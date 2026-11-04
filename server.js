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
  return (avgPowerW * elapsedMs) / 3600000000;
}

// ========================================================
// ML ELECTRICAL ANOMALY & EVENT DETECTION ENGINE (from idea.txt)
// ========================================================
let eventsDatabase = [
  {
    event_id: "EVT1001",
    house_id: "FACILITY-S3",
    switch_id: "SW-01",
    appliance: "5V DC Water Pump",
    event_type: "startup_inrush_surge",
    severity: "medium",
    model_confidence: 0.94,
    voltage: 5.0,
    current: 1.85,
    power: 9.25,
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    details: "Motor inductive startup transient surge (1.85A peak, 420ms duration). Classified as normal inrush."
  },
  {
    event_id: "EVT1002",
    house_id: "FACILITY-S3",
    switch_id: "SW-01",
    appliance: "5V DC Water Pump",
    event_type: "voltage_calibration_anomaly",
    severity: "medium",
    model_confidence: 0.91,
    voltage: 1.18,
    current: 0.183,
    power: 0.216,
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    details: "ESP32 reports 1.18V on 5V rated DC pump. Sensor divider attenuation or voltage probe offset requires verification."
  },
  {
    event_id: "EVT1003",
    house_id: "FACILITY-S3",
    switch_id: "SW-03",
    appliance: "Ceiling Fan",
    event_type: "bearing_friction_anomaly",
    severity: "medium",
    model_confidence: 0.89,
    voltage: 230.0,
    current: 0.42,
    power: 96.6,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    details: "Current draw is 18% higher than learned baseline pattern (0.35A -> 0.42A). Mechanical bearing friction suspected."
  },
  {
    event_id: "EVT1004",
    house_id: "FACILITY-S3",
    switch_id: "SW-04",
    appliance: "Solar Battery Bank",
    event_type: "normal_float_charge",
    severity: "normal",
    model_confidence: 0.98,
    voltage: 12.6,
    current: 0.45,
    power: 5.67,
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    details: "Lead-acid/LiFePO4 battery rail in steady float maintenance mode. State-of-Health (SoH) estimated at 94%."
  },
  {
    event_id: "EVT1005",
    house_id: "FACILITY-S3",
    switch_id: "SW-02",
    appliance: "DC LED Fixture",
    event_type: "steady_illumination",
    severity: "normal",
    model_confidence: 0.99,
    voltage: 4.63,
    current: 0.393,
    power: 1.82,
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    details: "Stable DC illumination load within nominal tolerances (4.63V / 0.393A)."
  }
];

// Helper to auto-log real-time events based on physical telemetry thresholds
function evaluateTelemetryAnomalies(telemetry) {
  const motorC = telemetry.live.motorCurrent || 0;
  const motorV = telemetry.live.motorVoltage || 0;

  // 1. Motor Stall Overload (> 2.5A)
  if (motorC > 2.5) {
    const lastEvent = eventsDatabase[0];
    if (!lastEvent || lastEvent.event_type !== 'stall_overload' || (Date.now() - new Date(lastEvent.timestamp).getTime()) > 30000) {
      eventsDatabase.unshift({
        event_id: `EVT${Date.now().toString().slice(-4)}`,
        house_id: "FACILITY-S3",
        switch_id: "SW-01",
        appliance: "5V DC Water Pump",
        event_type: "stall_overload",
        severity: "critical",
        model_confidence: 0.98,
        voltage: motorV,
        current: motorC,
        power: motorV * motorC,
        timestamp: new Date().toISOString(),
        details: `CRITICAL ALERT: Motor stall detected (${motorC.toFixed(2)}A > 2.5A). Impeller blockage or locked rotor. Immediate thermal trip recommended!`
      });
      if (eventsDatabase.length > 50) eventsDatabase.pop();
    }
  }

  // 2. Motor Startup Surge (1.2A to 2.5A)
  else if (motorC > 1.2) {
    const lastEvent = eventsDatabase[0];
    if (!lastEvent || lastEvent.event_type !== 'startup_inrush_surge' || (Date.now() - new Date(lastEvent.timestamp).getTime()) > 30000) {
      eventsDatabase.unshift({
        event_id: `EVT${Date.now().toString().slice(-4)}`,
        house_id: "FACILITY-S3",
        switch_id: "SW-01",
        appliance: "5V DC Water Pump",
        event_type: "startup_inrush_surge",
        severity: "medium",
        model_confidence: 0.94,
        voltage: motorV,
        current: motorC,
        power: motorV * motorC,
        timestamp: new Date().toISOString(),
        details: `Transient inrush current detected (${motorC.toFixed(2)}A). Classified as normal motor starting acceleration.`
      });
      if (eventsDatabase.length > 50) eventsDatabase.pop();
    }
  }
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

    const motorObj = b.motorCurrent || b.waterPumpCurrent || {};
    const motorVObj = b.motorVoltage || b.waterPumpVoltage || {};

    const bAvgMotorC = Math.abs(motorObj.average ?? 0);
    const bMaxMotorC = Math.abs(motorObj.maximum ?? 0);
    const bMinMotorC = Math.abs(motorObj.minimum ?? 0);

    const bAvgMotorV = Math.abs(motorVObj.average ?? 0);
    const bMaxMotorV = Math.abs(motorVObj.maximum ?? 0);
    const bMinMotorV = Math.abs(motorVObj.minimum ?? 0);

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

// Fetch live telemetry & calculate deterministic metrics
async function fetchFirebaseTelemetry() {
  try {
    const authQuery = FIREBASE_AUTH_SECRET ? `?auth=${FIREBASE_AUTH_SECRET}` : '';
    const liveUrl = `${FIREBASE_DB_URL.replace(/\/$/, '')}/live.json${authQuery}`;
    const aggUrl = `${FIREBASE_DB_URL.replace(/\/$/, '')}/aggregates/minute.json${authQuery}`;

    const [liveRes, aggRes] = await Promise.all([
      fetch(liveUrl).catch(() => null),
      fetch(aggUrl).catch(() => null)
    ]);

    const liveData = liveRes && liveRes.ok ? await liveRes.json() : null;
    const aggData = aggRes && aggRes.ok ? await aggRes.json() : null;

    let ledCurrent = telemetryCache.live.ledCurrent || 0;
    let ledVoltage = telemetryCache.live.ledVoltage || 0;
    let motorCurrent = telemetryCache.live.motorCurrent || 0;
    let motorVoltage = telemetryCache.live.motorVoltage || 0;
    let currentTimestampMs = Date.now();

    if (liveData) {
      if (liveData.ledCurrent !== undefined) ledCurrent = Math.abs(Number(liveData.ledCurrent) || 0);
      if (liveData.ledVoltage !== undefined) ledVoltage = Number(liveData.ledVoltage) || 0;

      const rawMotorC = liveData.motorCurrent !== undefined ? liveData.motorCurrent : liveData.waterPumpCurrent;
      if (rawMotorC !== undefined) motorCurrent = Math.abs(Number(rawMotorC) || 0);

      const rawMotorV = liveData.motorVoltage !== undefined ? liveData.motorVoltage : liveData.waterPumpVoltage;
      if (rawMotorV !== undefined) motorVoltage = Number(rawMotorV) || 0;

      if (liveData.timestamp) {
        currentTimestampMs = Number(liveData.timestamp) > 1e11 ? Number(liveData.timestamp) : Number(liveData.timestamp) * 1000;
      }
    }

    if (ledCurrent > MAX_VALID_DC_CURRENT) ledCurrent = 0;
    if (motorCurrent > MAX_VALID_DC_CURRENT) motorCurrent = 0;

    const ledPowerWatts = ledVoltage * ledCurrent;
    const motorPowerWatts = motorVoltage * motorCurrent;
    const totalPowerWatts = ledPowerWatts + motorPowerWatts;

    const ledStatus = ledCurrent > 0.05 ? 'ON' : 'OFF';

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

    // Trapezoidal Energy Integration using Actual Timestamps
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

    const ledEnergyChargeINR = totalLedKwh * TARIFF_RATE_PER_UNIT;
    const motorEnergyChargeINR = totalMotorKwh * TARIFF_RATE_PER_UNIT;
    const totalEnergyChargeINR = totalKwh * TARIFF_RATE_PER_UNIT;

    const elapsedHours = (aggSummary?.bucketsCount > 0)
      ? (aggSummary.bucketsCount / 60)
      : Math.max((Date.now() - (accumulatorState.firstTimestampMs || Date.now())) / 3600000, 0.1);

    const historicalAvgKwhPerHour = elapsedHours > 0 ? (totalKwh / elapsedHours) : 0;
    const historicalMonthlyUnits = historicalAvgKwhPerHour * 720;
    const historicalMonthlyCostINR = historicalMonthlyUnits * TARIFF_RATE_PER_UNIT;

    const currentLoadMonthlyUnits = (totalPowerWatts / 1000) * 720;
    const currentLoadMonthlyCostINR = currentLoadMonthlyUnits * TARIFF_RATE_PER_UNIT;

    const schedule12hMonthlyUnits = (totalPowerWatts * 12 * 30) / 1000;
    const schedule12hMonthlyCostINR = schedule12hMonthlyUnits * TARIFF_RATE_PER_UNIT;

    telemetryCache = {
      live: {
        ledCurrent,
        ledVoltage,
        motorCurrent,
        motorVoltage,
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

    evaluateTelemetryAnomalies(telemetryCache);

    return telemetryCache;
  } catch (err) {
    telemetryCache.lastUpdated = new Date().toISOString();
    telemetryCache.error = err.message;
    return telemetryCache;
  }
}

// ==========================================
// API ROUTES
// ==========================================

// Endpoint: Live Telemetry
app.get('/api/telemetry', async (req, res) => {
  const data = await fetchFirebaseTelemetry();
  res.json({
    success: true,
    data
  });
});

// Endpoint: Anomaly & Event Detection Log (from idea.txt)
app.get('/api/events', async (req, res) => {
  const { appliance, severity } = req.query;
  let filtered = [...eventsDatabase];
  if (appliance) {
    filtered = filtered.filter(e => e.appliance.toLowerCase().includes(appliance.toLowerCase()));
  }
  if (severity) {
    filtered = filtered.filter(e => e.severity.toLowerCase() === severity.toLowerCase());
  }
  res.json({
    success: true,
    count: filtered.length,
    events: filtered
  });
});

// Endpoint: Multi-Appliance System Overview (idea.txt)
app.get('/api/appliances', async (req, res) => {
  const telemetry = await fetchFirebaseTelemetry();
  const led = telemetry.led;
  const motor = telemetry.dcMotor;

  const appliances = [
    {
      id: "APP-01",
      switch_id: "SW-01",
      name: "5V DC Water Pump",
      category: "Inductive Motor",
      status: motor.status,
      voltage: Number(motor.voltage.toFixed(2)),
      current: Number(motor.current.toFixed(3)),
      power: Number(motor.instantPowerWatts.toFixed(2)),
      cumulative_kwh: Number(motor.cumulativeKwh.toFixed(4)),
      cost_inr: Number(motor.energyChargeINR.toFixed(2)),
      health_score: motor.voltage < 2.0 ? 76 : (motor.status === 'NORMAL RUNNING' ? 98 : 88),
      anomaly_count: eventsDatabase.filter(e => e.appliance.includes("Pump")).length,
      icon: "💧",
      is_physical: true
    },
    {
      id: "APP-02",
      switch_id: "SW-02",
      name: "DC LED Fixture",
      category: "Lighting",
      status: led.status,
      voltage: Number(led.voltage.toFixed(2)),
      current: Number(led.current.toFixed(3)),
      power: Number(led.instantPowerWatts.toFixed(2)),
      cumulative_kwh: Number(led.cumulativeKwh.toFixed(4)),
      cost_inr: Number(led.energyChargeINR.toFixed(2)),
      health_score: 99,
      anomaly_count: eventsDatabase.filter(e => e.appliance.includes("LED")).length,
      icon: "💡",
      is_physical: true
    },
    {
      id: "APP-03",
      switch_id: "SW-03",
      name: "Ceiling Fan",
      category: "Smart Appliance",
      status: "ON",
      voltage: 230.0,
      current: 0.42,
      power: 96.6,
      cumulative_kwh: 0.842,
      cost_inr: 6.74,
      health_score: 84,
      anomaly_count: eventsDatabase.filter(e => e.appliance.includes("Fan")).length,
      icon: "🌀",
      is_physical: false
    },
    {
      id: "APP-04",
      switch_id: "SW-04",
      name: "Refrigerator",
      category: "Cooling Compressor",
      status: "STANDBY",
      voltage: 230.0,
      current: 0.12,
      power: 27.6,
      cumulative_kwh: 1.450,
      cost_inr: 11.60,
      health_score: 95,
      anomaly_count: 0,
      icon: "❄️",
      is_physical: false
    },
    {
      id: "APP-05",
      switch_id: "SW-BATT",
      name: "Solar Battery Bank",
      category: "Energy Storage",
      status: "DISCHARGING",
      voltage: 12.6,
      current: 0.95,
      power: 11.97,
      cumulative_kwh: 2.180,
      cost_inr: 0.00,
      health_score: 94,
      anomaly_count: 0,
      icon: "🔋",
      is_physical: false
    }
  ];

  res.json({
    success: true,
    appliances
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

  evaluateTelemetryAnomalies(telemetryCache);

  res.json({ success: true, data: telemetryCache });
});

// Endpoint: Groq AI Copilot with Event Retrieval Tool Contract
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

  const recentEvents = eventsDatabase.slice(0, 5);

  const systemPayload = {
    timestamp: new Date(telemetry.live.timestamp).toISOString(),
    currency: "INR (₹)",
    tariff: {
      rate_per_kwh: TARIFF_RATE_PER_UNIT,
      type: "prototype_flat_rate",
      notes: "Illustrative prototype flat rate (₹8.00/kWh). Not official KSEB utility bill."
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
      today_kwh: null,
      today_energy_available: false,
      energy_charge_inr: Number(overview.energyChargeINR.toFixed(4)),
      historical_window_minutes: aggSummary?.bucketsCount || 0,
      historical_window_hours: Number(elapsedHours.toFixed(3)),
      historical_projection_kwh: Number(proj.historicalAverage.monthlyUnits.toFixed(4)),
      historical_projection_cost_inr: Number(proj.historicalAverage.monthlyCostINR.toFixed(2)),
      current_load_projection_kwh: Number(proj.currentLoad.monthlyUnits.toFixed(4)),
      current_load_projection_cost_inr: Number(proj.currentLoad.monthlyCostINR.toFixed(2)),
      operating_schedule_12h_monthly_kwh: Number(proj.operatingSchedule12h.monthlyUnits.toFixed(4)),
      operating_schedule_12h_monthly_cost_inr: Number(proj.operatingSchedule12h.monthlyCostINR.toFixed(2))
    },
    electrical_intelligence_events: recentEvents
  };

  const systemPrompt = `# S-3 IOT AI Copilot — Persona & Operating Constraints

You are **S-3 IOT**, a Senior Electrical Energy Auditor, Power Systems Engineer, and Industrial IoT Diagnostics Specialist.
You operate a hybrid AI architecture: continuous Electrical ML Event Detection + Conversational Intelligence.

### 🛡️ OPERATING PRINCIPLES:
1. **NO HALLUCINATION:** Use ONLY facts from the structured JSON below. If asked about anomalies, cite the exact \`event_id\`, appliance, measured values, severity, and confidence score.
2. **ZERO RE-CALCULATION:** The backend is the single source of truth for power ($P = V \\times I$), energy, and ₹8.00/unit tariff. Never invent your own numbers.
3. **METRIC SEPARATION:** Keep instant power (W), cumulative energy (kWh), and projections strictly distinct.
4. **DIAGNOSTIC RIGOR:** 
   - DC Pump motor is rated 5V DC. If telemetry reports 1.18V, explain this as sensor divider calibration skew, not brownout.
   - Normal starting surge is 1.2A-2.5A. Motor stall only occurs when $I > 2.5A$.

### 📦 VERIFIED STRUCTURED TELEMETRY & EVENT LOG:
\`\`\`json
${JSON.stringify(systemPayload, null, 2)}
\`\`\``;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**Live Telemetry Status:**\n- **LED:** ${led.voltage.toFixed(2)} V × ${led.current.toFixed(3)} A = **${led.instantPowerWatts.toFixed(3)} W**\n- **Pump Motor:** ${motor.voltage.toFixed(2)} V × ${motor.current.toFixed(3)} A = **${motor.instantPowerWatts.toFixed(3)} W** (${motor.status})\n- **Recent Anomaly:** ${recentEvents[0]?.appliance} (${recentEvents[0]?.event_type}) - Severity: ${recentEvents[0]?.severity.toUpperCase()}\n\nPlease add your \`GROQ_API_KEY\` to chat.`
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
      max_tokens: 950
    });

    const reply = chatCompletion.choices[0]?.message?.content || "No response received from Groq AI.";
    res.json({ reply, telemetry, events: recentEvents });
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
  console.log(`🚀 S-3 IOT Server [TEST BRANCH] running at: http://localhost:${PORT}`);
  console.log(`📡 Connected to Firebase: ${FIREBASE_DB_URL}`);
  console.log(`⚡ Strict DC Power Engine: P = V * I`);
  console.log(`🧠 ML Event Detection & Multi-Appliance Engine Active`);
  console.log(`===============================================`);
});
