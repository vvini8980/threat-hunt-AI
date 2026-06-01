from fastapi import APIRouter, HTTPException
from services.supabase_client import supabase
from services.splunk_service import execute_splunk_query
from services.llm_service import analyze_hunt_results_with_llm
import json

router = APIRouter()

@router.post("/execute/{hypothesis_id}")
def execute_hunt(hypothesis_id: str):
    """
    Executes a hunt by querying Splunk based on the hypothesis.
    """
    if not supabase: 
        return {"status": "success", "results": "mocked results"}
        
    try:
        # Fetch hypothesis details to get the tactic/description
        hyp_res = supabase.table("hypotheses").select("*").eq("id", hypothesis_id).execute()
        if not hyp_res.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
            
        hypothesis = hyp_res.data[0]
        client_id = hypothesis.get("client_id")
        
        # A real implementation would translate the hypothesis into a Splunk query.
        # Here we use a generic placeholder query based on the tactic.
        splunk_query = f"index=* sourcetype=* \"{hypothesis.get('tactic')}\""
        
        raw_results = execute_splunk_query(splunk_query)
        
        # Store initial results in supabase
        hunt_record = {
            "hypothesis_id": hypothesis_id,
            "client_id": client_id,
            "verdict": "pending",
            "evidence": json.dumps(raw_results, indent=2) if raw_results else "No evidence found",
            "analyst_notes": "Awaiting LLM analysis"
        }
        
        result_res = supabase.table("hunt_results").insert([hunt_record]).execute()
        return result_res.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/results/{client_id}")
def get_hunt_results(client_id: str):
    """
    Returns all hunt results for a client.
    """
    if not supabase: return []
    try:
        response = supabase.table("hunt_results").select("*, hypotheses(title)").eq("client_id", client_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/{result_id}")
def analyze_hunt(result_id: str):
    """
    Triggers LLM analysis for a given hunt result to determine TP/FP.
    """
    if not supabase: return {"status": "analyzed"}
    
    try:
        # Fetch the result
        res = supabase.table("hunt_results").select("*, hypotheses(*)").eq("id", result_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Hunt result not found")
            
        hunt_result = res.data[0]
        hypothesis = hunt_result.get("hypotheses", {})
        
        context = f"Title: {hypothesis.get('title')}\nDescription: {hypothesis.get('description')}\nTactic: {hypothesis.get('tactic')}"
        raw_evidence = hunt_result.get("evidence", "")
        
        # Call LLM
        analysis_text = analyze_hunt_results_with_llm(context, raw_evidence)
        
        # Parse VERDICT and NOTES
        verdict = "clean"
        notes = analysis_text
        
        if "VERDICT: TP" in analysis_text.upper() or "TRUE POSITIVE" in analysis_text.upper():
            verdict = "TP"
        elif "VERDICT: FP" in analysis_text.upper() or "FALSE POSITIVE" in analysis_text.upper():
            verdict = "FP"
            
        # Update supabase
        update_data = {
            "verdict": verdict,
            "analyst_notes": analysis_text
        }
        
        update_res = supabase.table("hunt_results").update(update_data).eq("id", result_id).execute()
        return update_res.data[0]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
