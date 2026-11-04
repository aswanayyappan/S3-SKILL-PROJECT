"""
Generate Complete S-3 IOT Presentation PowerPoint (.pptx)
Covers the entire project: 6V Solar, Battery Booster, Dual Loads, PyTorch Transformer,
Autonomous Continuous Learning, Zero-Bias Clamping, MCP & ChatGPT, and Future Scope Modular Switch System.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette (Clean Executive Vibe Coding Palette)
    C_WHITE = RGBColor(255, 255, 255)
    C_BG_OFFWHITE = RGBColor(248, 250, 252)      # Slate-50
    C_BORDER = RGBColor(226, 232, 240)          # Slate-200
    C_DARK = RGBColor(15, 23, 42)               # Slate-900
    C_MUTED = RGBColor(100, 116, 139)           # Slate-500
    C_BLUE = RGBColor(2, 132, 199)              # Sky-600
    C_EMERALD = RGBColor(16, 185, 129)          # Emerald-500
    C_AMBER = RGBColor(217, 119, 6)             # Amber-600
    C_CARD_BG = RGBColor(255, 255, 255)
    C_PANEL_ALT = RGBColor(241, 245, 249)       # Slate-100

    def add_header(slide, title_text, category="SOLAR BATTERY MANAGEMENT & ENERGY MONITORING SYSTEM", subtitle=None):
        # Category Pill
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(9.5)
        p_cat.font.bold = True
        p_cat.font.color.rgb = C_BLUE

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.65))
        tf = title_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(22)
        p.font.bold = True
        p.font.color.rgb = C_DARK

        if subtitle:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.3), Inches(11.7), Inches(0.4))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = C_MUTED

    def add_footer(slide, current_idx, total_slides=10):
        foot_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.7), Inches(0.35))
        tf = foot_box.text_frame
        p = tf.paragraphs[0]
        p.text = f"S-3 IOT Engineering Presentation  •  Aswan Ayyappan (UKP25EE023) & Aadil Mohamed  •  Slide {current_idx} of {total_slides}"
        p.font.size = Pt(9)
        p.font.color.rgb = C_MUTED

    # ========================================================
    # SLIDE 1: TITLE SLIDE
    # ========================================================
    s1 = prs.slides.add_slide(blank_layout)
    
    # Hero Title Box
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

    # Metadata Cards (3 columns)
    meta_cols = [
        ("PROJECT SPECIFICATION", "6V Solar PV Panel (5–10W)\n3.7V 18650 Li-ion Cell\nDC-DC Step-Up 5V Booster Rail"),
        ("STUDENT CREDENTIALS", "Aswan Ayyappan (UKP25EE023)\nAadil Mohamed\nDept of Electrical Engineering"),
        ("INTELLIGENCE ENGINE", "PyTorch S3ElectricalTransformer\nAutonomous Online Learning (5m)\nModel Context Protocol (MCP)")
    ]
    for idx, (head, body) in enumerate(meta_cols):
        left = Inches(1.0 + idx * 3.85)
        rect = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(4.3), Inches(3.6), Inches(2.2))
        rect.fill.solid()
        rect.fill.fore_color.rgb = C_PANEL_ALT
        rect.line.color.rgb = C_BORDER
        rect.line.width = Pt(1)

        tframe = rect.text_frame
        tframe.word_wrap = True
        tframe.margin_left = Inches(0.2)
        tframe.margin_top = Inches(0.2)
        
        ph = tframe.paragraphs[0]
        ph.text = head
        ph.font.size = Pt(10)
        ph.font.bold = True
        ph.font.color.rgb = C_BLUE

        pb = tframe.add_paragraph()
        pb.text = body
        pb.font.size = Pt(11.5)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(6)

    add_footer(s1, 1)

    # ========================================================
    # SLIDE 2: TABLE OF CONTENTS
    # ========================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Table of Contents & Technical Agenda", subtitle="Comprehensive overview of hardware engineering, signal rectification, machine learning, and future scope")
    
    agenda_items = [
        ("01", "Objective & Problem Formulation", "Solar harvesting, dual 5V load telemetry, sensor float rectification, and billing"),
        ("02", "System Architecture & Block Diagram", "Four-tier pipeline: Solar Edge, ESP32 MCU, Cloud Engine, and AI Dashboard"),
        ("03", "Hardware Circuit Schematic & Pin Interfacing", "6V Panel, TP4056, 3.7V Battery, 5V Booster, Dual ACS712-5A, Star Ground"),
        ("04", "Sensor Zero-Bias Clamping & Noise Deadband", "Elimination of 1.18V and ~0.2A off-time sensor floating for zero billing distortion"),
        ("05", "Real-Time Telemetry & Experimental Results", "Live load verification: DC LED (0.393A) vs. 5V Motor (idle, running, stall)"),
        ("06", "PyTorch Neural Transformer Model", "S3ElectricalTransformer (64-dim, 4 heads) with 97.22% state & anomaly accuracy"),
        ("07", "Autonomous Continuous Online Learning Engine", "5-minute scheduled learning daemon, experience replay buffer, weights fine-tuning"),
        ("08", "Model Context Protocol (MCP) & ChatGPT Integration", "Standardized tools interface, Custom GPT actions, multi-model AI copilot"),
        ("09", "Future Scope: Smart Home Modular Switch System", "1-4 gang modular holders, per-switch telemetry, offline edge ML anomaly engine"),
        ("10", "Conclusion & Engineering Demonstration", "Summary of system accomplishments, verification metrics, and live Q&A")
    ]

    for i, (num, title, desc) in enumerate(agenda_items):
        col = i // 5
        row = i % 5
        left = Inches(0.8 + col * 5.9)
        top = Inches(1.8 + row * 0.98)
        
        card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.65), Inches(0.85))
        card.fill.solid()
        card.fill.fore_color.rgb = C_PANEL_ALT
        card.line.color.rgb = C_BORDER
        card.line.width = Pt(1)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.15)
        tf.margin_top = Inches(0.1)

        p1 = tf.paragraphs[0]
        p1.text = f"{num} • {title}"
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = C_DARK

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(9)
        p2.font.color.rgb = C_MUTED
        p2.space_before = Pt(2)

    add_footer(s2, 2)

    # ========================================================
    # SLIDE 3: OBJECTIVE & PROBLEM FORMULATION
    # ========================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Project Objectives & Technical Problem Formulation", subtitle="Designing a clean solar-powered dual-load energy management system with sub-watt accuracy")

    obj_cards = [
        ("CLEAN SOLAR POWER HARVESTING", 
         "• Ingest power from a 6V Solar PV Panel (5–10W) via TP4056 charging module.\n"
         "• Buffer generated clean energy into a 3.7V Li-ion 18650 cell with full protection.\n"
         "• Step-up stored 3.7V to stable 5V DC via booster to drive real electrical loads.", C_AMBER),
        ("DUAL LOAD ISOLATION & TELEMETRY", 
         "• Monitor two distinct 5V DC loads simultaneously: Resistive/Optical (DC LED) and Inductive (DC Motor).\n"
         "• Measure active voltage via precision dividers and load current via Hall-effect ACS712-5A.\n"
         "• Maintain independent power rail for ESP32 DevKit V1 with star grounding.", C_BLUE),
        ("SENSOR ZERO-BIAS RECTIFICATION", 
         "• Real physical bench sensors float when turned OFF (reading ~1.18V and ~0.2A noise floor).\n"
         "• Without calibration, phantom power accumulates, falsifying kWh and tariff bills.\n"
         "• Built an adaptive digital deadband that clamps off-time sensor float to true 0.00V / 0.00A.", C_EMERALD),
        ("AI COGNITION & CONTINUOUS LEARNING", 
         "• Train a PyTorch Multi-Head Self-Attention Transformer model on real Firebase telemetry.\n"
         "• Classify electrical states and detect anomalous surges and motor stall overloads.\n"
         "• Continually fine-tune neural weights in the background via experience replay buffer.", C_DARK)
    ]

    for idx, (title, content, bar_color) in enumerate(obj_cards):
        col = idx % 2
        row = idx // 2
        left = Inches(0.8 + col * 5.95)
        top = Inches(1.8 + row * 2.5)

        card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.7), Inches(2.3))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_BORDER
        card.line.width = Pt(1)

        # Accent bar
        bar = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top + Inches(0.05), Inches(0.08), Inches(2.2))
        bar.fill.solid()
        bar.fill.fore_color.rgb = bar_color
        bar.line.fill.background()

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.25)
        tf.margin_top = Inches(0.15)

        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = bar_color

        pb = tf.add_paragraph()
        pb.text = content
        pb.font.size = Pt(10)
        pb.font.color.rgb = C_DARK
        pb.space_before = Pt(6)

    add_footer(s3, 3)

    # ========================================================
    # SLIDE 4: SYSTEM ARCHITECTURE & BLOCK DIAGRAM
    # ========================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "System Architecture & Block Diagram", subtitle="Four-tier pipeline: Solar Edge Generation • ESP32 MCU Acquisition • Cloud Engine • AI Dashboard")

    img_path = os.path.join("public", "block_diagram.png")
    if os.path.exists(img_path):
        s4.shapes.add_picture(img_path, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))
    else:
        # Fallback text box if image missing
        tbox = s4.shapes.add_textbox(Inches(0.8), Inches(2.0), Inches(11.7), Inches(4.0))
        tbox.text_frame.text = "System Block Diagram: Edge Acquisition -> Firebase Cloud -> Backend Server -> UI"

    add_footer(s4, 4)

    # ========================================================
    # SLIDE 5: HARDWARE CIRCUIT SCHEMATIC & PIN INTERFACING
    # ========================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Solar Powered ESP32 Energy Monitoring Circuit Diagram", subtitle="Detailed schematic showing 6V solar, TP4056, 3.7V battery, 5V booster, dual ACS712 sensors, and ESP32 pin mappings")

    circuit_img = os.path.join("public", "circuit_diagram.png")
    if os.path.exists(circuit_img):
        s5.shapes.add_picture(circuit_img, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))

    add_footer(s5, 5)

    # ========================================================
    # SLIDE 6: SENSOR ZERO-BIAS RECTIFICATION & FLT CLAMPING
    # ========================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Sensor Zero-Bias Deadband & Float Noise Clamping", subtitle="Eliminating ADC bias distortion to ensure mathematically accurate Indian Rupee (INR) billing")

    # Left Column: The Problem & Formula
    rect_left = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.7), Inches(4.9))
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
    pl3.space_before = Pt(14)

    pl4 = tf_l.add_paragraph()
    pl4.text = (
        "V_rect = 0.00 V   if V_raw < V_floor (2.0 V)\n"
        "I_rect = 0.000 A  if I_raw < I_floor (0.28 A LED / 0.22 A Motor)\n"
        "P_rect = V_rect × I_rect (Guaranteed 0.00 W when inactive)\n"
        "Billing Cost = (Total_kWh) × ₹8.00 / kWh"
    )
    pl4.font.size = Pt(10)
    pl4.font.bold = True
    pl4.font.color.rgb = C_BLUE
    pl4.space_before = Pt(6)

    # Right Column: Comparative Metrics Table
    rect_right = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.9))
    rect_right.fill.solid()
    rect_right.fill.fore_color.rgb = C_WHITE
    rect_right.line.color.rgb = C_BORDER
    tf_r = rect_right.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = Inches(0.25)
    tf_r.margin_top = Inches(0.2)

    pr1 = tf_r.paragraphs[0]
    pr1.text = "EXPERIMENTAL VERIFICATION: BEFORE VS. AFTER"
    pr1.font.size = Pt(12)
    pr1.font.bold = True
    pr1.font.color.rgb = C_DARK

    pr2 = tf_r.add_paragraph()
    pr2.text = (
        "Operating State: Load 1 (DC LED) and Load 2 (DC Motor) turned OFF.\n\n"
        "WITHOUT DEADBAND CALIBRATION (RAW SENSOR FLOAT):\n"
        "• Measured Voltage: 1.18 V (Floating float rail)\n"
        "• Measured Current: 0.240 A (Hall noise floor)\n"
        "• Erroneous Power: 0.283 W (False generation)\n"
        "• Monthly Phantom Cost: ₹1.63 phantom bill per inactive socket\n\n"
        "WITH ZERO-BIAS RECTIFICATION (ACTIVE FILTER):\n"
        "• Rectified Voltage: 0.00 V (Clamped to ground)\n"
        "• Rectified Current: 0.000 A (Clamped to zero)\n"
        "• True Inactive Power: 0.000 W (Strict zero)\n"
        "• Monthly Inactive Cost: ₹0.00 (100% billing accuracy)\n\n"
        "ACTIVE RUNNING LOAD VERIFICATION:\n"
        "• DC LED ON: 4.63 V × 0.393 A = 1.820 W (Passed untouched)\n"
        "• Motor Normal: 5.00 V × 0.850 A = 4.250 W (Passed untouched)"
    )
    pr2.font.size = Pt(10)
    pr2.font.color.rgb = C_DARK
    pr2.space_before = Pt(6)

    add_footer(s6, 6)

    # ========================================================
    # SLIDE 7: PYTORCH NEURAL MODEL & CONTINUOUS LEARNING
    # ========================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "PyTorch Transformer Neural Engine & Continuous Online Learning", subtitle="Self-Attention architecture for multi-task load classification with dynamic streaming replay buffer fine-tuning")

    # Card 1: Model Architecture
    c1 = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.7), Inches(2.35))
    c1.fill.solid()
    c1.fill.fore_color.rgb = C_PANEL_ALT
    c1.line.color.rgb = C_BORDER
    tf_c1 = c1.text_frame
    tf_c1.word_wrap = True
    tf_c1.margin_left = Inches(0.2)
    tf_c1.margin_top = Inches(0.15)
    
    p = tf_c1.paragraphs[0]
    p.text = "S3ELECTRICALTRANSFORMER ARCHITECTURE"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_BLUE

    p_body = tf_c1.add_paragraph()
    p_body.text = (
        "• Input Dimension: 4 Channels (V_led, I_led, V_motor, I_motor)\n"
        "• Embedding: 64-dimensional feature projection\n"
        "• Transformer Encoder: 2 layers, 4 Multi-Head Attention Heads\n"
        "• Multi-Task Output Heads: State Classifier (7 electrical classes), Rectified Power Head, and Anomaly Risk Head (Normal/Medium/Critical)\n"
        "• Validation Accuracy: 97.22% on real Firebase telemetry"
    )
    p_body.font.size = Pt(9.5)
    p_body.font.color.rgb = C_DARK
    p_body.space_before = Pt(4)

    # Card 2: Autonomous Continuous Learning
    c2 = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(2.35))
    c2.fill.solid()
    c2.fill.fore_color.rgb = C_WHITE
    c2.line.color.rgb = C_BORDER
    tf_c2 = c2.text_frame
    tf_c2.word_wrap = True
    tf_c2.margin_left = Inches(0.2)
    tf_c2.margin_top = Inches(0.15)

    p = tf_c2.paragraphs[0]
    p.text = "AUTONOMOUS CONTINUOUS LEARNING SUBSYSTEM"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD

    p_body = tf_c2.add_paragraph()
    p_body.text = (
        "• Ingests live telemetry streams from Firebase RTDB in real time\n"
        "• Experience Replay Buffer: Maintains 234+ balanced historical and recent real-world sensor transitions\n"
        "• Periodic Online Learning Scheduler: Fires every 5 minutes (configurable to 2m, 15m, 30m, or manual)\n"
        "• Continual Fine-Tuning: AdamW optimizer, lr=3e-4, 5 adaptive epochs\n"
        "• Dynamic Model Reload: Backend and UI reloads model weights on the fly without server downtime"
    )
    p_body.font.size = Pt(9.5)
    p_body.font.color.rgb = C_DARK
    p_body.space_before = Pt(4)

    # Card 3: 7 Electrical Classes
    c3 = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.35), Inches(11.7), Inches(2.35))
    c3.fill.solid()
    c3.fill.fore_color.rgb = C_PANEL_ALT
    c3.line.color.rgb = C_BORDER
    tf_c3 = c3.text_frame
    tf_c3.word_wrap = True
    tf_c3.margin_left = Inches(0.2)
    tf_c3.margin_top = Inches(0.15)

    p = tf_c3.paragraphs[0]
    p.text = "SEVEN-CLASS NEURAL ELECTRICAL RECOGNITION TAXONOMY"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_DARK

    p_body = tf_c3.add_paragraph()
    p_body.text = (
        "1. ALL_OFF (Rectified): V < 2V, I < 0.22A -> Clamped to 0.00 W • Anomaly Risk: Normal\n"
        "2. LED_ONLY_ACTIVE: V_led = 4.63V, I_led = 0.393A (~1.82W) • Optical solar load active\n"
        "3. MOTOR_IDLE: V_motor ~ 1.18V, I_motor ~ 0.183A (~0.22W) • Low-power standby state\n"
        "4. MOTOR_RUNNING_NORMAL: V_motor = 5.0V, I_motor = 0.85A (~4.25W) • Normal pump operation\n"
        "5. DUAL_LOAD_ACTIVE: Both LED and Motor active simultaneously (~6.07W) • Clean solar generation rail\n"
        "6. TRANSIENT_INRUSH_SURGE: Motor inrush spike up to 1.85A (~9.2W) • Anomaly Risk: Medium\n"
        "7. MOTOR_STALL_OVERLOAD: Motor jammed/stalled pulling 3.20A (~15.3W) • Anomaly Risk: CRITICAL ALARM"
    )
    p_body.font.size = Pt(9.5)
    p_body.font.color.rgb = C_DARK
    p_body.space_before = Pt(4)

    add_footer(s7, 7)

    # ========================================================
    # SLIDE 8: MODEL CONTEXT PROTOCOL (MCP) & AI COPILOT
    # ========================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Model Context Protocol (MCP) & Multi-Model AI Copilot", subtitle="Exposing standardized tools for ChatGPT Custom GPTs, Claude Desktop, and browser multi-model inference")

    # Left: MCP Server
    c_mcp = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.7), Inches(4.9))
    c_mcp.fill.solid()
    c_mcp.fill.fore_color.rgb = C_PANEL_ALT
    c_mcp.line.color.rgb = C_BORDER
    tf_mcp = c_mcp.text_frame
    tf_mcp.word_wrap = True
    tf_mcp.margin_left = Inches(0.25)
    tf_mcp.margin_top = Inches(0.2)

    p = tf_mcp.paragraphs[0]
    p.text = "OFFICIAL MODEL CONTEXT PROTOCOL (MCP) INTEGRATION"
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = C_BLUE

    p_b = tf_mcp.add_paragraph()
    p_b.text = (
        "• Standardized Protocol: Supports official MCP 2024-11-05 spec and OpenAPI 3.1 schema for ChatGPT Custom GPT Actions.\n\n"
        "MCP ACTIVE TOOLS CATALOG:\n"
        "1. get_live_telemetry: Reads live V, I, P for Solar LED & DC Motor from Firebase RTDB.\n"
        "2. get_power_and_bill: Calculates active total watts, accumulated kWh, and ₹ billing charges.\n"
        "3. predict_electrical_anomaly: Queries PyTorch Transformer for state & risk scoring.\n"
        "4. get_sensor_bias_calibration: Returns active noise thresholds and deadband status.\n"
        "5. get_hardware_pinout: Returns complete ESP32 pin mappings and power connections.\n\n"
        "INTEROPERABILITY:\n"
        "• Works with ChatGPT Custom Actions (http://localhost:3000/api/mcp/openapi.json)\n"
        "• Works with Claude Desktop via stdio server (python mcp/s3_iot_mcp_server.py)\n"
        "• Zero hallucination: All agent answers grounded strictly in verified JSON telemetry."
    )
    p_b.font.size = Pt(10)
    p_b.font.color.rgb = C_DARK
    p_b.space_before = Pt(6)

    # Right: Multi-Model AI Copilot
    c_copilot = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.9))
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

    p_b = tf_cop.add_paragraph()
    p_b.text = (
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
    p_b.font.size = Pt(10)
    p_b.font.color.rgb = C_DARK
    p_b.space_before = Pt(6)

    add_footer(s8, 8)

    # ========================================================
    # SLIDE 9: FUTURE SCOPE - SMART HOME MODULAR SWITCH SYSTEM
    # ========================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Future Scope: Smart Home Modular Switch Circuit Schematic", subtitle="Decentralized modular switch holders with per-switch telemetry, primary ESP32 hub, and offline edge ML anomaly engine")

    modular_img = os.path.join("public", "Smart_Home_Modular_Switch_System_Diagram.png")
    if os.path.exists(modular_img):
        s9.shapes.add_picture(modular_img, Inches(0.8), Inches(1.75), width=Inches(11.73), height=Inches(4.9))

    add_footer(s9, 9)

    # ========================================================
    # SLIDE 10: CONCLUSION & ENGINEERING VERIFICATION
    # ========================================================
    s10 = prs.slides.add_slide(blank_layout)
    
    tbox10 = s10.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.8))
    tf10 = tbox10.text_frame
    tf10.word_wrap = True

    p = tf10.paragraphs[0]
    p.text = "ENGINEERING DEMONSTRATION & PROJECT VALIDATION COMPLETE"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD

    p_title = tf10.add_paragraph()
    p_title.text = "Summary of System Achievements"
    p_title.font.size = Pt(32)
    p_title.font.bold = True
    p_title.font.color.rgb = C_DARK
    p_title.space_before = Pt(6)

    # 4 Validation metric summary boxes
    achievements = [
        ("CLEAN ENERGY HARDWARE PIPELINE", 
         "Fully functioning 6V Solar PV generation into TP4056 and 3.7V Li-ion battery. DC-DC 5V booster rail powers dual DC loads (LED and DC Motor) with common star grounding and isolated ESP32 sensing."),
        ("ZERO-BIAS CLAMPING & TARIFF ACCURACY", 
         "Eliminated all off-time sensor floating (1.18V & 0.2A baseline). Clamped phantom generation to exactly 0.00W. Trapezoidal energy integration produces 100% accurate Indian Rupee billing at ₹8.00/kWh."),
        ("PYTORCH NEURAL MODEL & CONTINUOUS LEARNING", 
         "Trained S3ElectricalTransformer achieving 97.22% validation accuracy. Background daemon fine-tunes weights every 5 minutes from live Firebase telemetry via 234+ sample experience replay buffer."),
        ("INTEROPERABILITY: MCP & DUAL AI COPILOT", 
         "Built official Model Context Protocol (MCP 2024-11-05) and OpenAPI 3.1 action endpoints for ChatGPT and Claude Desktop. Real-time multi-model chat interface with FreeTheAI GLM-5.3 & Groq.")
    ]

    for idx, (title, text) in enumerate(achievements):
        col = idx % 2
        row = idx // 2
        left = Inches(1.0 + col * 5.75)
        top = Inches(2.7 + row * 2.1)

        rect = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, Inches(5.5), Inches(1.95))
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

    # Q&A Footer Banner
    qbox = s10.shapes.add_textbox(Inches(1.0), Inches(6.75), Inches(11.3), Inches(0.5))
    tf_q = qbox.text_frame
    p_q = tf_q.paragraphs[0]
    p_q.text = "Thank You! • Open for Questions, Evaluation & Technical Demonstration • Aswan Ayyappan (UKP25EE023) & Aadil Mohamed"
    p_q.font.size = Pt(10.5)
    p_q.font.bold = True
    p_q.font.color.rgb = C_DARK
    p_q.alignment = PP_ALIGN.CENTER

    # Save to both paths
    out_dir = "public"
    p1 = os.path.join(out_dir, "S-3_IOT_Solar_Battery_Presentation.pptx")
    p2 = os.path.join(out_dir, "S-3_IOT_Presentation.pptx")
    p3 = "ASWAN AYYAPPAN(UKP25EE023).pptx"
    
    prs.save(p1)
    prs.save(p2)
    prs.save(p3)
    print(f"Generated and saved 10-slide presentation to:\n  - {p1}\n  - {p2}\n  - {p3}")

if __name__ == "__main__":
    create_deck()
