import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://s3-skills-default-rtdb.firebaseio.com/';
const FIREBASE_AUTH_SECRET = process.env.FIREBASE_AUTH_SECRET || '';

// Tariff rate: ₹8.00 per unit (1 Unit = 1 kWh)
const TARIFF_RATE_PER_UNIT = 8.00;

// Maximum physically valid DC current threshold for ACS712-5A (reject noise spikes > 6A)
const MAX_VALID_DC_CURRENT = 6.0; // Amperes
const MIN_VALID_VOLTAGE = 0.0;
const MAX_VALID_VOLTAGE = 35.0; // Low-voltage DC bench testing

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// PERSISTENT ACCUMULATOR STORAGE (Survives Render Restarts)
// ========================================================
const STATE_FILE = path.join(__dirname, 'accumulator_state.json');

function loadAccumulatorState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        accumulatedLedKwh: Number(data.accumulatedLedKwh) || 0,
        accumulatedMotorKwh: Number(data.accumulatedMotorKwh ?? data.accumulatedPumpKwh) || 0,
        lastTimestampMs: Number(data.lastTimestampMs) || 0,
        lastLedPowerW: Number(data.lastLedPowerW) || 0,
        lastMotorPowerW: Number(data.lastMotorPowerW ?? data.lastPumpPowerW) || 0,
        firstTimestampMs: Number(data.firstTimestampMs) || 0
      };
    }
  } catch (err) {
    console.error('Error loading accumulator state:', err.message);
  }
  return {
    accumulatedLedKwh: 0,
    accumulatedMotorKwh: 0,
    lastTimestampMs: 0,
    lastLedPowerW: 0,
    lastMotorPowerW: 0,
    firstTimestampMs: 0
  };
}

let accumulatorState = loadAccumulatorState();

function saveAccumulatorState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(accumulatorState, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving accumulator state:', err.message);
  }
}

// Trapezoidal energy integration using exact elapsed milliseconds
function integrateEnergy(prevPowerW, currPowerW, elapsedMs) {
  if (elapsedMs <= 0 || elapsedMs > 60000) {
    return 0; // Reject stale or negative time deltas
  }
  const avgPowerW = (prevPowerW + currPowerW) / 2;
  // Convert W * ms to kWh: divide by 1000 (W->kW) * 3600 (s->h) * 1000 (ms->s) = 3,600,000,000
  return (avgPowerW * elapsedMs) / 3600000000;
}

// In-memory telemetry cache
let telemetryCache = {
  live: {
    ledCurrent: 0,
    ledVoltage: 0,
    motorCurrent: 0,
    motorVoltage: 0,
    timestamp: Date.now()
  },
  aggregatesSummary: {
    totalSamples: 0,
    bucketsCount: 0,
    ledCurrent: { minimum: 0, maximum: 0, average: 0 },
    ledVoltage: { minimum: 0, maximum: 0, average: 0 },
    motorCurrent: { minimum: 0, maximum: 0, average: 0 },
    motorVoltage: { minimum: 0, maximum: 0, average: 0 }
  },
  lastUpdated: new Date().toISOString(),
  source: 'initializing'
};

// Parse historical minute aggregates & reject sensor spikes
function parseAggregates(minuteAggregates) {
  if (!minuteAggregates || typeof minuteAggregates !== 'object') return null;

  const bucketKeys = Object.keys(minuteAggregates).sort();
  if (bucketKeys.length === 0) return null;

  let totalSamples = 0;
  let sumLedC = 0, sumLedV = 0, sumMotorC = 0, sumMotorV = 0;
  let validLedSamples = 0, validMotorSamples = 0;
  let minLedC = Infinity, maxLedC = -Infinity;
  let minLedV = Infinity, maxLedV = -Infinity;
  let minMotorC = Infinity, maxMotorC = -Infinity;
  let minMotorV = Infinity, maxMotorV = -Infinity;

  for (const key of bucketKeys) {
    const b = minuteAggregates[key];
    if (!b || typeof b !== 'object') continue;

    const samples = b.ledCurrent?.samples || b.waterPumpCurrent?.samples || b.motorCurrent?.samples || 1;
    totalSamples += samples;

    const bAvgLedC = Math.abs(b.ledCurrent?.average ?? 0);
    const bMaxLedC = Math.abs(b.ledCurrent?.maximum ?? 0);
    const bMinLedC = Math.abs(b.ledCurrent?.minimum ?? 0);

    const bAvgLedV = Math.abs(b.ledVoltage?.average ?? 0);
    const bMaxLedV = Math.abs(b.ledVoltage?.maximum ?? 0);
    const bMinLedV = Math.abs(b.ledVoltage?.minimum ?? 0);

    // Backward-compatible reading of motorCurrent or legacy waterPumpCurrent
    const motorObj = b.motorCurrent || b.waterPumpCurrent || {};
    const motorVObj = b.motorVoltage || b.waterPumpVoltage || {};

    const bAvgMotorC = Math.abs(motorObj.average ?? 0);
    const bMaxMotorC = Math.abs(motorObj.maximum ?? 0);
    const bMinMotorC = Math.abs(motorObj.minimum ?? 0);

    const bAvgMotorV = Math.abs(motorVObj.average ?? 0);
    const bMaxMotorV = Math.abs(motorVObj.maximum ?? 0);
    const bMinMotorV = Math.abs(motorVObj.minimum ?? 0);

    // Validate LED: Reject impossible sensor noise (e.g., 25-27A on 5A sensor)
    if (bAvgLedC <= MAX_VALID_DC_CURRENT) {
      sumLedC += bAvgLedC * samples;
      validLedSamples += samples;
      if (bMinLedC < minLedC) minLedC = bMinLedC;
      if (bMaxLedC > maxLedC && bMaxLedC <= MAX_VALID_DC_CURRENT) maxLedC = bMaxLedC;
    }

    if (bAvgLedV <= MAX_VALID_VOLTAGE) {
      sumLedV += bAvgLedV * samples;
      if (bMinLedV < minLedV) minLedV = bMinLedV;
      if (bMaxLedV > maxLedV) maxLedV = bMaxLedV;
    }

    // Validate DC Motor: Reject impossible sensor noise
    if (bAvgMotorC <= MAX_VALID_DC_CURRENT) {
      sumMotorC += bAvgMotorC * samples;
      validMotorSamples += samples;
      if (bMinMotorC < minMotorC) minMotorC = bMinMotorC;
      if (bMaxMotorC > maxMotorC && bMaxMotorC <= MAX_VALID_DC_CURRENT) maxMotorC = bMaxMotorC;
    }

    if (bAvgMotorV <= MAX_VALID_VOLTAGE) {
      sumMotorV += bAvgMotorV * samples;
      if (bMinMotorV < minMotorV) minMotorV = bMinMotorV;
      if (bMaxMotorV > maxMotorV) maxMotorV = bMaxMotorV;
    }
  }

  const avgLedC = validLedSamples > 0 ? sumLedC / validLedSamples : 0;
  const avgLedV = validLedSamples > 0 ? sumLedV / validLedSamples : 0;
  const avgMotorC = validMotorSamples > 0 ? sumMotorC / validMotorSamples : 0;
  const avgMotorV = validMotorSamples > 0 ? sumMotorV / validMotorSamples : 0;

  return {
    totalSamples,
    bucketsCount: bucketKeys.length,
    ledCurrent: {
      minimum: minLedC === Infinity ? 0 : minLedC,
      maximum: maxLedC === -Infinity ? 0 : maxLedC,
      average: avgLedC
    },
    ledVoltage: {
      minimum: minLedV === Infinity ? 0 : minLedV,
      maximum: maxLedV === -Infinity ? 0 : maxLedV,
      average: avgLedV
    },
    motorCurrent: {
      minimum: minMotorC === Infinity ? 0 : minMotorC,
      maximum: maxMotorC === -Infinity ? 0 : maxMotorC,
      average: avgMotorC
    },
    motorVoltage: {
      minimum: minMotorV === Infinity ? 0 : minMotorV,
      maximum: maxMotorV === -Infinity ? 0 : maxMotorV,
      average: avgMotorV
    }
  };
}

// ========================================================
// CORE FETCH & MOTOR-SPECIFIC CLASSIFICATION
// ========================================================
async function fetchFirebaseTelemetry() {
  try {
    let baseUrl = FIREBASE_DB_URL.endsWith('/') ? FIREBASE_DB_URL.slice(0, -1) : FIREBASE_DB_URL;
    const authQuery = FIREBASE_AUTH_SECRET ? `?auth=${encodeURIComponent(FIREBASE_AUTH_SECRET)}` : '';

    const [liveRes, aggRes] = await Promise.allSettled([
      fetch(`${baseUrl}/live.json${authQuery}`, { signal: AbortSignal.timeout(4000) }),
      fetch(`${baseUrl}/aggregates/minute.json${authQuery}`, { signal: AbortSignal.timeout(4000) })
    ]);

    let liveData = null;
    if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
      liveData = await liveRes.value.json();
    }

    let aggData = null;
    if (aggRes.status === 'fulfilled' && aggRes.value.ok) {
      aggData = await aggRes.value.json();
    }

    // 1. Extract and sanitize raw sensor values (accepting both new motor* and existing waterPump* fields)
    let rawLedC = Number(liveData?.ledCurrent ?? liveData?.current1);
    let rawLedV = Number(liveData?.ledVoltage ?? liveData?.voltage1);
    let rawMotorC = Number(liveData?.motorCurrent ?? liveData?.waterPumpCurrent ?? liveData?.current2);
    let rawMotorV = Number(liveData?.motorVoltage ?? liveData?.waterPumpVoltage ?? liveData?.voltage2);
    let rawTimestamp = Number(liveData?.timestamp);

    // Filter invalid readings (NaN, Infinity, negative voltage, sensor noise > 6A)
    const ledCurrent = (!isNaN(rawLedC) && isFinite(rawLedC) && Math.abs(rawLedC) <= MAX_VALID_DC_CURRENT) ? Math.abs(rawLedC) : telemetryCache.live.ledCurrent;
    const ledVoltage = (!isNaN(rawLedV) && isFinite(rawLedV) && rawLedV >= MIN_VALID_VOLTAGE && rawLedV <= MAX_VALID_VOLTAGE) ? rawLedV : telemetryCache.live.ledVoltage;
    const motorCurrent = (!isNaN(rawMotorC) && isFinite(rawMotorC) && Math.abs(rawMotorC) <= MAX_VALID_DC_CURRENT) ? Math.abs(rawMotorC) : telemetryCache.live.motorCurrent;
    const motorVoltage = (!isNaN(rawMotorV) && isFinite(rawMotorV) && rawMotorV >= MIN_VALID_VOLTAGE && rawMotorV <= MAX_VALID_VOLTAGE) ? rawMotorV : telemetryCache.live.motorVoltage;

    const currentTimestampMs = (!isNaN(rawTimestamp) && rawTimestamp > 0)
      ? (rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp)
      : Date.now();

    // 2. Strict DC power calculation: P = V * I
    const ledPowerWatts = ledVoltage * ledCurrent;
    const motorPowerWatts = motorVoltage * motorCurrent;
    const totalPowerWatts = ledPowerWatts + motorPowerWatts;

    // Device operating states
    const ledStatus = ledCurrent > 0.05 ? 'ON' : 'OFF';

    // DC Motor Specific State Classification
    let motorStatus = 'OFF';
    if (motorCurrent <= 0.05) {
      motorStatus = 'OFF';
    } else if (motorCurrent > 2.5) {
      motorStatus = 'STALL / OVERLOAD';
    } else if (motorCurrent > 1.2) {
      motorStatus = 'STARTUP / HIGH LOAD';
    } else {
      motorStatus = 'NORMAL RUNNING';
    }

    // 3. Trapezoidal Energy Integration using Actual Timestamps
    if (accumulatorState.lastTimestampMs === 0) {
      accumulatorState.lastTimestampMs = currentTimestampMs;
      accumulatorState.firstTimestampMs = currentTimestampMs;
      accumulatorState.lastLedPowerW = ledPowerWatts;
      accumulatorState.lastMotorPowerW = motorPowerWatts;
    } else if (currentTimestampMs > accumulatorState.lastTimestampMs) {
      const elapsedMs = currentTimestampMs - accumulatorState.lastTimestampMs;
      if (elapsedMs <= 60000) {
        const deltaLedKwh = integrateEnergy(accumulatorState.lastLedPowerW, ledPowerWatts, elapsedMs);
        const deltaMotorKwh = integrateEnergy(accumulatorState.lastMotorPowerW, motorPowerWatts, elapsedMs);

        accumulatorState.accumulatedLedKwh += deltaLedKwh;
        accumulatorState.accumulatedMotorKwh += deltaMotorKwh;
      }
      accumulatorState.lastTimestampMs = currentTimestampMs;
      accumulatorState.lastLedPowerW = ledPowerWatts;
      accumulatorState.lastMotorPowerW = motorPowerWatts;
      saveAccumulatorState();
    }

    const aggSummary = parseAggregates(aggData) || telemetryCache.aggregatesSummary;

    let totalLedKwh = accumulatorState.accumulatedLedKwh;
    let totalMotorKwh = accumulatorState.accumulatedMotorKwh;

    // Initialize baseline from aggregates if fresh state
    if (totalLedKwh === 0 && totalMotorKwh === 0 && aggSummary?.bucketsCount > 0) {
      const hours = aggSummary.bucketsCount / 60;
      const baseLedW = aggSummary.ledVoltage.average * aggSummary.ledCurrent.average;
      const baseMotorW = aggSummary.motorVoltage.average * aggSummary.motorCurrent.average;
      totalLedKwh = (baseLedW * hours) / 1000;
      totalMotorKwh = (baseMotorW * hours) / 1000;
      accumulatorState.accumulatedLedKwh = totalLedKwh;
      accumulatorState.accumulatedMotorKwh = totalMotorKwh;
      saveAccumulatorState();
    }

    const totalKwh = totalLedKwh + totalMotorKwh;

    // 4. Energy Charges at ₹8.00/Unit
    const ledEnergyChargeINR = totalLedKwh * TARIFF_RATE_PER_UNIT;
    const motorEnergyChargeINR = totalMotorKwh * TARIFF_RATE_PER_UNIT;
    const totalEnergyChargeINR = totalKwh * TARIFF_RATE_PER_UNIT;

  // 5. Distinct Energy & Projection Metrics:
  const elapsedHours = (aggSummary?.bucketsCount > 0)
    ? (aggSummary.bucketsCount / 60)
    : Math.max((Date.now() - (accumulatorState.firstTimestampMs || Date.now())) / 3600000, 0.1);

  // Metric 1: Actual Cumulative Energy (kWh)
  // Metric 2: Today's / Session consumption from accumulator
  // Metric 3: Historical average consumption rate (kWh per hour)
  const historicalAvgKwhPerHour = elapsedHours > 0 ? (totalKwh / elapsedHours) : 0;

  // Metric 4: Historical Monthly Projection (720 hours @ historical average)
  const historicalMonthlyUnits = historicalAvgKwhPerHour * 720;
  const historicalMonthlyCostINR = historicalMonthlyUnits * TARIFF_RATE_PER_UNIT;

  // Metric 5: Current-Load Monthly Projection (24/7 continuous run at instant load: kW * 720)
  const currentLoadMonthlyUnits = (totalPowerWatts / 1000) * 720;
  const currentLoadMonthlyCostINR = currentLoadMonthlyUnits * TARIFF_RATE_PER_UNIT;

  // Metric 6: Operating-Schedule-Based Projection (e.g., 12 hours/day for 30 days = 360 hours)
  const schedule12hMonthlyUnits = (totalPowerWatts * 12 * 30) / 1000;
  const schedule12hMonthlyCostINR = schedule12hMonthlyUnits * TARIFF_RATE_PER_UNIT;

  telemetryCache = {
    live: {
      ledCurrent,
      ledVoltage,
      motorCurrent,
      motorVoltage,
      // Backward compatibility
      waterPumpCurrent: motorCurrent,
      waterPumpVoltage: motorVoltage,
      timestamp: currentTimestampMs
    },
    led: {
      status: ledStatus,
      current: ledCurrent,
      voltage: ledVoltage,
      instantPowerWatts: ledPowerWatts,
      cumulativeKwh: totalLedKwh,
      energyChargeINR: ledEnergyChargeINR,
      stats: aggSummary.ledCurrent,
      voltageStats: aggSummary.ledVoltage
    },
    dcMotor: {
      status: motorStatus,
      current: motorCurrent,
      voltage: motorVoltage,
      instantPowerWatts: motorPowerWatts,
      cumulativeKwh: totalMotorKwh,
      energyChargeINR: motorEnergyChargeINR,
      stats: aggSummary.motorCurrent,
      voltageStats: aggSummary.motorVoltage
    },
    // Backward compatibility alias
    waterPump: {
      status: motorStatus,
      current: motorCurrent,
      voltage: motorVoltage,
      instantPowerWatts: motorPowerWatts,
      cumulativeKwh: totalMotorKwh,
      energyChargeINR: motorEnergyChargeINR,
      stats: aggSummary.motorCurrent,
      voltageStats: aggSummary.motorVoltage
    },
    systemOverview: {
      totalPowerWatts,
      cumulativeUnitsKwh: totalKwh,
      energyChargeINR: totalEnergyChargeINR,
      tariffRate: `₹${TARIFF_RATE_PER_UNIT}/Unit`,
      projections: {
        historicalAverage: {
          monthlyUnits: historicalMonthlyUnits,
          monthlyCostINR: historicalMonthlyCostINR,
          avgKwhPerHour: historicalAvgKwhPerHour,
          elapsedHours: elapsedHours,
          label: "Historical Average Projection (720h extrapolated from bucket history)"
        },
        currentLoad: {
          monthlyUnits: currentLoadMonthlyUnits,
          monthlyCostINR: currentLoadMonthlyCostINR,
          label: "Current Load Projection (24/7 continuous run at current instant power)"
        },
        operatingSchedule12h: {
          monthlyUnits: schedule12hMonthlyUnits,
          monthlyCostINR: schedule12hMonthlyCostINR,
          label: "12-Hour Daily Operating Schedule Projection (30 days)"
        }
      }
    },
    aggregatesSummary: aggSummary,
    lastUpdated: new Date().toISOString(),
    source: 'firebase_live'
  };

    return telemetryCache;
  } catch (err) {
    telemetryCache.lastUpdated = new Date().toISOString();
    telemetryCache.error = err.message;
    return telemetryCache;
  }
}

// Endpoint: Live Telemetry
app.get('/api/telemetry', async (req, res) => {
  const data = await fetchFirebaseTelemetry();
  res.json({
    success: true,
    data
  });
});

// Endpoint: Manual Simulation / Testing Console
app.post('/api/telemetry/simulate', (req, res) => {
  const { current_one, current_two, voltage_two, voltage_one } = req.body;
  if (current_one !== undefined) telemetryCache.live.ledCurrent = Math.abs(Number(current_one));
  if (voltage_one !== undefined) telemetryCache.live.ledVoltage = Number(voltage_one);
  if (current_two !== undefined) {
    telemetryCache.live.motorCurrent = Math.abs(Number(current_two));
    telemetryCache.live.waterPumpCurrent = telemetryCache.live.motorCurrent;
  }
  if (voltage_two !== undefined) {
    telemetryCache.live.motorVoltage = Number(voltage_two);
    telemetryCache.live.waterPumpVoltage = telemetryCache.live.motorVoltage;
  }

  const c1 = telemetryCache.live.ledCurrent;
  const v1 = telemetryCache.live.ledVoltage;
  const c2 = telemetryCache.live.motorCurrent;
  const v2 = telemetryCache.live.motorVoltage;

  const pLed = v1 * c1;
  const pMotor = v2 * c2;
  const pTotal = pLed + pMotor;

  telemetryCache.led = {
    ...telemetryCache.led,
    status: c1 > 0.05 ? 'ON' : 'OFF',
    current: c1,
    voltage: v1,
    instantPowerWatts: pLed
  };

  let motorStatus = 'OFF';
  if (c2 <= 0.05) motorStatus = 'OFF';
  else if (c2 > 2.5) motorStatus = 'STALL / OVERLOAD';
  else if (c2 > 1.2) motorStatus = 'STARTUP / HIGH LOAD';
  else motorStatus = 'NORMAL RUNNING';

  telemetryCache.dcMotor = {
    ...telemetryCache.dcMotor,
    status: motorStatus,
    current: c2,
    voltage: v2,
    instantPowerWatts: pMotor
  };
  telemetryCache.waterPump = telemetryCache.dcMotor;

  telemetryCache.systemOverview.totalPowerWatts = pTotal;
  telemetryCache.lastUpdated = new Date().toISOString();
  telemetryCache.source = 'manual_override';

  res.json({ success: true, data: telemetryCache });
});

// Endpoint: Groq AI Copilot
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const telemetry = await fetchFirebaseTelemetry();
  const led = telemetry.led;
  const motor = telemetry.dcMotor;
  const overview = telemetry.systemOverview;
  const proj = overview.projections;
  const aggSummary = telemetry.aggregatesSummary;
  const elapsedHours = proj.historicalAverage?.elapsedHours || 0;

  const systemPayload = {
      timestamp: new Date(telemetry.live.timestamp).toISOString(),
      currency: "INR (₹)",
      tariff: {
        rate_per_kwh: TARIFF_RATE_PER_UNIT,
        type: "prototype_flat_rate",
        notes: "Illustrative prototype flat rate. Not an official multi-slab KSEB utility bill with fixed charges/duty."
      },
      devices: {
        led: {
          voltage_v: Number(led.voltage.toFixed(3)),
          current_a: Number(led.current.toFixed(4)),
          power_w: Number(led.instantPowerWatts.toFixed(4)),
          status: led.status,
          energy_kwh: Number(led.cumulativeKwh.toFixed(6)),
          cost_inr: Number(led.energyChargeINR.toFixed(4))
        },
        motor: {
          voltage_v: Number(motor.voltage.toFixed(3)),
          current_a: Number(motor.current.toFixed(4)),
          power_w: Number(motor.instantPowerWatts.toFixed(4)),
          status: motor.status,
          energy_kwh: Number(motor.cumulativeKwh.toFixed(6)),
          cost_inr: Number(motor.energyChargeINR.toFixed(4)),
          rated_voltage_v: 5.0,
          hardware_note: motor.voltage < 2.0 ? "Measured voltage (1.18V) is significantly below 5V rated voltage; sensor voltage divider calibration required." : "Voltage within normal operating band."
        }
      },
      power: {
        total_instant_power_w: Number(overview.totalPowerWatts.toFixed(4)),
        formula: "total_power = (led_voltage * led_current) + (motor_voltage * motor_current)"
      },
      energy_and_metrics: {
        cumulative_kwh: Number(overview.cumulativeUnitsKwh.toFixed(6)),
        today_kwh: null, // Explicitly null: no daily midnight reset counter exists
        today_energy_available: false,
        energy_charge_inr: Number(overview.energyChargeINR.toFixed(4)),
        historical_window_minutes: aggSummary?.bucketsCount || 0,
        historical_window_hours: Number(elapsedHours.toFixed(3)),
        historical_projection_kwh: Number(proj.historicalAverage.monthlyUnits.toFixed(4)),
        historical_projection_cost_inr: Number(proj.historicalAverage.monthlyCostINR.toFixed(2)),
        current_load_projection_kwh: Number(proj.currentLoad.monthlyUnits.toFixed(4)),
        current_load_projection_cost_inr: Number(proj.currentLoad.monthlyCostINR.toFixed(2)),
        operating_schedule_12h_monthly_kwh: Number(proj.operatingSchedule12h.monthlyUnits.toFixed(4)),
        operating_schedule_12h_monthly_cost_inr: Number(proj.operatingSchedule12h.monthlyCostINR.toFixed(2)),
        savings_30_percent: {
          monthly_kwh: Number((proj.operatingSchedule12h.monthlyUnits * 0.70).toFixed(4)),
          monthly_cost_inr: Number((proj.operatingSchedule12h.monthlyCostINR * 0.70).toFixed(2)),
          energy_saved_kwh: Number((proj.operatingSchedule12h.monthlyUnits * 0.30).toFixed(4)),
          money_saved_inr: Number((proj.operatingSchedule12h.monthlyCostINR * 0.30).toFixed(2))
        }
      },
      data_quality: {
        sensor_calibration: "unverified (motor voltage reads 1.18V for 5V rated motor)",
        noise_filter_active: true,
        max_valid_current_threshold_a: MAX_VALID_DC_CURRENT
      }
    };

    const systemPrompt = `# AuraIoT AI Copilot — System Instructions

You are AuraIoT, an electrical energy monitoring analyst and instrumentation advisor.
Your responsibility is to explain validated sensor readings, energy consumption, electrical power, estimated costs and operational trends using ONLY the structured backend data provided below.

## 1. SOURCE OF TRUTH & STRICT DATA CONTRACT
- Rely solely on the provided JSON telemetry payload.
- NEVER invent missing sensor readings, timestamps, energy values, or tariff information.
- NEVER replace null or missing values with assumed figures.
- Do NOT independently estimate or recalculate sensor readings when validated backend values are provided.

## 2. METRIC DEFINITIONS (KEEP STRICTLY SEPARATE)
- Instantaneous Power: Current electrical load in watts (total: ${overview.totalPowerWatts.toFixed(3)} W).
- Cumulative Energy: Total recorded energy since monitoring baseline (${overview.cumulativeUnitsKwh.toFixed(4)} kWh).
- Daily Energy (Today's Energy): Explicitly UNAVAILABLE (marked null in payload because no midnight calendar counter is active). If asked about "today's energy", directly state that daily energy aggregation is not active/available.
- Historical Projection: Extrapolation based strictly on past observation duration (${proj.historicalAverage.elapsedHours.toFixed(1)} hours).
- Current-Load Projection: Continuous 24/7 run assuming present instant power remains constant forever.
- Scheduled-Use Projection: Estimate based on an explicitly specified daily schedule (e.g. 12 hours/day for 30 days).

## 3. CALCULATION RULES & ACCURACY
For DC loads:
- Power (W) = Voltage (V) × Current (A)
- Energy (kWh) = Power (W) × Time (hours) / 1000
- Energy Cost (₹) = Energy (kWh) × Configured Tariff (₹8.00/kWh)
Use the pre-calculated unrounded backend figures for calculations and state exact arithmetic (e.g., 0.4 Units × ₹8 = ₹3.20, NOT ₹3.40).

## 4. MISSING AND UNRELIABLE DATA
- If daily energy is requested, state clearly that daily consumption is unavailable.
- Since motor voltage is reported as 1.18V for a 5V rated motor, identify the reading as provisional and explain the multimeter check across the motor terminals.
- Never describe projected or estimated values as actual utility bills.

## 5. TARIFF RULES
The tariff is marked "prototype_flat_rate" at ₹8.00/kWh. Describe it as an illustrative prototype estimate, NOT an official statutory KSEB domestic bill (which involves multi-slab telescopic rates, fixed charges, and duty).

## 6. STRUCTURED BACKEND DATA PAYLOAD:
\`\`\`json
${JSON.stringify(systemPayload, null, 2)}
\`\`\``;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**Verified Mathematical Telemetry:**\n- **LED:** ${led.voltage.toFixed(2)} V × ${led.current.toFixed(3)} A = **${led.instantPowerWatts.toFixed(3)} W**\n- **DC Motor:** ${motor.voltage.toFixed(2)} V × ${motor.current.toFixed(3)} A = **${motor.instantPowerWatts.toFixed(3)} W** (${motor.status})\n- **Total Instant Power:** **${overview.totalPowerWatts.toFixed(3)} W**\n- **Energy Charge:** ${overview.cumulativeUnitsKwh.toFixed(4)} Units × ₹8.00 = **₹${overview.energyChargeINR.toFixed(2)}**\n\nPlease add your \`GROQ_API_KEY\` to chat.`
    });
  }

  try {
    const activeGroq = new Groq({ apiKey: clientApiKey });

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: String(h.content || '')
      })) : []),
      { role: 'user', content: message }
    ];

    const chatCompletion = await activeGroq.chat.completions.create({
      messages: formattedMessages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.5,
      max_tokens: 900
    });

    const reply = chatCompletion.choices[0]?.message?.content || "No response received from Groq AI.";
    res.json({ reply, telemetry });
  } catch (err) {
    console.error("Groq Error:", err.message);
    res.status(500).json({
      error: "Error communicating with Groq API",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 AuraIoT Server running at: http://localhost:${PORT}`);
  console.log(`📡 Connected to Firebase: ${FIREBASE_DB_URL}`);
  console.log(`⚡ Strict DC Power Engine: P = V * I`);
  console.log(`⚙️ DC Motor Classification & ACS712-5A Engine Active`);
  console.log(`===============================================`);
});
