#!/usr/bin/env python3
"""Generate branded PAZE proposal Word document."""

from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "branding" / "paze-logo.png"
OUTPUT = ROOT / "docs" / "PAZE_Branded_Proposal.docx"

PAZE_BLUE = RGBColor(0x00, 0x7A, 0xCC)
PAZE_NAVY = RGBColor(0x1A, 0x1A, 0x2E)
PAZE_GREEN = RGBColor(0x00, 0xC8, 0x96)
PAZE_MUTED = RGBColor(0x55, 0x55, 0x66)


def set_cell_shading(cell, color_hex):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), color_hex)
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = PAZE_NAVY
    return h


def add_body(doc, text, bold=False, italic=False, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(11)
    run.font.name = "Calibri"
    if bold:
        run.bold = True
    if italic:
        run.italic = True
    if color:
        run.font.color.rgb = color
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    for run in p.runs:
        run.font.size = Pt(11)
    return p


def build():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.9)
        section.bottom_margin = Inches(0.9)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Header band with logo
    header_table = doc.add_table(rows=1, cols=2)
    header_table.autofit = False
    header_table.columns[0].width = Inches(1.2)
    header_table.columns[1].width = Inches(5.3)
    left = header_table.rows[0].cells[0]
    right = header_table.rows[0].cells[1]
    set_cell_shading(left, "1A1A2E")
    set_cell_shading(right, "1A1A2E")
    if LOGO.exists():
        left.paragraphs[0].add_run().add_picture(str(LOGO), width=Inches(0.9))
    tp = right.paragraphs[0]
    tp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = tp.add_run("PAZE\n")
    r.bold = True
    r.font.size = Pt(26)
    r.font.color.rgb = PAZE_BLUE
    r2 = tp.add_run("Crowdsourced Road Intelligence Platform\n")
    r2.font.size = Pt(12)
    r2.font.color.rgb = RGBColor(0xF0, 0xF4, 0xF8)
    r3 = tp.add_run('"Drive. Report. Get Paid."')
    r3.italic = True
    r3.font.size = Pt(11)
    r3.font.color.rgb = PAZE_GREEN

    doc.add_paragraph()

    sections = [
        ("Platform Overview",
         "PAZE is a crowdsourced road intelligence platform that pays drivers for reporting "
         "road hazards, weather conditions, accidents, police activity, traffic, and more. "
         "Users earn real money by submitting geo-tagged photos and 15-second video reports. "
         "The platform also features an optional Live Drive Mode that acts as a continuous "
         "dashcam for users seeking major insurance discounts."),
        ("The Problem",
         "Motor vehicle crashes cost the United States approximately $340 billion annually. "
         "Pothole damage alone costs American drivers an estimated $3 billion to $26 billion "
         "per year in vehicle repairs. Traditional methods of identifying and fixing road "
         "hazards are slow and often lack visual evidence."),
    ]
    for title, body in sections:
        add_heading(doc, title, 1)
        add_body(doc, body)

    add_heading(doc, "Data Monetization Strategy", 1)
    add_body(doc, "PAZE generates revenue by licensing high-quality visual and geospatial road data:")
    for item in [
        "Auto insurance companies — improved risk modeling and reduced claims",
        "Government entities (DOT, DOE, EPA, FAA) — infrastructure planning, environmental studies, transportation safety",
        "Premium government licensing rates with community revenue-share back to contributing drivers",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "Technical Architecture", 1)
    arch = [
        ("Mobile Application (Flutter + Mapbox + ElevenLabs)",
         ["Mapbox SDK for real-time hazard maps and navigation overlays",
          "15-second geo-tagged video reports with on-device compression",
          "Live Drive Mode — continuous dashcam with GPS breadcrumb trails",
          "ElevenLabs voice integration for hands-free reporting",
          "Stripe/Plaid payout wallet with instant cash-out"]),
        ("Backend API & Data Pipeline",
         ["REST + WebSocket API with JWT authentication",
          "S3 media storage with FFmpeg transcoding pipeline",
          "PostGIS geospatial indexing for hazard clustering and heatmaps",
          "ML pipeline for automatic hazard classification",
          "Revenue-share engine and tiered data licensing API"]),
        ("Web Dashboard & Admin Panel",
         ["Interactive Mapbox GL maps for enterprise clients",
          "Report browser with metadata export and analytics suite",
          "Content moderation queue and payout administration",
          "SOC 2-aligned compliance controls for government contracts"]),
    ]
    for subtitle, bullets in arch:
        add_heading(doc, subtitle, 2)
        for b in bullets:
            add_bullet(doc, b)

    add_heading(doc, "Mission Statement", 1)
    add_body(doc, "To make roads safer by turning every driver into a rewarded contributor of real-time road intelligence.", italic=True, color=PAZE_BLUE)

    add_heading(doc, "Proposal for Tesla Partnership", 1)
    add_body(doc, "Subject: Exclusive Pilot Partnership Proposal – PAZE + Tesla Vehicles", bold=True)
    doc.add_paragraph()
    for para in [
        "Dear Elon Musk and Tesla Team,",
        "",
        "PAZE offers Tesla a unique opportunity to rapidly expand real-world visual road data collection through a dedicated partnership.",
        "We propose an exclusive pilot where Tesla vehicles can optionally stream anonymized road hazard and condition data directly into the PAZE network. In return, Tesla gains access to crowdsourced visual data from millions of non-Tesla drivers, significantly supplementing Tesla's own fleet data.",
        "This partnership would accelerate improvements to Full Self-Driving by providing richer, more diverse visual training data for edge cases, construction zones, weather events, and temporary hazards that even advanced sensor suites may miss.",
        "We believe this collaboration would meaningfully advance vehicle safety for both Tesla owners and all road users.",
        "I would welcome the opportunity to present a detailed pilot plan.",
        "",
        "Best regards,\nCharles Clottin\nFounder, PAZE",
    ]:
        if para == "":
            doc.add_paragraph()
        else:
            add_body(doc, para)

    # Footer
    doc.add_paragraph()
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = footer.add_run("© 2026 PAZE · paze.app · Confidential")
    fr.font.size = Pt(9)
    fr.font.color.rgb = PAZE_MUTED

    doc.save(OUTPUT)
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build()