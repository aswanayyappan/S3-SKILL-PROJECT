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

// Indian Electricity Tariff Standard rate (₹8.00 per unit for illustrative energy charge)
const TARIFF_RATE_PER_UNIT = 8.00;

// Maximum physically valid DC current threshold for ACS712-5A (reject noise spikes like 25-27A)
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
        accumulatedPumpKwh: Number(data.accumulatedPumpKwh) || 0,
        lastTimestampMs: Number(data.lastTimestampMs) || 0,
        lastLedPowerW: Number(data.lastLedPowerW) || 0,
        lastPumpPowerW: Number(data.lastPumpPowerW) || 0,
        firstTimestampMs: Number(data.firstTimestampMs) || 0
      };
    }
  } catch (err) {
    console.error('Error loading accumulator state:', err.message);
  }
  return {
    accumulatedLedKwh: 0,
    accumulatedPumpKwh: 0,
    lastTimestampMs: 0,
    lastLedPowerW: 0,
    lastPumpPowerW: 0,
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
    waterPumpCurrent: 0,
    waterPumpVoltage: 0,
    timestamp: Date.now()
  },
  aggregatesSummary: {
    totalSamples: 0,
    bucketsCount: 0,
    ledCurrent: { minimum: 0, maximum: 0, average: 0 },
    ledVoltage: { minimum: 0, maximum: 0, average: 0 },
    waterPumpCurrent: { minimum: 0, maximum: 0, average: 0 },
    waterPumpVoltage: { minimum: 0, maximum: 0, average: 0 }
  },
  lastUpdated: new Date().toISOString(),
  source: 'initializing'
};

// ========================================================
// PARSE HISTORICAL MINUTE AGGREGATES & REJECT SENSOR SPIKES
// ========================================================
function parseAggregates(minuteAggregates) {
  if (!minuteAggregates || typeof minuteAggregates !== 'object') return null;

  const bucketKeys = Object.keys(minuteAggregates).sort();
  if (bucketKeys.length === 0) return null;

  let totalSamples = 0;
  let sumLedC = 0, sumLedV = 0, sumPumpC = 0, sumPumpV = 0;
  let validLedSamples = 0, validPumpSamples = 0;
  let minLedC = Infinity, maxLedC = -Infinity;
  let minLedV = Infinity, maxLedV = -Infinity;
  let minPumpC = Infinity, maxPumpC = -Infinity;
  let minPumpV = Infinity, maxPumpV = -Infinity;

  for (const key of bucketKeys) {
    const b = minuteAggregates[key];
    if (!b || typeof b !== 'object') continue;

    const samples = b.ledCurrent?.samples || b.waterPumpCurrent?.samples || 1;
    totalSamples += samples;

    const bAvgLedC = Math.abs(b.ledCurrent?.average ?? 0);
    const bMaxLedC = Math.abs(b.ledCurrent?.maximum ?? 0);
    const bMinLedC = Math.abs(b.ledCurrent?.minimum ?? 0);

    const bAvgLedV = Math.abs(b.ledVoltage?.average ?? 0);
    const bMaxLedV = Math.abs(b.ledVoltage?.maximum ?? 0);
    const bMinLedV = Math.abs(b.ledVoltage?.minimum ?? 0);

    const bAvgPumpC = Math.abs(b.waterPumpCurrent?.average ?? 0);
    const bMaxPumpC = Math.abs(b.waterPumpCurrent?.maximum ?? 0);
    const bMinPumpC = Math.abs(b.waterPumpCurrent?.minimum ?? 0);

    const bAvgPumpV = Math.abs(b.waterPumpVoltage?.average ?? 0);
    const bMaxPumpV = Math.abs(b.waterPumpVoltage?.maximum ?? 0);
    const bMinPumpV = Math.abs(b.waterPumpVoltage?.minimum ?? 0);

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

    // Validate Pump: Reject impossible sensor noise
    if (bAvgPumpC <= MAX_VALID_DC_CURRENT) {
      sumPumpC += bAvgPumpC * samples;
      validPumpSamples += samples;
      if (bMinPumpC < minPumpC) minPumpC = bMinPumpC;
      if (bMaxPumpC > maxPumpC && bMaxPumpC <= MAX_VALID_DC_CURRENT) maxPumpC = bMaxPumpC;
    }

    if (bAvgPumpV <= MAX_VALID_VOLTAGE) {
      sumPumpV += bAvgPumpV * samples;
      if (bMinPumpV < minPumpV) minPumpV = bMinPumpV;
      if (bMaxPumpV > maxPumpV) maxPumpV = bMaxPumpV;
    }
  }

  const avgLedC = validLedSamples > 0 ? sumLedC / validLedSamples : 0;
  const avgLedV = validLedSamples > 0 ? sumLedV / validLedSamples : 0;
  const avgPumpC = validPumpSamples > 0 ? sumPumpC / validPumpSamples : 0;
  const avgPumpV = validPumpSamples > 0 ? sumPumpV / validPumpSamples : 0;

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
    waterPumpCurrent: {
      minimum: minPumpC === Infinity ? 0 : minPumpC,
      maximum: maxPumpC === -Infinity ? 0 : maxPumpC,
      average: avgPumpC
    },
    waterPumpVoltage: {
      minimum: minPumpV === Infinity ? 0 : minPumpV,
      maximum: maxPumpV === -Infinity ? 0 : maxPumpV,
      average: avgPumpV
    }
  };
}

// ========================================================
// CORE FETCH & STRICT MATHEMATICAL CALCULATION ENGINE
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

    // 1. Extract and sanitize raw sensor values
    let rawLedC = Number(liveData?.ledCurrent ?? liveData?.current1);
    let rawLedV = Number(liveData?.ledVoltage ?? liveData?.voltage1);
    let rawPumpC = Number(liveData?.waterPumpCurrent ?? liveData?.current2);
    let rawPumpV = Number(liveData?.waterPumpVoltage ?? liveData?.voltage2);
    let rawTimestamp = Number(liveData?.timestamp);

    // Filter invalid readings (NaN, Infinity, negative voltage, sensor noise > 6A)
    const ledCurrent = (!isNaN(rawLedC) && isFinite(rawLedC) && Math.abs(rawLedC) <= MAX_VALID_DC_CURRENT) ? Math.abs(rawLedC) : telemetryCache.live.ledCurrent;
    const ledVoltage = (!isNaN(rawLedV) && isFinite(rawLedV) && rawLedV >= MIN_VALID_VOLTAGE && rawLedV <= MAX_VALID_VOLTAGE) ? rawLedV : telemetryCache.live.ledVoltage;
    const pumpCurrent = (!isNaN(rawPumpC) && isFinite(rawPumpC) && Math.abs(rawPumpC) <= MAX_VALID_DC_CURRENT) ? Math.abs(rawPumpC) : telemetryCache.live.waterPumpCurrent;
    const pumpVoltage = (!isNaN(rawPumpV) && isFinite(rawPumpV) && rawPumpV >= MIN_VALID_VOLTAGE && rawPumpV <= MAX_VALID_VOLTAGE) ? rawPumpV : telemetryCache.live.waterPumpVoltage;

    // Normalizing timestamp to milliseconds
    const currentTimestampMs = (!isNaN(rawTimestamp) && rawTimestamp > 0)
      ? (rawTimestamp < 10000000000 ? rawTimestamp * 1000 : rawTimestamp)
      : Date.now();

    // 2. Strict DC power calculation: P = V * I (no hardcoded multipliers!)
    const ledPowerWatts = ledVoltage * ledCurrent;
    const pumpPowerWatts = pumpVoltage * pumpCurrent;
    const totalPowerWatts = ledPowerWatts + pumpPowerWatts;

    // Device operating status
    const ledStatus = ledCurrent > 0.05 ? 'ON' : 'OFF';
    const pumpStatus = pumpCurrent > 0.05 ? 'RUNNING' : 'IDLE';

    // 3. Trapezoidal Energy Integration using Actual Timestamps
    if (accumulatorState.lastTimestampMs === 0) {
      accumulatorState.lastTimestampMs = currentTimestampMs;
      accumulatorState.firstTimestampMs = currentTimestampMs;
      accumulatorState.lastLedPowerW = ledPowerWatts;
      accumulatorState.lastPumpPowerW = pumpPowerWatts;
    } else if (currentTimestampMs > accumulatorState.lastTimestampMs) {
      const elapsedMs = currentTimestampMs - accumulatorState.lastTimestampMs;
      if (elapsedMs <= 60000) {
        const deltaLedKwh = integrateEnergy(accumulatorState.lastLedPowerW, ledPowerWatts, elapsedMs);
        const deltaPumpKwh = integrateEnergy(accumulatorState.lastPumpPowerW, pumpPowerWatts, elapsedMs);

        accumulatorState.accumulatedLedKwh += deltaLedKwh;
        accumulatorState.accumulatedPumpKwh += deltaPumpKwh;
      }
      accumulatorState.lastTimestampMs = currentTimestampMs;
      accumulatorState.lastLedPowerW = ledPowerWatts;
      accumulatorState.lastPumpPowerW = pumpPowerWatts;
      saveAccumulatorState();
    }

    const aggSummary = parseAggregates(aggData) || telemetryCache.aggregatesSummary;

    // Ensure accumulated energy includes minute buckets historical baseline if accumulator is fresh
    let totalLedKwh = accumulatorState.accumulatedLedKwh;
    let totalPumpKwh = accumulatorState.accumulatedPumpKwh;

    // If accumulator just started, calculate base energy from validated aggregate minute buckets
    if (totalLedKwh === 0 && totalPumpKwh === 0 && aggSummary?.bucketsCount > 0) {
      const hours = aggSummary.bucketsCount / 60;
      const baseLedW = aggSummary.ledVoltage.average * aggSummary.ledCurrent.average;
      const basePumpW = aggSummary.waterPumpVoltage.average * aggSummary.waterPumpCurrent.average;
      totalLedKwh = (baseLedW * hours) / 1000;
      totalPumpKwh = (basePumpW * hours) / 1000;
      accumulatorState.accumulatedLedKwh = totalLedKwh;
      accumulatorState.accumulatedPumpKwh = totalPumpKwh;
      saveAccumulatorState();
    }

    const totalKwh = totalLedKwh + totalPumpKwh;

    // 4. Exact Tariff Energy Charges: Energy Charge = Cumulative kWh * Tariff Rate (₹8)
    const ledEnergyChargeINR = totalLedKwh * TARIFF_RATE_PER_UNIT;
    const pumpEnergyChargeINR = totalPumpKwh * TARIFF_RATE_PER_UNIT;
    const totalEnergyChargeINR = totalKwh * TARIFF_RATE_PER_UNIT;

    // 5. Monthly Projections
    // Elapsed hours for historical calculation
    const elapsedHours = (aggSummary?.bucketsCount > 0)
      ? (aggSummary.bucketsCount / 60)
      : Math.max((Date.now() - (accumulatorState.firstTimestampMs || Date.now())) / 3600000, 0.1);

    // A. Historical Average Projection: (Total kWh / Elapsed Hours) * 720 hours
    const historicalMonthlyUnits = elapsedHours > 0 ? (totalKwh / elapsedHours) * 720 : 0;
    const historicalMonthlyCostINR = historicalMonthlyUnits * TARIFF_RATE_PER_UNIT;

    // B. Current Load Monthly Projection: (Instant kW) * 720 hours
    const currentLoadMonthlyUnits = (totalPowerWatts / 1000) * 720;
    const currentLoadMonthlyCostINR = currentLoadMonthlyUnits * TARIFF_RATE_PER_UNIT;

    telemetryCache = {
      live: {
        ledCurrent,
        ledVoltage,
        waterPumpCurrent: pumpCurrent,
        waterPumpVoltage: pumpVoltage,
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
      waterPump: {
        status: pumpStatus,
        current: pumpCurrent,
        voltage: pumpVoltage,
        instantPowerWatts: pumpPowerWatts,
        cumulativeKwh: totalPumpKwh,
        energyChargeINR: pumpEnergyChargeINR,
        stats: aggSummary.waterPumpCurrent,
        voltageStats: aggSummary.waterPumpVoltage
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
            label: "Historical Average Projection"
          },
          currentLoad: {
            monthlyUnits: currentLoadMonthlyUnits,
            monthlyCostINR: currentLoadMonthlyCostINR,
            label: "Current Load Projection"
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

// Endpoint: Live Telemetry & Calculations
app.get('/api/telemetry', async (req, res) => {
  const data = await fetchFirebaseTelemetry();
  res.json({
    success: true,
    data
  });
});

// Endpoint: Manual Simulation / Override for Testing
app.post('/api/telemetry/simulate', (req, res) => {
  const { current_one, current_two, voltage_two, voltage_one } = req.body;
  if (current_one !== undefined) telemetryCache.live.ledCurrent = Math.abs(Number(current_one));
  if (voltage_one !== undefined) telemetryCache.live.ledVoltage = Number(voltage_one);
  if (current_two !== undefined) telemetryCache.live.waterPumpCurrent = Math.abs(Number(current_two));
  if (voltage_two !== undefined) telemetryCache.live.waterPumpVoltage = Number(voltage_two);

  const c1 = telemetryCache.live.ledCurrent;
  const v1 = telemetryCache.live.ledVoltage;
  const c2 = telemetryCache.live.waterPumpCurrent;
  const v2 = telemetryCache.live.waterPumpVoltage;

  const pLed = v1 * c1;
  const pPump = v2 * c2;
  const pTotal = pLed + pPump;

  telemetryCache.led = {
    ...telemetryCache.led,
    status: c1 > 0.05 ? 'ON' : 'OFF',
    current: c1,
    voltage: v1,
    instantPowerWatts: pLed
  };

  telemetryCache.waterPump = {
    ...telemetryCache.waterPump,
    status: c2 > 0.05 ? 'RUNNING' : 'IDLE',
    current: c2,
    voltage: v2,
    instantPowerWatts: pPump
  };

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
  const pump = telemetry.waterPump;
  const overview = telemetry.systemOverview;
  const proj = overview.projections;

  const systemPrompt = `You are "AuraIoT", an expert Electrical Engineering and Energy Systems Assistant.
You have direct real-time access to the verified telemetry and calculation engine.

CRITICAL CALCULATION SPECIFICATION:
1. DC Power Formula:
   - LED Power = ledVoltage * ledCurrent = ${led.voltage.toFixed(2)} V * ${led.current.toFixed(3)} A = ${led.instantPowerWatts.toFixed(3)} W
   - Pump Power = waterPumpVoltage * waterPumpCurrent = ${pump.voltage.toFixed(2)} V * ${pump.current.toFixed(3)} A = ${pump.instantPowerWatts.toFixed(3)} W
   - Total Instant Power = ${overview.totalPowerWatts.toFixed(3)} W
2. Energy Integration & Tariff:
   - Cumulative Energy = ${overview.cumulativeUnitsKwh.toFixed(4)} Units (kWh) integrated via timestamps.
   - Energy Charge = Cumulative Units * ₹${TARIFF_RATE_PER_UNIT}/Unit = ₹${overview.energyChargeINR.toFixed(2)}
   - Device Breakdown:
     * LED Energy: ${led.cumulativeKwh.toFixed(4)} kWh (₹${led.energyChargeINR.toFixed(2)})
     * Pump Energy: ${pump.cumulativeKwh.toFixed(4)} kWh (₹${pump.energyChargeINR.toFixed(2)})
3. Projections (Distinct Definitions):
   - Historical Average Projection: ${proj.historicalAverage.monthlyUnits.toFixed(1)} Units/month (₹${proj.historicalAverage.monthlyCostINR.toFixed(2)}/month)
   - Current Load Projection: ${proj.currentLoad.monthlyUnits.toFixed(1)} Units/month (₹${proj.currentLoad.monthlyCostINR.toFixed(2)}/month)
4. Sensor Anomaly Note:
   - ACS712 DC sensors require offset and sensitivity calibration. High values (>6A) in raw history are filtered noise and must not be described as genuine overloads without physical verification.
   - The reported pump voltage of 1.18V yields 0.216W (1.18V * 0.183A). Note if the pump voltage appears lower than nominal operating voltage.

Answer queries with technical accuracy, clear markdown tables, and exact mathematical integrity.`;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**Verified Mathematical Telemetry:**\n- **LED:** ${led.voltage.toFixed(2)} V × ${led.current.toFixed(3)} A = **${led.instantPowerWatts.toFixed(3)} W**\n- **Pump:** ${pump.voltage.toFixed(2)} V × ${pump.current.toFixed(3)} A = **${pump.instantPowerWatts.toFixed(3)} W**\n- **Total Instant Power:** **${overview.totalPowerWatts.toFixed(3)} W**\n- **Energy Charge:** ${overview.cumulativeUnitsKwh.toFixed(4)} Units × ₹8.00 = **₹${overview.energyChargeINR.toFixed(2)}**\n\nPlease add your \`GROQ_API_KEY\` to chat.`
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
  console.log(`⚡ Strict DC Power Engine Active: P = V * I`);
  console.log(`💾 Trapezoidal Energy & State Persistence Active`);
  console.log(`===============================================`);
});
