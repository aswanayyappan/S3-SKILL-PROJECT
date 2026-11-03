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

// ==========================================
// KSEB TARIFF CALCULATION ENGINE (2026 SCHEDULE)
// ==========================================

/**
 * Calculates exact KSEB Domestic (LT-I) electricity bill
 * @param {number} units - Total consumption in units (kWh)
 * @param {boolean} isBPL - Below Poverty Line subsidy eligibility (<=40 units, load <= 1000W)
 * @param {number} fixedCharge - Base fixed charge in ₹ (default ₹50 for single phase)
 */
function calculateKSEBDomesticBill(units, isBPL = false, fixedCharge = 50.0) {
  if (units <= 0) {
    return {
      units: 0,
      slabType: 'Zero Consumption',
      energyCharge: 0,
      duty: 0,
      fac: 0,
      fixedCharge: 0,
      meterRent: 0,
      totalBill: 0,
      effectiveRatePerUnit: 0
    };
  }

  // 1. BPL Subsidy Check (<= 40 units, ₹1.50/unit, no fixed charge)
  if (isBPL && units <= 40) {
    const energyCharge = units * 1.50;
    const duty = energyCharge * 0.05; // 5% Electricity duty
    const fac = units * 0.15; // Average Fuel Adjustment Charge ₹0.15/unit
    const total = energyCharge + duty + fac;
    return {
      units: parseFloat(units.toFixed(4)),
      slabType: 'BPL Subsidy (≤40 Units @ ₹1.50/Unit)',
      energyCharge: parseFloat(energyCharge.toFixed(2)),
      fixedCharge: 0,
      duty: parseFloat(duty.toFixed(2)),
      meterRent: 6.00,
      fac: parseFloat(fac.toFixed(2)),
      totalBill: parseFloat((total + 6.00).toFixed(2)),
      effectiveRatePerUnit: parseFloat(((total + 6.00) / units).toFixed(2))
    };
  }

  let energyCharge = 0;
  let slabType = '';

  // 2. Telescopic Slabs (<= 250 Units)
  if (units <= 250) {
    slabType = 'Telescopic Slabs (≤250 Units)';
    let remaining = units;

    // 0 - 50 Units @ ₹3.35
    const u1 = Math.min(remaining, 50);
    energyCharge += u1 * 3.35;
    remaining -= u1;

    // 51 - 100 Units @ ₹4.15
    if (remaining > 0) {
      const u2 = Math.min(remaining, 50);
      energyCharge += u2 * 4.15;
      remaining -= u2;
    }

    // 101 - 150 Units @ ₹5.30
    if (remaining > 0) {
      const u3 = Math.min(remaining, 50);
      energyCharge += u3 * 5.30;
      remaining -= u3;
    }

    // 151 - 200 Units @ ₹7.10
    if (remaining > 0) {
      const u4 = Math.min(remaining, 50);
      energyCharge += u4 * 7.10;
      remaining -= u4;
    }

    // 201 - 250 Units @ ₹8.50
    if (remaining > 0) {
      const u5 = Math.min(remaining, 50);
      energyCharge += u5 * 8.50;
      remaining -= u5;
    }
  } else {
    // 3. Non-Telescopic Slabs (> 250 Units) - Entire consumption re-rated at flat rate
    if (units <= 300) {
      slabType = 'Non-Telescopic (251–300 Units @ ₹6.75 flat)';
      energyCharge = units * 6.75;
    } else if (units <= 350) {
      slabType = 'Non-Telescopic (301–350 Units @ ₹7.60 flat)';
      energyCharge = units * 7.60;
    } else if (units <= 400) {
      slabType = 'Non-Telescopic (351–400 Units @ ₹7.95 flat)';
      energyCharge = units * 7.95;
    } else if (units <= 500) {
      slabType = 'Non-Telescopic (401–500 Units @ ₹8.25 flat)';
      energyCharge = units * 8.25;
    } else {
      slabType = 'Non-Telescopic (>500 Units @ ₹9.20 flat)';
      energyCharge = units * 9.20;
    }
  }

  // Statutory & Additional Charges
  const duty = energyCharge * 0.05; // 5% electricity duty
  const meterRent = 6.00; // Single phase meter rent ~₹6
  const fac = units * 0.15; // Fuel Adjustment Charge ~₹0.15/unit
  const totalBill = energyCharge + fixedCharge + duty + meterRent + fac;

  return {
    units: parseFloat(units.toFixed(4)),
    slabType,
    energyCharge: parseFloat(energyCharge.toFixed(2)),
    fixedCharge,
    duty: parseFloat(duty.toFixed(2)),
    meterRent,
    fac: parseFloat(fac.toFixed(2)),
    totalBill: parseFloat(totalBill.toFixed(2)),
    effectiveRatePerUnit: parseFloat((totalBill / units).toFixed(2))
  };
}

// Commercial Tariff LT-VIIA calculation helper
function calculateKSEBCommercialBill(units) {
  let rate = 6.05;
  if (units > 500) rate = 9.40;
  else if (units > 100) rate = 7.50;

  const energyCharge = units * rate;
  const duty = energyCharge * 0.05;
  const fixed = 120.0;
  const fac = units * 0.15;
  const total = energyCharge + duty + fixed + fac;
  return {
    units: parseFloat(units.toFixed(4)),
    tariff: 'Commercial (LT-VIIA)',
    energyCharge: parseFloat(energyCharge.toFixed(2)),
    totalBill: parseFloat(total.toFixed(2)),
    ratePerUnit: rate
  };
}

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
    ksebBilling: {
      domestic: null,
      commercial: null
    }
  },
  historyTrend: [],
  lastUpdated: new Date().toISOString(),
  source: 'initializing'
};

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

  // KSEB Domestic Billing for individual and total
  const domesticTotal = calculateKSEBDomesticBill(totalKWh);
  const domesticLed = calculateKSEBDomesticBill(ledKWh);
  const domesticPump = calculateKSEBDomesticBill(pumpKWh);
  const commercialTotal = calculateKSEBCommercialBill(totalKWh);

  // 30-Day Monthly Projection (based on observed consumption rate)
  const monthlyUnitsProjected = hours > 0 ? parseFloat(((totalKWh / hours) * 24 * 30).toFixed(2)) : 0;
  const monthlyDomesticProjection = calculateKSEBDomesticBill(monthlyUnitsProjected);

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
    ksebBilling: {
      provider: "Kerala State Electricity Board (KSEB)",
      scheduleYear: "2026",
      domesticLT1: domesticTotal,
      commercialLT7A: commercialTotal,
      ledPortion: domesticLed,
      pumpPortion: domesticPump,
      monthlyProjection: {
        projectedUnits: monthlyUnitsProjected,
        projectedBillINR: monthlyDomesticProjection.totalBill,
        slab: monthlyDomesticProjection.slabType
      }
    },
    recentTrend: historyTrend.slice(-15)
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

    let healthScore = 100;
    if (pumpC > 5.0) healthScore -= 20;
    if (ledV > 5.5) healthScore -= 15;
    if (pumpV > 25.0 && pumpV < 180.0) healthScore -= 10;

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
        costINR: aggSummary.ksebBilling?.ledPortion?.energyCharge ?? 0
      },
      waterPump: {
        status: pumpStatus,
        current: parseFloat(pumpC.toFixed(4)),
        voltage: parseFloat(pumpV.toFixed(4)),
        instantPowerWatts: parseFloat((pumpC * (pumpV > 50 ? pumpV : 230)).toFixed(2)),
        stats: aggSummary.waterPumpCurrent,
        voltageStats: aggSummary.waterPumpVoltage,
        energyKWh: aggSummary.unitConsumptionKWh.pump_kWh,
        costINR: aggSummary.ksebBilling?.pumpPortion?.energyCharge ?? 0
      },
      systemOverview: {
        healthScore: Math.max(healthScore, 50),
        totalPowerWatts: parseFloat(((ledC * (ledV > 1 ? ledV : 12)) + (pumpC * (pumpV > 50 ? pumpV : 230))).toFixed(1)),
        totalUnitsKWh: aggSummary.unitConsumptionKWh.total_kWh,
        ksebBillINR: aggSummary.ksebBilling?.domesticLT1?.totalBill ?? 0,
        ksebSlab: aggSummary.ksebBilling?.domesticLT1?.slabType ?? 'Telescopic',
        monthlyProjectedBillINR: aggSummary.ksebBilling?.monthlyProjection?.projectedBillINR ?? 0,
        monthlyProjectedUnits: aggSummary.ksebBilling?.monthlyProjection?.projectedUnits ?? 0,
        tariffProvider: "KSEB 2026 Tariff (LT-I)"
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
    kseb: data.aggregatesSummary?.ksebBilling
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
  const kseb = agg.ksebBilling;
  const dom = kseb?.domesticLT1;

  const systemPrompt = `You are "AuraIoT", an expert IoT Telemetry Engineer & Certified Electrical Energy Auditor specializing in the official Kerala State Electricity Board (KSEB) tariff schedule (2026 regulations).
You monitor live IoT hardware connected via Firebase Realtime Database (https://s3-skills-default-rtdb.firebaseio.com/).

KSEB TARIFF STRUCTURE RULES & REGULATION (2026 SCHEDULE):
1. Domestic Tariff (LT-I):
   - Telescopic Slabs (Usage ≤ 250 Units):
     * 0–50 Units: ₹3.35/unit
     * 51–100 Units: ₹4.15/unit
     * 101–150 Units: ₹5.30/unit
     * 151–200 Units: ₹7.10/unit
     * 201–250 Units: ₹8.50/unit
   - Non-Telescopic Slabs (Usage > 250 Units - entire consumption re-rated at single flat rate):
     * 251–300 units: ₹6.75/unit flat
     * 301–350 units: ₹7.60/unit flat
     * 351–400 units: ₹7.95/unit flat
     * 401–500 units: ₹8.25/unit flat
     * Above 500 units: ₹9.20/unit flat
   - Below Poverty Line (BPL) Subsidy: For load ≤ 1000W & usage ≤ 40 units, rate is ₹1.50/unit with no fixed charge.
   - Additional Charges:
     * Fixed Charge: ₹50 to ₹310 depending on phase and connected load (standard single-phase: ₹50/mo)
     * Electricity Duty: 5% of energy charges
     * Meter Rent: ₹6–₹10/month
     * Fuel Adjustment Charge (FAC): ₹0.10–₹0.25/unit (default ~₹0.15/unit)
2. Commercial Tariff (LT-VIIA):
   * 0–100 units: ₹6.05/unit
   * 101–500 units: ₹7.50/unit
   * Above 500 units: ₹9.40/unit

CURRENT TELEMETRY & KSEB BILLING AUDIT:
- LED Fixture: Live ${telemetry.live.ledCurrent} A | ${telemetry.live.ledVoltage} V | Instant ${telemetry.led?.instantPowerWatts} W
  * Historical Current: Max ${agg.ledCurrent.maximum} A, Min ${agg.ledCurrent.minimum} A, Avg ${agg.ledCurrent.average} A
  * Energy Consumed: ${agg.unitConsumptionKWh.led_kWh} Units (kWh)
- Water Pump: Live ${telemetry.live.waterPumpCurrent} A | ${telemetry.live.waterPumpVoltage} V | Instant ${telemetry.waterPump?.instantPowerWatts} W
  * Historical Current: Max ${agg.waterPumpCurrent.maximum} A, Min ${agg.waterPumpCurrent.minimum} A, Avg ${agg.waterPumpCurrent.average} A
  * Historical Voltage: Max ${agg.waterPumpVoltage.maximum} V, Min ${agg.waterPumpVoltage.minimum} V
  * Energy Consumed: ${agg.unitConsumptionKWh.pump_kWh} Units (kWh)
- Total Recorded Consumption: ${agg.unitConsumptionKWh.total_kWh} Units (kWh) across ${agg.bucketsCount} minute buckets
- Active KSEB Slab: ${dom?.slabType || 'Telescopic (≤250 Units)'}
- KSEB Bill Breakdown:
  * Energy Charge: ₹${dom?.energyCharge || 0}
  * Fixed Charge: ₹${dom?.fixedCharge || 50}
  * Electricity Duty (5%): ₹${dom?.duty || 0}
  * Meter Rent: ₹${dom?.meterRent || 6}
  * FAC Charge: ₹${dom?.fac || 0}
  * Total KSEB Bill: ₹${dom?.totalBill || 0}
- 30-Day Monthly Projection:
  * Projected Monthly Units: ${kseb?.monthlyProjection?.projectedUnits || 0} Units
  * Projected Monthly Bill: ₹${kseb?.monthlyProjection?.projectedBillINR || 0} (${kseb?.monthlyProjection?.slab})

DIRECTIVES:
- ALWAYS calculate and display bills in INDIAN RUPEES (₹) adhering to KSEB's telescopic/non-telescopic rules.
- Clearly present itemized bill breakdowns (Energy Charge, 5% Duty, Fixed Charge, FAC, Meter Rent).
- Warn when consumption approaches or crosses 250 units because non-telescopic flat re-rating significantly increases total billing!`;

  const clientApiKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY;

  if (!clientApiKey) {
    return res.status(200).json({
      reply: `⚠️ **Groq API Key Required**\n\n**KSEB Domestic (LT-I) Telemetry Audit:**\n- **Total Units Consumed:** \`${agg.unitConsumptionKWh.total_kWh} Units (kWh)\`\n- **Active Slab:** ${dom?.slabType}\n- **Total KSEB Bill:** \`₹${dom?.totalBill}\` (Energy: ₹${dom?.energyCharge}, Fixed: ₹${dom?.fixedCharge}, Duty 5%: ₹${dom?.duty})\n- **30-Day Projected Bill:** \`₹${kseb?.monthlyProjection?.projectedBillINR}\` (${kseb?.monthlyProjection?.projectedUnits} Units)\n\nPlease configure your \`GROQ_API_KEY\` to chat.`
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
  console.log(`⚡ KSEB 2026 Tariff Engine Active: Telescopic & Non-Telescopic`);
  console.log(`💡 ledCurrent & ledVoltage = LED Fixture`);
  console.log(`🚰 waterPumpCurrent & waterPumpVoltage = Water Pump`);
  console.log(`===============================================`);
});
