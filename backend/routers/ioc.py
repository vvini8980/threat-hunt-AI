from fastapi import APIRouter, HTTPException
from services.supabase_client import supabase
from services.opencti_service import fetch_iocs_from_opencti
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
        iocs = fetch_iocs_from_opencti(limit=20)
        
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
