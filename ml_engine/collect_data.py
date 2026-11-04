"""
S-3 IOT: Firebase Historical Electrical Data Collector
Fetches live and minute-aggregate electrical data from Firebase RTDB:
https://s3-skills-default-rtdb.firebaseio.com/
Prepares clean time-series datasets for PyTorch model training.
"""

import os
import json
import urllib.request
import time

FIREBASE_URL = "https://s3-skills-default-rtdb.firebaseio.com"

# Physical Hardware Bench Calibration Constants
BIAS_CONFIG = {
    "voltage_noise_floor": 2.0,       # Voltages <= 2.0V when idle are floating sensor noise
    "led_current_noise_floor": 0.28,   # Current <= 0.28A when idle is ACS712 zero-point drift
    "pump_current_noise_floor": 0.22,  # Current <= 0.22A when idle is ACS712 zero-point drift
    "nominal_led_voltage": 5.0,
    "nominal_pump_voltage": 5.0
}

def fetch_firebase_json(path=""):
    url = f"{FIREBASE_URL}/{path.lstrip('/')}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "S3-IOT-PyTorch-Collector/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"[ERROR] Failed to fetch {url}: {e}")
        return None

def collect_and_build_dataset(output_path="ml_engine/data/firebase_electrical_dataset.json"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    print("Collecting telemetry data from Firebase RTDB...")

    root_data = fetch_firebase_json("")
    if not root_data or not isinstance(root_data, dict):
        print("[WARNING] Could not retrieve Firebase root data, building synthetic calibration dataset.")
        root_data = {}

    live = root_data.get("live", {})
    aggregates = root_data.get("aggregates", {})
    minute_aggs = aggregates.get("minute", {})
    hour_aggs = aggregates.get("hour", {})

    print(f"Loaded {len(minute_aggs)} minute buckets and {len(hour_aggs)} hour buckets from Firebase.")

    samples = []

    # 1. Process all minute buckets from Firebase
    for bucket_id, bucket in minute_aggs.items():
        if not isinstance(bucket, dict):
            continue

        led_c_stats = bucket.get("ledCurrent", {})
        led_v_stats = bucket.get("ledVoltage", {})
        pump_c_stats = bucket.get("waterPumpCurrent", {})
        pump_v_stats = bucket.get("waterPumpVoltage", {})

        c_led_avg = float(led_c_stats.get("average", 0.0))
        c_led_min = float(led_c_stats.get("minimum", 0.0))
        c_led_max = float(led_c_stats.get("maximum", 0.0))

        v_led_avg = float(led_v_stats.get("average", 0.0))
        v_led_min = float(led_v_stats.get("minimum", 0.0))
        v_led_max = float(led_v_stats.get("maximum", 0.0))

        c_pump_avg = float(pump_c_stats.get("average", 0.0))
        c_pump_min = float(pump_c_stats.get("minimum", 0.0))
        c_pump_max = float(pump_c_stats.get("maximum", 0.0))

        v_pump_avg = float(pump_v_stats.get("average", 0.0))
        v_pump_min = float(pump_v_stats.get("minimum", 0.0))
        v_pump_max = float(pump_v_stats.get("maximum", 0.0))

        # Generate representative data points for min, avg, max
        for (c_led, v_led, c_pump, v_pump, point_type) in [
            (c_led_avg, v_led_avg, c_pump_avg, v_pump_avg, "average"),
            (c_led_min, v_led_min, c_pump_min, v_pump_min, "minimum"),
            (c_led_max, v_led_max, c_pump_max, v_pump_max, "maximum")
        ]:
            # Apply Bias Elimination Logic
            is_led_idle = (c_led <= BIAS_CONFIG["led_current_noise_floor"]) or (v_led <= BIAS_CONFIG["voltage_noise_floor"])
            is_pump_idle = (c_pump <= BIAS_CONFIG["pump_current_noise_floor"]) or (v_pump <= BIAS_CONFIG["voltage_noise_floor"])

            # Clean/Calibrated values
            cal_led_c = 0.0 if is_led_idle else c_led
            cal_led_v = 0.0 if is_led_idle else v_led
            cal_pump_c = 0.0 if is_pump_idle else c_pump
            cal_pump_v = 0.0 if is_pump_idle else v_pump

            power_led = cal_led_v * cal_led_c
            power_pump = cal_pump_v * cal_pump_c
            total_power = power_led + power_pump

            # Labeling for State Classification:
            # 0: BENCH_IDLE_OFF
            # 1: LED_ACTIVE
            # 2: PUMP_NORMAL_RUNNING
            # 3: PUMP_STARTUP_INRUSH
            # 4: PUMP_STALL_OVERLOAD
            # 5: SENSOR_BIAS_ANOMALY
            if c_pump > 2.5:
                state_label = 4  # PUMP_STALL_OVERLOAD
                state_name = "PUMP_STALL_OVERLOAD"
            elif c_pump > 1.2:
                state_label = 3  # PUMP_STARTUP_INRUSH
                state_name = "PUMP_STARTUP_INRUSH"
            elif not is_pump_idle and c_pump > 0.3:
                state_label = 2  # PUMP_NORMAL_RUNNING
                state_name = "PUMP_NORMAL_RUNNING"
            elif not is_led_idle and c_led > 0.28:
                state_label = 1  # LED_ACTIVE
                state_name = "LED_ACTIVE"
            elif (v_led > 0.8 and v_led < 2.0) or (c_led > 0.1 and c_led < 0.28):
                state_label = 5  # SENSOR_BIAS_ANOMALY (floating 1.18V or 0.2A zero drift)
                state_name = "SENSOR_BIAS_ANOMALY"
            else:
                state_label = 0  # BENCH_IDLE_OFF
                state_name = "BENCH_IDLE_OFF"

            samples.append({
                "bucket_id": bucket_id,
                "point_type": point_type,
                "raw_led_v": round(v_led, 3),
                "raw_led_c": round(c_led, 3),
                "raw_pump_v": round(v_pump, 3),
                "raw_pump_c": round(c_pump, 3),
                "cal_led_v": round(cal_led_v, 3),
                "cal_led_c": round(cal_led_c, 3),
                "cal_pump_v": round(cal_pump_v, 3),
                "cal_pump_c": round(cal_pump_c, 3),
                "power_watts": round(total_power, 3),
                "state_label": state_label,
                "state_name": state_name
            })

    # 2. Add bench scenario boundary cases for robust generalization (Inrush & Stall)
    augmented_cases = [
        # Idle off cases with 1.18V & 0.2A sensor bias
        {"raw_led_v": 1.18, "raw_led_c": 0.24, "raw_pump_v": 1.18, "raw_pump_c": 0.19, "state": 5, "name": "SENSOR_BIAS_ANOMALY"},
        {"raw_led_v": 1.18, "raw_led_c": 0.27, "raw_pump_v": 1.18, "raw_pump_c": 0.14, "state": 5, "name": "SENSOR_BIAS_ANOMALY"},
        {"raw_led_v": 0.0, "raw_led_c": 0.0, "raw_pump_v": 0.0, "raw_pump_c": 0.0, "state": 0, "name": "BENCH_IDLE_OFF"},
        # LED ON (4.63V / 0.393A)
        {"raw_led_v": 4.63, "raw_led_c": 0.393, "raw_pump_v": 1.18, "raw_pump_c": 0.14, "state": 1, "name": "LED_ACTIVE"},
        {"raw_led_v": 5.05, "raw_led_c": 0.410, "raw_pump_v": 0.0, "raw_pump_c": 0.0, "state": 1, "name": "LED_ACTIVE"},
        # Pump Normal (4.8V / 0.75A)
        {"raw_led_v": 4.63, "raw_led_c": 0.393, "raw_pump_v": 4.85, "raw_pump_c": 0.72, "state": 2, "name": "PUMP_NORMAL_RUNNING"},
        {"raw_led_v": 0.0, "raw_led_c": 0.0, "raw_pump_v": 4.90, "raw_pump_c": 0.85, "state": 2, "name": "PUMP_NORMAL_RUNNING"},
        # Startup inrush transients (1.85A peak)
        {"raw_led_v": 4.63, "raw_led_c": 0.393, "raw_pump_v": 4.70, "raw_pump_c": 1.85, "state": 3, "name": "PUMP_STARTUP_INRUSH"},
        {"raw_led_v": 1.18, "raw_led_c": 0.20, "raw_pump_v": 4.60, "raw_pump_c": 1.95, "state": 3, "name": "PUMP_STARTUP_INRUSH"},
        # Motor stall jam overloads (3.2A peak)
        {"raw_led_v": 4.63, "raw_led_c": 0.393, "raw_pump_v": 4.40, "raw_pump_c": 3.20, "state": 4, "name": "PUMP_STALL_OVERLOAD"},
        {"raw_led_v": 1.18, "raw_led_c": 0.15, "raw_pump_v": 4.30, "raw_pump_c": 3.45, "state": 4, "name": "PUMP_STALL_OVERLOAD"}
    ]

    for c in augmented_cases:
        v_led, c_led = c["raw_led_v"], c["raw_led_c"]
        v_pump, c_pump = c["raw_pump_v"], c["raw_pump_c"]
        is_led_idle = (c_led <= BIAS_CONFIG["led_current_noise_floor"]) or (v_led <= BIAS_CONFIG["voltage_noise_floor"])
        is_pump_idle = (c_pump <= BIAS_CONFIG["pump_current_noise_floor"]) or (v_pump <= BIAS_CONFIG["voltage_noise_floor"])
        cal_led_c = 0.0 if is_led_idle else c_led
        cal_led_v = 0.0 if is_led_idle else v_led
        cal_pump_c = 0.0 if is_pump_idle else c_pump
        cal_pump_v = 0.0 if is_pump_idle else v_pump
        p_tot = (cal_led_v * cal_led_c) + (cal_pump_v * cal_pump_c)

        for _ in range(4): # duplicate for balanced distribution
            samples.append({
                "bucket_id": "augmented_physics",
                "point_type": "boundary_case",
                "raw_led_v": v_led,
                "raw_led_c": c_led,
                "raw_pump_v": v_pump,
                "raw_pump_c": c_pump,
                "cal_led_v": cal_led_v,
                "cal_led_c": cal_led_c,
                "cal_pump_v": cal_pump_v,
                "cal_pump_c": cal_pump_c,
                "power_watts": round(p_tot, 3),
                "state_label": c["state"],
                "state_name": c["name"]
            })

    output_data = {
        "timestamp": int(time.time()),
        "source": FIREBASE_URL,
        "sample_count": len(samples),
        "bias_config": BIAS_CONFIG,
        "classes": [
            "BENCH_IDLE_OFF",
            "LED_ACTIVE",
            "PUMP_NORMAL_RUNNING",
            "PUMP_STARTUP_INRUSH",
            "PUMP_STALL_OVERLOAD",
            "SENSOR_BIAS_ANOMALY"
        ],
        "samples": samples
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"Dataset successfully compiled! Saved {len(samples)} samples to {output_path}")
    return output_data

if __name__ == "__main__":
    collect_and_build_dataset()

