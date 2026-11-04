// S-3 IOT - Next-Gen Solar Battery & Electrical AI Command Center
// Active on 'test' branch

let chatHistory = [];
let localGroqKey = localStorage.getItem('groq_api_key') || '';
let localFtaiKey = localStorage.getItem('ftai_api_key') || '';
let selectedProvider = localStorage.getItem('s3_ai_provider') || 'freetheai';
let selectedModel = localStorage.getItem('s3_ai_model') || 'fta/zai/glm-5.3-flash';
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
const kpiSolarLedPower = document.getElementById('kpiSolarLedPower');
const kpiMotorPower = document.getElementById('kpiMotorPower');
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

// Load 2 (DC Motor) Elements
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
  const savedTheme = localStorage.getItem('s3_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    themeIcon.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  } else {
    document.body.classList.remove('light-theme');
    themeIcon.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
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
  if (targetViewId === 'anomalies') fetchEvents();
  if (targetViewId === 'mcp') {
    fetchPyTorchLive();
    loadBiasConfig();
    fetchContinuousLearningStatus();
  }
  if (targetViewId === 'chat') {
    requestAnimationFrame(() => {
      if (fsChatMessages) fsChatMessages.scrollTo({ top: fsChatMessages.scrollHeight, behavior: 'smooth' });
    });
  }
  if (targetViewId === 'overview') {
    requestAnimationFrame(() => {
      if (chatMessages) chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    });
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
  if (!t) return;
  const led = t.led || {};
  const motor = t.dcMotor || t.waterPump || {};
  const overview = t.systemOverview || {};
  const proj = overview.projections || {};

  const totalWatts = overview.totalPowerWatts ?? 0;
  const totalUnits = overview.cumulativeUnitsKwh ?? 0;
  const totalCost = overview.energyChargeINR ?? 0;

  // 1. Nav Quick Stats
  if (navKpiLoad) navKpiLoad.textContent = `${totalWatts.toFixed(3)} W`;
  if (navKpiUnits) navKpiUnits.textContent = `${totalUnits.toFixed(4)} kWh`;
  if (navKpiCost) navKpiCost.textContent = `₹${totalCost.toFixed(2)}`;

  // 2. Executive KPI Cards
  if (kpiSolarLedPower) kpiSolarLedPower.textContent = (led.instantPowerWatts || 0).toFixed(2);
  if (kpiMotorPower) kpiMotorPower.textContent = (motor.instantPowerWatts || 0).toFixed(2);
  if (kpiTotalPower) kpiTotalPower.textContent = totalWatts.toFixed(1);
  if (kpiTotalUnits) kpiTotalUnits.textContent = totalUnits.toFixed(4);
  if (kpiTotalCostINR) kpiTotalCostINR.textContent = `₹${totalCost.toFixed(2)}`;

  if (proj.historicalAverage) {
    if (kpiMonthlyCostINR) kpiMonthlyCostINR.textContent = `₹${proj.historicalAverage.monthlyCostINR.toFixed(2)}`;
    if (kpiMonthlyUnits) kpiMonthlyUnits.textContent = `${proj.historicalAverage.monthlyUnits.toFixed(1)} Units`;
  }

  // 3. Power Flow Topology Card
  if (flowTotalPower) flowTotalPower.textContent = `${totalWatts.toFixed(2)} W Total`;
  if (flowLedPower) flowLedPower.textContent = `${(led.instantPowerWatts || 0).toFixed(2)} W`;
  if (flowMotorPower) flowMotorPower.textContent = `${(motor.instantPowerWatts || 0).toFixed(2)} W`;
  
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
  if (ledPowerVal) ledPowerVal.textContent = (led.instantPowerWatts || 0).toFixed(3);
  if (ledVoltageVal) ledVoltageVal.innerHTML = `${(led.voltage || 0).toFixed(2)} <small>V</small>`;
  if (ledCurrentVal) ledCurrentVal.innerHTML = `${(led.current || 0).toFixed(3)} <small>A</small>`;
  if (ledEnergyVal) ledEnergyVal.innerHTML = `${(led.cumulativeKwh || 0).toFixed(4)} <small>kWh</small>`;
  if (ledCostVal) ledCostVal.textContent = `₹${(led.energyChargeINR || 0).toFixed(2)}`;
  if (ledStatusBadge) {
    ledStatusBadge.textContent = led.status || 'OFF';
    ledStatusBadge.className = `device-status-badge ${led.status === 'ON' ? 'status-on' : 'status-off'}`;
  }
  if (ledAvgCurrent) ledAvgCurrent.textContent = `${(led.stats?.average || 0).toFixed(3)}A`;

  // 5. Load 2: DC Motor Card
  if (motorPowerVal) motorPowerVal.textContent = (motor.instantPowerWatts || 0).toFixed(3);
  if (motorVoltageVal) motorVoltageVal.innerHTML = `${(motor.voltage || 0).toFixed(2)} <small>V</small>`;
  if (motorCurrentVal) motorCurrentVal.innerHTML = `${(motor.current || 0).toFixed(3)} <small>A</small>`;
  if (motorEnergyVal) motorEnergyVal.innerHTML = `${(motor.cumulativeKwh || 0).toFixed(4)} <small>kWh</small>`;
  if (motorCostVal) motorCostVal.textContent = `₹${(motor.energyChargeINR || 0).toFixed(2)}`;
  
  if (motorStatusBadge) {
    motorStatusBadge.textContent = motor.status || 'OFF';
    let badgeClass = 'status-off';
    if (motor.status === 'NORMAL RUNNING') badgeClass = 'status-on';
    else if (motor.status === 'STARTUP / HIGH LOAD') badgeClass = 'status-warn';
    else if (motor.status === 'STALL / OVERLOAD') badgeClass = 'status-danger';
    motorStatusBadge.className = `device-status-badge ${badgeClass}`;
  }
  if (motorStateClassified) motorStateClassified.textContent = motor.status || 'OFF';

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
            <span class="badge-source-real"><span class="live-dot pulse-green" style="width: 5px; height: 5px;"></span> REAL HARDWARE</span>
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
  if (!eventsTableBody) return;
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
          <button class="btn-micro" onclick="switchView('mcp')">Inspect ML</button>
        </td>
      </tr>
    `;
  }).join('');
}

function askAboutEvent(id, appliance, type) {
  switchView('mcp');
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
    pyLiveState.className = `pl-status-tag ${p.state_name.includes('STALL') ? 'status-danger' : (p.state_name.includes('INRUSH') || p.state_name.includes('BIAS') ? 'status-warn' : 'status-on')}`;
  }
  if (pyLiveConfidence) pyLiveConfidence.textContent = p.confidence_percent;
  if (pyLivePower) pyLivePower.textContent = `${p.predicted_power_watts.toFixed(2)} W`;
  if (pyLiveRisk) {
    pyLiveRisk.textContent = p.anomaly_severity.toUpperCase();
    pyLiveRisk.style.color = p.anomaly_severity === 'critical' ? 'var(--danger)' : (p.anomaly_severity === 'medium' ? 'var(--warning)' : 'var(--success)');
  }
  if (pyLiveBiasExplanation && b) {
    pyLiveBiasExplanation.innerHTML = `<strong>Sensor Zero-Bias:</strong> ${b.explanation} (LED: ${b.calibrated_led_voltage}V / ${b.calibrated_led_current}A &bull; Motor: ${b.calibrated_pump_voltage}V / ${b.calibrated_pump_current}A)`;
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
// 6.1 AUTONOMOUS CONTINUOUS ONLINE LEARNING CONTROLLER
// ========================================================
async function fetchContinuousLearningStatus() {
  try {
    const res = await fetch('/api/ml/continuous-learning/status');
    if (!res.ok) return;
    const data = await res.json();

    const statusBadge = document.getElementById('clStatusBadge');
    const totalCyclesEl = document.getElementById('clTotalCycles');
    const lastLearnedTimeEl = document.getElementById('clLastLearnedTime');
    const totalBufferEl = document.getElementById('clTotalBuffer');
    const newSamplesDeltaEl = document.getElementById('clNewSamplesDelta');
    const accuracyEl = document.getElementById('clAccuracy');
    const lossValueEl = document.getElementById('clLossValue');
    const spinner = document.getElementById('clLearningSpinner');
    const btnTrigger = document.getElementById('btnTriggerLearn');

    if (data.is_learning_in_progress) {
      if (spinner) spinner.style.display = 'inline-flex';
      if (btnTrigger) btnTrigger.disabled = true;
      if (statusBadge) {
        statusBadge.textContent = 'FINE-TUNING IN PROGRESS...';
        statusBadge.style.color = 'var(--accent-sky)';
      }
    } else {
      if (spinner) spinner.style.display = 'none';
      if (btnTrigger) btnTrigger.disabled = false;
      if (statusBadge) {
        if (data.active) {
          statusBadge.textContent = `ACTIVE (EVERY ${data.interval_minutes} MIN)`;
          statusBadge.style.color = 'var(--success)';
        } else {
          statusBadge.textContent = 'PAUSED (MANUAL ONLY)';
          statusBadge.style.color = 'var(--warning)';
        }
      }
    }

    const latest = data.latest_cycle || {};
    if (totalCyclesEl) totalCyclesEl.textContent = `${data.total_cycles_completed || 0} Cycles Completed`;
    if (lastLearnedTimeEl && latest.timestamp) {
      const dt = new Date(latest.timestamp);
      lastLearnedTimeEl.textContent = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (totalBufferEl) totalBufferEl.textContent = `${latest.total_buffer_samples || 234} Samples`;
    if (newSamplesDeltaEl) newSamplesDeltaEl.textContent = `+${latest.new_samples_added || 0} Ingested`;
    if (accuracyEl && latest.val_accuracy !== undefined) accuracyEl.textContent = `${latest.val_accuracy}%`;
    if (lossValueEl && latest.val_loss !== undefined) lossValueEl.textContent = `Loss: ${latest.val_loss}`;

    // Update interval buttons active state
    const mins = data.interval_minutes;
    [2, 5, 15, 30, 0].forEach(m => {
      const btn = document.getElementById(`btnInt${m}`);
      if (btn) {
        btn.classList.toggle('active', (data.active && m === mins) || (!data.active && m === 0));
      }
    });

    // Populate timeline table
    const tbody = document.getElementById('clHistoryTableBody');
    if (tbody && Array.isArray(data.recent_history) && data.recent_history.length > 0) {
      tbody.innerHTML = data.recent_history.map(item => `
        <tr>
          <td><strong>Cycle #${item.cycle}</strong></td>
          <td class="mono">${new Date(item.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge-tag tag-blue">+${item.new_samples_added || 0} Samples</span></td>
          <td class="mono">${item.total_buffer_samples} Points</td>
          <td class="mono">${item.val_loss}</td>
          <td class="mono" style="color: var(--success); font-weight: bold;">${item.val_accuracy}%</td>
          <td><span class="badge-tag tag-green">${item.status || 'CONVERGED'}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Continuous learning status fetch error:', err);
  }
}

async function triggerManualLearningPass() {
  const btn = document.getElementById('btnTriggerLearn');
  const spinner = document.getElementById('clLearningSpinner');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-flex';

  try {
    const res = await fetch('/api/ml/continuous-learning/trigger', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      await fetchContinuousLearningStatus();
      await fetchPyTorchLive();
      alert(`Continuous Learning Cycle #${data.cycle} Successful!\n• Ingested: +${data.new_samples_added} new Firebase telemetry points\n• Total Replay Buffer: ${data.total_buffer_samples} samples\n• Updated Validation Accuracy: ${data.val_accuracy}%\n• Fine-Tuning Duration: ${data.duration_seconds}s\n• Updated weights loaded into inference engine!`);
    } else {
      alert(`Learning pass notice: ${data.error || 'Check server logs'}`);
    }
  } catch (err) {
    alert(`Failed to trigger continuous learning: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function setLearningInterval(minutes) {
  try {
    const res = await fetch('/api/ml/continuous-learning/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_minutes: minutes })
    });
    const data = await res.json();
    if (data.success) {
      fetchContinuousLearningStatus();
    }
  } catch (err) {
    console.error('Failed to set interval:', err);
  }
}

// ========================================================
// 6.2 BENCH SIMULATION TRIGGER
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
// 7. AI COPILOT & MULTI-MODEL DISPATCHER (FreeTheAI & Groq)
// ========================================================
function initAiModelSelectors() {
  const providerSelect = document.getElementById('aiProviderSelect');
  const modelSelect = document.getElementById('aiModelSelect');
  const customFtaiInput = document.getElementById('customFtaiKey');
  const customGroqInput = document.getElementById('customGroqKey');
  const activeModelBadge = document.getElementById('activeModelBadge');
  const miniAiModelBadge = document.getElementById('miniAiModelBadge');
  const chatSubtitle = document.getElementById('chatEngineSubtitle');

  if (providerSelect) {
    providerSelect.value = selectedProvider;
    providerSelect.addEventListener('change', (e) => {
      selectedProvider = e.target.value;
      localStorage.setItem('s3_ai_provider', selectedProvider);
      updateModelBadges();
    });
  }

  if (modelSelect) {
    modelSelect.value = selectedModel;
    modelSelect.addEventListener('change', (e) => {
      selectedModel = e.target.value;
      localStorage.setItem('s3_ai_model', selectedModel);
      updateModelBadges();
    });
  }

  if (customFtaiInput && localFtaiKey) customFtaiInput.value = localFtaiKey;
  if (customGroqInput && localGroqKey) customGroqInput.value = localGroqKey;

  updateModelBadges();

  function updateModelBadges() {
    const shortName = selectedModel.includes('/') ? selectedModel.split('/').pop() : selectedModel.split('-')[0];
    if (activeModelBadge) activeModelBadge.textContent = shortName.toUpperCase();
    if (miniAiModelBadge) miniAiModelBadge.textContent = `${selectedProvider === 'groq' ? 'Groq' : 'FreeTheAI'} ${shortName}`;
    if (chatSubtitle) chatSubtitle.textContent = `Active Engine: ${selectedProvider === 'groq' ? 'Groq' : 'FreeTheAI'} (${selectedModel}) • Grounded Telemetry`;
  }
}

window.saveCustomAiKeys = function() {
  const ftaiVal = document.getElementById('customFtaiKey')?.value.trim();
  const groqVal = document.getElementById('customGroqKey')?.value.trim();
  if (ftaiVal !== undefined) {
    localFtaiKey = ftaiVal;
    localStorage.setItem('ftai_api_key', ftaiVal);
  }
  if (groqVal !== undefined) {
    localGroqKey = groqVal;
    localStorage.setItem('groq_api_key', groqVal);
  }
  alert('Custom AI API keys saved locally in your browser storage!');
};

window.sendQuickPrompt = function(text) {
  const cInput = document.getElementById('chatInput');
  const fsInput = document.getElementById('fsChatInput');
  if (cInput) cInput.value = text;
  if (fsInput) fsInput.value = text;
  sendPrompt(text);
  if (cInput) cInput.value = '';
  if (fsInput) fsInput.value = '';
};

async function sendPrompt(text) {
  if (!text || !text.trim()) return;

  // Append user message to both chat boxes
  appendChatMessage('user', text);

  // Show typing indicator
  const typingEl = appendChatMessage('assistant', '*Consulting electrical intelligence engine & telemetry logs...*');
  typingEl.classList.add('chat-typing-indicator');
  if (chatMessages && chatMessages.lastElementChild) {
    chatMessages.lastElementChild.classList.add('chat-typing-indicator');
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (localGroqKey) headers['x-groq-key'] = localGroqKey;
    if (localFtaiKey) headers['x-ftai-key'] = localFtaiKey;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(-8),
        provider: selectedProvider,
        model: selectedModel,
        ftaiKey: localFtaiKey || undefined,
        groqKey: localGroqKey || undefined
      })
    });

    const json = await res.json();
    document.querySelectorAll('.chat-typing-indicator').forEach(node => node.remove());

    if (json.reply) {
      appendChatMessage('assistant', json.reply, json.model, json.provider);
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: json.reply });
      if (json.telemetry) {
        try {
          updateUI(json.telemetry);
        } catch (uiErr) {
          console.warn('UI update error following chat telemetry sync:', uiErr);
        }
      }
    } else if (json.error) {
      appendChatMessage('assistant', `⚠️ **AI Service Error:** ${json.error}`);
    }
  } catch (err) {
    document.querySelectorAll('.chat-typing-indicator').forEach(node => node.remove());
    appendChatMessage('assistant', `⚠️ **Network Error:** Could not contact server: ${err.message}`);
  }
}

function appendChatMessage(role, content, model = null, provider = null) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  
  if (role === 'assistant') {
    let html = marked.parse(content);
    if (model) {
      const pName = provider || (model.startsWith('fta/') ? 'FreeTheAI' : 'Groq');
      html += `<div style="margin-top: 8px; font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono); border-top: 1px dashed var(--border); padding-top: 5px; display: flex; align-items: center; gap: 6px;">
        <span class="live-dot pulse-green" style="width: 5px; height: 5px;"></span>
        Engine: <strong>${pName}</strong> &bull; Model: <code>${model}</code>
      </div>`;
    }
    bubble.innerHTML = html;
  } else {
    bubble.textContent = content;
  }
  
  el.appendChild(bubble);

  // Append to both mini chat and full-screen chat with smooth auto-scroll to bottom
  if (chatMessages) {
    chatMessages.appendChild(el.cloneNode(true));
    requestAnimationFrame(() => {
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    });
  }
  if (fsChatMessages) {
    fsChatMessages.appendChild(el);
    requestAnimationFrame(() => {
      fsChatMessages.scrollTo({ top: fsChatMessages.scrollHeight, behavior: 'smooth' });
    });
  }

  return el;
}

// Form Handlers
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = chatInput ? chatInput.value.trim() : '';
    if (val) {
      sendPrompt(val);
      if (chatInput) {
        chatInput.value = '';
        chatInput.focus();
      }
    }
  });
}

if (fsChatForm) {
  fsChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = fsChatInput ? fsChatInput.value.trim() : '';
    if (val) {
      sendPrompt(val);
      if (fsChatInput) {
        fsChatInput.value = '';
        fsChatInput.focus();
      }
    }
  });
}

const clearBothChats = () => {
  chatHistory = [];
  const defaultHtml = `
    <div class="chat-msg assistant">
      <div class="msg-bubble">Conversation cleared. How can I assist you with facility telemetry or anomaly diagnostics?</div>
    </div>
  `;
  if (chatMessages) chatMessages.innerHTML = defaultHtml;
  if (fsChatMessages) fsChatMessages.innerHTML = defaultHtml;
};

if (clearChatBtn) clearChatBtn.addEventListener('click', clearBothChats);
const fsClearChatBtn = document.getElementById('fsClearChatBtn');
if (fsClearChatBtn) fsClearChatBtn.addEventListener('click', clearBothChats);

// Configure Groq API Key (if present)
const apiKeyBtn = document.getElementById('apiKeyBtn');
if (apiKeyBtn) {
  apiKeyBtn.addEventListener('click', () => {
    const key = prompt('Enter your Groq API Key (saved locally in your browser):', localGroqKey);
    if (key !== null) {
      localGroqKey = key.trim();
      localStorage.setItem('groq_api_key', localGroqKey);
      alert('Groq API Key saved for this session!');
    }
  });
}

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
  initAiModelSelectors();
  
  let savedView = localStorage.getItem('s3_active_view') || 'overview';
  if (savedView === 'appliances') savedView = 'overview';
  switchView(savedView);

  // Initial fetches
  fetchTelemetry();
  fetchAppliances();
  fetchEvents();
  fetchPyTorchLive();
  loadBiasConfig();
  fetchContinuousLearningStatus();

  // Continuous polling
  setInterval(fetchTelemetry, 2500);
  setInterval(fetchPyTorchLive, 4000);
  setInterval(fetchContinuousLearningStatus, 5000);

  // 10-minute web keep-alive heartbeat (prevents host sleep)
  setInterval(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        console.log('[Heartbeat ⏰ 10m] Keep-alive ping acknowledged:', data);
      }
    } catch (e) {
      console.warn('Keep-alive ping notice:', e.message);
    }
  }, 10 * 60 * 1000);
});


// ========================================================
// 9. SINGLE-PAGE ARCHITECTURE: EMBEDDED SLIDES & LIGHTBOX
// (Strictly Zero Page Redirection • 100% In-Page Navigation)
// ========================================================
let currentEmbeddedSlide = 1;
const totalEmbeddedSlides = 10;

const slideCategories = [
  "Project Overview",
  "Technical Agenda",
  "Objective & Problem",
  "System Architecture",
  "Hardware Schematics",
  "Experimental Verification",
  "Conclusion & Matrix",
  "Future Scope AI",
  "Modular Switch Circuit",
  "Demonstration Complete"
];

window.goToSlide = function(num) {
  num = parseInt(num, 10);
  if (isNaN(num) || num < 1) num = 1;
  if (num > totalEmbeddedSlides) num = totalEmbeddedSlides;
  currentEmbeddedSlide = num;
  updateEmbeddedSlideView();
};

window.navSlide = function(direction) {
  goToSlide(currentEmbeddedSlide + direction);
};

window.toggleSlideFullscreen = function() {
  const deck = document.getElementById('embeddedDeckViewport');
  if (!deck) return;
  if (!document.fullscreenElement) {
    deck.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
  } else {
    document.exitFullscreen().catch(err => console.warn('Exit fullscreen failed:', err));
  }
};

function updateEmbeddedSlideView() {
  document.querySelectorAll('.embedded-slide').forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === currentEmbeddedSlide);
  });
  const counter = document.getElementById('currentSlideCounter');
  if (counter) counter.textContent = `Slide ${currentEmbeddedSlide} of ${totalEmbeddedSlides}`;
  const catTag = document.getElementById('currentSlideCategoryTag');
  if (catTag && slideCategories[currentEmbeddedSlide - 1]) {
    catTag.textContent = slideCategories[currentEmbeddedSlide - 1].toUpperCase();
  }
  const jumpSelect = document.getElementById('slideJumpSelect');
  if (jumpSelect) jumpSelect.value = currentEmbeddedSlide;
  document.querySelectorAll('.deck-dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === currentEmbeddedSlide);
  });
}

// In-Page Lightbox Modal (Zero Page Redirection)
window.openLightboxModal = function(src, title) {
  const modal = document.getElementById('imageLightboxModal');
  const img = document.getElementById('lightboxImg');
  const t = document.getElementById('lightboxTitle');
  if (!modal || !img) return;
  img.src = src;
  if (t) t.textContent = title || 'High-Resolution Hardware Schematic';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeLightboxModal = function(e) {
  if (e && e.target && e.target.closest('.lightbox-content') && !e.target.closest('.btn-close-modal')) return;
  const modal = document.getElementById('imageLightboxModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightboxModal();
  if (document.getElementById('view-schematics')?.classList.contains('active')) {
    if (e.key === 'ArrowLeft') navSlide(-1);
    if (e.key === 'ArrowRight') navSlide(1);
  }
});

// ========================================================
// 10. PROJECT KNOWLEDGE BASE & DICTIONARY SEARCH ENGINE
// ========================================================
window.filterDictionaryTerms = function(query) {
  const q = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#dictionaryGridContainer .dict-card');
  cards.forEach(card => {
    const text = (card.getAttribute('data-term') || '') + ' ' + (card.innerText || '').toLowerCase();
    if (!q || text.includes(q)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
};
