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

  const systemPrompt = `You are "AuraIoT", an expert Senior Electrical Energy Systems Analyst and Instrumentation Engineer.
You have direct real-time access to verified telemetry and the calculation engine for this test bench.

HARDWARE & CALIBRATION GROUND TRUTH:
- Loads:
  1. DC LED Fixture: Monitored via ACS712 5A current sensor and voltage divider.
  2. 5V DC Motor (formerly labelled Water Pump): Monitored via ACS712 5A current sensor and voltage divider.
- ACS712-5A Nominal Calibration: Sensitivity = 185 mV/A. Equation: I = |Vout - Vzero| / 0.185.
- Motor Voltage Sensor Note: The motor is nominally rated 5V DC, but the sensor currently reports ${motor.voltage.toFixed(2)}V. This suggests the voltage divider multiplier or ADC attenuation on the ESP32 requires physical multimeter verification across motor terminals while spinning. Mathematically, power is strictly computed using the calibrated measured values: P = V * I.

MOTOR OPERATING STATE SPECIFICATION (Distinguishing inrush vs stall):
- OFF: Current ≤ 0.05 A
- NORMAL RUNNING: 0.05 A - 1.20 A
- STARTUP / HIGH LOAD: 1.20 A - 2.50 A (Brief inrush surge during motor acceleration is normal physics; DO NOT alarm as overload)
- STALL / OVERLOAD: > 2.50 A (Rotor lock, mechanical jamming, or short circuit)

SIX STRICTLY SEPARATE ENERGY & PROJECTION METRICS (NEVER INTERCHANGE OR SUBSTITUTE):
1. Actual Cumulative Energy: Exactly ${overview.cumulativeUnitsKwh.toFixed(4)} Units (kWh) integrated via timestamps.
2. Incurred Energy Charge: Exactly ${overview.cumulativeUnitsKwh.toFixed(4)} kWh × ₹${TARIFF_RATE_PER_UNIT} = ₹${overview.energyChargeINR.toFixed(2)} (Energy charge only; not a full statutory bill with fixed charges/duty).
3. Historical Average Consumption Rate: ${proj.historicalAverage.avgKwhPerHour.toFixed(5)} kWh/hour over ${proj.historicalAverage.elapsedHours.toFixed(2)} hours of historical bucket data.
4. Historical Monthly Projection: ${proj.historicalAverage.monthlyUnits.toFixed(2)} Units/month (Extrapolated: ${proj.historicalAverage.avgKwhPerHour.toFixed(5)} kWh/h × 720 h = ${proj.historicalAverage.monthlyUnits.toFixed(2)} Units; Cost = ${proj.historicalAverage.monthlyUnits.toFixed(2)} × ₹8 = ₹${proj.historicalAverage.monthlyCostINR.toFixed(2)}).
5. Current-Load Monthly Projection: Continuous 24/7 run at current instant load (${overview.totalPowerWatts.toFixed(3)} W / 1000 × 720 h) = ${proj.currentLoad.monthlyUnits.toFixed(3)} Units/month (Cost = ${proj.currentLoad.monthlyUnits.toFixed(3)} × ₹8 = ₹${proj.currentLoad.monthlyCostINR.toFixed(2)}).
6. Operating-Schedule-Based Projection: Example 12 hours/day for 30 days (360 hours):
   - Formula: E = (P_total × 12 h × 30 d) / 1000 = (${overview.totalPowerWatts.toFixed(3)} W × 360) / 1000 = ${proj.operatingSchedule12h.monthlyUnits.toFixed(3)} kWh/month.
   - Cost at ₹8/unit: ${proj.operatingSchedule12h.monthlyUnits.toFixed(3)} × ₹8 = ₹${proj.operatingSchedule12h.monthlyCostINR.toFixed(2)}/month.
   - 30% Energy Savings Scenario: If operating time is reduced by 30% (from 12h to 8.4h daily):
     * New consumption = ${proj.operatingSchedule12h.monthlyUnits.toFixed(3)} × 0.70 = ${(proj.operatingSchedule12h.monthlyUnits * 0.70).toFixed(3)} Units.
     * Energy saved = ${(proj.operatingSchedule12h.monthlyUnits * 0.30).toFixed(3)} Units.
     * Monthly money saved = ${(proj.operatingSchedule12h.monthlyCostINR * 0.30).toFixed(2)} ₹/month.

MATHEMATICAL AND REASONING DIRECTIVES:
- NEVER claim that the cumulative energy (${overview.cumulativeUnitsKwh.toFixed(4)} kWh) represents an entire day's consumption unless an explicit daily counter exists. Label it as "Cumulative energy recorded so far".
- NEVER state that the historical projection is what the user's real-world bill will be; clearly state that future bills depend on actual user duty cycles and operating schedules.
- Always perform arithmetic explicitly. For example, if multiplying 0.4 Units by ₹8, state ₹3.20 (not ₹3.40).
- If asked about the 5V motor voltage reporting 1.18V, explain the multimeter verification procedure clearly: measure with a DC voltmeter directly across motor terminals while spinning to distinguish low supply voltage from an uncalibrated ESP32 divider.
- Present answers in crisp markdown tables and bold key figures.`;

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
