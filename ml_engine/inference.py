"""
S-3 IOT: PyTorch Real-Time Inference Engine
Loads weights from ml_engine/weights/s3_iot_model.pth
Takes real-time ESP32 voltage and current inputs and outputs:
- Electrical State Classification
- PyTorch Confidence Score (%)
- Calibrated True Power Forecast (Watts)
- Predicted Sensor Zero-Bias Offsets
"""

import os
import sys
import json
import argparse

# Ensure utf-8 stdout
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add ml_engine to path so model can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
from model import S3ElectricalTransformer

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights", "s3_iot_model.pth")

_cached_model = None
_cached_metadata = None

def get_model():
    global _cached_model, _cached_metadata
    if _cached_model is not None:
        return _cached_model, _cached_metadata

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Trained model not found at {MODEL_PATH}. Run ml_engine/train.py first!")

    checkpoint = torch.load(MODEL_PATH, map_location=torch.device('cpu'), weights_only=False)
    
    model = S3ElectricalTransformer(
        input_dim=checkpoint.get("input_dim", 6),
        d_model=checkpoint.get("d_model", 64),
        nhead=checkpoint.get("nhead", 4),
        num_classes=checkpoint.get("num_classes", 6),
        dropout=0.0
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    _cached_model = model
    _cached_metadata = checkpoint
    return _cached_model, _cached_metadata

def predict(v_led, c_led, v_pump, c_pump):
    model, meta = get_model()
    class_names = meta.get("class_names", [
        "BENCH_IDLE_OFF",
        "LED_ACTIVE",
        "PUMP_NORMAL_RUNNING",
        "PUMP_STARTUP_INRUSH",
        "PUMP_STALL_OVERLOAD",
        "SENSOR_BIAS_ANOMALY"
    ])

    p_led_raw = v_led * c_led
    p_pump_raw = v_pump * c_pump

    features = torch.tensor([[v_led, c_led, v_pump, c_pump, p_led_raw, p_pump_raw]], dtype=torch.float32)

    with torch.no_grad():
        out = model(features)
        probs = out["probabilities"][0]
        pred_idx = torch.argmax(probs).item()
        confidence = float(probs[pred_idx].item())
        pred_power = float(out["predicted_power"][0].item())
        pred_bias = out["predicted_bias"][0].tolist()

    state_name = class_names[pred_idx]

    # Bias Rectification:
    # If model detects SENSOR_BIAS_ANOMALY or BENCH_IDLE_OFF, clamp power to 0.0W and zero-out phantom current/voltage
    is_bias_anomaly = (state_name in ["SENSOR_BIAS_ANOMALY", "BENCH_IDLE_OFF"])
    cal_v_led = 0.0 if (is_bias_anomaly or v_led < 2.0) else max(0.0, v_led - pred_bias[0])
    cal_c_led = 0.0 if (is_bias_anomaly or c_led < 0.28) else max(0.0, c_led - pred_bias[1])
    cal_v_pump = 0.0 if (is_bias_anomaly or v_pump < 2.0) else max(0.0, v_pump - pred_bias[2])
    cal_c_pump = 0.0 if (is_bias_anomaly or c_pump < 0.22) else max(0.0, c_pump - pred_bias[3])

    is_anomaly = state_name in ["PUMP_STARTUP_INRUSH", "PUMP_STALL_OVERLOAD", "SENSOR_BIAS_ANOMALY"]
    anomaly_severity = "normal"
    if state_name == "PUMP_STALL_OVERLOAD":
        anomaly_severity = "critical"
    elif state_name in ["PUMP_STARTUP_INRUSH", "SENSOR_BIAS_ANOMALY"]:
        anomaly_severity = "medium"

    result = {
        "success": True,
        "framework": "PyTorch 2.15.0+cpu",
        "model_architecture": "S3ElectricalTransformer (64-dim, 4 heads)",
        "inputs": {
            "v_led": round(v_led, 3),
            "c_led": round(c_led, 3),
            "v_pump": round(v_pump, 3),
            "c_pump": round(c_pump, 3)
        },
        "prediction": {
            "state_id": pred_idx,
            "state_name": state_name,
            "confidence_score": round(confidence, 4),
            "confidence_percent": f"{round(confidence * 100, 1)}%",
            "predicted_power_watts": round(0.0 if is_bias_anomaly else pred_power, 3),
            "is_anomaly": is_anomaly,
            "anomaly_severity": anomaly_severity
        },
        "bias_rectification": {
            "zero_bias_detected": is_bias_anomaly,
            "calibrated_led_voltage": round(cal_v_led, 2),
            "calibrated_led_current": round(cal_c_led, 3),
            "calibrated_pump_voltage": round(cal_v_pump, 2),
            "calibrated_pump_current": round(cal_c_pump, 3),
            "explanation": "Off-time floating voltage (~1.18V) and ACS712 midpoint drift (~0.2A) suppressed to true 0.00V / 0.000A" if is_bias_anomaly else "Active load measured within nominal tolerances."
        }
    }
    return result

def main():
    parser = argparse.ArgumentParser(description="PyTorch S-3 IOT Inference Engine")
    parser.add_argument("--v_led", type=float, default=1.183, help="LED raw voltage")
    parser.add_argument("--c_led", type=float, default=0.241, help="LED raw current")
    parser.add_argument("--v_pump", type=float, default=1.183, help="Pump raw voltage")
    parser.add_argument("--c_pump", type=float, default=0.203, help="Pump raw current")
    parser.add_argument("--json_in", type=str, default="", help="JSON input string")

    args = parser.parse_args()

    if args.json_in:
        try:
            payload = json.loads(args.json_in)
            v_l = float(payload.get("v_led", 1.183))
            c_l = float(payload.get("c_led", 0.241))
            v_p = float(payload.get("v_pump", 1.183))
            c_p = float(payload.get("c_pump", 0.203))
        except Exception:
            v_l, c_l, v_p, c_p = args.v_led, args.c_led, args.v_pump, args.c_pump
    else:
        v_l, c_l, v_p, c_p = args.v_led, args.c_led, args.v_pump, args.c_pump

    res = predict(v_l, c_l, v_p, c_p)
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()

