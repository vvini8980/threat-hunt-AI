from fastapi import APIRouter, HTTPException
from services.supabase_client import supabase
from services.opencti_service import fetch_iocs_from_opencti
from services.report_generator import build_ioc_report
import datetime

router = APIRouter()

@router.get("/{client_id}")
def get_iocs(client_id: str):
    """
    Retrieves all IOCs for a client.
    """
    if not supabase: return []
    try:
        response = supabase.table("ioc_reports").select("*").eq("client_id", client_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fetch/{client_id}")
def fetch_and_store_iocs(client_id: str):
    """
    Fetches IOCs from OpenCTI and stores them in Supabase for the client.
    """
    if not supabase: return {"status": "mocked success"}
    
    try:
        iocs = fetch_iocs_from_opencti(client_id=client_id, days_back=1, min_confidence=70)
        
        if not iocs:
            return {"status": "success", "message": "No new IOCs found"}
            
        records = []
        for ioc in iocs:
            records.append({
                "client_id": client_id,
                "ioc_type": ioc["type"],
                "value": ioc["value"],
                "confidence": ioc["confidence"],
                "threat_actor": ioc["threat_actor"],
                "report_date": datetime.datetime.utcnow().isoformat()
            })
            
        res = supabase.table("ioc_reports").insert(records).execute()
        return {"status": "success", "inserted": len(res.data)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/build/{client_id}")
def build_ioc_report_endpoint(client_id: str):
    """
    Builds the aggregated JSON IOC report for the client for today.
    """
    try:
        date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        result = build_ioc_report(client_id, date_str)
        return {"status": "success", "report": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
