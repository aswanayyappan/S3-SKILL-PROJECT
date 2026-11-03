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

// Indian Electricity Tariff Standard rate: ₹8.00 per unit (1 Unit = 1 kWh)
const INR_RATE_PER_UNIT = 8.00;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    waterPumpVoltage: { minimum: 0, maximum: 0, average: 0 },
    unitConsumptionKWh: {
      led_kWh: 0,
      pump_kWh: 0,
      total_kWh: 0,
      estimatedUnits: 0
    },
    costINR: {
      ratePerUnit: INR_RATE_PER_UNIT,
      led_inr: 0,
      pump_inr: 0,
      total_inr: 0
    }
  },
  historyTrend: [],
  lastUpdated: new Date().toISOString(),
  source: 'initializing'
};

// Parse /aggregates/minute buckets
function parseAggregates(minuteAggregates) {
  if (!minuteAggregates || typeof minuteAggregates !== 'object') return null;

  const bucketKeys = Object.keys(minuteAggregates).sort();
  if (bucketKeys.length === 0) return null;

  let totalSamples = 0;
  let sumLedC = 0, sumLedV = 0, sumPumpC = 0, sumPumpV = 0;
  let minLedC = Infinity, maxLedC = -Infinity;
  let minLedV = Infinity, maxLedV = -Infinity;
  let minPumpC = Infinity, maxPumpC = -Infinity;
  let minPumpV = Infinity, maxPumpV = -Infinity;

  const historyTrend = [];

  for (const key of bucketKeys) {
    const b = minuteAggregates[key];
    if (!b || typeof b !== 'object') continue;

    const samples = b.ledCurrent?.samples || b.waterPumpCurrent?.samples || 1;
    totalSamples += samples;

    const bAvgLedC = Math.abs(b.ledCurrent?.average ?? 0);
    const bMaxLedC = Math.abs(b.ledCurrent?.maximum ?? 0);
    const bMinLedC = Math.abs(b.ledCurrent?.minimum ?? 0);

    const bAvgLedV = b.ledVoltage?.average ?? 0;
    const bMaxLedV = b.ledVoltage?.maximum ?? 0;
    const bMinLedV = b.ledVoltage?.minimum ?? 0;

    const bAvgPumpC = Math.abs(b.waterPumpCurrent?.average ?? 0);
    const bMaxPumpC = Math.abs(b.waterPumpCurrent?.maximum ?? 0);
    const bMinPumpC = Math.abs(b.waterPumpCurrent?.minimum ?? 0);

    const bAvgPumpV = b.waterPumpVoltage?.average ?? 0;
    const bMaxPumpV = b.waterPumpVoltage?.maximum ?? 0;
    const bMinPumpV = b.waterPumpVoltage?.minimum ?? 0;

    sumLedC += bAvgLedC * samples;
    sumLedV += bAvgLedV * samples;
    sumPumpC += bAvgPumpC * samples;
    sumPumpV += bAvgPumpV * samples;

    if (bMinLedC < minLedC) minLedC = bMinLedC;
    if (bMaxLedC > maxLedC) maxLedC = bMaxLedC;
    if (bMinLedV < minLedV) minLedV = bMinLedV;
    if (bMaxLedV > maxLedV) maxLedV = bMaxLedV;

    if (bMinPumpC < minPumpC) minPumpC = bMinPumpC;
    if (bMaxPumpC > maxPumpC) maxPumpC = bMaxPumpC;
    if (bMinPumpV < minPumpV) minPumpV = bMinPumpV;
    if (bMaxPumpV > maxPumpV) maxPumpV = bMaxPumpV;

    // Store recent history trend for live mini charts
    historyTrend.push({
      bucket: key,
      ledCurrent: parseFloat(bAvgLedC.toFixed(3)),
      pumpCurrent: parseFloat(bAvgPumpC.toFixed(3)),
      ledVolt: parseFloat(bAvgLedV.toFixed(2)),
      pumpVolt: parseFloat(bAvgPumpV.toFixed(2))
    });
  }

  const avgLedC = totalSamples > 0 ? sumLedC / totalSamples : 0;
  const avgLedV = totalSamples > 0 ? sumLedV / totalSamples : 0;
  const avgPumpC = totalSamples > 0 ? sumPumpC / totalSamples : 0;
  const avgPumpV = totalSamples > 0 ? sumPumpV / totalSamples : 0;

  const totalMinutes = bucketKeys.length;
  const hours = totalMinutes / 60;

  // Power in kW -> kWh (1 Unit = 1 kWh)
  const ledPowerWatts = (avgLedV > 1 ? avgLedV : 12) * avgLedC;
  const ledKWh = (ledPowerWatts * hours) / 1000;

  const pumpPowerWatts = (avgPumpV > 50 ? avgPumpV : 230) * avgPumpC;
  const pumpKWh = (pumpPowerWatts * hours) / 1000;

  const totalKWh = ledKWh + pumpKWh;

  // Cost calculation in Indian Rupees (INR ₹)
  const ledCostINR = ledKWh * INR_RATE_PER_UNIT;
  const pumpCostINR = pumpKWh * INR_RATE_PER_UNIT;
  const totalCostINR = totalKWh * INR_RATE_PER_UNIT;

  return {
    totalSamples,
    bucketsCount: totalMinutes,
    operatingHours: parseFloat(hours.toFixed(2)),
    ledCurrent: {
      minimum: parseFloat((minLedC === Infinity ? 0 : minLedC).toFixed(4)),
      maximum: parseFloat((maxLedC === -Infinity ? 0 : maxLedC).toFixed(4)),
      average: parseFloat(avgLedC.toFixed(4))
    },
    ledVoltage: {
      minimum: parseFloat((minLedV === Infinity ? 0 : minLedV).toFixed(4)),
      maximum: parseFloat((maxLedV === -Infinity ? 0 : maxLedV).toFixed(4)),
      average: parseFloat(avgLedV.toFixed(4))
    },
    waterPumpCurrent: {
      minimum: parseFloat((minPumpC === Infinity ? 0 : minPumpC).toFixed(4)),
      maximum: parseFloat((maxPumpC === -Infinity ? 0 : maxPumpC).toFixed(4)),
      average: parseFloat(avgPumpC.toFixed(4))
    },
    waterPumpVoltage: {
      minimum: parseFloat((minPumpV === Infinity ? 0 : minPumpV).toFixed(4)),
      maximum: parseFloat((maxPumpV === -Infinity ? 0 : maxPumpV).toFixed(4)),
      average: parseFloat(avgPumpV.toFixed(4))
    },
    unitConsumptionKWh: {
      led_kWh: parseFloat(ledKWh.toFixed(5)),
      pump_kWh: parseFloat(pumpKWh.toFixed(5)),
      total_kWh: parseFloat(totalKWh.toFixed(5)),
      estimatedUnits: parseFloat(totalKWh.toFixed(4))
    },
    costINR: {
      currency: "INR (₹)",
      ratePerUnit: INR_RATE_PER_UNIT,
      led_inr: parseFloat(ledCostINR.toFixed(4)),
      pump_inr: parseFloat(pumpCostINR.toFixed(4)),
      total_inr: parseFloat(totalCostINR.toFixed(4))
    },
    recentTrend: historyTrend.slice(-15) // last 15 buckets
  };
}

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

    const ledC = liveData ? Math.abs(parseFloat(liveData.ledCurrent ?? liveData.current1 ?? 0)) : telemetryCache.live.ledCurrent;
    const ledV = liveData ? parseFloat(liveData.ledVoltage ?? liveData.voltage1 ?? 0) : telemetryCache.live.ledVoltage;
    const pumpC = liveData ? Math.abs(parseFloat(liveData.waterPumpCurrent ?? liveData.current2 ?? 0)) : telemetryCache.live.waterPumpCurrent;
    const pumpV = liveData ? parseFloat(liveData.waterPumpVoltage ?? liveData.voltage2 ?? 0) : telemetryCache.live.waterPumpVoltage;

    const ledStatus = ledC > 0.05 ? 'ON' : 'OFF';
    const pumpStatus = pumpC > 0.1 ? 'RUNNING' : 'IDLE';

    const aggSummary = parseAggregates(aggData) || telemetryCache.aggregatesSummary;

    // Derived operational health score (0-100%)
    let healthScore = 100;
    if (pumpC > 5.0) healthScore -= 20; // high pump load
    if (ledV > 5.5) healthScore -= 15; // LED overvoltage
    if (pumpV > 25.0 && pumpV < 180.0) healthScore -= 10; // unusual intermediate voltage

    telemetryCache = {
      live: {
        ledCurrent: parseFloat(ledC.toFixed(4)),
        ledVoltage: parseFloat(ledV.toFixed(4)),
        waterPumpCurrent: parseFloat(pumpC.toFixed(4)),
        waterPumpVoltage: parseFloat(pumpV.toFixed(4)),
        timestamp: liveData?.timestamp || Date.now()
      },
      led: {
        status: ledStatus,
        current: parseFloat(ledC.toFixed(4)),
        voltage: parseFloat(ledV.toFixed(4)),
        instantPowerWatts: parseFloat((ledC * (ledV > 1 ? ledV : 12)).toFixed(2)),
        stats: aggSummary.ledCurrent,
        voltageStats: aggSummary.ledVoltage,
        energyKWh: aggSummary.unitConsumptionKWh.led_kWh,
        costINR: aggSummary.costINR.led_inr
      },
      waterPump: {
        status: pumpStatus,
        current: parseFloat(pumpC.toFixed(4)),
        voltage: parseFloat(pumpV.toFixed(4)),
        instantPowerWatts: parseFloat((pumpC * (pumpV > 50 ? pumpV : 230)).toFixed(2)),
        stats: aggSummary.waterPumpCurrent,
        voltageStats: aggSummary.waterPumpVoltage,
        energyKWh: aggSummary.unitConsumptionKWh.pump_kWh,
        costINR: aggSummary.costINR.pump_inr
      },
      systemOverview: {
        healthScore: Math.max(healthScore, 50),
        totalPowerWatts: parseFloat(((ledC * (ledV > 1 ? ledV : 12)) + (pumpC * (pumpV > 50 ? pumpV : 230))).toFixed(1)),
        totalUnitsKWh: aggSummary.unitConsumptionKWh.total_kWh,
        totalCostINR: aggSummary.costINR.total_inr,
        tariffRate: `₹${INR_RATE_PER_UNIT}/Unit`
      },
      aggregatesSummary: aggSummary,
      historyTrend: aggSummary.recentTrend || [],
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

app.get('/api/telemetry', async (req, res) => {
  const data = await fetchFirebaseTelemetry();
  res.json({
    success: true,
    data,
    currency: "INR (₹)",
    ratePerUnit: `₹${INR_RATE_PER_UNIT}`
  });
});

app.post('/api/telemetry/simulate', (req, res) => {
  const { current_one, current_two, voltage_two, voltage_one } = req.body;
  if (current_one !== undefined) telemetryCache.live.ledCurrent = Math.abs(parseFloat(current_one));
  if (voltage_one !== undefined) telemetryCache.live.ledVoltage = parseFloat(voltage_one);
  if (current_two !== undefined) telemetryCache.live.waterPumpCurrent = Math.abs(parseFloat(current_two));
  if (voltage_two !== undefined) telemetryCache.live.waterPumpVoltage = parseFloat(voltage_two);

  const c1 = telemetryCache.live.ledCurrent;
  const v1 = telemetryCache.live.ledVoltage;
  const c2 = telemetryCache.live.waterPumpCurrent;
  const v2 = telemetryCache.live.waterPumpVoltage;

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

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const telemetry = await fetchFirebaseTelemetry();
  const agg = telemetry.aggregatesSummary;
  const overview = telemetry.systemOverview;

  const systemPrompt = `You are "AuraIoT", an expert Industrial IoT Telemetry Engineer & Electrical Energy Advisor.
You monitor live IoT hardware connected via Firebase Realtime Database (https://s3-skills-default-rtdb.firebaseio.com/).

CURRENCY & BILLING SPECIFICATION:
- ALL financial calculations MUST strictly use INDIAN RUPEES (INR / ₹) at the standard industrial/commercial tariff of ₹${INR_RATE_PER_UNIT} per electricity unit (1 Unit = 1 kWh).
- NEVER use USD ($), Euro (€), or other currencies. ALWAYS use Indian Rupees (₹).

LIVE SYSTEM STATUS & STATISTICAL METRICS:
1. LED FIXTURE:
   - Live Current: ${telemetry.live.ledCurrent} A | Status: ${telemetry.led?.status}
   - Live Voltage: ${telemetry.live.ledVoltage} V | Instant Power: ${telemetry.led?.instantPowerWatts} W
   - Historical Aggregates (${agg.bucketsCount} minute buckets, ${agg.totalSamples} samples):
     * Maximum Peak Current: ${agg.ledCurrent.maximum} A
     * Minimum Current: ${agg.ledCurrent.minimum} A
     * Average Current: ${agg.ledCurrent.average} A
     * Voltage: Max ${agg.ledVoltage.maximum} V, Min ${agg.ledVoltage.minimum} V, Avg ${agg.ledVoltage.average} V
   - Energy Consumed: ${agg.unitConsumptionKWh.led_kWh} Units (kWh)
   - Estimated Cost: ₹${agg.costINR.led_inr}

2. WATER PUMP MOTOR:
   - Live Current: ${telemetry.live.waterPumpCurrent} A | Status: ${telemetry.waterPump?.status}
   - Live Voltage: ${telemetry.live.waterPumpVoltage} V | Instant Power: ${telemetry.waterPump?.instantPowerWatts} W
   - Historical Aggregates (${agg.bucketsCount} minute buckets, ${agg.totalSamples} samples):
     * Maximum Peak Current: ${agg.waterPumpCurrent.maximum} A
     * Minimum Current: ${agg.waterPumpCurrent.minimum} A
     * Average Current: ${agg.waterPumpCurrent.average} A
     * Voltage: Max ${agg.waterPumpVoltage.maximum} V, Min ${agg.waterPumpVoltage.minimum} V, Avg ${agg.waterPumpVoltage.average} V
   - Energy Consumed: ${agg.unitConsumptionKWh.pump_kWh} Units (kWh)
   - Estimated Cost: ₹${agg.costINR.pump_inr}

3. FACILITY OVERVIEW:
   - Total Units Consumed: ${overview.totalUnitsKWh} Units (kWh)
   - Total Cost: ₹${overview.totalCostINR} (at ₹${INR_RATE_PER_UNIT}/Unit)
   - Overall Health Score: ${overview.healthScore}%
   - Total Instant Load: ${overview.totalPowerWatts} W
   - Last Sync: ${telemetry.lastUpdated}

RESPONSE GUIDELINES:
- When calculating electricity cost or monthly projection, calculate in ₹ (INR): (Units * ₹8.00).
- Present clear structured summaries with markdown tables, bold values, and concise engineering recommendations.`;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**Live Telemetry (INR ₹):**\n- **LED:** \`${telemetry.live.ledCurrent} A\` | Max: \`${agg.ledCurrent.maximum} A\` | Cost: \`₹${agg.costINR.led_inr}\`\n- **Pump:** \`${telemetry.live.waterPumpCurrent} A\` | Max: \`${agg.waterPumpCurrent.maximum} A\` | Cost: \`₹${agg.costINR.pump_inr}\`\n- **Total Consumption:** \`${overview.totalUnitsKWh} Units (kWh)\` = **₹${overview.totalCostINR}**\n\nAdd your \`GROQ_API_KEY\` to chat.`
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
  console.log(`🇮🇳 Currency configured: Indian Rupee (₹${INR_RATE_PER_UNIT}/Unit)`);
  console.log(`💡 ledCurrent & ledVoltage = LED Fixture`);
  console.log(`🚰 waterPumpCurrent & waterPumpVoltage = Water Pump`);
  console.log(`===============================================`);
});
