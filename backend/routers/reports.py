from fastapi import APIRouter, HTTPException
from services.supabase_client import supabase
from services.report_generator import generate_hunt_report, generate_ioc_report
from services.email_service import send_report_email
import datetime

router = APIRouter()

@router.post("/hunt/{client_id}")
def create_hunt_report(client_id: str):
    """
    Generates a Hunt PDF report and stores it in Supabase.
    """
    if not supabase: return {"status": "mocked success"}
    
    try:
        # Fetch hunt results
        res = supabase.table("hunt_results").select("*, hypotheses(title)").eq("client_id", client_id).execute()
        results = []
        for row in res.data:
            results.append({
                "hypothesis": row.get("hypotheses", {}).get("title", "Unknown"),
                "verdict": row.get("verdict", "Unknown")
            })
            
        pdf_path = generate_hunt_report(client_id, results)
        
        # In a real setup, we would upload to Supabase Storage and get a URL.
        # Here we mock the URL.
        file_url = f"https://mock-storage.local/{pdf_path}"
        
        record = {
            "client_id": client_id,
            "report_type": "hunt",
            "file_url": file_url,
            "report_date": datetime.datetime.utcnow().isoformat()
        }
        
        db_res = supabase.table("reports").insert([record]).execute()
        return db_res.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ioc/{client_id}")
def create_ioc_report(client_id: str):
    """
    Generates an IOC PDF report and stores it in Supabase.
    """
    if not supabase: return {"status": "mocked success"}
    
    try:
        res = supabase.table("ioc_reports").select("*").eq("client_id", client_id).execute()
        iocs = []
        for row in res.data:
            iocs.append({
                "type": row.get("ioc_type", "Unknown"),
                "value": row.get("value", "Unknown"),
                "confidence": row.get("confidence", "Unknown")
            })
            
        pdf_path = generate_ioc_report(client_id, iocs)
        file_url = f"https://mock-storage.local/{pdf_path}"
        
        record = {
            "client_id": client_id,
            "report_type": "ioc",
            "file_url": file_url,
            "report_date": datetime.datetime.utcnow().isoformat()
        }
        
        db_res = supabase.table("reports").insert([record]).execute()
        return db_res.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send/{client_id}")
def send_reports_to_client(client_id: str):
    """
    Emails the latest reports to the client.
    """
    if not supabase: return {"status": "mocked success"}
    
    try:
        # Fetch client email (assuming client table has email or contact info, we will mock for now)
        client_res = supabase.table("clients").select("*").eq("id", client_id).execute()
        if not client_res.data:
            raise HTTPException(status_code=404, detail="Client not found")
            
        client = client_res.data[0]
        # Fetch latest report
        report_res = supabase.table("reports").select("*").eq("client_id", client_id).order("report_date", desc=True).limit(1).execute()
        
        if not report_res.data:
            raise HTTPException(status_code=404, detail="No reports found for client")
            
        report = report_res.data[0]
        
        # Email would normally download the PDF and attach it.
        # Since we just mocked upload, we can't download.
        
        send_report_email(
            to_email=f"contact@{client['name'].lower().replace(' ', '')}.com",
            subject=f"New {report['report_type']} Report Available",
            body=f"Your new report is available at: {report['file_url']}"
        )
        
        # Update sent_at
        supabase.table("reports").update({"sent_at": datetime.datetime.utcnow().isoformat()}).eq("id", report['id']).execute()
        
        return {"status": "success", "message": "Email sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
