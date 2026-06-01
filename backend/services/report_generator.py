import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def generate_hunt_report(client_id: str, results: list) -> str:
    """
    Generates a PDF report for Hunt results.
    Returns the file path to the generated PDF.
    """
    file_path = f"/tmp/hunt_report_{client_id}.pdf"
    
    # In Windows, use local temp or current directory for fallback
    if os.name == 'nt':
        file_path = f"hunt_report_{client_id}.pdf"
        
    c = canvas.Canvas(file_path, pagesize=letter)
    c.drawString(100, 750, f"Hunt Report for Client: {client_id}")
    
    y = 700
    for res in results:
        text = f"- {res.get('hypothesis', 'Unknown')}: {res.get('verdict', 'Unknown')}"
        c.drawString(100, y, text)
        y -= 20
        if y < 50:
            c.showPage()
            y = 750
            
    c.save()
    return file_path

def generate_ioc_report(client_id: str, iocs: list) -> str:
    """
    Generates a PDF report for IOCs.
    Returns the file path to the generated PDF.
    """
    file_path = f"/tmp/ioc_report_{client_id}.pdf"
    
    if os.name == 'nt':
        file_path = f"ioc_report_{client_id}.pdf"
        
    c = canvas.Canvas(file_path, pagesize=letter)
    c.drawString(100, 750, f"IOC Intelligence Report for Client: {client_id}")
    
    y = 700
    for ioc in iocs:
        text = f"- [{ioc.get('type')}] {ioc.get('value')} ({ioc.get('confidence')})"
        c.drawString(100, y, text)
        y -= 20
        if y < 50:
            c.showPage()
            y = 750
            
    c.save()
    return file_path
