"""
Generate Enhanced 12-Slide S-3 IOT Presentation PowerPoint (.pptx)
Covers the entire project: 
6V Solar, Battery Booster, Dual Loads, 9 Hardware Components Matrix, 
PyTorch Transformer, Continuous Learning, Zero-Bias Clamping, MCP & AI Copilot, 
Project Dictionary & Terms Glossary, Future Modular Switch System, and Viva Q&A.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    C_WHITE = RGBColor(255, 255, 255)
    C_BG_OFFWHITE = RGBColor(248, 250, 252)
    C_BORDER = RGBColor(226, 232, 240)
    C_DARK = RGBColor(15, 23, 42)
    C_MUTED = RGBColor(100, 116, 139)
    C_BLUE = RGBColor(2, 132, 199)
    C_EMERALD = RGBColor(16, 185, 129)
    C_AMBER = RGBColor(217, 119, 6)
    C_PANEL_ALT = RGBColor(241, 245, 249)

    TOTAL_SLIDES = 12

    def add_header(slide, title_text, category="SOLAR BATTERY MANAGEMENT & ENERGY MONITORING SYSTEM", subtitle=None):
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(8), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(9.5)
        p_cat.font.bold = True
        p_cat.font.color.rgb = C_BLUE

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.65), Inches(11.7), Inches(0.65))
        tf = title_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(21)
        p.font.bold = True
        p.font.color.rgb = C_DARK

        if subtitle:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.25), Inches(11.7), Inches(0.4))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = C_MUTED

    def add_footer(slide, current_idx):
        foot_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.7), Inches(0.35))
        tf = foot_box.text_frame
        p = tf.paragraphs[0]
        p.text = f"S-3 IOT Engineering Presentation  •  Aswan Ayyappan (UKP25EE023) & Aadil Mohamed  •  Slide {current_idx} of {TOTAL_SLIDES}"
        p.font.size = Pt(9)
        p.font.color.rgb = C_MUTED

    # ========================================================
    # SLIDE 1: TITLE SLIDE
    # ========================================================
    s1 = prs.slides.add_slide(blank_layout)
    tbox = s1.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.3), Inches(2.2))
    tf1 = tbox.text_frame
    tf1.word_wrap = True
    
    p_badge = tf1.paragraphs[0]
    p_badge.text = "HARDWARE-VERIFIED IOT & ELECTRICAL MACHINE LEARNING SYSTEM"
    p_badge.font.size = Pt(11)
    p_badge.font.bold = True
    p_badge.font.color.rgb = C_EMERALD

    p_main = tf1.add_paragraph()
    p_main.text = "Solar Battery Management &\nEnergy Monitoring System"
    p_main.font.size = Pt(36)
    p_main.font.bold = True
    p_main.font.color.rgb = C_DARK
    p_main.space_before = Pt(8)

    p_sub = tf1.add_paragraph()
    p_sub.text = "Clean Solar PV Edge Rail • TP4056 Charger • 3.7V Li-ion Battery • 5V Booster • Dual Monitored DC Loads • PyTorch Neural Engine • Continuous Learning • Model Context Protocol (MCP)"
    p_sub.font.size = Pt(13)
    p_sub.font.color.rgb = C_MUTED
    p_sub.space_before = Pt(10)

    # 3 Metadata Cards
    cols_meta = [
        ("PROJECT AUTHORS", "Aswan Ayyappan (UKP25EE023)\nAadil Mohamed\nElectrical & Electronics Engineering"),
        ("KEY HARDWARE PIPELINE", "• 6V PV Panel + TP4056 1.0A CC/CV\n• 3.7V Li-ion (18650) + 5V Booster Rail\n• Dual Loads: 5V LED & 5V DC Motor\n• Isolated ESP32 Sensing Architecture"),
        ("AI / ML STACK", "• PyTorch Sequence Transformer\n• 5-Min Autonomous Continuous Learning\n• Zero-Bias Deadband Noise Clamping\n• FreeTheAI GLM-5.3 & Groq LLaMA 3.3")
    ]
    for i, (title, body) in enumerate(cols_meta):
        left = Inches(1.0 + i * 3.85)
        rect = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(3.8), Inches(3.6), Inches(2.6))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        pb = tf.add_paragraph()
        pb.text = body
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(6)

    add_footer(s1, 1)

    # ========================================================
    # SLIDE 2: TABLE OF CONTENTS
    # ========================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Presentation Structure & Technical Agenda", subtitle="Comprehensive end-to-end overview from photovoltaic photons to edge neural telemetry")
    
    agenda = [
        ("01", "Project Objective & Engineering Problem", "Why standard IoT monitors fail with inductive surges, phantom ADC offsets, and dirty rails."),
        ("02", "End-to-End System Pipeline", "Photovoltaic harvesting (6V), TP4056 chemical storage, MT3608 boost rail, and cloud telemetry."),
        ("03", "Hardware Circuit Schematic & Pin Interfacing", "ESP32 GPIO 32/34 (LED) and GPIO 33/35 (Motor) pin mapping and common ground layout."),
        ("04", "Hardware Component Specifications", "Complete breakdown of 9 physical devices: specs, connections, principles, and failure modes."),
        ("05", "Sensor Zero-Bias Deadband & Float Clamping", "Clamping 1.18V floating voltage and 0.2A ACS712 noise to ensure mathematically accurate billing."),
        ("06", "PyTorch Neural Model & Continuous Learning", "S3ElectricalTransformer architecture, multi-head attention, and autonomous 5-minute fine-tuning."),
        ("07", "Model Context Protocol (MCP) & AI Copilot", "Anthropic MCP tools, live telemetry grounding, and FreeTheAI GLM-5.3 / Groq LLaMA fallback."),
        ("08", "Project Dictionary & Terms Glossary", "A-Z definitions of ADC, GPIO, CC/CV, Hall Effect, Deadband, Inrush, Stall, Tariff, and Replay Buffer."),
        ("09", "Future Scope: Smart Home Modular Switch", "Plug-in modular appliance switches with distributed per-switch sensing and edge ML engine."),
        ("10", "Conclusion, Verification & Viva Q&A", "Hardware validation results, 97.22% accuracy, and top evaluation defense questions answered.")
    ]
    for i, (num, title, desc) in enumerate(agenda):
        col = i // 5
        row = i % 5
        left = Inches(1.0 + col * 5.75)
        top = Inches(1.85 + row * 0.95)
        rect = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.5), Inches(0.85))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_WHITE
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.15)
        tf.margin_top = Inches(0.08)
        p = tf.paragraphs[0]
        p.text = f"{num}  {title}"
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = C_DARK
        pb = tf.add_paragraph()
        pb.text = desc
        pb.font.size = Pt(8.5)
        pb.font.color.rgb = C_MUTED
        pb.space_before = Pt(2)

    add_footer(s2, 2)

    # ========================================================
    # SLIDE 3: PROBLEM FORMULATION & OBJECTIVES
    # ========================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Project Objective & Engineering Problem Formulation", subtitle="Overcoming uncalibrated sensor drift, brownouts, and dirty power in IoT solar telemetry")
    cards_s3 = [
        ("THE UNRELIABLE FLOATING ADC PROBLEM", 
         "Unshielded breadboard ADC pins float at ~1.18V and ACS712 Hall sensors drift by ~0.2A when loads are completely OFF. Left uncalibrated, phantom power (0.24W per channel) accumulates 24/7, fabricating false electricity charges on user bills.", C_AMBER),
        ("THE INDUCTIVE MOTOR BROWNOUT HAZARD", 
         "DC motors pull massive inrush current (1.85A peak) during startup and emit inductive back-EMF spikes. Sharing power rails between motors and the ESP32 causes severe voltage sags below 2.7V, crashing the MCU and causing continuous Wi-Fi reconnect drops.", RGBColor(239, 68, 68)),
        ("CLEAN ENERGY DC STORAGE & BOOST SOLUTION", 
         "Implement an isolated 6V Solar PV + TP4056 + 3.7V Li-ion battery bank stepped up to a steady 5V DC rail for dual monitored loads (LED and DC Motor), while powering the ESP32 independently via an external 5V supply.", C_EMERALD),
        ("AUTONOMOUS EDGE AI & CONTINUOUS LEARNING", 
         "Deploy a deep PyTorch sequence transformer on sliding telemetry windows with continuous experience replay buffer retraining every 5 minutes (97.22% val accuracy), coupled with Anthropic MCP and LLM copilot grounding.", C_BLUE)
    ]
    for idx, (title, content, bar_color) in enumerate(cards_s3):
        col = idx % 2
        row = idx // 2
        left = Inches(1.0 + col * 5.75)
        top = Inches(1.85 + row * 2.5)
        rect = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.5), Inches(2.3))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.15)
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = bar_color
        pb = tf.add_paragraph()
        pb.text = content
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(6)

    add_footer(s3, 3)

    # ========================================================
    # SLIDE 4: SYSTEM ARCHITECTURE & BLOCK DIAGRAM
    # ========================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "System Architecture & Physical Flow Diagram", subtitle="Four-tier pipeline: Solar Edge Generation • ESP32 MCU Acquisition • Cloud Engine • AI Dashboard")
    img_path = os.path.join("public", "block_diagram.png")
    if os.path.exists(img_path):
        s4.shapes.add_picture(img_path, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))
    add_footer(s4, 4)

    # ========================================================
    # SLIDE 5: HARDWARE CIRCUIT SCHEMATIC
    # ========================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Solar Powered ESP32 Energy Monitoring Circuit Diagram", subtitle="Detailed schematic showing 6V solar, TP4056, 3.7V battery, 5V booster, dual ACS712 sensors, and ESP32 pin mappings")
    circuit_img = os.path.join("public", "circuit_diagram.png")
    if os.path.exists(circuit_img):
        s5.shapes.add_picture(circuit_img, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))
    add_footer(s5, 5)

    # ========================================================
    # SLIDE 6: HARDWARE COMPONENT SPECIFICATIONS (NEW SLIDE)
    # ========================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Hardware Component Specifications & Pin Interfacing Catalog", subtitle="Complete electrical parameters, pin connections, working principles, and failure modes for all 9 devices")

    hw_specs = [
        ("6V 5W–10W SOLAR PV PANEL", "Voc: ~7.2V, Vmp: ~6.0V. Converts photons to DC electricity via p-n semiconductor effect. Provides +1.8V headroom above 4.2V lithium charge termination."),
        ("TP4056 CHARGER & DW01A IC", "1.0A CC/CV charge management. Terminates at 4.2V ±1%. DW01A protection IC disconnects load if battery drains below 2.5V or encounters short circuit."),
        ("3.7V 18650 LI-ION BATTERY", "2200–2600 mAh capacity. 3.7V nominal, 4.2V peak. Chemical buffer storing clean solar energy for continuous round-the-clock load actuation."),
        ("MT3608 BOOST CONVERTER", "Input: 3.0V–4.2V, Output: Regulated 5.0V DC bus. 1.2MHz high-frequency switching inductor step-up. Prevents motor stalling as battery discharges."),
        ("ESP32-WROOM-32 MCU", "Tensilica Dual-Core 240MHz, 520KB SRAM, 2.4GHz Wi-Fi. Powered via independent external 5V supply to prevent inductive motor brownouts."),
        ("ACS712-05B CURRENT SENSORS", "Dual isolated Hall-effect ICs. Sensitivity: 185 mV/A. Vout = 2.5V + (I × 0.185). Monitored on GPIO 34 (DC LED) and GPIO 35 (DC Motor)."),
        ("5:1 VOLTAGE DIVIDER SENSORS", "Dual 30kΩ/7.5kΩ precision divider modules. Scales 0–25V down to 0–5V (safe ≤3.3V for ADC1). Monitored on GPIO 32 (LED) and GPIO 33 (Motor)."),
        ("5V DC LED FIXTURE (LOAD 1)", "Resistive lighting load. Consumes steady 0.393A (~1.82W) with zero inrush transient. Demonstrates flat baseline energy telemetry."),
        ("5V DC MOTOR / PUMP (LOAD 2)", "Dynamic inductive motive load. 1.85A startup surge (420ms), 0.18A–0.45A normal running, >2.5A locked-rotor stall fault condition.")
    ]

    for idx, (title, desc) in enumerate(hw_specs):
        col = idx % 3
        row = idx // 3
        left = Inches(0.8 + col * 3.95)
        top = Inches(1.8 + row * 1.65)
        rect = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(3.75), Inches(1.5))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.15)
        tf.margin_top = Inches(0.1)
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(9.5)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        pb = tf.add_paragraph()
        pb.text = desc
        pb.font.size = Pt(8.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(3)

    add_footer(s6, 6)

    # ========================================================
    # SLIDE 7: SENSOR ZERO-BIAS RECTIFICATION & CLAMPING
    # ========================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Sensor Zero-Bias Deadband & Float Noise Clamping", subtitle="Eliminating ADC bias distortion to ensure mathematically accurate Indian Rupee (INR) billing")

    rect_left = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.7), Inches(4.9))
    rect_left.fill.solid()
    rect_left.fill.fore_color.rgb = C_PANEL_ALT
    rect_left.line.color.rgb = C_BORDER
    tf_l = rect_left.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = Inches(0.25)
    tf_l.margin_top = Inches(0.2)

    pl1 = tf_l.paragraphs[0]
    pl1.text = "THE SENSOR NOISE FLOOR PROBLEM"
    pl1.font.size = Pt(12)
    pl1.font.bold = True
    pl1.font.color.rgb = RGBColor(239, 68, 68)

    pl2 = tf_l.add_paragraph()
    pl2.text = (
        "• Physical Hall-effect current sensors (ACS712) and resistive voltage dividers exhibit small baseline output drift when loads are unpowered.\n"
        "• Uncalibrated readings showed ~1.18V on disconnected voltage lines and ~0.20A–0.24A idle noise floor.\n"
        "• Phantom Power Impact: 1.18V × 0.20A = 0.236 W phantom load per channel continuously accumulating 24/7.\n"
        "• Result: Electricity bills accumulated even when devices were completely OFF."
    )
    pl2.font.size = Pt(10.5)
    pl2.font.color.rgb = C_DARK
    pl2.space_before = Pt(8)

    pl3 = tf_l.add_paragraph()
    pl3.text = "MATHEMATICAL RECTIFICATION DEAD-BAND"
    pl3.font.size = Pt(12)
    pl3.font.bold = True
    pl3.font.color.rgb = C_EMERALD
    pl3.space_before = Pt(12)

    pl4 = tf_l.add_paragraph()
    pl4.text = (
        "• Applied digital deadband filter in ESP32 firmware and cloud telemetry engine:\n"
        "  - If measured Voltage ≤ 2.0V → Clamp to exactly 0.00 V\n"
        "  - If LED Current ≤ 0.28A → Clamp to exactly 0.00 A\n"
        "  - If Motor Current ≤ 0.22A → Clamp to exactly 0.00 A\n"
        "  - Power: If either V=0 or I=0 → Instant Power = 0.00 W"
    )
    pl4.font.size = Pt(10.5)
    pl4.font.color.rgb = C_DARK
    pl4.space_before = Pt(6)

    # Right Column: Energy Integration & Tariff
    rect_right = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.9))
    rect_right.fill.solid()
    rect_right.fill.fore_color.rgb = C_PANEL_ALT
    rect_right.line.color.rgb = C_BORDER
    tf_r = rect_right.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = Inches(0.25)
    tf_r.margin_top = Inches(0.2)

    pr1 = tf_r.paragraphs[0]
    pr1.text = "ENERGY INTEGRATION & TARIFF ENGINE"
    pr1.font.size = Pt(12)
    pr1.font.bold = True
    pr1.font.color.rgb = C_BLUE

    pr2 = tf_r.add_paragraph()
    pr2.text = (
        "STRICT DC POWER CALCULATION:\n"
        "• Direct Current circuits: P = V × I (Power Factor = 1.0)\n"
        "• Instant Load = P_led + P_motor\n\n"
        "TRAPEZOIDAL ENERGY INTEGRATION (kWh):\n"
        "• Exact millisecond timestamp delta: Δt = t_now - t_prev\n"
        "• Energy Delta: ΔE = ((P_prev + P_curr) / 2) × (Δt / 3,600,000,000) kWh\n"
        "• Rejects step-error distortions and captures motor inrush spikes.\n\n"
        "COMMERCIAL TARIFF BILLING (₹8.00 / Unit):\n"
        "• 1 Unit = 1 kWh = 1,000 Watt-hours = 3.6 × 10^6 Joules\n"
        "• Electricity Bill (₹) = Cumulative kWh × ₹8.00\n\n"
        "MONTHLY PROJECTION MODEL:\n"
        "• Continuous 60-minute window moving average extrapolation."
    )
    pr2.font.size = Pt(10)
    pr2.font.color.rgb = C_DARK
    pr2.space_before = Pt(8)

    add_footer(s7, 7)

    # ========================================================
    # SLIDE 8: PYTORCH NEURAL MODEL & CONTINUOUS LEARNING
    # ========================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "PyTorch Deep Neural Model & Autonomous Continuous Learning", subtitle="Edge sequence transformer (S3ElectricalTransformer) with 5-minute autonomous fine-tuning")

    c1 = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(3.6), Inches(4.9))
    c1.fill.solid()
    c1.fill.fore_color.rgb = C_PANEL_ALT
    c1.line.color.rgb = C_BORDER
    tf_c1 = c1.text_frame
    tf_c1.word_wrap = True
    tf_c1.margin_left = Inches(0.2)
    tf_c1.margin_top = Inches(0.2)
    p = tf_c1.paragraphs[0]
    p.text = "TRANSFORMER ARCHITECTURE"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    pb = tf_c1.add_paragraph()
    pb.text = (
        "• Model: S3ElectricalTransformer\n"
        "• Input: 8-step time window of [Voltage, Current, Power, dI/dt]\n"
        "• Feature Projection: 4 → 32 dim\n"
        "• Positional Encoding: Sinusoidal\n"
        "• Transformer Layers: 2 Encoder blocks\n"
        "• Multi-Head Attention: 4 heads\n"
        "• Feedforward Dim: 64 with ReLU\n"
        "• Output: 4-class Softmax classifier:\n"
        "  0: Steady State (Normal)\n"
        "  1: Startup Inrush Surge\n"
        "  2: Overload / Motor Stall\n"
        "  3: Sensor Calibration Anomaly"
    )
    pb.font.size = Pt(9.5)
    pb.font.color.rgb = C_DARK
    pb.space_before = Pt(6)

    c2 = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.8), Inches(1.8), Inches(3.6), Inches(4.9))
    c2.fill.solid()
    c2.fill.fore_color.rgb = C_PANEL_ALT
    c2.line.color.rgb = C_BORDER
    tf_c2 = c2.text_frame
    tf_c2.word_wrap = True
    tf_c2.margin_left = Inches(0.2)
    tf_c2.margin_top = Inches(0.2)
    p = tf_c2.paragraphs[0]
    p.text = "5-MIN CONTINUOUS LEARNING"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    pb = tf_c2.add_paragraph()
    pb.text = (
        "• Autonomous background daemon executes every 5 minutes.\n"
        "• Ingests newly recorded telemetry into continuous replay buffer.\n"
        "• Fine-tuning Hyperparameters:\n"
        "  - Epochs: 4 per cycle\n"
        "  - Optimizer: AdamW (lr=0.0003)\n"
        "  - Loss: CrossEntropyLoss\n"
        "• Performance Validation:\n"
        "  - Ingested: 234+ real samples\n"
        "  - Validation Accuracy: 97.22%\n"
        "  - Loss: 0.1703\n"
        "• Hot Model Reload: Weight checkpoint auto-reloaded in server memory."
    )
    pb.font.size = Pt(9.5)
    pb.font.color.rgb = C_DARK
    pb.space_before = Pt(6)

    c3 = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.8), Inches(1.8), Inches(3.7), Inches(4.9))
    c3.fill.solid()
    c3.fill.fore_color.rgb = C_PANEL_ALT
    c3.line.color.rgb = C_BORDER
    tf_c3 = c3.text_frame
    tf_c3.word_wrap = True
    tf_c3.margin_left = Inches(0.2)
    tf_c3.margin_top = Inches(0.2)
    p = tf_c3.paragraphs[0]
    p.text = "CLASSIFICATION BENCHMARK"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_AMBER
    pb = tf_c3.add_paragraph()
    pb.text = (
        "REAL BENCH EVENT ACCURACY:\n\n"
        "• Startup Inrush Surge (1.85A peak, 420ms duration):\n"
        "  Confidence: 94% (Benign)\n\n"
        "• Locked Rotor Stall (>2.5A continuous):\n"
        "  Confidence: 96% (Critical Alert)\n\n"
        "• Voltage Floating Offset (1.18V uncalibrated):\n"
        "  Confidence: 91% (Sensor Warning)\n\n"
        "• DC LED Steady Illumination (4.63V / 0.393A):\n"
        "  Confidence: 99% (Normal State)"
    )
    pb.font.size = Pt(9.5)
    pb.font.color.rgb = C_DARK
    pb.space_before = Pt(6)

    add_footer(s8, 8)

    # ========================================================
    # SLIDE 9: MODEL CONTEXT PROTOCOL (MCP) & AI COPILOT
    # ========================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Model Context Protocol (MCP 2024-11-05) & Dual AI Copilot", subtitle="Exposing real-time telemetry tools directly to ChatGPT, Claude Desktop, and local intelligence agents")

    c_mcp = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.7), Inches(4.9))
    c_mcp.fill.solid()
    c_mcp.fill.fore_color.rgb = C_WHITE
    c_mcp.line.color.rgb = C_BORDER
    tf_mcp = c_mcp.text_frame
    tf_mcp.word_wrap = True
    tf_mcp.margin_left = Inches(0.25)
    tf_mcp.margin_top = Inches(0.2)
    p = tf_mcp.paragraphs[0]
    p.text = "OFFICIAL MCP SPECIFICATION (ANTHROPIC COMPLIANT)"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = C_BLUE
    pb = tf_mcp.add_paragraph()
    pb.text = (
        "• Implements Anthropic Model Context Protocol (MCP 2024-11-05 spec).\n"
        "• Exposes live hardware telemetry tools via structured JSON-RPC schema:\n\n"
        "1. get_live_telemetry:\n"
        "   Returns real-time voltage, current, power, cumulative kWh, and bill.\n\n"
        "2. run_ml_inference:\n"
        "   Invokes PyTorch S3ElectricalTransformer sequence classifier.\n\n"
        "3. recalibrate_sensor_bias:\n"
        "   Dynamically updates zero-bias deadband threshold floors.\n\n"
        "4. get_appliance_states:\n"
        "   Inspects real bench appliances (DC LED and 5V Motor status).\n\n"
        "5. get_electrical_events:\n"
        "   Retrieves verified physical anomaly log from memory."
    )
    pb.font.size = Pt(9.5)
    pb.font.color.rgb = C_DARK
    pb.space_before = Pt(6)

    c_copilot = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.9))
    c_copilot.fill.solid()
    c_copilot.fill.fore_color.rgb = C_WHITE
    c_copilot.line.color.rgb = C_BORDER
    tf_cop = c_copilot.text_frame
    tf_cop.word_wrap = True
    tf_cop.margin_left = Inches(0.25)
    tf_cop.margin_top = Inches(0.2)
    p = tf_cop.paragraphs[0]
    p.text = "MULTI-MODEL CONVERSATIONAL COPILOT"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    pb = tf_cop.add_paragraph()
    pb.text = (
        "• Dual AI Provider Gateway built into the web application:\n\n"
        "FREETHEAI MODEL FLEET (Active Project Key):\n"
        "• fta/zai/glm-5.3-flash: High-speed reasoning with instant token streaming.\n"
        "• fta/zai/glm-5.3: Deep transformer comprehension for electrical diagnostics.\n"
        "• fta/zzz/deepseek-chat: DeepSeek V3 open weights model.\n"
        "• fta/meow/gpt-4o-mini: Fast compact GPT model.\n\n"
        "GROQ HIGH-THROUGHPUT ENGINE:\n"
        "• llama-3.3-70b-versatile: 70B parameter open-weights LLaMA.\n"
        "• llama-3.1-8b-instant: Sub-second latency edge inference.\n\n"
        "INTELLIGENT RESILIENCE & SMART FALLBACK:\n"
        "• If one provider encounters rate limits (503) or authentication issues (403), the engine automatically falls back to FreeTheAI GLM-5.3 without user disruption.\n"
        "• Client-side custom API key override stored securely in browser localStorage."
    )
    pb.font.size = Pt(9.5)
    pb.font.color.rgb = C_DARK
    pb.space_before = Pt(6)

    add_footer(s9, 9)

    # ========================================================
    # SLIDE 10: PROJECT DICTIONARY & KEY TERMS (NEW SLIDE)
    # ========================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Comprehensive Project Dictionary & Key Electrical Terms", subtitle="Clear, simple definitions for every core term, acronym, and electrical principle in the system")

    dict_terms = [
        ("ADC (ANALOG-TO-DIGITAL CONVERTER)", "Translates physical continuous analog voltages (0.0V–3.3V) into digital numbers (0–4095) for the ESP32. Like an interpreter turning physical ruler heights into digital numbers."),
        ("GPIO (GENERAL PURPOSE I/O)", "The physical programmable input/output metal pins on the ESP32 (GPIO 32, 33, 34, 35) that read sensors or control circuits. Like universal USB ports on a computer chip."),
        ("CC/CV CHARGING ALGORITHM", "Constant Current / Constant Voltage: Feeds steady 1A into the lithium battery until 4.2V, then caps voltage to avoid thermal runaway. Like rapid-filling a water balloon, then gently topping it off."),
        ("HALL EFFECT SENSING", "Current creates an internal magnetic field in the ACS712, deflecting electrons and generating proportional voltage. Measures current safely without cutting into wires or creating resistive heat."),
        ("DEADBAND / CLAMPING FILTER", "A software threshold that forces any sensor measurement below noise levels (≤2.0V or ≤0.22A) to exact zero. Like noise cancellation in headphones, ignoring faint background rustle."),
        ("INRUSH CURRENT (STARTUP SURGE)", "A brief high current spike (1.85A for 420ms) when the motor starts from rest before back-EMF opposes current. Like the heavy shove needed to get a stalled car rolling forward."),
        ("MOTOR STALL (LOCKED ROTOR)", "A severe fault where the motor shaft is physically blocked. With zero back-EMF, current spikes >2.5A, risking coil burnout. Like pressing the gas pedal while holding the handbrake."),
        ("TRAPEZOIDAL ENERGY INTEGRATION", "Calculus integration summing areas under the power curve across millisecond intervals (Δt) to compute total kWh. Prevents step errors and captures brief surges accurately."),
        ("ELECTRICITY TARIFF (₹8.00 / UNIT)", "The commercial rate charged per kilowatt-hour (1 kWh = 1 Unit). Electricity Bill = Cumulative Energy (kWh) × ₹8.00. Like the price per liter of fuel at a gas station.")
    ]

    for idx, (title, desc) in enumerate(dict_terms):
        col = idx % 3
        row = idx // 3
        left = Inches(0.8 + col * 3.95)
        top = Inches(1.8 + row * 1.65)
        rect = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(3.75), Inches(1.5))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.15)
        tf.margin_top = Inches(0.1)
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(9.5)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        pb = tf.add_paragraph()
        pb.text = desc
        pb.font.size = Pt(8.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(3)

    add_footer(s10, 10)

    # ========================================================
    # SLIDE 11: FUTURE SCOPE - SMART HOME MODULAR SWITCH SYSTEM
    # ========================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Future Scope: Smart Home Modular Switch Circuit Schematic", subtitle="Decentralized modular switch holders with per-switch telemetry, primary ESP32 hub, and offline edge ML anomaly engine")
    modular_img = os.path.join("public", "Smart_Home_Modular_Switch_System_Diagram.png")
    if os.path.exists(modular_img):
        s11.shapes.add_picture(modular_img, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))
    add_footer(s11, 11)

    # ========================================================
    # SLIDE 12: CONCLUSION, VIVA Q&A & SYSTEM ACHIEVEMENTS
    # ========================================================
    s12 = prs.slides.add_slide(blank_layout)
    tbox12 = s12.shapes.add_textbox(Inches(1.0), Inches(0.6), Inches(11.3), Inches(1.6))
    tf12 = tbox12.text_frame
    tf12.word_wrap = True

    p = tf12.paragraphs[0]
    p.text = "ENGINEERING DEMONSTRATION & PROJECT VALIDATION COMPLETE"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD

    p_title = tf12.add_paragraph()
    p_title.text = "Summary of Achievements & Evaluator Viva Q&A"
    p_title.font.size = Pt(28)
    p_title.font.bold = True
    p_title.font.color.rgb = C_DARK
    p_title.space_before = Pt(4)

    achievements = [
        ("CLEAN ENERGY HARDWARE PIPELINE", 
         "Fully functioning 6V Solar PV generation into TP4056 and 3.7V Li-ion battery. DC-DC 5V booster rail powers dual DC loads (LED and DC Motor) with common star grounding and isolated ESP32 sensing."),
        ("ZERO-BIAS CLAMPING & TARIFF ACCURACY", 
         "Eliminated all off-time sensor floating (1.18V & 0.2A baseline). Clamped phantom generation to exactly 0.00W. Trapezoidal energy integration produces 100% accurate Indian Rupee billing at ₹8.00/kWh."),
        ("PYTORCH NEURAL MODEL & CONTINUOUS LEARNING", 
         "Trained S3ElectricalTransformer achieving 97.22% validation accuracy. Background daemon fine-tunes weights every 5 minutes from live Firebase telemetry via 234+ sample experience replay buffer."),
        ("VIVA DEFENSE: WHY ISOLATE ESP32 POWER?", 
         "Electric motors cause severe startup inrush sags (1.85A) and back-EMF spikes. Sharing rails browns out the ESP32 below 2.7V. Independent external 5V powering guarantees 100% telemetry uptime.")
    ]

    for idx, (title, text) in enumerate(achievements):
        col = idx % 2
        row = idx // 2
        left = Inches(1.0 + col * 5.75)
        top = Inches(2.4 + row * 2.1)
        rect = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.5), Inches(1.95))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        tf = rect.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.15)
        ph = tf.paragraphs[0]
        ph.text = title
        ph.font.size = Pt(10.5)
        ph.font.bold = True
        ph.font.color.rgb = C_BLUE
        pb = tf.add_paragraph()
        pb.text = text
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(4)

    qbox = s12.shapes.add_textbox(Inches(1.0), Inches(6.75), Inches(11.3), Inches(0.5))
    tf_q = qbox.text_frame
    p_q = tf_q.paragraphs[0]
    p_q.text = "Thank You! • Open for Questions, Evaluation & Technical Demonstration • Aswan Ayyappan (UKP25EE023) & Aadil Mohamed"
    p_q.font.size = Pt(10.5)
    p_q.font.bold = True
    p_q.font.color.rgb = C_DARK
    p_q.alignment = PP_ALIGN.CENTER

    add_footer(s12, 12)

    # Save to all required paths
    out_dir = "public"
    p1 = os.path.join(out_dir, "S-3_IOT_Solar_Battery_Presentation.pptx")
    p2 = os.path.join(out_dir, "S-3_IOT_Presentation.pptx")
    p3 = "ASWAN AYYAPPAN(UKP25EE023).pptx"
    
    prs.save(p1)
    prs.save(p2)
    prs.save(p3)
    print(f"Generated and saved 12-slide presentation to:\n  - {p1}\n  - {p2}\n  - {p3}")

if __name__ == "__main__":
    create_deck()
