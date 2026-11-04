import re
import os

guide_html = '''
    <!-- ======================================================== -->
    <!-- VIEW 6: COMPREHENSIVE PROJECT KNOWLEDGE BASE & DICTIONARY -->
    <!-- ======================================================== -->
    <main class="view-container" id="view-guide">
      <div class="guide-container">

        <!-- Hero Header Card -->
        <div class="guide-hero">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <span class="badge-source-real" style="margin-bottom: 8px; display: inline-flex;">
                <span class="live-dot pulse-green" style="width: 6px; height: 6px;"></span>
                COMPREHENSIVE PROJECT REFERENCE MANUAL &amp; DICTIONARY
              </span>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">
                S-3 IOT: Complete Engineering Pipeline, Hardware &amp; Dictionary
              </h2>
              <p style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 4px; max-width: 850px; line-height: 1.55;">
                Everything you need to understand the project in crystal-clear, plain English. Includes the step-by-step energy and data pipeline, 9 physical hardware specifications, software algorithms, neural network architecture, and an A-Z glossary explaining every technical term.
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="window.print()">
                <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print / Save PDF
              </button>
            </div>
          </div>

          <!-- Sticky Sub-Navigation Pills -->
          <div class="guide-subnav">
            <a href="#guide-pipeline" class="guide-subnav-btn">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              1. System Pipeline
            </a>
            <a href="#guide-hardware" class="guide-subnav-btn">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
              2. Hardware Components (9)
            </a>
            <a href="#guide-software" class="guide-subnav-btn">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              3. Software, Math &amp; AI
            </a>
            <a href="#guide-dictionary" class="guide-subnav-btn">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
              4. Project Dictionary
            </a>
            <a href="#guide-faq" class="guide-subnav-btn">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              5. Viva &amp; Evaluator Q&amp;A
            </a>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- SUB-SECTION 1: END-TO-END SYSTEM PIPELINE                -->
        <!-- ======================================================== -->
        <section id="guide-pipeline" class="card">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <svg class="ui-icon" style="color: var(--accent-sky);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              1. The End-to-End System Pipeline
            </h3>
            <p style="font-size: 0.80rem; color: var(--text-secondary); margin-top: 2px;">
              Follow the journey of electrical energy and telemetry from sunlight photons falling on the solar panel to edge AI reasoning in the browser.
            </p>
          </div>

          <div class="pipeline-timeline">

            <!-- Step 1 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">01</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-hw">HARDWARE GENERATION</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">6V Monocrystalline PV Panel</span>
                </div>
                <h4>Photovoltaic Harvesting: Sun &rarr; 6.0V DC Electricity</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  Sunlight carries photons that strike the silicon crystals of the 6V / 5W–10W monocrystalline solar panel, knocking electrons free (the Photovoltaic Effect). This creates a direct electrical potential difference of ~6.0V DC. <strong>Why 6V?</strong> Because a lithium-ion battery requires 4.20V to reach full charge; a 6V solar panel provides the necessary +1.8V headroom above the battery voltage so the charging controller can operate efficiently even during partly cloudy conditions.
                </p>
              </div>
            </div>

            <!-- Step 2 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">02</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-hw">CHARGE REGULATION</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">TP4056 Module + 3.7V 18650 Li-ion Cell</span>
                </div>
                <h4>Safe Chemical Energy Storage: CC/CV Charging &amp; DW01A Protection</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  The raw 6V from the solar panel flows into the TP4056 charging IC. The TP4056 executes a precision two-stage <strong>Constant Current / Constant Voltage (CC/CV)</strong> charging profile, charging the 3.7V 18650 Li-ion cell at up to 1.0A until it safely terminates at 4.20V &plusmn;1%. The onboard DW01A protection IC and dual MOSFET switch protect against over-discharge (&lt;2.5V cut-off), short circuits, and reverse polarity, ensuring the lithium battery never suffers thermal runaway.
                </p>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">03</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-hw">DC-DC CONVERSION</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">MT3608 Step-Up Boost Converter</span>
                </div>
                <h4>Power Rail Boosting: 3.7V Battery &rarr; Stable 5.0V DC Output</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  As the 18650 battery discharges during use, its terminal voltage gradually drops from 4.2V down to 3.2V. Because our DC loads require a steady 5V DC supply, the MT3608 boost converter uses a 1.2MHz high-frequency switching inductor to continuously step up the varying battery voltage to a rock-solid, regulated 5.0V DC power rail.
                </p>
              </div>
            </div>

            <!-- Step 4 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">04</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-hw">ELECTRICAL LOADS</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">DC LED Fixture &amp; DC Motor</span>
                </div>
                <h4>Dual Appliance Actuation: Lighting &amp; Dynamic Inductive Motive Power</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  The 5.0V boost output powers two real hardware loads: 
                  <strong>(1) DC LED Fixture:</strong> a constant resistive lighting load drawing 0.393A (~1.82W); and 
                  <strong>(2) 5V DC Motor:</strong> a dynamic inductive load drawing 0.18A–0.45A during normal running, but pulling an initial 1.85A startup inrush surge when energized, and exceeding 2.5A during a locked-rotor stall fault.
                </p>
              </div>
            </div>

            <!-- Step 5 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge" style="border-color: var(--warning); color: var(--warning);">05</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-hw">ELECTRICAL ISOLATION RULE</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem; color: #d97706;">Independent External Supply for ESP32</span>
                </div>
                <h4>Power Isolation: Clean Logic Rail vs Noisy Solar Load Rail</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  <strong>Strict Architecture Principle:</strong> The solar battery and 5V booster rail STRICTLY power the LED and Motor loads. The ESP32 microcontroller is powered via an independent external 5V supply. <strong>Why?</strong> Electric motors produce massive electromagnetic inductive kickback (back-EMF) and instantaneous voltage sags during startup. If the ESP32 shared the motor's power rail, these voltage drops would brown out the microcontroller, causing continuous Wi-Fi disconnects and system resets. Separating the rails guarantees 100% telemetry uptime.
                </p>
              </div>
            </div>

            <!-- Step 6 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">06</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-sw">SENSING &amp; CALIBRATION</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">ACS712 (Hall) + 5:1 Dividers + ESP32 ADC1</span>
                </div>
                <h4>Precision Sensing &amp; Zero-Bias Clamping Filter</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  Two ACS712-05B Hall-effect sensors measure current in series (LED: GPIO 34, Motor: GPIO 35), and two 5:1 precision resistor dividers measure voltage in parallel (LED: GPIO 32, Motor: GPIO 33). The ESP32's 12-bit ADC converts these to digital values (0–4095). 
                  <strong>Zero-Bias Rectification:</strong> Breadboard noise causes idle pins to float at ~1.18V and ACS712 sensors to register ~0.20A quiescent drift when loads are completely off. Our firmware and backend apply a digital deadband filter: if voltage is &le; 2.0V or current is &le; 0.28A/0.22A, readings are mathematically clamped to exact 0.00V, 0.00A, and 0.00W.
                </p>
              </div>
            </div>

            <!-- Step 7 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge">07</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-sw">CLOUD TELEMETRY &amp; CALCULUS</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem;">Firebase RTDB + Node.js Engine</span>
                </div>
                <h4>Cloud Ingestion, Trapezoidal Energy Integration &amp; Electricity Billing</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  The ESP32 streams JSON payloads to Firebase Realtime Database (RTDB) via 2.4GHz Wi-Fi every 1–2 seconds. The Node.js cloud server reads this stream, computes instantaneous power using <code>P = V &times; I</code>, calculates cumulative energy using <strong>Trapezoidal Numerical Integration</strong> (accounting for exact millisecond intervals &Delta;t), and multiplies total units (kWh) by the commercial tariff rate of <strong>₹8.00 per Unit</strong> to provide real-time rupee electricity billing.
                </p>
              </div>
            </div>

            <!-- Step 8 -->
            <div class="pipeline-step-card">
              <div class="step-number-badge" style="border-color: #9333ea; color: #9333ea;">08</div>
              <div class="step-content">
                <div class="step-meta">
                  <span class="step-meta-badge step-meta-ai">NEURAL AI &amp; CONTINUOUS LEARNING</span>
                  <span class="badge-mini-real" style="font-size: 0.70rem; color: #9333ea;">PyTorch Transformer + FreeTheAI / Groq</span>
                </div>
                <h4>Edge Neural Diagnostics, Continuous Self-Learning &amp; AI Copilot Grounding</h4>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
                  The cloud backend runs <code>S3ElectricalTransformer</code>, a deep PyTorch neural sequence model utilizing multi-head self-attention on sliding windows of voltage, current, power, and dI/dt. It classifies appliance states into <em>Normal Running</em>, <em>Startup Inrush Surge</em>, or <em>Motor Stall</em>. 
                  Every 5 minutes, an autonomous background cycle fine-tunes the PyTorch model on newly ingested operational data using an experience replay buffer (97.22% validation accuracy). When users query the AI Copilot, live telemetry is grounded into FreeTheAI (GLM-5.3) and Groq (LLaMA 3.3) LLMs via the Model Context Protocol (MCP).
                </p>
              </div>
            </div>

          </div>
        </section>

        <!-- ======================================================== -->
        <!-- SUB-SECTION 2: COMPLETE HARDWARE CATALOG (9 COMPONENTS)  -->
        <!-- ======================================================== -->
        <section id="guide-hardware" class="card">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <svg class="ui-icon" style="color: var(--accent-sky);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
              2. Complete Hardware Component Catalog (All 9 Physical Devices)
            </h3>
            <p style="font-size: 0.80rem; color: var(--text-secondary); margin-top: 2px;">
              Detailed breakdown of each physical component: exact model, specifications, pin connections, operating principle, and failure impacts.
            </p>
          </div>

          <div class="hw-catalog-grid">

            <!-- HW 1: Solar Panel -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">PRIMARY GENERATOR</span>
                  <h4>6V 5W–10W Monocrystalline PV Panel</h4>
                </div>
                <span class="badge-mini-real">6V DC</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Red Lead (+) &rarr; TP4056 IN+ &bull; Black Lead (-) &rarr; TP4056 IN-
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Primary clean renewable energy generator. Converts photons into direct electrical current.<br>
                <strong>Working Principle:</strong> Semiconductor p-n junction absorbs light; photons transfer energy to valence electrons, generating an electric field.<br>
                <strong>Why 6V?</strong> Provides the +1.8V headroom needed above the 4.2V lithium-ion charge cutoff threshold.<br>
                <strong>Failure Mode:</strong> In nighttime or disconnection, system seamlessly draws stored power from the 18650 battery.
              </p>
            </div>

            <!-- HW 2: TP4056 Charger -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">BATTERY CONTROLLER</span>
                  <h4>TP4056 Lithium Charge &amp; Protection Module</h4>
                </div>
                <span class="badge-mini-real">1.0A CC/CV</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> IN+/IN- (Solar) &bull; B+/B- (18650 Battery) &bull; OUT+/OUT- (Booster IN)
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Safe battery charging and multi-fault protection.<br>
                <strong>Working Principle:</strong> Regulates current to 1A in Constant Current mode until battery reaches 4.2V, then switches to Constant Voltage mode with auto-cutoff.<br>
                <strong>Protection ICs:</strong> DW01A protection IC with dual 8205A MOSFETs disconnects load if voltage drops below 2.5V (over-discharge) or shorts.<br>
                <strong>Failure Mode:</strong> Disconnecting TP4056 stops battery charging and removes protection against over-voltage damage.
              </p>
            </div>

            <!-- HW 3: 18650 Battery -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">ENERGY STORAGE</span>
                  <h4>3.7V 18650 Rechargeable Li-ion Cell</h4>
                </div>
                <span class="badge-mini-real">2200–2600 mAh</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Positive terminal &rarr; TP4056 B+ &bull; Negative terminal &rarr; TP4056 B-
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Electrochemical buffer storing clean solar energy for round-the-clock continuous load operation.<br>
                <strong>Working Principle:</strong> Lithium ions move between graphite anode and metal-oxide cathode during charge/discharge cycles.<br>
                <strong>Nominal Specs:</strong> 3.7V nominal, 4.2V peak charged, 3.0V discharge cutoff.<br>
                <strong>Failure Mode:</strong> Missing battery means loads only run during bright sun and shut off immediately when solar irradiance drops.
              </p>
            </div>

            <!-- HW 4: MT3608 Booster -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">STEP-UP CONVERTER</span>
                  <h4>MT3608 DC-DC Step-Up Boost Converter</h4>
                </div>
                <span class="badge-mini-real">3.7V &rarr; 5.0V</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> IN+/IN- from TP4056 OUT &bull; OUT+/OUT- to 5V Monitored Load Rail
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Steps up fluctuating battery voltage (3.2V–4.2V) to a rock-solid, regulated 5.0V DC bus.<br>
                <strong>Working Principle:</strong> Internal power MOSFET switches at 1.2MHz, charging an inductor and discharging it into an output capacitor via a Schottky diode.<br>
                <strong>Why Needed?</strong> 5V DC Motor and LED require a steady 5V. Connecting them directly to the 3.7V battery would cause motor stalling and LED dimming as the battery discharges.<br>
                <strong>Efficiency:</strong> Up to 93% energy conversion efficiency.
              </p>
            </div>

            <!-- HW 5: ESP32 Microcontroller -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">EDGE MCU</span>
                  <h4>ESP32 DevKit V1 (Tensilica Dual-Core)</h4>
                </div>
                <span class="badge-mini-real">240MHz &bull; Wi-Fi</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> GPIO 32 (LED V) &bull; GPIO 34 (LED I) &bull; GPIO 33 (Motor V) &bull; GPIO 35 (Motor I) &bull; VIN/GND (Ext 5V)
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Central processing unit for analog multi-channel sampling, zero-bias deadband filtering, and 2.4GHz Wi-Fi cloud streaming.<br>
                <strong>Processor:</strong> Dual-core 32-bit Xtensa LX6 microcontroller running at 240MHz with 520KB SRAM.<br>
                <strong>Powering:</strong> Powered from an independent external 5V supply, completely isolated from load transients.<br>
                <strong>ADC Architecture:</strong> Uses ADC1 channels only, ensuring analog readings function seamlessly alongside active Wi-Fi transmission.
              </p>
            </div>

            <!-- HW 6: ACS712 Current Sensors -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">CURRENT SENSING</span>
                  <h4>ACS712-05B Hall-Effect Current Sensor Modules (Dual)</h4>
                </div>
                <span class="badge-mini-real">&plusmn;5A &bull; 185mV/A</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Screw terminals: In-series with (+) wire &bull; VCC: 5V, GND: GND &bull; OUT: GPIO 34 (LED), GPIO 35 (Motor)
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Precise, galvanically isolated current measurement for both loads.<br>
                <strong>Working Principle:</strong> Current passes through internal copper conduction path, creating a magnetic field proportional to current. An internal Hall element detects the field and outputs an analog voltage: <code>Vout = 2.5V + (I &times; 0.185V/A)</code>.<br>
                <strong>Zero Current Output:</strong> 2.50V (half of VCC) represents zero amperes.<br>
                <strong>Why ACS712?</strong> Eliminates ground loops and heat loss associated with traditional shunt resistors.
              </p>
            </div>

            <!-- HW 7: Voltage Divider Sensors -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">VOLTAGE SENSING</span>
                  <h4>5:1 Precision Resistor Divider Modules (Dual)</h4>
                </div>
                <span class="badge-mini-real">0–25V Input</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Screw terminals: Across load (+) &amp; (-) &bull; S: GPIO 32 (LED), GPIO 33 (Motor) &bull; -: GND
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Scales high DC voltages (up to 25V) down to safe levels for the 3.3V ESP32 ADC.<br>
                <strong>Resistor Network:</strong> 30 k&Omega; and 7.5 k&Omega; in series. <code>Vout = Vin &times; (7.5 / 37.5) = Vin / 5</code>.<br>
                <strong>Why Essential?</strong> Connecting a 5V–12V DC power rail directly to an ESP32 GPIO pin would immediately destroy the internal silicon gate. The divider keeps all signals strictly &le; 3.3V.
              </p>
            </div>

            <!-- HW 8: DC LED Load -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">LIGHTING APPLIANCE</span>
                  <h4>5V DC LED Lighting Fixture (Load 1)</h4>
                </div>
                <span class="badge-mini-real">5V &bull; 0.393A &bull; 1.82W</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Positive: Boost 5V Rail via ACS712 Module 1 &bull; Negative: Common GND
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Primary baseline lighting appliance demonstrating steady-state energy telemetry.<br>
                <strong>Electrical Behavior:</strong> Non-inductive resistive diode load. Exhibits zero inrush transients and flat continuous power consumption (~1.82W).<br>
                <strong>Telemetry Channel:</strong> Monitored in real-time by GPIO 32 (Voltage) and GPIO 34 (Current).
              </p>
            </div>

            <!-- HW 9: 5V DC Motor -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-hw">DYNAMIC INDUCTIVE LOAD</span>
                  <h4>5V DC Motor / Pump Appliance (Load 2)</h4>
                </div>
                <span class="badge-mini-real">5V &bull; 0.18A–2.5A</span>
              </div>
              <div class="hw-pinout-box">
                <strong>Pins:</strong> Positive: Boost 5V Rail via ACS712 Module 2 &bull; Negative: Common GND
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                <strong>Purpose:</strong> Dynamic motive power appliance demonstrating complex electrical transients, motor inrush surges, and stall fault detection.<br>
                <strong>Operating Phases:</strong><br>
                &bull; <em>Startup Inrush Surge:</em> Draws 1.85A peak for ~420ms when rotor accelerates from rest.<br>
                &bull; <em>Normal Running:</em> Settles to 0.18A–0.45A once back-EMF is established.<br>
                &bull; <em>Stall / Overload Fault:</em> If shaft is blocked, current exceeds 2.5A, triggering PyTorch anomaly alerts.
              </p>
            </div>

          </div>
        </section>

        <!-- ======================================================== -->
        <!-- SUB-SECTION 3: SOFTWARE, MATHEMATICS & AI STACK          -->
        <!-- ======================================================== -->
        <section id="guide-software" class="card">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <svg class="ui-icon" style="color: var(--accent-sky);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              3. Software, Mathematics &amp; Neural Network Architecture
            </h3>
            <p style="font-size: 0.80rem; color: var(--text-secondary); margin-top: 2px;">
              The algorithms, mathematical equations, and PyTorch deep learning models that power the real-time electrical analytics.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;">

            <!-- Card 1: Strict DC Power Formula -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-sw">MATHEMATICAL FORMULA</span>
                  <h4>Strict DC Power Formula: P = V &times; I</h4>
                </div>
                <span class="badge-mini-real">Watts (W)</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                In Direct Current (DC) circuits, voltage and current are strictly in phase without reactive displacement (Power Factor = 1.0). True instantaneous power is calculated directly:<br>
                <code>P_instant = V_measured &times; I_measured</code><br>
                Total monitored load power is the sum: <code>P_total = P_led + P_motor</code>.
              </p>
            </div>

            <!-- Card 2: Trapezoidal Energy Integration -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-sw">CALCULUS INTEGRATION</span>
                  <h4>Trapezoidal Energy Integration (kWh)</h4>
                </div>
                <span class="badge-mini-real">kWh Units</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                Power varies dynamically over time. To calculate total energy, the engine integrates power over exact millisecond timestamps using the <strong>Trapezoidal Rule</strong>:<br>
                <code>&Delta;E = ((P_prev + P_curr) / 2) &times; (&Delta;t_ms / 3,600,000,000) kWh</code><br>
                This rejects discrete step errors and accurately records brief motor inrush spikes.
              </p>
            </div>

            <!-- Card 3: Tariff Billing Engine -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-sw">FINANCIAL BILLING</span>
                  <h4>Electricity Tariff: ₹8.00 / Unit</h4>
                </div>
                <span class="badge-mini-real">Rupees (₹)</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                One standard electrical &ldquo;Unit&rdquo; equals 1 kilowatt-hour (1 kWh = 1000 Watts used for 1 hour). The live bill is computed as:<br>
                <code>Energy Charge (₹) = Cumulative Energy (kWh) &times; ₹8.00</code><br>
                Monthly projected bill is extrapolated from the running 60-minute consumption moving average.
              </p>
            </div>

            <!-- Card 4: Zero-Bias Calibration -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-sw">SENSOR RECTIFICATION</span>
                  <h4>Zero-Bias Deadband Calibration Filter</h4>
                </div>
                <span class="badge-mini-real">Noise Clamping</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                <strong>The Problem:</strong> When loads are turned off, unshielded breadboard ADC pins float at ~1.18V, and Hall sensors drift by ~0.20A. Left unchecked, this false phantom power accumulates into incorrect electricity bills.<br>
                <strong>The Solution:</strong> The engine applies deadband clamping:<br>
                <code>if (V &le; 2.0V) { V = 0.00; }</code><br>
                <code>if (I_led &le; 0.28A) { I_led = 0.00; P_led = 0.00; }</code><br>
                <code>if (I_motor &le; 0.22A) { I_motor = 0.00; P_motor = 0.00; }</code>
              </p>
            </div>

            <!-- Card 5: PyTorch Transformer -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-ai">DEEP LEARNING</span>
                  <h4>PyTorch Transformer (S3ElectricalTransformer)</h4>
                </div>
                <span class="badge-mini-real">Multi-Head Attention</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                A 4-layer PyTorch sequence transformer trained on 8-step time windows of <code>[Voltage, Current, Power, dI/dt]</code>. Multi-head self-attention models temporal dynamics, distinguishing between safe motor startup surges (420ms transient) and dangerous locked-rotor motor stalls (&gt;2.5A sustained).
              </p>
            </div>

            <!-- Card 6: Continuous Learning Engine -->
            <div class="hw-card">
              <div class="hw-card-header">
                <div>
                  <span class="step-meta-badge step-meta-ai">AUTONOMOUS MLOPS</span>
                  <h4>Continuous Learning &amp; Replay Buffer Loop</h4>
                </div>
                <span class="badge-mini-real">Auto-Retrain 5m</span>
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.55;">
                New telemetry cycles are automatically appended to a sliding experience replay buffer. Every 5 minutes, an autonomous background pass fine-tunes the PyTorch neural network weights using AdamW optimizer and cross-entropy loss, maintaining 97.22% validation accuracy without human intervention.
              </p>
            </div>

          </div>
        </section>

        <!-- ======================================================== -->
        <!-- SUB-SECTION 4: THE A-Z PROJECT DICTIONARY ("SMALL WORDS")-->
        <!-- ======================================================== -->
        <section id="guide-dictionary" class="card">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <svg class="ui-icon" style="color: var(--accent-sky);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
              4. The Project Dictionary (&ldquo;Small Words&rdquo; Explained Simply)
            </h3>
            <p style="font-size: 0.80rem; color: var(--text-secondary); margin-top: 2px;">
              Every technical term, acronym, and electrical word defined in clear, accessible everyday language with analogies.
            </p>
          </div>

          <!-- Real-Time Search Bar -->
          <div class="dict-search-bar">
            <svg class="ui-icon" style="color: var(--text-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="dictionarySearchInput" placeholder="Search dictionary terms (e.g. ADC, Inrush, Hall Effect, Deadband, Tariff, MCP, Booster)..." oninput="filterDictionaryTerms(this.value)">
          </div>

          <div class="dict-grid" id="dictionaryGridContainer">

            <!-- Term 1: ADC -->
            <div class="dict-card" data-term="adc analog digital converter">
              <div class="term-head">
                <span class="term-title">ADC (Analog-to-Digital Converter)</span>
                <span class="badge-mini-real">Hardware</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> An interpreter that translates a continuous analog ruler measurement into a digital typed number for a computer.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The internal circuitry on the ESP32 that measures continuous physical voltage levels (0.0V to 3.3V) and converts them into 12-bit digital numbers (integers from 0 to 4095) so code can analyze them.
              </p>
            </div>

            <!-- Term 2: GPIO -->
            <div class="dict-card" data-term="gpio general purpose input output pins">
              <div class="term-head">
                <span class="term-title">GPIO (General Purpose Input/Output)</span>
                <span class="badge-mini-real">Hardware</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> The physical ports or sockets on a microchip where wires are plugged in to communicate with the outside world.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The programmable metal pins on the ESP32 (e.g. GPIO 32, 33, 34, 35) configured to read incoming analog voltages from the sensors or send signals to relays and LEDs.
              </p>
            </div>

            <!-- Term 3: Photovoltaic (PV) Effect -->
            <div class="dict-card" data-term="photovoltaic pv effect solar panel">
              <div class="term-head">
                <span class="term-title">Photovoltaic (PV) Effect</span>
                <span class="badge-mini-real">Physics</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Sunlight shining on silicon acts like pool balls hitting electrons, knocking them forward through a wire to create electricity.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The physical phenomenon where light particles (photons) strike semiconductor silicon cells, transferring energy to electrons and generating a direct current (DC) electrical voltage.
              </p>
            </div>

            <!-- Term 4: CC/CV Charging -->
            <div class="dict-card" data-term="cc cv charging constant current voltage tp4056">
              <div class="term-head">
                <span class="term-title">CC/CV Charging</span>
                <span class="badge-mini-real">Battery</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Pumping water into a balloon rapidly at first (Constant Current), then slowing down to a gentle trickle near the end so it doesn't pop (Constant Voltage).
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The standard safe charging profile for lithium batteries used by the TP4056: feeds a steady 1.0A current until the cell reaches 4.2V, then caps voltage at 4.2V and lets current taper to zero.
              </p>
            </div>

            <!-- Term 5: Hall Effect -->
            <div class="dict-card" data-term="hall effect acs712 current sensor magnetic">
              <div class="term-head">
                <span class="term-title">Hall Effect</span>
                <span class="badge-mini-real">Sensing</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Measuring water speed in a hose by listening to how fast an external wheel spins without cutting into the hose itself.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                When current flows through a conductor, it creates a magnetic field. The ACS712 senses this magnetic field perpendicular to current flow, generating a voltage proportional to amperes without direct electrical contact.
              </p>
            </div>

            <!-- Term 6: DC-DC Boost Converter -->
            <div class="dict-card" data-term="dcdc boost step up converter mt3608">
              <div class="term-head">
                <span class="term-title">DC-DC Step-Up (Boost) Converter</span>
                <span class="badge-mini-real">Power</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> A bicycle pump that takes low-pressure air strokes and compresses them into high-pressure tire inflation.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                An electronic circuit that takes a lower input DC voltage (3.2V–4.2V from the battery) and boosts it up to a higher, stable output voltage (5.0V DC) using high-frequency switching and an inductor.
              </p>
            </div>

            <!-- Term 7: Deadband / Clamping Filter -->
            <div class="dict-card" data-term="deadband clamping filter zero bias">
              <div class="term-head">
                <span class="term-title">Deadband / Clamping Filter</span>
                <span class="badge-mini-real">Software</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Noise cancellation in headphones: ignoring faint background room rustle so you only hear true voice conversations.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                A software algorithm that forces any sensor measurement below a predefined threshold (e.g. &le; 2.0V or &le; 0.22A) to exact zero, eliminating phantom sensor drift when appliances are switched off.
              </p>
            </div>

            <!-- Term 8: Inrush Current / Startup Surge -->
            <div class="dict-card" data-term="inrush current startup surge motor pump">
              <div class="term-head">
                <span class="term-title">Inrush Current (Startup Surge)</span>
                <span class="badge-mini-real">Electrical</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Pushing a heavy stalled car: you need a massive initial shove to get it rolling, after which it rolls easily with gentle effort.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The brief, normal spike in electrical current (e.g. 1.85A for 420ms on our DC motor) when an electric motor first starts from a complete standstill before the rotor generates opposing back-EMF.
              </p>
            </div>

            <!-- Term 9: Motor Stall / Locked Rotor -->
            <div class="dict-card" data-term="motor stall locked rotor fault overload">
              <div class="term-head">
                <span class="term-title">Motor Stall (Locked Rotor)</span>
                <span class="badge-mini-real">Fault</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Stepping on the gas pedal while holding the handbrake: the engine strains dangerously and overheats because the wheels cannot turn.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                A severe fault where the motor shaft is physically jammed. Because no back-EMF is generated, current rises uncontrollably (&gt;2.5A), creating fire and coil burn risks if not detected by AI.
              </p>
            </div>

            <!-- Term 10: kWh & Unit -->
            <div class="dict-card" data-term="kwh kilowatt hour unit energy billing">
              <div class="term-head">
                <span class="term-title">Kilowatt-Hour (kWh) &amp; Unit</span>
                <span class="badge-mini-real">Measurement</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Like measuring total liters of water pumped out of a tank over an entire month.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The standard commercial unit of electrical energy. 1 kWh (or 1 Unit) equals 1,000 Watts of electrical power consumed continuously for 1 hour: <code>1 kWh = 3,600,000 Joules</code>.
              </p>
            </div>

            <!-- Term 11: Tariff Rate (₹8.00/Unit) -->
            <div class="dict-card" data-term="tariff rate inr electricity bill cost">
              <div class="term-head">
                <span class="term-title">Electricity Tariff Rate (₹8.00 / Unit)</span>
                <span class="badge-mini-real">Billing</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> The price per liter of fuel at a gas station: multiply liters used by price per liter to get total bill.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The pricing schedule set by electrical utility providers. In our system, each 1.0 kWh of energy consumed costs exactly ₹8.00.
              </p>
            </div>

            <!-- Term 12: Back-EMF -->
            <div class="dict-card" data-term="back emf counter electromotive force motor">
              <div class="term-head">
                <span class="term-title">Back-EMF (Counter-Electromotive Force)</span>
                <span class="badge-mini-real">Physics</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Running into a headwind: the faster you run, the more air pushes back against you, naturally capping your top speed.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                The opposing voltage naturally generated by a spinning electric motor armature that opposes the incoming supply voltage, naturally limiting steady-state running current to ~0.2A.
              </p>
            </div>

            <!-- Term 13: Brownout -->
            <div class="dict-card" data-term="brownout voltage sag reset esp32">
              <div class="term-head">
                <span class="term-title">Brownout &amp; Voltage Sag</span>
                <span class="badge-mini-real">Power Quality</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> When someone flushes a toilet in the house and the shower pressure suddenly drops to a trickle.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                A sudden temporary dip in voltage caused by high startup load current. If microcontrollers experience a brownout below ~2.7V, their internal logic crashes and restarts.
              </p>
            </div>

            <!-- Term 14: Model Context Protocol (MCP) -->
            <div class="dict-card" data-term="mcp model context protocol ai tool calling">
              <div class="term-head">
                <span class="term-title">Model Context Protocol (MCP)</span>
                <span class="badge-mini-real">AI / Protocols</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> A standardized universal plug that lets AI bots like ChatGPT reach into local devices and read dials or push buttons safely.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                An open standard protocol created by Anthropic allowing AI Large Language Models to call structured software tools (like <code>get_live_telemetry</code>) and access real-time hardware state without hallucination.
              </p>
            </div>

            <!-- Term 15: Replay Buffer -->
            <div class="dict-card" data-term="replay buffer continuous learning experience">
              <div class="term-head">
                <span class="term-title">Experience Replay Buffer</span>
                <span class="badge-mini-real">Machine Learning</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> A student's flashcard review pile: reviewing both new test questions and previous flashcards so they never forget past knowledge.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                A circular memory buffer that stores historical telemetry transitions. During continuous learning passes, the neural network samples from both old and new data to prevent catastrophic forgetting.
              </p>
            </div>

            <!-- Term 16: Star Ground -->
            <div class="dict-card" data-term="star ground common gnd reference">
              <div class="term-head">
                <span class="term-title">Common Star Ground (GND)</span>
                <span class="badge-mini-real">Circuit Design</span>
              </div>
              <div class="dict-analogy">
                <strong>Simple Analogy:</strong> Sea level: the universal zero-height baseline from which all mountain heights and ocean depths are measured.
              </div>
              <p style="font-size: 0.80rem; color: var(--text-secondary); line-height: 1.5;">
                Tying all ground wires from the solar charger, battery booster, sensors, and ESP32 to a single central reference point, ensuring 0.0V is identical across all components to eliminate ground loops.
              </p>
            </div>

          </div>
        </section>

        <!-- ======================================================== -->
        <!-- SUB-SECTION 5: VIVA & EVALUATOR TECHNICAL FAQ            -->
        <!-- ======================================================== -->
        <section id="guide-faq" class="card">
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <svg class="ui-icon" style="color: var(--accent-sky);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              5. Viva, Defense &amp; Evaluator Technical Q&amp;A
            </h3>
            <p style="font-size: 0.80rem; color: var(--text-secondary); margin-top: 2px;">
              The top engineering questions asked by project reviewers, university professors, and judges — answered with rock-solid technical justifications.
            </p>
          </div>

          <div class="faq-list">

            <!-- Q1 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q1</span>
                Why is the ESP32 powered from an independent external supply instead of the solar booster rail?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> Electric motors are highly inductive loads that generate severe startup inrush surges (1.85A) and back-EMF noise. If the ESP32 shared the 5V booster rail with the motor, these transient load surges would cause sudden voltage sags (brownouts) dropping below 2.7V, which crashes the ESP32 and resets Wi-Fi. Powering the ESP32 from an independent external 5V rail isolates sensitive logic from motor noise and guarantees uninterrupted monitoring.
              </div>
            </div>

            <!-- Q2 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q2</span>
                Why use a 6V solar panel to charge a 3.7V battery? Why not a 3.7V or 5V panel?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> A single lithium-ion 18650 cell reaches full charge at 4.20V. Linear charge management ICs like the TP4056 require an input voltage at least 0.3V–0.5V higher than the target battery voltage (dropout voltage). A 6V panel provides ~6.0V under load, ensuring continuous charging even during morning, evening, or cloudy hours when solar irradiance drops.
              </div>
            </div>

            <!-- Q3 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q3</span>
                Why is the MT3608 boost converter needed between the battery and the loads?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> A lithium battery's output voltage is not constant; it drops from 4.2V when fully charged down to 3.0V as it discharges. If connected directly, the LED would dim and the DC motor would lose torque and stall as the battery drains. The MT3608 boost converter steps up this changing 3.0V–4.2V input to a rock-solid, regulated 5.0V output, ensuring loads always operate at full rated power.
              </div>
            </div>

            <!-- Q4 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q4</span>
                How does the PyTorch neural network distinguish a safe startup inrush surge from a dangerous motor stall?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> By analyzing temporal sequences rather than single scalar values. A normal startup surge is transient: current peaks at 1.85A but rapidly decays within 420 milliseconds as rotor back-EMF develops. A locked-rotor motor stall produces a sustained high current exceeding 2.5A with zero back-EMF decay. The <code>S3ElectricalTransformer</code> multi-head attention mechanism models both current magnitude and rate of change (dI/dt) over time, classifying inrush as benign and stall as critical.
              </div>
            </div>

            <!-- Q5 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q5</span>
                What causes the 1.18V and 0.2A sensor readings when loads are off, and how does zero-bias rectification fix it?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> High-impedance breadboard traces act as antennas picking up stray electromagnetic noise, causing floating ADC pins to read ~1.18V. Additionally, the ACS712 Hall-effect sensor outputs 2.50V at 0A, and minor thermal drift or VCC variance causes a ~0.20A offset. Our zero-bias deadband filter checks: if measured voltage &le; 2.0V or current &le; 0.28A, the software clamps both to exact 0.00V, 0.00A, and 0.00W, preventing false billing accumulation.
              </div>
            </div>

            <!-- Q6 -->
            <div class="faq-item">
              <div class="faq-q">
                <span class="step-number-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">Q6</span>
                Why use an ACS712 Hall-effect sensor instead of a low-cost shunt resistor?
              </div>
              <div class="faq-a">
                <strong>Answer:</strong> An ACS712 sensor provides complete galvanic isolation up to 2.1 kV between the high-current power path and the low-voltage ESP32 sensing pins. Shunt resistors require direct conductive insertion into the circuit, generate resistive I&sup2;R heat losses, and cause ground loop voltage offsets that distort sensitive ADC readings.
              </div>
            </div>

          </div>
        </section>

      </div>
    </main>
'''

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add tab button
tab_btn = '''        <button class="view-tab" data-view="guide" id="tabGuideBtn">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/><path d="M6 14h6"/></svg>
          <span class="tab-text">Project Guide &amp; Docs</span>
          <span class="tab-pill" style="font-weight: 700; color: var(--accent-sky); background: rgba(2, 132, 199, 0.1);">A-Z DOCS</span>
        </button>'''

if 'data-view="guide"' not in content:
    # Insert right after tabSchematicsBtn button
    m = re.search(r'(<button class="view-tab"[^>]*id="tabSchematicsBtn".*?</button>)', content, re.DOTALL)
    if m:
        content = content[:m.end()] + '\n' + tab_btn + content[m.end():]
        print('Tab button injected successfully!')
    else:
        print('Could not find tabSchematicsBtn')

# 2. Add view-guide before </div><!-- /.dashboard-wrapper -->
if 'id="view-guide"' not in content:
    target = '</div><!-- /.dashboard-wrapper -->'
    idx = content.rfind(target)
    if idx != -1:
        content = content[:idx] + guide_html + '\n  ' + content[idx:]
        print('view-guide container injected successfully!')
    else:
        print('Could not find dashboard-wrapper close tag')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('public/index.html updated successfully!')
