"""
S-3 IOT: Autonomous Continuous Online Learning Pipeline
Periodically or incrementally ingests incoming Firebase RTDB telemetry,
maintains an experience replay buffer to prevent catastrophic forgetting,
runs fine-tuning epochs on S3ElectricalTransformer weights,
evaluates updated accuracy and loss, and saves new checkpoints.
"""

import os
import sys
import json
import time
import argparse
import urllib.request

# Ensure UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import TensorDataset, DataLoader, random_split

# Add ml_engine directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from model import S3ElectricalTransformer

FIREBASE_URL = "https://s3-skills-default-rtdb.firebaseio.com"
DATASET_PATH = os.path.join(BASE_DIR, "data", "firebase_electrical_dataset.json")
BUFFER_PATH = os.path.join(BASE_DIR, "data", "continuous_replay_buffer.json")
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "s3_iot_model.pth")
HISTORY_PATH = os.path.join(WEIGHTS_DIR, "learning_history.json")
METRICS_PATH = os.path.join(WEIGHTS_DIR, "training_metrics.json")

BIAS_CONFIG = {
    "voltage_noise_floor": 2.0,
    "led_current_noise_floor": 0.28,
    "pump_current_noise_floor": 0.22,
    "nominal_led_voltage": 5.0,
    "nominal_pump_voltage": 5.0
}

CLASS_NAMES = [
    "BENCH_IDLE_OFF",
    "LED_ACTIVE",
    "PUMP_NORMAL_RUNNING",
    "PUMP_STARTUP_INRUSH",
    "PUMP_STALL_OVERLOAD",
    "SENSOR_BIAS_ANOMALY"
]

def fetch_firebase_root():
    url = f"{FIREBASE_URL}/.json"
    req = urllib.request.Request(url, headers={"User-Agent": "S3-IOT-Continuous-Learner/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[WARN] Failed to fetch Firebase: {e}", file=sys.stderr)
        return None

def initialize_replay_buffer():
    os.makedirs(os.path.dirname(BUFFER_PATH), exist_ok=True)
    if os.path.exists(BUFFER_PATH):
        try:
            with open(BUFFER_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Initialize from baseline dataset if available
    initial_samples = []
    if os.path.exists(DATASET_PATH):
        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                base_data = json.load(f)
                initial_samples = base_data.get("samples", [])
        except Exception:
            pass

    buffer_data = {
        "created_at": time.time(),
        "total_cycles_completed": 0,
        "samples": initial_samples
    }
    with open(BUFFER_PATH, "w", encoding="utf-8") as f:
        json.dump(buffer_data, f, indent=2)
    return buffer_data

def extract_sample_from_telemetry(v_led, c_led, v_pump, c_pump, timestamp=None):
    if timestamp is None:
        timestamp = int(time.time())

    is_led_idle = (c_led <= BIAS_CONFIG["led_current_noise_floor"]) or (v_led <= BIAS_CONFIG["voltage_noise_floor"])
    is_pump_idle = (c_pump <= BIAS_CONFIG["pump_current_noise_floor"]) or (v_pump <= BIAS_CONFIG["voltage_noise_floor"])

    cal_led_c = 0.0 if is_led_idle else c_led
    cal_led_v = 0.0 if is_led_idle else v_led
    cal_pump_c = 0.0 if is_pump_idle else c_pump
    cal_pump_v = 0.0 if is_pump_idle else v_pump

    power_watts = (cal_led_v * cal_led_c) + (cal_pump_v * cal_pump_c)

    # State classification label
    if is_led_idle and is_pump_idle:
        if (v_led > 0.5 or c_led > 0.05 or v_pump > 0.5 or c_pump > 0.05):
            state_label = 5 # SENSOR_BIAS_ANOMALY
        else:
            state_label = 0 # BENCH_IDLE_OFF
    elif is_led_idle and not is_pump_idle:
        if c_pump > 2.5:
            state_label = 4 # PUMP_STALL_OVERLOAD
        elif c_pump >= 1.2:
            state_label = 3 # PUMP_STARTUP_INRUSH
        else:
            state_label = 2 # PUMP_NORMAL_RUNNING
    elif not is_led_idle and is_pump_idle:
        state_label = 1 # LED_ACTIVE
    else:
        # Both active
        if c_pump > 2.5:
            state_label = 4
        elif c_pump >= 1.2:
            state_label = 3
        else:
            state_label = 2

    return {
        "timestamp": timestamp,
        "raw_led_v": round(float(v_led), 4),
        "raw_led_c": round(float(c_led), 4),
        "raw_pump_v": round(float(v_pump), 4),
        "raw_pump_c": round(float(c_pump), 4),
        "cal_led_v": round(float(cal_led_v), 4),
        "cal_led_c": round(float(cal_led_c), 4),
        "cal_pump_v": round(float(cal_pump_v), 4),
        "cal_pump_c": round(float(cal_pump_c), 4),
        "power_watts": round(float(power_watts), 4),
        "state_label": state_label,
        "state_name": CLASS_NAMES[state_label]
    }

def ingest_latest_telemetry(buffer_data):
    root = fetch_firebase_root()
    if not root:
        return 0

    existing_samples = buffer_data.get("samples", [])
    # Track existing signatures to avoid duplicate spam: (round(v_led, 2), round(c_led, 2), round(v_pump, 2), round(c_pump, 2), state_label)
    signatures = set()
    for s in existing_samples[-100:]:
        sig = (round(s["raw_led_v"], 2), round(s["raw_led_c"], 2), round(s["raw_pump_v"], 2), round(s["raw_pump_c"], 2), s["state_label"])
        signatures.add(sig)

    new_count = 0

    # 1. Check live telemetry
    live = root.get("live", {})
    if live and isinstance(live, dict):
        v_led = float(live.get("ledVoltage", live.get("voltage", 0.0)))
        c_led = float(live.get("ledCurrent", live.get("current", 0.0)))
        v_pump = float(live.get("waterPumpVoltage", live.get("motorVoltage", 0.0)))
        c_pump = float(live.get("waterPumpCurrent", live.get("motorCurrent", 0.0)))
        ts = int(live.get("timestamp", time.time()))

        sample = extract_sample_from_telemetry(v_led, c_led, v_pump, c_pump, ts)
        sig = (round(sample["raw_led_v"], 2), round(sample["raw_led_c"], 2), round(sample["raw_pump_v"], 2), round(sample["raw_pump_c"], 2), sample["state_label"])
        if sig not in signatures:
            existing_samples.append(sample)
            signatures.add(sig)
            new_count += 1

    # 2. Check minute aggregates
    minute_aggs = root.get("aggregates", {}).get("minute", {})
    if isinstance(minute_aggs, dict):
        for bucket_id, bucket in list(minute_aggs.items())[-20:]:
            if not isinstance(bucket, dict):
                continue
            led_c = float(bucket.get("ledCurrent", {}).get("average", 0.0))
            led_v = float(bucket.get("ledVoltage", {}).get("average", 0.0))
            pump_c = float(bucket.get("waterPumpCurrent", {}).get("average", 0.0))
            pump_v = float(bucket.get("waterPumpVoltage", {}).get("average", 0.0))

            sample = extract_sample_from_telemetry(led_v, led_c, pump_v, pump_c)
            sig = (round(sample["raw_led_v"], 2), round(sample["raw_led_c"], 2), round(sample["raw_pump_v"], 2), round(sample["raw_pump_c"], 2), sample["state_label"])
            if sig not in signatures:
                existing_samples.append(sample)
                signatures.add(sig)
                new_count += 1

    # Maintain maximum replay buffer size (e.g. 1000 samples)
    if len(existing_samples) > 1000:
        # Keep anchor baseline samples (first 50) + most recent 950
        existing_samples = existing_samples[:50] + existing_samples[-950:]

    buffer_data["samples"] = existing_samples
    buffer_data["last_ingested_at"] = time.time()
    return new_count

def prepare_tensors(samples):
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

        feat = [v_led, c_led, v_pump, c_pump, p_led_raw, p_pump_raw]
        features.append(feat)

        labels.append(s["state_label"])
        powers.append(s["power_watts"])

        v_led_bias = max(0.0, v_led - s["cal_led_v"])
        c_led_bias = max(0.0, c_led - s["cal_led_c"])
        v_pump_bias = max(0.0, v_pump - s["cal_pump_v"])
        c_pump_bias = max(0.0, c_pump - s["cal_pump_c"])
        biases.append([v_led_bias, c_led_bias, v_pump_bias, c_pump_bias])

    X = torch.tensor(features, dtype=torch.float32)
    y_class = torch.tensor(labels, dtype=torch.long)
    y_power = torch.tensor(powers, dtype=torch.float32)
    y_bias = torch.tensor(biases, dtype=torch.float32)

    return X, y_class, y_power, y_bias

def run_continuous_learning_cycle(epochs=8, lr=0.0005):
    start_time = time.time()
    os.makedirs(WEIGHTS_DIR, exist_ok=True)

    buffer_data = initialize_replay_buffer()
    new_samples_added = ingest_latest_telemetry(buffer_data)

    samples = buffer_data.get("samples", [])
    if len(samples) < 10:
        return {
            "success": False,
            "error": "Not enough samples to learn."
        }

    X, y_class, y_power, y_bias = prepare_tensors(samples)

    dataset = TensorDataset(X, y_class, y_power, y_bias)
    train_size = int(0.85 * len(dataset))
    val_size = len(dataset) - train_size
    train_set, val_set = random_split(dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42))

    train_loader = DataLoader(train_set, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=16, shuffle=False)

    # Initialize model
    model = S3ElectricalTransformer(input_dim=6, d_model=64, nhead=4, num_classes=len(CLASS_NAMES), dropout=0.1)

    # Load previous weights if available to continue learning incrementally!
    if os.path.exists(MODEL_PATH):
        try:
            checkpoint = torch.load(MODEL_PATH, map_location=torch.device('cpu'), weights_only=False)
            model.load_state_dict(checkpoint["model_state_dict"])
        except Exception as e:
            print(f"[WARN] Failed to load existing weights, starting from scratch: {e}", file=sys.stderr)

    criterion_class = nn.CrossEntropyLoss()
    criterion_mse = nn.MSELoss()
    # Fine-tuning learning rate (gentle to preserve established knowledge)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    model.train()
    total_loss = 0.0

    for epoch in range(1, epochs + 1):
        for batch_x, batch_y_c, batch_y_p, batch_y_b in train_loader:
            optimizer.zero_grad()
            out = model(batch_x)

            loss_c = criterion_class(out["logits"], batch_y_c)
            loss_p = criterion_mse(out["predicted_power"], batch_y_p)
            loss_b = criterion_mse(out["predicted_bias"], batch_y_b)

            loss = loss_c + 0.4 * loss_p + 0.3 * loss_b
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

    # Validation evaluation
    model.eval()
    val_correct = 0
    val_total = 0
    val_loss = 0.0

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

    cycle_num = buffer_data.get("total_cycles_completed", 0) + 1
    buffer_data["total_cycles_completed"] = cycle_num

    # Save updated buffer
    with open(BUFFER_PATH, "w", encoding="utf-8") as f:
        json.dump(buffer_data, f, indent=2)

    # Save updated model weights
    torch.save({
        "model_state_dict": model.state_dict(),
        "input_dim": 6,
        "d_model": 64,
        "nhead": 4,
        "num_classes": len(CLASS_NAMES),
        "class_names": CLASS_NAMES,
        "final_accuracy": val_acc,
        "learning_cycle": cycle_num,
        "trained_timestamp": int(time.time()),
        "torch_version": torch.__version__
    }, MODEL_PATH)

    elapsed_sec = round(time.time() - start_time, 2)

    # Update learning history
    history = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass

    history_entry = {
        "cycle": cycle_num,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "new_samples_added": new_samples_added,
        "total_buffer_samples": len(samples),
        "epochs_trained": epochs,
        "learning_rate": lr,
        "val_accuracy": round(val_acc, 2),
        "val_loss": round(avg_val_loss, 4),
        "duration_seconds": elapsed_sec,
        "status": "CONVERGED_SUCCESS"
    }
    history.append(history_entry)
    # Keep last 100 cycles in history
    if len(history) > 100:
        history = history[-100:]

    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # Also update metrics summary for compatibility
    metrics_summary = {
        "success": True,
        "model_name": "S3ElectricalTransformer",
        "framework": f"PyTorch {torch.__version__}",
        "dataset_samples": len(samples),
        "learning_cycle": cycle_num,
        "epochs": epochs,
        "training_time_seconds": elapsed_sec,
        "final_val_accuracy": round(val_acc, 2),
        "classes": CLASS_NAMES,
        "last_learned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    return {
        "success": True,
        "cycle": cycle_num,
        "new_samples_added": new_samples_added,
        "total_buffer_samples": len(samples),
        "val_accuracy": round(val_acc, 2),
        "val_loss": round(avg_val_loss, 4),
        "duration_seconds": elapsed_sec,
        "timestamp": history_entry["timestamp"]
    }

def main():
    parser = argparse.ArgumentParser(description="S-3 IOT Autonomous Continuous Learning Engine")
    parser.add_argument("--once", action="store_true", help="Run a single incremental learning cycle and output JSON")
    parser.add_argument("--interval", type=int, default=300, help="Continuous loop interval in seconds (default: 300s / 5min)")
    parser.add_argument("--epochs", type=int, default=8, help="Fine-tuning epochs per cycle")
    parser.add_argument("--lr", type=float, default=0.0005, help="Learning rate for incremental fine-tuning")

    args = parser.parse_args()

    if args.once:
        result = run_continuous_learning_cycle(epochs=args.epochs, lr=args.lr)
        print(json.dumps(result))
        return

    print("=" * 65)
    print(f"🔄 S-3 IOT: Starting Autonomous Continuous Learning Loop")
    print(f"   Interval: Every {args.interval}s ({args.interval / 60:.1f} minutes)")
    print(f"   Fine-tuning Epochs: {args.epochs} | Learning Rate: {args.lr}")
    print(f"   Model Weights: {MODEL_PATH}")
    print("=" * 65)

    while True:
        try:
            print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Executing incremental learning pass...")
            result = run_continuous_learning_cycle(epochs=args.epochs, lr=args.lr)
            if result.get("success"):
                print(f"   ✓ Learning Cycle #{result['cycle']} Complete in {result['duration_seconds']}s")
                print(f"   ✓ Ingested {result['new_samples_added']} new samples | Total Replay Buffer: {result['total_buffer_samples']}")
                print(f"   ✓ Updated Validation Accuracy: {result['val_accuracy']}% | Loss: {result['val_loss']}")
            else:
                print(f"   ✗ Learning pass notice: {result.get('error')}")
        except Exception as e:
            print(f"   ✗ Error during learning pass: {e}", file=sys.stderr)

        time.sleep(args.interval)

if __name__ == "__main__":
    main()

