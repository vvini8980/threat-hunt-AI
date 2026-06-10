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
        iocs = fetch_iocs_from_opencti(client_id=client_id, days_back=1, min_confidence=50)
        
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

import os
import google.generativeai as genai
from pydantic import BaseModel

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "mock-key"))

@router.put("/enrich/{ioc_id}")
def enrich_ioc(ioc_id: str):
    """
    Calls Gemini to enrich the IOC with a quick 2-sentence summary.
    """
    if not supabase: return {"status": "mocked", "ai_summary": "Mocked AI Summary for IOC."}
    try:
        # Fetch the IOC details
        res = supabase.table("ioc_reports").select("*").eq("id", ioc_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="IOC not found")
            
        ioc = res.data[0]
        
        # Call Gemini
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"Write a brief, 2-sentence technical summary analyzing the threat implications of the following Indicator of Compromise (IOC).\nType: {ioc['ioc_type']}\nValue: {ioc['value']}\nThreat Actor: {ioc.get('threat_actor', 'Unknown')}\nKeep it concise and focus on what this IOC is typically used for in a cyber attack."
        
        response = model.generate_content(prompt)
        ai_summary = response.text.strip()
        
        # Save to DB
        supabase.table("ioc_reports").update({"ai_summary": ai_summary}).eq("id", ioc_id).execute()
        
        return {"status": "success", "ai_summary": ai_summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/draft-hunt/{ioc_id}")
def draft_hunt_for_ioc(ioc_id: str):
    """
    Calls Gemini to automatically draft a Splunk SPL query for the given IOC and saves it as a draft hypothesis.
    """
    if not supabase: return {"status": "mocked"}
    try:
        res = supabase.table("ioc_reports").select("*").eq("id", ioc_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="IOC not found")
            
        ioc = res.data[0]
        
        # Call Gemini to get SPL
        sys_instruct = "You are a precise SIEM query generator. Your ONLY purpose is to output a single, valid Splunk SPL query string. You must return a JSON object containing a 'splunk_query' key."
        
        # We will enforce JSON parsing
        model = genai.GenerativeModel(
            "gemini-2.5-flash", 
            system_instruction=sys_instruct,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        prompt = f"""Generate an advanced, behavioral Splunk SPL query to hunt for the following Indicator of Compromise (IOC).
IMPORTANT: Do not just write a simple `index=* "{ioc['value']}"` search. You MUST incorporate the known Tactics, Techniques, and Procedures (TTPs) of the specified Threat Actor. 
For example, if the actor is known for lateral movement, correlate the IOC with Windows Event Logs (EventCode=4624). If they are known for exfiltration, look for high byte counts in network logs alongside the IOC.
IOC Type: {ioc['ioc_type']}
IOC Value: {ioc['value']}
Threat Actor: {ioc.get('threat_actor', 'Unknown')}
Output JSON format: {{"splunk_query": "YOUR RAW SPL STRING HERE"}}"""
        
        response = model.generate_content(prompt)
        
        try:
            import json
            parsed = json.loads(response.text)
            splunk_query = parsed.get("splunk_query", "").strip()
        except Exception:
            # Fallback if json parsing fails
            splunk_query = response.text.strip()
            
        # Extra safety cleanup if any markdown snuck into the JSON string
        splunk_query = splunk_query.strip("`").strip()
        if splunk_query.startswith("splunk\n"):
            splunk_query = splunk_query[7:].strip()
        
        title = f"AI Hunt: Detect {ioc['ioc_type'].upper()} {ioc['value']}"
        desc = f"Auto-generated hunt to detect activity related to {ioc.get('threat_actor', 'unknown threat actor')}. Source: OpenCTI Sync."
        
        # Insert as draft hypothesis
        draft_res = supabase.table("hypotheses").insert({
            "client_id": ioc["client_id"],
            "title": title,
            "description": desc,
            "mitre_id": "T1071", # Mocked default
            "mitre_tactic": "Command and Control",
            "source": "ai",
            "status": "draft",
            "splunk_query": splunk_query,
            "created_by": "AI Orchestrator"
        }).execute()
        
        return {"status": "success", "hypothesis_id": draft_res.data[0]["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports/build/{client_id}")
def build_ioc_report_endpoint(client_id: str):
    """
    Builds the aggregated JSON IOC report for the client for today.
    """
    from services.report_generator import build_ioc_report
    try:
        import datetime
        date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        result = build_ioc_report(client_id, date_str)
        return {"status": "success", "report": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
