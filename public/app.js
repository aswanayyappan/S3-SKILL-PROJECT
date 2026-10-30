// AuraIoT Frontend Logic

let chatHistory = [];
let localGroqKey = localStorage.getItem('groq_api_key') || '';

// DOM Elements
const ledCurrentVal = document.getElementById('ledCurrentVal');
const ledPowerVal = document.getElementById('ledPowerVal');
const ledStatusBadge = document.getElementById('ledStatusBadge');
const ledCurrentMeter = document.getElementById('ledCurrentMeter');
const ledMaxVal = document.getElementById('ledMaxVal');
const ledAvgVal = document.getElementById('ledAvgVal');
const ledKwhVal = document.getElementById('ledKwhVal');

const pumpVoltageVal = document.getElementById('pumpVoltageVal');
const pumpCurrentVal = document.getElementById('pumpCurrentVal');
const pumpPowerVal = document.getElementById('pumpPowerVal');
const pumpStatusBadge = document.getElementById('pumpStatusBadge');
const pumpCurrentMeter = document.getElementById('pumpCurrentMeter');
const pumpMaxVal = document.getElementById('pumpMaxVal');
const pumpMaxVoltVal = document.getElementById('pumpMaxVoltVal');
const pumpKwhVal = document.getElementById('pumpKwhVal');

const lastUpdated = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');

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

// Initialize API Key input if present
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

// Update Dashboard UI with latest sensor numbers
function updateUI(data) {
  const live = data.live || {};
  const c1 = parseFloat(live.current1 ?? data.led?.current ?? 0);
  const c2 = parseFloat(live.current2 ?? data.waterPump?.current ?? 0);
  const v1 = parseFloat(live.voltage1 ?? data.led?.voltage ?? 0);
  const v2 = parseFloat(live.voltage2 ?? data.waterPump?.voltage ?? 0);

  const pLed = data.led?.instantPowerWatts ?? (c1 * (v1 > 1 ? v1 : 12));
  const pPump = data.waterPump?.instantPowerWatts ?? (c2 * (v2 > 50 ? v2 : 230));

  // LED Updates (Current 1)
  ledCurrentVal.textContent = c1.toFixed(3);
  ledPowerVal.textContent = pLed.toFixed(2);
  const isLedOn = data.led?.status === 'ON' || c1 > 0.05;
  ledStatusBadge.textContent = isLedOn ? 'ON' : 'OFF';
  ledStatusBadge.className = `status-pill ${isLedOn ? 'status-on' : 'status-off'}`;
  
  // LED meter: 0 to 1A nominal scale
  const ledPercent = Math.min(Math.max((c1 / 1.0) * 100, 0), 100);
  ledCurrentMeter.style.width = `${ledPercent}%`;

  // LED Statistics & Units
  if (data.led?.stats) {
    if (ledMaxVal) ledMaxVal.textContent = `${data.led.stats.max} A`;
    if (ledAvgVal) ledAvgVal.textContent = `${data.led.stats.avg} A`;
    if (ledKwhVal) ledKwhVal.textContent = `${data.led.energyKWh} kWh`;
  }

  // Water Pump Updates (Current 2 & Voltage 2)
  pumpVoltageVal.textContent = v2.toFixed(1);
  pumpCurrentVal.textContent = c2.toFixed(3);
  pumpPowerVal.textContent = pPump.toFixed(1);
  const isPumpActive = data.waterPump?.status === 'RUNNING' || c2 > 0.1;
  pumpStatusBadge.textContent = isPumpActive ? 'ACTIVE' : 'IDLE';
  pumpStatusBadge.className = `status-pill ${isPumpActive ? 'status-active' : 'status-idle'}`;

  // Pump meter: 0 to 10A scale
  const pumpPercent = Math.min(Math.max((c2 / 1.0) * 100, 0), 100);
  pumpCurrentMeter.style.width = `${pumpPercent}%`;

  // Pump Statistics & Units
  if (data.waterPump?.stats) {
    if (pumpMaxVal) pumpMaxVal.textContent = `${data.waterPump.stats.max} A`;
    if (pumpMaxVoltVal) pumpMaxVoltVal.textContent = `${data.waterPump.voltageStats?.max ?? v2} V`;
    if (pumpKwhVal) pumpKwhVal.textContent = `${data.waterPump.energyKWh} kWh`;
  }

  // Timestamp & Total Unit Stats
  const date = data.lastUpdated ? new Date(data.lastUpdated) : new Date();
  const totalUnits = data.statsSummary?.unitConsumptionKWh?.total_kWh ?? '--';
  lastUpdated.textContent = `Sync: ${date.toLocaleTimeString()} | Total Units: ${totalUnits} kWh`;
}

// Send Simulator update
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

// Preset scenario buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    simC1.value = btn.dataset.c1;
    simC2.value = btn.dataset.c2;
    simV2.value = btn.dataset.v2;
    applySimBtn.click();
  });
});

// Chat Append Message Helper
function appendMessage(role, text) {
  const msgEl = document.createElement('div');
  msgEl.className = `message message-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  if (role === 'ai') {
    // Render markdown using marked
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

// Handle Chat Submission
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userText = chatInput.value.trim();
  if (!userText) return;

  chatInput.value = '';
  appendMessage('user', userText);

  // Add temporary loading indicator
  const loadingBubble = appendMessage('ai', 'Thinking and inspecting telemetry...');
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

    // Track history
    chatHistory.push({ role: 'user', content: userText });
    chatHistory.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    loadingBubble.innerHTML = `<span style="color: #ef4444;">⚠️ <strong>Chat Error:</strong> ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

// Chip prompt click handler
document.querySelectorAll('.prompt-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chatInput.value = chip.dataset.prompt;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

// Clear Chat History
clearChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
  chatHistory = [];
  appendMessage('ai', 'Chat history cleared. How can I assist you with the LED and Water Pump telemetry?');
});

// API Key Modal Controls
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
  appendMessage('ai', key ? '✅ Groq API key saved! You are now connected to Groq Llama 3.' : 'ℹ️ Groq API key removed.');
});

refreshBtn.addEventListener('click', fetchTelemetry);

// Initial Telemetry Fetch & Periodic 3-second Auto-refresh
fetchTelemetry();
setInterval(fetchTelemetry, 3000);

