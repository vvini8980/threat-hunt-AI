import os
import csv
import json
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from services.supabase_client import supabase

def generate_hunt_report(client_id: str, results: list) -> str:
    """
    Generates a PDF report for Hunt results.
    Returns the file path to the generated PDF.
    """
    file_path = f"/tmp/hunt_report_{client_id}.pdf"
    
    if os.name == 'nt':
        file_path = f"hunt_report_{client_id}.pdf"
        
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    elements.append(Paragraph(f"Hunt Report for Client: {client_id}", styles['Title']))
    elements.append(Spacer(1, 20))
    
    for res in results:
        text = f"<b>Hypothesis:</b> {res.get('hypothesis', 'Unknown')} <br/><b>Verdict:</b> {res.get('verdict', 'Unknown')}"
        elements.append(Paragraph(text, styles['Normal']))
        elements.append(Spacer(1, 10))
        
    doc.build(elements)
    return file_path


def build_ioc_report(client_id: str, date_str: str) -> dict:
    """
    Fetches raw IOCs for the client for the given date, groups them,
    adds context, and saves the grouped report stub to Supabase.
    """
    if not supabase:
        raise Exception("Supabase client not initialized")
        
    res = supabase.table("ioc_reports").select("*").eq("client_id", client_id).execute()
    iocs = res.data or []
    
    # Filter by date prefix
    today_iocs = [ioc for ioc in iocs if ioc.get("report_date", "").startswith(date_str)]
    
    grouped = {
        "ip": [],
        "domain": [],
        "hash": []
    }
    
    threat_actors = set()
    
    for ioc in today_iocs:
        ioc_type = ioc.get("ioc_type", "unknown").lower()
        if ioc_type in grouped:
            conf = ioc.get("confidence", "Medium")
            action = "Block" if conf == "High" else "Monitor"
            
            ioc_entry = {
                "value": ioc.get("value"),
                "confidence": conf,
                "threat_actor": ioc.get("threat_actor", "Unknown"),
                "recommended_action": action
            }
            grouped[ioc_type].append(ioc_entry)
            
            if ioc.get("threat_actor") and ioc.get("threat_actor") != "Unknown":
                threat_actors.add(ioc.get("threat_actor"))
                
    report_data = {
        "date": date_str,
        "threat_actors": list(threat_actors),
        "iocs": grouped
    }
    
    # Insert stub into reports table so the frontend sees it
    try:
        supabase.table("reports").insert({
            "client_id": client_id,
            "report_type": "ioc",
            "report_date": datetime.datetime.utcnow().isoformat(),
            "file_url": "processing..."
        }).execute()
    except Exception as e:
        print(f"Warning: Could not save report stub: {e}")
        
    return report_data


def generate_ioc_reports(client_id: str, date_str: str, report_data: dict) -> dict:
    """
    Generates professional PDF and CSV blocklist files for the IOC report.
    Returns a dictionary with paths to the generated files.
    """
    prefix = f"/tmp/ioc_{client_id}_{date_str}" if os.name != 'nt' else f"ioc_{client_id}_{date_str}"
    
    pdf_path = f"{prefix}_report.pdf"
    ip_csv = f"{prefix}_ip_blocklist.csv"
    domain_csv = f"{prefix}_domain_blocklist.csv"
    hash_csv = f"{prefix}_hash_blocklist.csv"
    
    iocs = report_data.get("iocs", {})
    
    # 1. Generate CSVs
    def write_csv(filepath, data_list):
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Value", "Confidence", "ThreatActor", "Action"])
            for row in data_list:
                writer.writerow([row["value"], row["confidence"], row["threat_actor"], row["recommended_action"]])
                
    write_csv(ip_csv, iocs.get("ip", []))
    write_csv(domain_csv, iocs.get("domain", []))
    write_csv(hash_csv, iocs.get("hash", []))
    
    # 2. Generate PDF
    doc = SimpleDocTemplate(pdf_path, pagesize=letter)
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    h2_style = styles['Heading2']
    normal_style = styles['Normal']
    
    elements = []
    
    # Executive Summary
    elements.append(Paragraph(f"IOC Intelligence Report", title_style))
    elements.append(Paragraph(f"Client: {client_id} | Date: {date_str}", normal_style))
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("Executive Summary", h2_style))
    elements.append(Paragraph("This report contains Indicators of Compromise (IOCs) identified by OpenCTI for your specific industry profile. Sources have been corroborated via Threat Intelligence feeds. High confidence indicators (80+) are recommended for immediate blocking at the firewall/EDR, while Medium confidence indicators (70-79) should be actively monitored.", normal_style))
    elements.append(Spacer(1, 15))
    
    # Threat Actors
    actors = report_data.get("threat_actors", [])
    if actors:
        elements.append(Paragraph("Identified Threat Actors", h2_style))
        elements.append(Paragraph(", ".join(actors), normal_style))
        elements.append(Spacer(1, 15))
        
    # Build Tables
    def build_table(title, data_list):
        if not data_list: return
        elements.append(Paragraph(title, h2_style))
        
        table_data = [["Value", "Confidence", "Threat Actor", "Action"]]
        for row in data_list:
            table_data.append([row["value"], row["confidence"], row["threat_actor"], row["recommended_action"]])
            
        t = Table(table_data, colWidths=[200, 80, 100, 80])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1"))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
    build_table("IP Blocklist", iocs.get("ip", []))
    build_table("Domain Blocklist", iocs.get("domain", []))
    build_table("Hash Blocklist", iocs.get("hash", []))
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("CONFIDENTIAL - DO NOT DISTRIBUTE", ParagraphStyle(name='Footer', alignment=1, textColor=colors.red, fontSize=10)))
    
    doc.build(elements)
    
    return {
        "pdf": pdf_path,
        "csv_ip": ip_csv,
        "csv_domain": domain_csv,
        "csv_hash": hash_csv
    }
