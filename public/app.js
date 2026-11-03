// AuraIoT Frontend Logic - Indian Rupee & Executive MVP Dashboard

let chatHistory = [];
let localGroqKey = localStorage.getItem('groq_api_key') || '';

// KPI Elements
const kpiTotalPower = document.getElementById('kpiTotalPower');
const kpiTotalUnits = document.getElementById('kpiTotalUnits');
const kpiTotalCostINR = document.getElementById('kpiTotalCostINR');
const kpiMonthlyCostINR = document.getElementById('kpiMonthlyCostINR');
const kpiMonthlyUnits = document.getElementById('kpiMonthlyUnits');
const headerKsebSlab = document.getElementById('headerKsebSlab');

// LED Card Elements
const ledCurrentVal = document.getElementById('ledCurrentVal');
const ledVoltageVal = document.getElementById('ledVoltageVal');
const ledPowerVal = document.getElementById('ledPowerVal');
const ledStatusBadge = document.getElementById('ledStatusBadge');
const ledCurrentMeter = document.getElementById('ledCurrentMeter');
const ledMaxVal = document.getElementById('ledMaxVal');
const ledAvgVal = document.getElementById('ledAvgVal');
const ledMinVal = document.getElementById('ledMinVal');
const ledCostINRVal = document.getElementById('ledCostINRVal');

// Pump Card Elements
const pumpVoltageVal = document.getElementById('pumpVoltageVal');
const pumpCurrentVal = document.getElementById('pumpCurrentVal');
const pumpPowerVal = document.getElementById('pumpPowerVal');
const pumpStatusBadge = document.getElementById('pumpStatusBadge');
const pumpCurrentMeter = document.getElementById('pumpCurrentMeter');
const pumpMaxVal = document.getElementById('pumpMaxVal');
const pumpAvgVal = document.getElementById('pumpAvgVal');
const pumpMinVal = document.getElementById('pumpMinVal');
const pumpCostINRVal = document.getElementById('pumpCostINRVal');

const lastUpdated = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');

// Chat Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

// Simulator Elements
const simC1 = document.getElementById('simC1');
const simC2 = document.getElementById('simC2');
const simV2 = document.getElementById('simV2');
const applySimBtn = document.getElementById('applySimBtn');

// Modal Elements
const apiKeyBtn = document.getElementById('apiKeyBtn');
const keyModal = document.getElementById('keyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const customGroqKey = document.getElementById('customGroqKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');

if (localGroqKey) {
  customGroqKey.value = localGroqKey;
}

// Telemetry Poller
async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    const json = await res.json();
    if (json.success && json.data) {
      updateUI(json.data);
    }
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
    lastUpdated.textContent = 'Sync error';
  }
}

// Update Dashboard UI with latest sensor numbers & strictly verified calculations
function updateUI(data) {
  const live = data.live || {};
  const led = data.led || {};
  const pump = data.waterPump || {};
  const overview = data.systemOverview || {};
  const proj = overview.projections || {};

  const c1 = Number(live.ledCurrent ?? led.current ?? 0);
  const v1 = Number(live.ledVoltage ?? led.voltage ?? 0);
  const c2 = Number(live.waterPumpCurrent ?? pump.current ?? 0);
  const v2 = Number(live.waterPumpVoltage ?? pump.voltage ?? 0);

  // Exact DC Power: P = V * I
  const pLed = led.instantPowerWatts ?? (v1 * c1);
  const pPump = pump.instantPowerWatts ?? (v2 * c2);
  const pTotal = overview.totalPowerWatts ?? (pLed + pPump);

  // Executive KPI Strip
  if (kpiTotalPower) kpiTotalPower.textContent = pTotal.toFixed(2);
  if (kpiTotalUnits) kpiTotalUnits.textContent = (overview.cumulativeUnitsKwh ?? 0).toFixed(4);
  if (kpiTotalCostINR) kpiTotalCostINR.textContent = `₹${(overview.energyChargeINR ?? 0).toFixed(2)}`;

  const histProj = proj.historicalAverage || {};
  if (kpiMonthlyCostINR) kpiMonthlyCostINR.textContent = `₹${(histProj.monthlyCostINR ?? 0).toFixed(2)}`;
  if (kpiMonthlyUnits) kpiMonthlyUnits.textContent = `${(histProj.monthlyUnits ?? 0).toFixed(1)} Units (Hist)`;

  if (headerKsebSlab) headerKsebSlab.textContent = 'Energy Charge @ ₹8.00 / Unit';

  // LED Updates (ledCurrent)
  ledCurrentVal.textContent = c1.toFixed(3);
  if (ledVoltageVal) ledVoltageVal.textContent = v1.toFixed(2);
  ledPowerVal.textContent = pLed.toFixed(3);
  const isLedOn = led.status === 'ON' || c1 > 0.05;
  ledStatusBadge.textContent = isLedOn ? 'ON' : 'OFF';
  ledStatusBadge.className = `status-pill ${isLedOn ? 'status-on' : 'status-off'}`;
  
  // LED meter: 0 to 1A nominal scale
  const ledPercent = Math.min(Math.max((c1 / 1.0) * 100, 0), 100);
  ledCurrentMeter.style.width = `${ledPercent}%`;

  // LED Statistical Aggregates & Cost
  const ledStats = led.stats || {};
  if (ledStats) {
    if (ledMaxVal) ledMaxVal.textContent = `${Number(ledStats.maximum ?? 0).toFixed(3)} A`;
    if (ledAvgVal) ledAvgVal.textContent = `${Number(ledStats.average ?? 0).toFixed(3)} A`;
    if (ledMinVal) ledMinVal.textContent = `${Number(ledStats.minimum ?? 0).toFixed(3)} A`;
    if (ledCostINRVal) ledCostINRVal.textContent = `₹${Number(led.energyChargeINR ?? 0).toFixed(2)}`;
  }

  // Water Pump Updates (waterPumpCurrent & waterPumpVoltage)
  pumpVoltageVal.textContent = v2.toFixed(2);
  pumpCurrentVal.textContent = c2.toFixed(3);
  pumpPowerVal.textContent = pPump.toFixed(3);
  const isPumpActive = pump.status === 'RUNNING' || c2 > 0.05;
  pumpStatusBadge.textContent = isPumpActive ? 'ACTIVE' : 'IDLE';
  pumpStatusBadge.className = `status-pill ${isPumpActive ? 'status-active' : 'status-idle'}`;

  // Pump meter: 0 to 1A scale
  const pumpPercent = Math.min(Math.max((c2 / 1.0) * 100, 0), 100);
  pumpCurrentMeter.style.width = `${pumpPercent}%`;

  // Pump Statistical Aggregates & Cost
  const pumpStats = pump.stats || {};
  if (pumpStats) {
    if (pumpMaxVal) pumpMaxVal.textContent = `${Number(pumpStats.maximum ?? 0).toFixed(3)} A`;
    if (pumpAvgVal) pumpAvgVal.textContent = `${Number(pumpStats.average ?? 0).toFixed(3)} A`;
    if (pumpMinVal) pumpMinVal.textContent = `${Number(pumpStats.minimum ?? 0).toFixed(3)} A`;
    if (pumpCostINRVal) pumpCostINRVal.textContent = `₹${Number(pump.energyChargeINR ?? 0).toFixed(2)}`;
  }

  // Timestamp & Status
  const date = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
  const buckets = data.aggregatesSummary?.bucketsCount ?? '--';
  lastUpdated.textContent = `Sync: ${date.toLocaleTimeString()} | ${buckets} Minute Buckets`;
}

// Simulator Trigger
applySimBtn.addEventListener('click', async () => {
  const c1 = parseFloat(simC1.value) || 0;
  const c2 = parseFloat(simC2.value) || 0;
  const v2 = parseFloat(simV2.value) || 0;

  try {
    const res = await fetch('/api/telemetry/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_one: c1, current_two: c2, voltage_two: v2 })
    });
    const result = await res.json();
    if (result.success) {
      updateUI(result.data);
    }
  } catch (e) {
    alert('Failed to push simulated telemetry');
  }
});

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    simC1.value = btn.dataset.c1;
    simC2.value = btn.dataset.c2;
    simV2.value = btn.dataset.v2;
    applySimBtn.click();
  });
});

// Append Message to Chat
function appendMessage(role, text) {
  const msgEl = document.createElement('div');
  msgEl.className = `message message-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  if (role === 'ai') {
    bubble.innerHTML = window.marked ? marked.parse(text) : text;
  } else {
    bubble.textContent = text;
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'msg-timestamp';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgEl.appendChild(bubble);
  msgEl.appendChild(timeEl);
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return bubble;
}

// Chat Submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userText = chatInput.value.trim();
  if (!userText) return;

  chatInput.value = '';
  appendMessage('user', userText);

  const loadingBubble = appendMessage('ai', 'Thinking and inspecting telemetry with Indian Rupee calculations...');
  sendBtn.disabled = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (localGroqKey) {
      headers['x-groq-key'] = localGroqKey;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: userText,
        history: chatHistory.slice(-6)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details || data.error || 'Server error');
    }

    const aiReply = data.reply || 'No response received.';
    loadingBubble.innerHTML = window.marked ? marked.parse(aiReply) : aiReply;

    chatHistory.push({ role: 'user', content: userText });
    chatHistory.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    loadingBubble.innerHTML = `<span style="color: #ef4444;">⚠️ <strong>Chat Error:</strong> ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

// Prompt Chips
document.querySelectorAll('.prompt-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chatInput.value = chip.dataset.prompt;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

clearChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
  chatHistory = [];
  appendMessage('ai', 'Chat history cleared. How can I help you analyze the energy data in Indian Rupees (₹)?');
});

apiKeyBtn.addEventListener('click', () => keyModal.classList.add('open'));
closeModalBtn.addEventListener('click', () => keyModal.classList.remove('open'));
keyModal.addEventListener('click', (e) => {
  if (e.target === keyModal) keyModal.classList.remove('open');
});

saveKeyBtn.addEventListener('click', () => {
  const key = customGroqKey.value.trim();
  localGroqKey = key;
  localStorage.setItem('groq_api_key', key);
  keyModal.classList.remove('open');
  appendMessage('ai', key ? '✅ Groq API key saved! Ready to analyze telemetry in INR (₹).' : 'ℹ️ Groq API key removed.');
});

refreshBtn.addEventListener('click', fetchTelemetry);

// Initial Telemetry Fetch & 3-sec interval
fetchTelemetry();
setInterval(fetchTelemetry, 3000);
