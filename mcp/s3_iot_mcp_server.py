#!/usr/bin/env python3
"""
S-3 IOT: Model Context Protocol (MCP) Server
Compatible with:
- ChatGPT Custom GPT Actions (via HTTP/REST & OpenAPI 3.1)
- Claude Desktop / Cursor / Antigravity (via JSON-RPC 2.0 stdio transport)
Exposes physical telemetry, PyTorch neural state predictions, and sensor bias calibration.
"""

import os
import sys
import json
import urllib.request
import argparse

# Ensure utf-8 stdout/stdin
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

LOCAL_SERVER_URL = "http://localhost:3000"
FIREBASE_URL = "https://s3-skills-default-rtdb.firebaseio.com"

# Import our PyTorch inference engine
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml_engine"))
try:
    from inference import predict as pytorch_predict
except Exception as e:
    pytorch_predict = None

# MCP Tools Definitions
TOOLS_SCHEMA = [
    {
        "name": "get_live_telemetry",
        "description": "Returns real-time physical bench telemetry from the ESP32 (voltages, currents, power, and operating status) for the DC LED and 5V Water Pump Motor with zero-bias noise suppression.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_power_and_bill",
        "description": "Calculates real active total power (Watts), cumulative electrical energy (kWh), and projected 30-day electricity bill in Indian Rupees (INR) at ₹8.00 per kWh.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tariff_rate_inr": {
                    "type": "number",
                    "description": "Tariff rate in ₹ per kWh unit (defaults to 8.0)",
                    "default": 8.0
                }
            },
            "required": []
        }
    },
    {
        "name": "predict_electrical_anomaly",
        "description": "Queries the S-3 IOT PyTorch Transformer Neural Network to classify physical bench electrical states (IDLE, ACTIVE_LED, PUMP_RUNNING, INRUSH_SURGE, STALL_OVERLOAD, SENSOR_BIAS_ANOMALY).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "v_led": {"type": "number", "description": "Raw LED voltage in Volts (e.g. 1.18 or 4.63)"},
                "c_led": {"type": "number", "description": "Raw LED current in Amperes (e.g. 0.24 or 0.393)"},
                "v_pump": {"type": "number", "description": "Raw Pump voltage in Volts (e.g. 1.18 or 5.0)"},
                "c_pump": {"type": "number", "description": "Raw Pump current in Amperes (e.g. 0.14 or 1.85)"}
            },
            "required": []
        }
    },
    {
        "name": "get_sensor_bias_calibration",
        "description": "Returns the active physical sensor zero-bias calibration parameters (quiescent noise floors, floating voltage thresholds, and ACS712 midpoint offsets).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_hardware_pinout",
        "description": "Returns ESP32 pinout specifications, ADC1 channel assignments, sensor models (ACS712 5A & 100k/10k divider), and flyback diode circuit protections.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]

def fetch_local_telemetry():
    """Fetch live data from local server or fall back directly to Firebase."""
    try:
        req = urllib.request.Request(f"{LOCAL_SERVER_URL}/api/telemetry")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success"):
                return data["data"]
    except Exception:
        pass

    # Direct Firebase fallback
    try:
        req = urllib.request.Request(f"{FIREBASE_URL}/.json")
        with urllib.request.urlopen(req, timeout=3) as resp:
            fb = json.loads(resp.read().decode("utf-8"))
            live = fb.get("live", {})
            return {
                "live": live,
                "source": "firebase_direct"
            }
    except Exception as e:
        return {"error": str(e)}

# Tool Implementations
def tool_get_live_telemetry():
    tel = fetch_local_telemetry()
    return tel

def tool_get_power_and_bill(tariff_rate=8.0):
    tel = fetch_local_telemetry()
    overview = tel.get("systemOverview", {})
    p_w = overview.get("totalPowerWatts", 0.0)
    kwh = overview.get("cumulativeUnitsKwh", 0.0)
    cost = kwh * tariff_rate
    proj_units = (p_w / 1000.0) * 720.0
    proj_cost = proj_units * tariff_rate
    return {
        "active_power_watts": round(p_w, 3),
        "cumulative_energy_kwh": round(kwh, 6),
        "tariff_rate_inr": f"₹{tariff_rate}/Unit",
        "current_cost_inr": round(cost, 2),
        "projection_30_day": {
            "projected_units_kwh": round(proj_units, 2),
            "projected_bill_inr": round(proj_cost, 2),
            "basis": "720 hours continuous operation at instant active load"
        }
    }

def tool_predict_electrical_anomaly(v_led=None, c_led=None, v_pump=None, c_pump=None):
    if not pytorch_predict:
        return {"error": "PyTorch inference engine not initialized"}

    if v_led is None or c_led is None or v_pump is None or c_pump is None:
        tel = fetch_local_telemetry()
        live = tel.get("live", {})
        v_led = float(live.get("ledVoltage", 1.183))
        c_led = float(live.get("ledCurrent", 0.241))
        v_pump = float(live.get("waterPumpVoltage", live.get("motorVoltage", 1.183)))
        c_pump = float(live.get("waterPumpCurrent", live.get("motorCurrent", 0.138)))

    return pytorch_predict(float(v_led), float(c_led), float(v_pump), float(c_pump))

def tool_get_sensor_bias_calibration():
    return {
        "status": "ACTIVE_BIAS_REMOVAL",
        "description": "Eliminates phantom off-time readings (~1.18V and ~0.2A) from ACS712 midpoint drift and high-impedance divider floating noise.",
        "thresholds": {
            "voltage_noise_floor_volts": 2.0,
            "led_current_noise_floor_amperes": 0.28,
            "pump_current_noise_floor_amperes": 0.22,
            "zero_current_target": 0.000,
            "zero_voltage_target": 0.00
        },
        "hardware_sensors": {
            "current_sensor": "ACS712 5A Hall Effect (185 mV/A sensitivity, 10k/10k divider to ESP32 ADC)",
            "voltage_sensor": "100k / 10k Resistor Divider (10:1 ratio, 0-25V range)"
        }
    }

def tool_get_hardware_pinout():
    return {
        "microcontroller": "ESP32 DevKit V1 (30-pin, ADC1 only for Wi-Fi compatibility)",
        "physical_loads": [
            {
                "name": "DC LED Fixture",
                "current_pin": "GPIO 32 (ADC1_CH4 via ACS712-5A)",
                "voltage_pin": "GPIO 34 (ADC1_CH6 via 100k/10k Divider)",
                "nominal_rating": "5V DC / 0.393A (~1.82W)"
            },
            {
                "name": "5V DC Water Pump Motor",
                "current_pin": "GPIO 33 (ADC1_CH5 via ACS712-5A)",
                "voltage_pin": "GPIO 35 (ADC1_CH7 via 100k/10k Divider)",
                "protection": "1N4007 Flyback Diode across inductive pump terminals",
                "nominal_rating": "5V DC / 0.75A (~3.75W)",
                "inrush_surge_threshold": "1.2A - 2.5A",
                "stall_overload_threshold": "> 2.5A"
            }
        ],
        "important_note": "ONLY the DC LED and 5V Pump Motor are physically wired to the ESP32. There are NO simulated or mock appliances."
    }

def call_tool(name, arguments):
    if name == "get_live_telemetry":
        return tool_get_live_telemetry()
    elif name == "get_power_and_bill":
        return tool_get_power_and_bill(arguments.get("tariff_rate_inr", 8.0))
    elif name == "predict_electrical_anomaly":
        return tool_predict_electrical_anomaly(
            arguments.get("v_led"),
            arguments.get("c_led"),
            arguments.get("v_pump"),
            arguments.get("c_pump")
        )
    elif name == "get_sensor_bias_calibration":
        return tool_get_sensor_bias_calibration()
    elif name == "get_hardware_pinout":
        return tool_get_hardware_pinout()
    else:
        raise ValueError(f"Unknown tool: {name}")

# JSON-RPC 2.0 stdio MCP handler for Claude Desktop / Cursor
def run_stdio_mcp_server():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {})

            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {
                            "name": "s3-iot-mcp-server",
                            "version": "1.0.0"
                        },
                        "capabilities": {
                            "tools": {}
                        }
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": TOOLS_SCHEMA
                    }
                }
            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})
                tool_result = call_tool(tool_name, tool_args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(tool_result, indent=2)
                            }
                        ]
                    }
                }
            else:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method '{method}' not found"
                    }
                }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_res = {
                "jsonrpc": "2.0",
                "id": req.get("id") if 'req' in locals() else None,
                "error": {
                    "code": -32000,
                    "message": str(e)
                }
            }
            sys.stdout.write(json.dumps(err_res) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="S-3 IOT MCP Server")
    parser.add_argument("--test-tool", type=str, help="Execute a specific tool and print result")
    parser.add_argument("--args", type=str, default="{}", help="JSON arguments for tool testing")
    args = parser.parse_args()

    if args.test_tool:
        tool_args = json.loads(args.args)
        result = call_tool(args.test_tool, tool_args)
        print(json.dumps(result, indent=2))
    else:
        run_stdio_mcp_server()
