// S-3 IOT - Next-Gen Solar Battery & Electrical AI Command Center
// Active on 'test' branch

let chatHistory = [];
let localGroqKey = localStorage.getItem('groq_api_key') || '';
let currentFilter = 'all';

// DOM Elements - Theme & Tabs
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const viewTabs = document.querySelectorAll('.view-tab');
const viewContainers = document.querySelectorAll('.view-container');

// Quick Nav KPIs
const navKpiLoad = document.getElementById('navKpiLoad');
const navKpiUnits = document.getElementById('navKpiUnits');
const navKpiCost = document.getElementById('navKpiCost');

// Executive KPIs
const kpiTotalPower = document.getElementById('kpiTotalPower');
const kpiTotalUnits = document.getElementById('kpiTotalUnits');
const kpiTotalCostINR = document.getElementById('kpiTotalCostINR');
const kpiMonthlyCostINR = document.getElementById('kpiMonthlyCostINR');
const kpiMonthlyUnits = document.getElementById('kpiMonthlyUnits');

// Power Flow Elements
const flowTotalPower = document.getElementById('flowTotalPower');
const flowLedPower = document.getElementById('flowLedPower');
const flowMotorPower = document.getElementById('flowMotorPower');
const flowMotorState = document.getElementById('flowMotorState');
const flowLedState = document.getElementById('flowLedState');
const biasFlowBadge = document.getElementById('biasFlowBadge');

// Load 1 (LED) Elements
const ledPowerVal = document.getElementById('ledPowerVal');
const ledVoltageVal = document.getElementById('ledVoltageVal');
const ledCurrentVal = document.getElementById('ledCurrentVal');
const ledEnergyVal = document.getElementById('ledEnergyVal');
const ledCostVal = document.getElementById('ledCostVal');
const ledStatusBadge = document.getElementById('ledStatusBadge');
const ledAvgCurrent = document.getElementById('ledAvgCurrent');

// Load 2 (Pump Motor) Elements
const motorPowerVal = document.getElementById('motorPowerVal');
const motorVoltageVal = document.getElementById('motorVoltageVal');
const motorCurrentVal = document.getElementById('motorCurrentVal');
const motorEnergyVal = document.getElementById('motorEnergyVal');
const motorCostVal = document.getElementById('motorCostVal');
const motorStatusBadge = document.getElementById('motorStatusBadge');
const motorStateClassified = document.getElementById('motorStateClassified');

// Containers
const realAppliancesContainer = document.getElementById('realAppliancesContainer');
const eventsTableBody = document.getElementById('eventsTableBody');
const anomalyCountBadge = document.getElementById('anomalyCountBadge');
const applianceCountBadge = document.getElementById('applianceCountBadge');

// PyTorch & MCP UI Elements
const pyLiveState = document.getElementById('pyLiveState');
const pyLiveConfidence = document.getElementById('pyLiveConfidence');
const pyLivePower = document.getElementById('pyLivePower');
const pyLiveRisk = document.getElementById('pyLiveRisk');
const pyLiveBiasExplanation = document.getElementById('pyLiveBiasExplanation');
const pyTesterOutput = document.getElementById('pyTesterOutput');
const mcpToolOutput = document.getElementById('mcpToolOutput');

// Chat Elements (Mini & Full-Screen)
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const clearChatBtn = document.getElementById('clearChatBtn');
const fsChatMessages = document.getElementById('fsChatMessages');
const fsChatForm = document.getElementById('fsChatForm');
const fsChatInput = document.getElementById('fsChatInput');

// Fullscreen Grounding Metrics
const fsChatLed = document.getElementById('fsChatLed');
const fsChatMotor = document.getElementById('fsChatMotor');
const fsChatTotal = document.getElementById('fsChatTotal');
const fsChatUnits = document.getElementById('fsChatUnits');

// ========================================================
// 1. THEME SWITCHER (DARK / LIGHT)
// ========================================================
function initTheme() {
  const savedTheme = localStorage.getItem('s3_theme') || 'dark';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeIcon.textContent = '🌙';
  } else {
    document.body.classList.remove('light-theme');
    themeIcon.textContent = '☀️';
  }
  localStorage.setItem('s3_theme', theme);
}

themeToggleBtn.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light-theme');
  applyTheme(isLight ? 'dark' : 'light');
});

// ========================================================
// 2. VIEW SWITCHER CONTROLLER (5 TABS)
// ========================================================
function switchView(targetViewId) {
  viewTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === targetViewId);
  });

  viewContainers.forEach(c => {
    c.classList.toggle('active', c.id === `view-${targetViewId}`);
  });

  localStorage.setItem('s3_active_view', targetViewId);

  // Auto-refresh when entering specific views
  if (targetViewId === 'appliances') fetchAppliances();
  if (targetViewId === 'anomalies') fetchEvents();
  if (targetViewId === 'mcp') {
    fetchPyTorchLive();
    loadBiasConfig();
  }
}

viewTabs.forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

// ========================================================
// 3. TELEMETRY ENGINE & UI UPDATER
// ========================================================
async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    if (!res.ok) throw new Error('Telemetry fetch failed');
    const json = await res.json();
    if (json.success && json.data) {
      updateUI(json.data);
    }
  } catch (err) {
    console.warn('Telemetry poll error:', err.message);
  }
}

function updateUI(t) {
  const led = t.led || {};
  const motor = t.dcMotor || t.waterPump || {};
  const overview = t.systemOverview || {};
  const proj = overview.projections || {};

  const totalWatts = overview.totalPowerWatts ?? 0;
  const totalUnits = overview.cumulativeUnitsKwh ?? 0;
  const totalCost = overview.energyChargeINR ?? 0;

  // 1. Nav Quick Stats
  navKpiLoad.textContent = `${totalWatts.toFixed(3)} W`;
  navKpiUnits.textContent = `${totalUnits.toFixed(4)} kWh`;
  navKpiCost.textContent = `₹${totalCost.toFixed(2)}`;

  // 2. Executive KPI Cards
  kpiTotalPower.textContent = totalWatts.toFixed(1);
  kpiTotalUnits.textContent = totalUnits.toFixed(4);
  kpiTotalCostINR.textContent = `₹${totalCost.toFixed(2)}`;

  if (proj.historicalAverage) {
    kpiMonthlyCostINR.textContent = `₹${proj.historicalAverage.monthlyCostINR.toFixed(2)}`;
    kpiMonthlyUnits.textContent = `${proj.historicalAverage.monthlyUnits.toFixed(1)} Units`;
  }

  // 3. Power Flow SVG Card
  flowTotalPower.textContent = `${totalWatts.toFixed(2)} W Total`;
  flowLedPower.textContent = `${(led.instantPowerWatts || 0).toFixed(2)} W`;
  flowMotorPower.textContent = `${(motor.instantPowerWatts || 0).toFixed(2)} W`;
  
  if (flowMotorState) {
    flowMotorState.textContent = motor.status || 'OFF';
    flowMotorState.className = `status-micro ${motor.status === 'NORMAL RUNNING' ? 'status-on' : (motor.status?.includes('STALL') ? 'status-danger' : '')}`;
  }

  if (flowLedState) {
    flowLedState.textContent = led.status || 'OFF';
    flowLedState.className = `status-micro ${led.status === 'ON' ? 'status-on' : ''}`;
  }

  if (biasFlowBadge && t.biasRectification) {
    const b = t.biasRectification;
    if (b.ledIdleClamped && b.motorIdleClamped) {
      biasFlowBadge.textContent = "Zero-Bias: Clamped (1.18V/0.2A)";
      biasFlowBadge.className = "badge-mini-bias bias-clamped";
    } else {
      biasFlowBadge.textContent = "Zero-Bias: Active Bench";
      biasFlowBadge.className = "badge-mini-bias bias-active";
    }
  }

  // 4. Load 1: DC LED Card
  ledPowerVal.textContent = (led.instantPowerWatts || 0).toFixed(3);
  ledVoltageVal.innerHTML = `${(led.voltage || 0).toFixed(2)} <small>V</small>`;
  ledCurrentVal.innerHTML = `${(led.current || 0).toFixed(3)} <small>A</small>`;
  ledEnergyVal.innerHTML = `${(led.cumulativeKwh || 0).toFixed(4)} <small>kWh</small>`;
  ledCostVal.textContent = `₹${(led.energyChargeINR || 0).toFixed(2)}`;
  ledStatusBadge.textContent = led.status || 'OFF';
  ledStatusBadge.className = `device-status-badge ${led.status === 'ON' ? 'status-on' : 'status-off'}`;
  ledAvgCurrent.textContent = `${(led.stats?.average || 0).toFixed(3)}A`;

  // 5. Load 2: DC Pump Motor Card
  motorPowerVal.textContent = (motor.instantPowerWatts || 0).toFixed(3);
  motorVoltageVal.innerHTML = `${(motor.voltage || 0).toFixed(2)} <small>V</small>`;
  motorCurrentVal.innerHTML = `${(motor.current || 0).toFixed(3)} <small>A</small>`;
  motorEnergyVal.innerHTML = `${(motor.cumulativeKwh || 0).toFixed(4)} <small>kWh</small>`;
  motorCostVal.textContent = `₹${(motor.energyChargeINR || 0).toFixed(2)}`;
  
  motorStatusBadge.textContent = motor.status || 'OFF';
  let badgeClass = 'status-off';
  if (motor.status === 'NORMAL RUNNING') badgeClass = 'status-on';
  else if (motor.status === 'STARTUP / HIGH LOAD') badgeClass = 'status-warn';
  else if (motor.status === 'STALL / OVERLOAD') badgeClass = 'status-danger';
  motorStatusBadge.className = `device-status-badge ${badgeClass}`;
  motorStateClassified.textContent = motor.status || 'OFF';

  // 6. Fullscreen Chat Grounding
  if (fsChatLed) fsChatLed.textContent = `${(led.instantPowerWatts || 0).toFixed(2)} W (${(led.current || 0).toFixed(3)}A)`;
  if (fsChatMotor) fsChatMotor.textContent = `${(motor.instantPowerWatts || 0).toFixed(2)} W (${motor.status})`;
  if (fsChatTotal) fsChatTotal.textContent = `${totalWatts.toFixed(2)} W`;
  if (fsChatUnits) fsChatUnits.textContent = `${totalUnits.toFixed(4)} kWh (₹${totalCost.toFixed(2)})`;
}

// ========================================================
// 4. PHYSICAL APPLIANCES FETCHER (Strictly Real Hardware)
// ========================================================
async function fetchAppliances() {
  try {
    const res = await fetch('/api/appliances');
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && Array.isArray(json.physical)) {
      renderApplianceList(realAppliancesContainer, json.physical);
      if (applianceCountBadge) {
        applianceCountBadge.textContent = json.physical.length;
      }
    }
  } catch (err) {
    console.warn('Appliance fetch error:', err);
  }
}

function renderApplianceList(container, apps) {
  if (!container) return;
  if (!apps || apps.length === 0) {
    container.innerHTML = `<div class="loading-state">No real bench devices detected.</div>`;
    return;
  }

  container.innerHTML = apps.map(app => {
    return `
      <div class="appliance-card card-real-border">
        <div class="app-card-head">
          <div class="app-meta">
            <div class="app-icon-wrap">${app.icon}</div>
            <div>
              <div class="app-name">${app.name}</div>
              <div class="app-switch-id">${app.switch_id} &bull; ${app.category}</div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="badge-source-real">🟢 REAL HARDWARE</span>
            <span class="device-status-badge ${app.status.includes('RUN') || app.status === 'ON' ? 'status-on' : 'status-off'}">
              ${app.status}
            </span>
          </div>
        </div>

        <div class="app-pin-banner">
          ⚡ Pin Connection: <strong>${app.pin_info || 'ESP32 ADC1'}</strong>
        </div>

        <div class="app-power-banner">
          <span>Instant Power</span>
          <span class="val">${app.power.toFixed(2)} W</span>
        </div>

        <div class="app-stats-row">
          <div class="app-stat-item">
            <span>VOLTAGE</span>
            <strong>${app.voltage.toFixed(2)} V</strong>
          </div>
          <div class="app-stat-item">
            <span>CURRENT</span>
            <strong>${app.current.toFixed(3)} A</strong>
          </div>
          <div class="app-stat-item">
            <span>ENERGY</span>
            <strong>${app.cumulative_kwh.toFixed(4)} kWh</strong>
          </div>
          <div class="app-stat-item inr-sub-box">
            <span>COST (@ ₹8)</span>
            <strong style="color: var(--warning);">₹${app.cost_inr.toFixed(2)}</strong>
          </div>
        </div>

        <div class="app-health-bar">
          <span>Health:</span>
          <div class="health-track">
            <div class="health-fill" style="width: ${app.health_score}%; background: ${app.health_score > 90 ? 'var(--success)' : (app.health_score > 80 ? 'var(--warning)' : 'var(--danger)')};"></div>
          </div>
          <strong>${app.health_score}%</strong>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================================
// 5. ML ANOMALY EVENT LOG (Physical Bench Telemetry Only)
// ========================================================
async function fetchEvents(filter = currentFilter) {
  try {
    const query = filter && filter !== 'all' ? `?severity=${filter}` : '';
    const res = await fetch(`/api/events${query}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && Array.isArray(json.events)) {
      renderEvents(json.events);
      const critCount = json.events.filter(e => e.severity === 'critical' || e.severity === 'medium').length;
      if (anomalyCountBadge) anomalyCountBadge.textContent = critCount;
    }
  } catch (err) {
    console.warn('Events fetch error:', err);
  }
}

function filterEvents(sev) {
  currentFilter = sev;
  document.querySelectorAll('.f-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${sev}'`));
  });
  fetchEvents(sev);
}

function renderEvents(events) {
  if (!events || events.length === 0) {
    eventsTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No events recorded matching this filter category.</td></tr>`;
    return;
  }

  eventsTableBody.innerHTML = events.map(e => {
    const sevClass = e.severity === 'critical' ? 'sev-critical' : (e.severity === 'medium' ? 'sev-medium' : 'sev-normal');
    const timeStr = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const confPct = Math.round((e.model_confidence || 0.95) * 100);

    return `
      <tr>
        <td><strong style="font-family: var(--font-mono); color: var(--primary);">${e.event_id}</strong></td>
        <td style="color: var(--text-muted); font-size: 0.78rem;">${timeStr}</td>
        <td><span class="tag-source-real">ESP32 ADC1</span></td>
        <td><strong>${e.appliance}</strong> <small style="color: var(--text-muted);">(${e.switch_id})</small></td>
        <td><code style="font-size: 0.76rem; color: var(--text-primary);">${e.event_type}</code></td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${Number(e.voltage).toFixed(2)}V &bull; ${Number(e.current).toFixed(3)}A &bull; <strong>${Number(e.power).toFixed(1)}W</strong></td>
        <td><span class="tag-severity ${sevClass}">${e.severity}</span></td>
        <td>
          <div class="confidence-bar">
            <div class="conf-track"><div class="conf-fill" style="width: ${confPct}%;"></div></div>
            <span>${confPct}%</span>
          </div>
        </td>
        <td>
          <button class="btn-micro" onclick="askAboutEvent('${e.event_id}', '${e.appliance}', '${e.event_type}')">Ask AI</button>
        </td>
      </tr>
    `;
  }).join('');
}

function askAboutEvent(id, appliance, type) {
  switchView('chat');
  sendPrompt(`Explain event ${id}: What caused the '${type}' on ${appliance} and what corrective actions should be taken?`);
}

// ========================================================
// 6. PYTORCH NEURAL MODEL & MCP INTEGRATION
// ========================================================
async function fetchPyTorchLive() {
  try {
    const res = await fetch('/api/ml/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && json.prediction) {
      updatePyTorchUI(json);
    }
  } catch (err) {
    console.warn('PyTorch inference fetch error:', err);
  }
}

function updatePyTorchUI(res) {
  const p = res.prediction;
  const b = res.bias_rectification;

  if (pyLiveState) {
    pyLiveState.textContent = p.state_name;
    pyLiveState.className = `pl-status-tag ${p.state_name === 'PUMP_STALL_OVERLOAD' ? 'status-danger' : (p.state_name.includes('INRUSH') || p.state_name.includes('BIAS') ? 'status-warn' : 'status-on')}`;
  }
  if (pyLiveConfidence) pyLiveConfidence.textContent = p.confidence_percent;
  if (pyLivePower) pyLivePower.textContent = `${p.predicted_power_watts.toFixed(2)} W`;
  if (pyLiveRisk) {
    pyLiveRisk.textContent = p.anomaly_severity.toUpperCase();
    pyLiveRisk.style.color = p.anomaly_severity === 'critical' ? 'var(--danger)' : (p.anomaly_severity === 'medium' ? 'var(--warning)' : 'var(--success)');
  }
  if (pyLiveBiasExplanation && b) {
    pyLiveBiasExplanation.innerHTML = `<strong>Sensor Zero-Bias:</strong> ${b.explanation} (LED: ${b.calibrated_led_voltage}V / ${b.calibrated_led_current}A &bull; Pump: ${b.calibrated_pump_voltage}V / ${b.calibrated_pump_current}A)`;
  }
}

async function runCustomPyTorchInference() {
  const vLed = parseFloat(document.getElementById('testVLed').value) || 0;
  const cLed = parseFloat(document.getElementById('testCLed').value) || 0;
  const vPump = parseFloat(document.getElementById('testVPump').value) || 0;
  const cPump = parseFloat(document.getElementById('testCPump').value) || 0;

  if (pyTesterOutput) pyTesterOutput.textContent = '// Running PyTorch S3ElectricalTransformer inference...';
  try {
    const res = await fetch('/api/ml/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v_led: vLed, c_led: cLed, v_pump: vPump, c_pump: cPump })
    });
    const json = await res.json();
    if (pyTesterOutput) pyTesterOutput.textContent = JSON.stringify(json, null, 2);
    if (json.prediction) updatePyTorchUI(json);
  } catch (err) {
    if (pyTesterOutput) pyTesterOutput.textContent = `Error: ${err.message}`;
  }
}

function setTestPreset(v1, c1, v2, c2) {
  document.getElementById('testVLed').value = v1;
  document.getElementById('testCLed').value = c1;
  document.getElementById('testVPump').value = v2;
  document.getElementById('testCPump').value = c2;
  runCustomPyTorchInference();
}

async function executeMcpTool(toolName) {
  if (mcpToolOutput) mcpToolOutput.textContent = `// Invoking MCP tool '${toolName}'...`;
  try {
    const res = await fetch(`/api/mcp/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (mcpToolOutput) mcpToolOutput.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    if (mcpToolOutput) mcpToolOutput.textContent = `MCP Error: ${err.message}`;
  }
}

function copyOpenApiUrl() {
  const url = `${window.location.origin}/api/mcp/openapi.json`;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Copied ChatGPT Custom GPT OpenAPI URL:\n${url}\n\nPaste this in ChatGPT Custom GPT Actions to enable instant MCP tool calls!`);
  }).catch(() => {
    prompt('Copy ChatGPT OpenAPI URL:', url);
  });
}

async function loadBiasConfig() {
  try {
    const res = await fetch('/api/calibration');
    const json = await res.json();
    if (json.success && json.config) {
      const vEl = document.getElementById('cfgVoltFloor');
      const lEl = document.getElementById('cfgLedFloor');
      const pEl = document.getElementById('cfgPumpFloor');
      if (vEl) vEl.value = json.config.VOLTAGE_NOISE_FLOOR;
      if (lEl) lEl.value = json.config.LED_CURRENT_NOISE_FLOOR;
      if (pEl) pEl.value = json.config.PUMP_CURRENT_NOISE_FLOOR;
    }
  } catch (e) {}
}

async function saveBiasConfig() {
  const vF = parseFloat(document.getElementById('cfgVoltFloor').value) || 2.0;
  const lF = parseFloat(document.getElementById('cfgLedFloor').value) || 0.28;
  const pF = parseFloat(document.getElementById('cfgPumpFloor').value) || 0.22;

  try {
    const res = await fetch('/api/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voltage_floor: vF, led_current_floor: lF, pump_current_floor: pF, auto_clamp: true })
    });
    const json = await res.json();
    if (json.success) {
      alert('Physical sensor bias deadband thresholds saved successfully!');
      fetchTelemetry();
      fetchPyTorchLive();
    }
  } catch (err) {
    alert(`Error saving calibration: ${err.message}`);
  }
}

// ========================================================
// 6. BENCH SIMULATION TRIGGER
// ========================================================
async function triggerSimulation(c1, v1, c2, v2) {
  try {
    const res = await fetch('/api/telemetry/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_one: c1,
        voltage_one: v1,
        current_two: c2,
        voltage_two: v2
      })
    });
    const json = await res.json();
    if (json.success && json.data) {
      updateUI(json.data);
      fetchEvents();
      fetchAppliances();
    }
  } catch (err) {
    console.error('Simulation error:', err);
  }
}

// ========================================================
// 7. GROQ AI COPILOT CONVERSATION LOGIC
// ========================================================
async function sendPrompt(text) {
  if (!text || !text.trim()) return;

  // Append user message to both chat boxes
  appendChatMessage('user', text);

  // Show typing indicator
  const typingEl = appendChatMessage('assistant', '🤖 *Consulting electrical intelligence engine & telemetry logs...*');

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (localGroqKey) headers['x-groq-key'] = localGroqKey;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(-8)
      })
    });

    const json = await res.json();
    typingEl.remove();

    if (json.reply) {
      appendChatMessage('assistant', json.reply, json.model);
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: json.reply });
      if (json.telemetry) updateUI(json.telemetry);
    } else if (json.error) {
      appendChatMessage('assistant', `⚠️ **AI Service Error:** ${json.error}`);
    }
  } catch (err) {
    typingEl.remove();
    appendChatMessage('assistant', `⚠️ **Network Error:** Could not contact server: ${err.message}`);
  }
}

function appendChatMessage(role, content, model = null) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  
  if (role === 'assistant') {
    let html = marked.parse(content);
    if (model) {
      html += `<div style="margin-top: 6px; font-size: 0.68rem; color: #64748b; font-family: 'JetBrains Mono', monospace; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 4px;">⚡ Model: ${model}</div>`;
    }
    bubble.innerHTML = html;
  } else {
    bubble.textContent = content;
  }
  
  el.appendChild(bubble);

  // Append to both mini chat and full-screen chat
  if (chatMessages) {
    chatMessages.appendChild(el.cloneNode(true));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  if (fsChatMessages) {
    fsChatMessages.appendChild(el);
    fsChatMessages.scrollTop = fsChatMessages.scrollHeight;
  }

  return el;
}

// Form Handlers
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = chatInput.value.trim();
  if (val) {
    sendPrompt(val);
    chatInput.value = '';
  }
});

fsChatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = fsChatInput.value.trim();
  if (val) {
    sendPrompt(val);
    fsChatInput.value = '';
  }
});

clearChatBtn.addEventListener('click', () => {
  chatHistory = [];
  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="chat-msg assistant">
        <div class="msg-bubble">Conversation cleared. How can I assist you with facility telemetry or anomaly diagnostics?</div>
      </div>
    `;
  }
  if (fsChatMessages) {
    fsChatMessages.innerHTML = `
      <div class="chat-msg assistant">
        <div class="msg-bubble">Conversation cleared. How can I assist you?</div>
      </div>
    `;
  }
});

// Configure Groq API Key
document.getElementById('apiKeyBtn').addEventListener('click', () => {
  const key = prompt('Enter your Groq API Key (saved locally in your browser):', localGroqKey);
  if (key !== null) {
    localGroqKey = key.trim();
    localStorage.setItem('groq_api_key', localGroqKey);
    alert('Groq API Key saved for this session!');
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  fetchTelemetry();
  fetchEvents();
  fetchAppliances();
});

// ========================================================
// 8. INITIAL BOOTSTRAP & CONTINUOUS POLLING
// ========================================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  const savedView = localStorage.getItem('s3_active_view') || 'overview';
  switchView(savedView);

  // Initial fetches
  fetchTelemetry();
  fetchAppliances();
  fetchEvents();
  fetchPyTorchLive();
  loadBiasConfig();

  // Continuous polling
  setInterval(fetchTelemetry, 2500);
  setInterval(fetchPyTorchLive, 4000);
});
