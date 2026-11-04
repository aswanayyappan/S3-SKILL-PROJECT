"""
S-3 IOT: PyTorch Training Pipeline
Trains the S3ElectricalTransformer model on the Firebase historical electrical dataset.
Saves model weights to ml_engine/weights/s3_iot_model.pth
"""

import os
import sys
import json
import time

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split
from model import S3ElectricalTransformer

DATASET_PATH = "ml_engine/data/firebase_electrical_dataset.json"
WEIGHTS_DIR = "ml_engine/weights"
MODEL_PATH = os.path.join(WEIGHTS_DIR, "s3_iot_model.pth")
METRICS_PATH = os.path.join(WEIGHTS_DIR, "training_metrics.json")

def load_data(filepath=DATASET_PATH):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset not found at {filepath}. Run collect_data.py first!")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    samples = data["samples"]
    features = []
    labels = []
    powers = []
    biases = []

    for s in samples:
        v_led = s["raw_led_v"]
        c_led = s["raw_led_c"]
        v_pump = s["raw_pump_v"]
        c_pump = s["raw_pump_c"]
        p_led_raw = v_led * c_led
        p_pump_raw = v_pump * c_pump

        # 6 input features
        feat = [v_led, c_led, v_pump, c_pump, p_led_raw, p_pump_raw]
        features.append(feat)

        labels.append(s["state_label"])
        powers.append(s["power_watts"])

        # Ground truth bias error: (raw - cal)
        v_led_bias = max(0.0, v_led - s["cal_led_v"])
        c_led_bias = max(0.0, c_led - s["cal_led_c"])
        v_pump_bias = max(0.0, v_pump - s["cal_pump_v"])
        c_pump_bias = max(0.0, c_pump - s["cal_pump_c"])
        biases.append([v_led_bias, c_led_bias, v_pump_bias, c_pump_bias])

    X = torch.tensor(features, dtype=torch.float32)
    y_class = torch.tensor(labels, dtype=torch.long)
    y_power = torch.tensor(powers, dtype=torch.float32)
    y_bias = torch.tensor(biases, dtype=torch.float32)

    return X, y_class, y_power, y_bias, data["classes"]

def train():
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    print("=" * 60)
    print("[START] S-3 IOT: PyTorch Model Training on Real Firebase Telemetry")
    print("=" * 60)

    X, y_class, y_power, y_bias, class_names = load_data()
    print(f"Loaded {len(X)} training samples with {X.shape[1]} electrical features.")
    print(f"Classes: {class_names}")

    dataset = TensorDataset(X, y_class, y_power, y_bias)
    train_size = int(0.85 * len(dataset))
    val_size = len(dataset) - train_size
    train_set, val_set = random_split(dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42))

    train_loader = DataLoader(train_set, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False)

    model = S3ElectricalTransformer(input_dim=6, d_model=64, nhead=4, num_classes=len(class_names), dropout=0.1)

    criterion_class = nn.CrossEntropyLoss()
    criterion_mse = nn.MSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=35)

    epochs = 35
    history = []

    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        correct = 0
        total = 0

        for batch_x, batch_y_c, batch_y_p, batch_y_b in train_loader:
            optimizer.zero_grad()
            out = model(batch_x)

            loss_c = criterion_class(out["logits"], batch_y_c)
            loss_p = criterion_mse(out["predicted_power"], batch_y_p)
            loss_b = criterion_mse(out["predicted_bias"], batch_y_b)

            loss = loss_c + 0.4 * loss_p + 0.3 * loss_b
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * batch_x.size(0)
            preds = torch.argmax(out["probabilities"], dim=1)
            correct += (preds == batch_y_c).sum().item()
            total += batch_y_c.size(0)

        scheduler.step()
        train_acc = (correct / total) * 100
        avg_train_loss = train_loss / total

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for vx, vy_c, vy_p, vy_b in val_loader:
                vout = model(vx)
                vloss = criterion_class(vout["logits"], vy_c) + 0.4 * criterion_mse(vout["predicted_power"], vy_p)
                val_loss += vloss.item() * vx.size(0)
                vpreds = torch.argmax(vout["probabilities"], dim=1)
                val_correct += (vpreds == vy_c).sum().item()
                val_total += vy_c.size(0)

        val_acc = (val_correct / val_total) * 100 if val_total > 0 else 100.0
        avg_val_loss = val_loss / val_total if val_total > 0 else 0.0

        if epoch % 5 == 0 or epoch == epochs:
            print(f"Epoch [{epoch:02d}/{epochs:02d}] | Train Loss: {avg_train_loss:.4f} | Train Acc: {train_acc:.1f}% | Val Loss: {avg_val_loss:.4f} | Val Acc: {val_acc:.1f}%")

        history.append({
            "epoch": epoch,
            "train_loss": round(avg_train_loss, 4),
            "train_acc": round(train_acc, 2),
            "val_loss": round(avg_val_loss, 4),
            "val_acc": round(val_acc, 2)
        })

    elapsed = round(time.time() - start_time, 2)
    print(f"\n[SUCCESS] PyTorch Training Complete in {elapsed}s!")
    print(f"Final Validation Accuracy: {val_acc:.2f}%")

    # Save model weights
    torch.save({
        "model_state_dict": model.state_dict(),
        "input_dim": 6,
        "d_model": 64,
        "nhead": 4,
        "num_classes": len(class_names),
        "class_names": class_names,
        "final_accuracy": val_acc,
        "trained_timestamp": int(time.time()),
        "torch_version": torch.__version__
    }, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

    # Save metrics JSON for the Web UI
    metrics_summary = {
        "success": True,
        "model_name": "S3ElectricalTransformer",
        "framework": f"PyTorch {torch.__version__}",
        "dataset_samples": len(X),
        "epochs": epochs,
        "training_time_seconds": elapsed,
        "final_train_accuracy": round(train_acc, 2),
        "final_val_accuracy": round(val_acc, 2),
        "classes": class_names,
        "history": history
    }

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"Metrics saved to {METRICS_PATH}")

if __name__ == "__main__":
    train()
