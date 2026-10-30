import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://s3-skills-default-rtdb.firebaseio.com/';
const FIREBASE_AUTH_SECRET = process.env.FIREBASE_AUTH_SECRET || '';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory telemetry cache
let telemetryCache = {
  live: {
    current1: 0,
    voltage1: 0,
    current2: 0,
    voltage2: 0,
    timestamp: Date.now()
  },
  statsSummary: {
    totalSamples: 0,
    c1: { min: 0, max: 0, avg: 0 },
    v1: { min: 0, max: 0, avg: 0 },
    c2: { min: 0, max: 0, avg: 0 },
    v2: { min: 0, max: 0, avg: 0 },
    unitConsumptionKWh: {
      led_kWh: 0,
      pump_kWh: 0,
      total_kWh: 0
    }
  },
  lastUpdated: new Date().toISOString(),
  source: 'initializing'
};

// Helper: Recursively extract all stat buckets (e.g. from /statistics/hour or /statistics/minute)
function parseStatistics(statsNode) {
  let allBuckets = [];

  function traverse(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.current1 && (obj.current1.avg !== undefined || obj.samples !== undefined)) {
      allBuckets.push(obj);
      return;
    }
    for (const key of Object.keys(obj)) {
      traverse(obj[key]);
    }
  }

  traverse(statsNode);

  if (allBuckets.length === 0) return null;

  let totalSamples = 0;
  let sumC1 = 0, sumV1 = 0, sumC2 = 0, sumV2 = 0;
  let minC1 = Infinity, maxC1 = -Infinity;
  let minV1 = Infinity, maxV1 = -Infinity;
  let minC2 = Infinity, maxC2 = -Infinity;
  let minV2 = Infinity, maxV2 = -Infinity;

  for (const b of allBuckets) {
    const samples = b.samples || 1;
    totalSamples += samples;

    // Use absolute current values (sensors record polarity sign depending on clamp orientation)
    const bAvgC1 = Math.abs(b.current1?.avg ?? 0);
    const bMaxC1 = Math.max(Math.abs(b.current1?.max ?? 0), Math.abs(b.current1?.min ?? 0));
    const bMinC1 = Math.min(Math.abs(b.current1?.max ?? 0), Math.abs(b.current1?.min ?? 0));

    const bAvgV1 = b.voltage1?.avg ?? 0;
    const bMaxV1 = b.voltage1?.max ?? 0;
    const bMinV1 = b.voltage1?.min ?? 0;

    const bAvgC2 = Math.abs(b.current2?.avg ?? 0);
    const bMaxC2 = Math.max(Math.abs(b.current2?.max ?? 0), Math.abs(b.current2?.min ?? 0));
    const bMinC2 = Math.min(Math.abs(b.current2?.max ?? 0), Math.abs(b.current2?.min ?? 0));

    const bAvgV2 = b.voltage2?.avg ?? 0;
    const bMaxV2 = b.voltage2?.max ?? 0;
    const bMinV2 = b.voltage2?.min ?? 0;

    sumC1 += bAvgC1 * samples;
    sumV1 += bAvgV1 * samples;
    sumC2 += bAvgC2 * samples;
    sumV2 += bAvgV2 * samples;

    if (bMinC1 < minC1) minC1 = bMinC1;
    if (bMaxC1 > maxC1) maxC1 = bMaxC1;
    if (bMinV1 < minV1) minV1 = bMinV1;
    if (bMaxV1 > maxV1) maxV1 = bMaxV1;

    if (bMinC2 < minC2) minC2 = bMinC2;
    if (bMaxC2 > maxC2) maxC2 = bMaxC2;
    if (bMinV2 < minV2) minV2 = bMinV2;
    if (bMaxV2 > maxV2) maxV2 = bMaxV2;
  }

  const avgC1 = totalSamples > 0 ? sumC1 / totalSamples : 0;
  const avgV1 = totalSamples > 0 ? sumV1 / totalSamples : 0;
  const avgC2 = totalSamples > 0 ? sumC2 / totalSamples : 0;
  const avgV2 = totalSamples > 0 ? sumV2 / totalSamples : 0;

  // Energy / Unit Consumption Estimation (1 Unit = 1 kWh)
  // Each sample interval in minute stats is approx 3.3 seconds (18 samples/min = 60s / 18)
  const totalOperatingHours = (totalSamples * (60 / 18)) / 3600; // estimated hours
  // LED: V1 * C1 (W) * hours / 1000
  const ledKWh = ((avgV1 > 1 ? avgV1 : 12) * avgC1 * totalOperatingHours) / 1000;
  // Water Pump: V2 * C2 (W) * hours / 1000
  const pumpKWh = ((avgV2 > 50 ? avgV2 : 230) * avgC2 * totalOperatingHours) / 1000;

  return {
    totalSamples,
    operatingHours: parseFloat(totalOperatingHours.toFixed(3)),
    c1: {
      min: parseFloat((minC1 === Infinity ? 0 : minC1).toFixed(3)),
      max: parseFloat((maxC1 === -Infinity ? 0 : maxC1).toFixed(3)),
      avg: parseFloat(avgC1.toFixed(3))
    },
    v1: {
      min: parseFloat((minV1 === Infinity ? 0 : minV1).toFixed(3)),
      max: parseFloat((maxV1 === -Infinity ? 0 : maxV1).toFixed(3)),
      avg: parseFloat(avgV1.toFixed(3))
    },
    c2: {
      min: parseFloat((minC2 === Infinity ? 0 : minC2).toFixed(3)),
      max: parseFloat((maxC2 === -Infinity ? 0 : maxC2).toFixed(3)),
      avg: parseFloat(avgC2.toFixed(3))
    },
    v2: {
      min: parseFloat((minV2 === Infinity ? 0 : minV2).toFixed(3)),
      max: parseFloat((maxV2 === -Infinity ? 0 : maxV2).toFixed(3)),
      avg: parseFloat(avgV2.toFixed(3))
    },
    unitConsumptionKWh: {
      led_kWh: parseFloat(ledKWh.toFixed(5)),
      pump_kWh: parseFloat(pumpKWh.toFixed(5)),
      total_kWh: parseFloat((ledKWh + pumpKWh).toFixed(5)),
      estimatedUnits: parseFloat((ledKWh + pumpKWh).toFixed(4)) // 1 Unit = 1 kWh
    }
  };
}

// Fetch both /live and /statistics from Firebase Realtime Database
async function fetchFirebaseTelemetry() {
  try {
    let baseUrl = FIREBASE_DB_URL.endsWith('/') ? FIREBASE_DB_URL.slice(0, -1) : FIREBASE_DB_URL;
    const authQuery = FIREBASE_AUTH_SECRET ? `?auth=${encodeURIComponent(FIREBASE_AUTH_SECRET)}` : '';

    // Fetch live node and statistics node in parallel
    const [liveRes, statsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/live.json${authQuery}`, { signal: AbortSignal.timeout(4000) }),
      fetch(`${baseUrl}/statistics.json${authQuery}`, { signal: AbortSignal.timeout(4000) })
    ]);

    let liveData = null;
    if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
      liveData = await liveRes.value.json();
    }

    let statsData = null;
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      statsData = await statsRes.value.json();
    }

    // Process live readings
    const c1 = liveData ? Math.abs(parseFloat(liveData.current1 ?? 0)) : telemetryCache.live.current1;
    const v1 = liveData ? parseFloat(liveData.voltage1 ?? 0) : telemetryCache.live.voltage1;
    const c2 = liveData ? Math.abs(parseFloat(liveData.current2 ?? 0)) : telemetryCache.live.current2;
    const v2 = liveData ? parseFloat(liveData.voltage2 ?? 0) : telemetryCache.live.voltage2;

    const ledStatus = c1 > 0.05 ? 'ON' : 'OFF';
    const pumpStatus = c2 > 0.1 ? 'RUNNING' : 'IDLE';

    // Calculate aggregated statistical metrics (min, max, avg, units/kWh)
    const statsSummary = parseStatistics(statsData) || telemetryCache.statsSummary;

    telemetryCache = {
      live: {
        current1: parseFloat(c1.toFixed(3)),
        voltage1: parseFloat(v1.toFixed(3)),
        current2: parseFloat(c2.toFixed(3)),
        voltage2: parseFloat(v2.toFixed(3)),
        timestamp: liveData?.timestamp || Date.now()
      },
      led: {
        status: ledStatus,
        current: parseFloat(c1.toFixed(3)),
        voltage: parseFloat(v1.toFixed(3)),
        instantPowerWatts: parseFloat((c1 * (v1 > 1 ? v1 : 12)).toFixed(2)),
        stats: statsSummary.c1,
        voltageStats: statsSummary.v1,
        energyKWh: statsSummary.unitConsumptionKWh.led_kWh
      },
      waterPump: {
        status: pumpStatus,
        current: parseFloat(c2.toFixed(3)),
        voltage: parseFloat(v2.toFixed(3)),
        instantPowerWatts: parseFloat((c2 * (v2 > 50 ? v2 : 230)).toFixed(2)),
        stats: statsSummary.c2,
        voltageStats: statsSummary.v2,
        energyKWh: statsSummary.unitConsumptionKWh.pump_kWh
      },
      statsSummary,
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

// Endpoint: Live Telemetry & Statistical Analysis
app.get('/api/telemetry', async (req, res) => {
  const data = await fetchFirebaseTelemetry();
  res.json({
    success: true,
    data,
    meta: {
      led: "Current 1 (LED lighting fixture)",
      waterPump: "Current 2 & Voltage 2 (Water Pump motor)",
      unitsDefinition: "1 Electricity Unit = 1 kWh"
    }
  });
});

// Endpoint: Simulator / Override
app.post('/api/telemetry/simulate', (req, res) => {
  const { current_one, current_two, voltage_two, voltage_one } = req.body;
  if (current_one !== undefined) telemetryCache.live.current1 = Math.abs(parseFloat(current_one));
  if (voltage_one !== undefined) telemetryCache.live.voltage1 = parseFloat(voltage_one);
  if (current_two !== undefined) telemetryCache.live.current2 = Math.abs(parseFloat(current_two));
  if (voltage_two !== undefined) telemetryCache.live.voltage2 = parseFloat(voltage_two);

  const c1 = telemetryCache.live.current1;
  const v1 = telemetryCache.live.voltage1;
  const c2 = telemetryCache.live.current2;
  const v2 = telemetryCache.live.voltage2;

  telemetryCache.led = {
    ...telemetryCache.led,
    status: c1 > 0.05 ? 'ON' : 'OFF',
    current: c1,
    voltage: v1,
    instantPowerWatts: parseFloat((c1 * (v1 > 1 ? v1 : 12)).toFixed(2))
  };

  telemetryCache.waterPump = {
    ...telemetryCache.waterPump,
    status: c2 > 0.1 ? 'RUNNING' : 'IDLE',
    current: c2,
    voltage: v2,
    instantPowerWatts: parseFloat((c2 * (v2 > 50 ? v2 : 230)).toFixed(2))
  };

  telemetryCache.lastUpdated = new Date().toISOString();
  telemetryCache.source = 'manual_override';

  res.json({ success: true, data: telemetryCache });
});

// Endpoint: Chat with Groq AI with Statistical & Unit Consumption Context
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Always fetch fresh telemetry and statistical trends
  const telemetry = await fetchFirebaseTelemetry();
  const stats = telemetry.statsSummary;

  const systemPrompt = `You are "AuraIoT", an expert Industrial IoT Telemetry Engineer & Electrical Energy Analyst.
You monitor live IoT hardware connected via Firebase Realtime Database (https://s3-skills-default-rtdb.firebaseio.com/).

DEVICE TELEMETRY & STATISTICAL METRICS:

1. LED FIXTURE (Monitored via Current 1 / current1):
   - Current Instant: ${telemetry.live.current1} A | Status: ${telemetry.led?.status}
   - Instantaneous Power: ${telemetry.led?.instantPowerWatts} W
   - STATISTICAL ANALYSIS (from historical data buckets, ${stats.totalSamples} total recorded samples):
     * Current Max Peak: ${stats.c1.max} A
     * Current Min: ${stats.c1.min} A
     * Current Average: ${stats.c1.avg} A
     * Voltage Max: ${stats.v1.max} V | Min: ${stats.v1.min} V | Avg: ${stats.v1.avg} V
   - Cumulative Unit Consumption: ${stats.unitConsumptionKWh.led_kWh} kWh (Units)

2. WATER PUMP MOTOR (Monitored via Current 2 / current2 & Voltage 2 / voltage2):
   - Current Instant: ${telemetry.live.current2} A | Status: ${telemetry.waterPump?.status}
   - Voltage Instant: ${telemetry.live.voltage2} V
   - Instantaneous Power: ${telemetry.waterPump?.instantPowerWatts} W
   - STATISTICAL ANALYSIS (from historical data buckets, ${stats.totalSamples} total recorded samples):
     * Current Max Peak: ${stats.c2.max} A
     * Current Min: ${stats.c2.min} A
     * Current Average: ${stats.c2.avg} A
     * Voltage Max: ${stats.v2.max} V | Min: ${stats.v2.min} V | Avg: ${stats.v2.avg} V
   - Cumulative Unit Consumption: ${stats.unitConsumptionKWh.pump_kWh} kWh (Units)

3. OVERALL ENERGY CONSUMPTION SUMMARY:
   - Total Monitoring Duration: ~${stats.operatingHours} hours (${stats.totalSamples} samples)
   - Total Energy Consumption: ${stats.unitConsumptionKWh.total_kWh} kWh (${stats.unitConsumptionKWh.estimatedUnits} Electricity Units)
   - Last Telemetry Sync: ${telemetry.lastUpdated}

ROLE & RESPONSE DIRECTIVES:
- Emphasize STATISTICAL VALUES whenever asked: always cite Max, Min, Average, and Peak loads.
- Highlight UNIT CONSUMPTION (kWh / Units) and estimate operating cost if requested (e.g., assuming typical grid rate like $0.12 or ₹8 per unit).
- Point out anomalies: note if voltage surges (Max voltage) or current surges (Peak current) indicate motor inrush, dry-run, or circuit overload.
- Keep output cleanly structured with markdown tables or bulleted highlights.`;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**Statistical Snapshot:**\n- **LED Current (1):** Instant: \`${telemetry.live.current1} A\`, Max: \`${stats.c1.max} A\`, Avg: \`${stats.c1.avg} A\`, Energy: \`${stats.unitConsumptionKWh.led_kWh} kWh\`\n- **Pump Current (2):** Instant: \`${telemetry.live.current2} A\`, Max: \`${stats.c2.max} A\`, Avg: \`${stats.c2.avg} A\`\n- **Total Units Consumed:** \`${stats.unitConsumptionKWh.total_kWh} kWh\`\n\nAdd your \`GROQ_API_KEY\` to chat with the AI.`
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
  console.log(`🚀 IoT & Groq Server running at: http://localhost:${PORT}`);
  console.log(`📡 Connected to Firebase: ${FIREBASE_DB_URL}`);
  console.log(`📊 Reading /live and /statistics nodes`);
  console.log(`💡 Current 1 = LED Fixture`);
  console.log(`🚰 Current 2 & Voltage 2 = Water Pump`);
  console.log(`===============================================`);
});
