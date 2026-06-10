"""
Report Generator — Builds PDF reports for all report types.
Uses ReportLab for PDF generation with professional styling.
"""
import os
import csv
import json
import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from services.supabase_client import supabase

# ── Colour palette (dark theme matching the UI) ──────────────────────────────
DARK_BG    = colors.HexColor("#0f172a")
PANEL_BG   = colors.HexColor("#1e293b")
ACCENT     = colors.HexColor("#3b82f6")
ACCENT2    = colors.HexColor("#8b5cf6")
RED        = colors.HexColor("#ef4444")
AMBER      = colors.HexColor("#f59e0b")
EMERALD    = colors.HexColor("#10b981")
CYAN       = colors.HexColor("#06b6d4")
TEXT       = colors.HexColor("#f1f5f9")
TEXT_MUTED = colors.HexColor("#94a3b8")
BORDER     = colors.HexColor("#334155")


def _styles():
    s = getSampleStyleSheet()
    base = dict(fontName="Helvetica", textColor=TEXT)

    s.add(ParagraphStyle("TH_Title",    **base, fontSize=26, spaceAfter=4,  leading=32, fontName="Helvetica-Bold"))
    s.add(ParagraphStyle("TH_Subtitle", **base, fontSize=11, spaceAfter=20, textColor=TEXT_MUTED))
    s.add(ParagraphStyle("TH_H2",       **base, fontSize=13, spaceAfter=6,  fontName="Helvetica-Bold", spaceBefore=18))
    s.add(ParagraphStyle("TH_H3",       **base, fontSize=11, spaceAfter=4,  fontName="Helvetica-Bold", spaceBefore=12, textColor=ACCENT))
    s.add(ParagraphStyle("TH_Body",     **base, fontSize=9,  spaceAfter=4,  leading=14))
    s.add(ParagraphStyle("TH_Muted",    **base, fontSize=8,  spaceAfter=4,  textColor=TEXT_MUTED))
    s.add(ParagraphStyle("TH_Confid",   **base, fontSize=8,  alignment=TA_CENTER, textColor=RED, spaceBefore=20))
    return s


def _doc(path: str):
    return SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch
    )


def _header(elements, s, title: str, subtitle: str, client_name: str = ""):
    """Adds a professional branded header block."""
    elements.append(Paragraph(f"🛡 ThreatHunt AI Platform", s["TH_Muted"]))
    elements.append(Paragraph(title, s["TH_Title"]))
    elements.append(Paragraph(f"{subtitle}   •   Client: {client_name}   •   Generated: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", s["TH_Subtitle"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=14))


def _kpi_table(rows):
    """Renders a horizontal KPI row table."""
    data    = [[Paragraph(f"<b>{v}</b>", ParagraphStyle("kv", fontName="Helvetica-Bold", fontSize=18, textColor=TEXT, alignment=TA_CENTER)),
                Paragraph(k, ParagraphStyle("kl", fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER))]
               for k, v in rows]
    cols    = len(rows)
    col_w   = (6.5 * inch) / cols
    t = Table([[row[0] for row in data], [row[1] for row in data]], colWidths=[col_w] * cols)
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), PANEL_BG),
        ("GRID",        (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",  (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t


def _verdict_color(verdict):
    if verdict == "TP":    return RED
    if verdict == "FP":    return AMBER
    if verdict == "clean": return EMERALD
    return TEXT_MUTED


def _output_path(filename: str) -> str:
    """Returns OS-appropriate output path."""
    if os.name == "nt":
        return filename
    return f"/tmp/{filename}"


# ──────────────────────────────────────────────────────────────────────────────
# Data builders
# ──────────────────────────────────────────────────────────────────────────────

def build_daily_summary_data(client_id: str, start: datetime.datetime, end: datetime.datetime) -> dict:
    """Fetches all hunt results for the given window and builds summary stats."""
    if not supabase:
        return _mock_daily_data()
    res = (
        supabase.table("hunt_results")
        .select("*, hypotheses(title, mitre_id)")
        .eq("client_id", client_id)
        .gte("executed_at", start.isoformat())
        .lte("executed_at", end.isoformat())
        .execute()
    )
    rows = res.data or []
    tp = [r for r in rows if r.get("verdict") == "TP"]
    fp = [r for r in rows if r.get("verdict") == "FP"]
    cl = [r for r in rows if r.get("verdict") == "clean"]
    return {
        "total_hunts": len(rows),
        "tp_count":    len(tp),
        "fp_count":    len(fp),
        "clean_count": len(cl),
        "tp_rate":     round(len(tp) / len(rows) * 100, 1) if rows else 0,
        "results":     rows,
        "start":       start.strftime("%Y-%m-%d"),
        "end":         end.strftime("%Y-%m-%d"),
    }


def build_weekly_summary_data(client_id: str, start: datetime.datetime, end: datetime.datetime) -> dict:
    """Fetches 7-day data including IOC counts for weekly/executive reports."""
    data = build_daily_summary_data(client_id, start, end)
    ioc_res = supabase.table("ioc_reports").select("ioc_type, threat_actor, confidence").eq("client_id", client_id).execute() if supabase else None
    iocs = ioc_res.data or [] if ioc_res else []
    actors = list(set(i.get("threat_actor") for i in iocs if i.get("threat_actor")))
    hyp_res = supabase.table("hypotheses").select("mitre_id, title, status").eq("client_id", client_id).execute() if supabase else None
    hyps = hyp_res.data or [] if hyp_res else []
    data["ioc_count"]      = len(iocs)
    data["threat_actors"]  = actors
    data["hypotheses"]     = hyps
    data["mitre_coverage"] = len(set(h.get("mitre_id") for h in hyps if h.get("mitre_id")))
    return data


def _mock_daily_data():
    return {"total_hunts": 0, "tp_count": 0, "fp_count": 0, "clean_count": 0, "tp_rate": 0, "results": [], "start": "N/A", "end": "N/A"}


# ──────────────────────────────────────────────────────────────────────────────
# PDF generators
# ──────────────────────────────────────────────────────────────────────────────

def generate_daily_pdf(client_id: str, data: dict) -> str:
    """Generates a Daily Hunt Summary PDF."""
    path = _output_path(f"daily_{client_id}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf")
    doc  = _doc(path)
    s    = _styles()
    el   = []

    _header(el, s, "Daily Hunt Summary", f"Period: {data['start']} → {data['end']}", client_id)

    # KPI strip
    el.append(_kpi_table([
        ("Total Hunts",    str(data["total_hunts"])),
        ("True Positives", str(data["tp_count"])),
        ("False Positives",str(data["fp_count"])),
        ("Clean",          str(data["clean_count"])),
        ("TP Rate",        f"{data['tp_rate']}%"),
    ]))
    el.append(Spacer(1, 20))

    # Results table
    if data["results"]:
        el.append(Paragraph("Hunt Results", s["TH_H2"]))
        table_data = [["Hypothesis", "MITRE", "Verdict", "Executed At"]]
        for r in data["results"][:50]:
            verdict = r.get("verdict", "pending")
            hyp_title = (r.get("hypotheses") or {}).get("title", "Unknown")
            mitre = (r.get("hypotheses") or {}).get("mitre_id", "—")
            table_data.append([
                Paragraph(hyp_title[:60], ParagraphStyle("tc", fontSize=8, textColor=TEXT)),
                Paragraph(mitre, ParagraphStyle("tc", fontSize=8, textColor=AMBER, fontName="Helvetica-Bold")),
                Paragraph(verdict, ParagraphStyle("tc", fontSize=8, textColor=_verdict_color(verdict), fontName="Helvetica-Bold")),
                Paragraph(r.get("executed_at", "")[:16], ParagraphStyle("tc", fontSize=8, textColor=TEXT_MUTED)),
            ])
        t = Table(table_data, colWidths=[3.2*inch, 0.8*inch, 0.7*inch, 1.3*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  ACCENT),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0),  9),
            ("BACKGROUND",    (0, 1), (-1, -1), PANEL_BG),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [PANEL_BG, colors.HexColor("#243145")]),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        el.append(t)
    else:
        el.append(Paragraph("No hunt results in this period.", s["TH_Muted"]))

    el.append(Spacer(1, 30))
    el.append(Paragraph("CONFIDENTIAL — ThreatHunt AI Platform", s["TH_Confid"]))
    doc.build(el)
    return path


def generate_weekly_pdf(client_id: str, data: dict) -> str:
    """Generates a Weekly Executive Summary PDF."""
    path = _output_path(f"weekly_{client_id}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf")
    doc  = _doc(path)
    s    = _styles()
    el   = []

    _header(el, s, "Weekly Executive Summary", f"7-Day Period: {data.get('start', '')} → {data.get('end', '')}", client_id)

    el.append(_kpi_table([
        ("Hunts Executed",   str(data["total_hunts"])),
        ("True Positives",   str(data["tp_count"])),
        ("False Positives",  str(data["fp_count"])),
        ("IOCs Tracked",     str(data.get("ioc_count", 0))),
        ("MITRE Techniques", str(data.get("mitre_coverage", 0))),
        ("TP Detection Rate",f"{data['tp_rate']}%"),
    ]))
    el.append(Spacer(1, 20))

    # Threat actors
    actors = data.get("threat_actors", [])
    if actors:
        el.append(Paragraph("Identified Threat Actors This Week", s["TH_H2"]))
        for a in actors[:10]:
            el.append(Paragraph(f"• {a}", s["TH_Body"]))
        el.append(Spacer(1, 10))

    # MITRE coverage summary
    hyps = data.get("hypotheses", [])
    if hyps:
        el.append(Paragraph("Hypothesis Pipeline Status", s["TH_H2"]))
        status_counts = {}
        for h in hyps:
            st = h.get("status", "unknown")
            status_counts[st] = status_counts.get(st, 0) + 1
        status_table = [["Status", "Count"]]
        for st, cnt in sorted(status_counts.items()):
            status_table.append([st.title(), str(cnt)])
        t = Table(status_table, colWidths=[2*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), PANEL_BG),
            ("TEXTCOLOR",     (0, 0), (-1, 0), ACCENT),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND",    (0, 1), (-1, -1), DARK_BG),
            ("TEXTCOLOR",     (0, 1), (-1, -1), TEXT),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        el.append(t)

    el.append(Spacer(1, 30))
    el.append(Paragraph("CONFIDENTIAL — ThreatHunt AI Platform", s["TH_Confid"]))
    doc.build(el)
    return path


def generate_executive_pdf(client_id: str, data: dict) -> str:
    """Generates a C-suite Executive Threat Brief."""
    path = _output_path(f"executive_{client_id}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf")
    doc  = _doc(path)
    s    = _styles()
    el   = []

    _header(el, s, "Executive Threat Brief", "Monthly Threat Posture Summary", client_id)

    # Threat posture rating
    tp_rate = data.get("tp_rate", 0)
    if tp_rate >= 20:
        posture, posture_color = "🔴 ELEVATED", RED
    elif tp_rate >= 5:
        posture, posture_color = "🟡 MODERATE", AMBER
    else:
        posture, posture_color = "🟢 NORMAL", EMERALD

    el.append(Paragraph("Threat Posture", s["TH_H2"]))
    el.append(Paragraph(posture, ParagraphStyle("posture", fontSize=22, fontName="Helvetica-Bold", textColor=posture_color, spaceAfter=8)))
    el.append(Paragraph(
        f"Your environment had a {tp_rate}% true positive detection rate this period. "
        f"A total of {data['total_hunts']} proactive threat hunts were executed, "
        f"resulting in {data['tp_count']} confirmed threats and {data['fp_count']} false positives.",
        s["TH_Body"]
    ))
    el.append(Spacer(1, 12))

    el.append(_kpi_table([
        ("Threats Confirmed", str(data["tp_count"])),
        ("False Positives",   str(data["fp_count"])),
        ("Hunts Executed",    str(data["total_hunts"])),
        ("IOCs Monitored",    str(data.get("ioc_count", 0))),
    ]))
    el.append(Spacer(1, 20))

    # Key recommendations
    el.append(Paragraph("Key Recommendations", s["TH_H2"]))
    recs = [
        "Continue expanding MITRE ATT&CK coverage with targeted hypothesis generation.",
        "Review and action all True Positive findings identified this period.",
        "Update firewall/EDR block lists with newly identified high-confidence IOCs.",
        "Approve pending hunt hypotheses to maintain continuous detection coverage.",
    ]
    for i, rec in enumerate(recs, 1):
        el.append(Paragraph(f"{i}. {rec}", s["TH_Body"]))

    el.append(Spacer(1, 30))
    el.append(Paragraph("CONFIDENTIAL — For Executive Distribution Only", s["TH_Confid"]))
    doc.build(el)
    return path


def generate_coverage_pdf(client_id: str, hypotheses: list) -> str:
    """Generates a MITRE ATT&CK coverage report."""
    path = _output_path(f"coverage_{client_id}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf")
    doc  = _doc(path)
    s    = _styles()
    el   = []

    _header(el, s, "MITRE ATT&CK Coverage Report", "Technique Coverage & Detection Gaps", client_id)

    # Stats
    techniques = {}
    for h in hypotheses:
        mid = h.get("mitre_id", "Unknown")
        if mid not in techniques:
            techniques[mid] = []
        techniques[mid].append(h)

    total_techniques = len(techniques)
    covered = [mid for mid in techniques if mid and mid != "Unknown"]

    el.append(_kpi_table([
        ("Total Hypotheses",  str(len(hypotheses))),
        ("MITRE Techniques",  str(total_techniques)),
        ("Covered Techniques",str(len(covered))),
    ]))
    el.append(Spacer(1, 20))

    if techniques:
        el.append(Paragraph("Coverage by MITRE Technique", s["TH_H2"]))
        table_data = [["MITRE ID", "Hypotheses", "Status"]]
        for mid, hyps in sorted(techniques.items()):
            statuses = ", ".join(set(h.get("status", "?") for h in hyps))
            table_data.append([mid or "—", str(len(hyps)), statuses])

        t = Table(table_data, colWidths=[1.2*inch, 1*inch, 4.3*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  ACCENT),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("BACKGROUND",    (0, 1), (-1, -1), PANEL_BG),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [PANEL_BG, colors.HexColor("#243145")]),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TEXTCOLOR",     (0, 1), (-1, -1), TEXT),
        ]))
        el.append(t)

    el.append(Spacer(1, 30))
    el.append(Paragraph("CONFIDENTIAL — ThreatHunt AI Platform", s["TH_Confid"]))
    doc.build(el)
    return path


# ──────────────────────────────────────────────────────────────────────────────
# Existing functions (kept for backward compat)
# ──────────────────────────────────────────────────────────────────────────────

def generate_hunt_report(client_id: str, results: list) -> str:
    """Generates a Hunt Results PDF (legacy + updated styling)."""
    path = _output_path(f"hunt_report_{client_id}_{datetime.datetime.utcnow().strftime('%Y%m%d')}.pdf")
    data = {
        "total_hunts": len(results),
        "tp_count":    sum(1 for r in results if r.get("verdict") == "TP"),
        "fp_count":    sum(1 for r in results if r.get("verdict") == "FP"),
        "clean_count": sum(1 for r in results if r.get("verdict") == "clean"),
        "tp_rate":     0,
        "results":     [{"hypotheses": {"title": r.get("hypothesis", ""), "mitre_id": r.get("mitre_id", "")}, "verdict": r.get("verdict", ""), "executed_at": r.get("executed_at", "")} for r in results],
        "start":       "—",
        "end":         datetime.datetime.utcnow().strftime("%Y-%m-%d"),
    }
    return generate_daily_pdf(client_id, data)


def build_ioc_report(client_id: str, date_str: str) -> dict:
    """Fetches raw IOCs for the client for the given date, groups them."""
    if not supabase:
        raise Exception("Supabase client not initialized")
    res = supabase.table("ioc_reports").select("*").eq("client_id", client_id).execute()
    iocs = res.data or []
    today_iocs = [ioc for ioc in iocs if ioc.get("report_date", "").startswith(date_str)]
    grouped = {"ip": [], "domain": [], "hash": []}
    threat_actors = set()
    for ioc in today_iocs:
        ioc_type = ioc.get("ioc_type", "unknown").lower()
        if ioc_type in grouped:
            conf   = ioc.get("confidence", "Medium")
            action = "Block" if conf == "High" else "Monitor"
            grouped[ioc_type].append({
                "value": ioc.get("value"),
                "confidence": conf,
                "threat_actor": ioc.get("threat_actor", "Unknown"),
                "recommended_action": action,
            })
            if ioc.get("threat_actor") and ioc.get("threat_actor") != "Unknown":
                threat_actors.add(ioc.get("threat_actor"))
    try:
        supabase.table("reports").insert({
            "client_id": client_id,
            "report_type": "ioc",
            "report_date": datetime.datetime.utcnow().isoformat(),
            "file_url": "processing...",
        }).execute()
    except Exception as e:
        print(f"Warning: {e}")
    return {"date": date_str, "threat_actors": list(threat_actors), "iocs": grouped}


def generate_ioc_reports(client_id: str, date_str: str, report_data: dict) -> dict:
    """Generates IOC PDF and CSV blocklist files."""
    prefix = _output_path(f"ioc_{client_id}_{date_str}")
    pdf_path    = f"{prefix}_report.pdf"
    ip_csv      = f"{prefix}_ip_blocklist.csv"
    domain_csv  = f"{prefix}_domain_blocklist.csv"
    hash_csv    = f"{prefix}_hash_blocklist.csv"
    iocs = report_data.get("iocs", {})

    def write_csv(filepath, data_list):
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["Value", "Confidence", "ThreatActor", "Action"])
            for row in data_list:
                w.writerow([row["value"], row["confidence"], row["threat_actor"], row["recommended_action"]])

    write_csv(ip_csv,     iocs.get("ip", []))
    write_csv(domain_csv, iocs.get("domain", []))
    write_csv(hash_csv,   iocs.get("hash", []))

    # PDF
    doc = _doc(pdf_path)
    s   = _styles()
    el  = []
    _header(el, s, "IOC Intelligence Report", f"Date: {date_str}", client_id)

    actors = report_data.get("threat_actors", [])
    all_iocs = sum(len(v) for v in iocs.values())

    el.append(_kpi_table([
        ("Total IOCs",     str(all_iocs)),
        ("IPs",            str(len(iocs.get("ip", [])))),
        ("Domains",        str(len(iocs.get("domain", [])))),
        ("Hashes",         str(len(iocs.get("hash", [])))),
        ("Threat Actors",  str(len(actors))),
    ]))
    el.append(Spacer(1, 16))

    el.append(Paragraph(
        "This report contains Indicators of Compromise (IOCs) identified for your specific industry profile. "
        "High confidence IOCs (80+) are recommended for immediate blocking. Medium confidence IOCs should be actively monitored.",
        s["TH_Body"]
    ))

    if actors:
        el.append(Paragraph("Identified Threat Actors", s["TH_H2"]))
        el.append(Paragraph(" • ".join(actors), s["TH_Body"]))

    def _ioc_table(title, rows):
        if not rows:
            return
        el.append(Paragraph(title, s["TH_H2"]))
        td = [["Value", "Confidence", "Threat Actor", "Action"]]
        for row in rows:
            td.append([row["value"], row["confidence"], row["threat_actor"], row["recommended_action"]])
        t = Table(td, colWidths=[2.5*inch, 0.9*inch, 1.5*inch, 0.9*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  ACCENT),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("BACKGROUND",    (0, 1), (-1, -1), PANEL_BG),
            ("TEXTCOLOR",     (0, 1), (-1, -1), TEXT),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        el.append(t)
        el.append(Spacer(1, 12))

    _ioc_table("IP Blocklist",     iocs.get("ip", []))
    _ioc_table("Domain Blocklist", iocs.get("domain", []))
    _ioc_table("Hash Blocklist",   iocs.get("hash", []))

    el.append(Spacer(1, 20))
    el.append(Paragraph("CONFIDENTIAL — DO NOT DISTRIBUTE", s["TH_Confid"]))
    doc.build(el)

    return {"pdf": pdf_path, "csv_ip": ip_csv, "csv_domain": domain_csv, "csv_hash": hash_csv}
