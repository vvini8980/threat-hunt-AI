from fastapi import APIRouter, HTTPException
from models.schemas import HypothesisCreate
from services.supabase_client import supabase
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class StatusUpdate(BaseModel):
    status: str

class GenerateRequest(BaseModel):
    opencti_url: str = ""
    opencti_token: str = ""

class GenerateQueryRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    hunting_logic: Optional[str] = ""
    mitre_id: Optional[str] = ""
    mitre_tactic: Optional[str] = ""
    client_id: str

@router.get("/{client_id}")
def get_hypotheses(client_id: str):
    """
    Retrieves all hypotheses for a given client (client-specific + global).
    """
    if not supabase: return []
    try:
        response = supabase.table("hypotheses").select("*").or_(f"client_id.eq.{client_id},client_id.is.null").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{client_id}/generate")
def generate_ai_hypotheses(client_id: str, req: GenerateRequest = None):
    """
    Triggers the CrewAI pipeline to fetch OpenCTI intel and draft new hypotheses.
    """
    from agents.crew_definitions import get_hypothesis_generation_crew
    try:
        splunk_schema = "Default Schema (index=*)"
        if supabase:
            try:
                res = supabase.table("clients").select("splunk_schema").eq("id", client_id).single().execute()
                if res.data and res.data.get("splunk_schema"):
                    splunk_schema = res.data["splunk_schema"]
            except Exception as e:
                print(f"Error fetching splunk schema: {e}")
                
            supabase.table("pipeline_logs").insert({
                "client_id": client_id,
                "crew_type": "Hypothesis Generation",
                "status": "started"
            }).execute()

        opencti_url = req.opencti_url if req else ""
        opencti_token = req.opencti_token if req else ""
        crew = get_hypothesis_generation_crew(client_id, splunk_schema, opencti_url, opencti_token)
        crew.kickoff()

        if supabase:
            supabase.table("pipeline_logs").insert({
                "client_id": client_id,
                "crew_type": "Hypothesis Generation",
                "status": "success"
            }).execute()

        return {"status": "success", "message": "AI successfully drafted new hypotheses."}
    except Exception as e:
        if supabase:
            supabase.table("pipeline_logs").insert({
                "client_id": client_id,
                "crew_type": "Hypothesis Generation",
                "status": "failed",
                "error_msg": str(e)
            }).execute()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_hypothesis(hypothesis: HypothesisCreate):
    """
    Creates a new hypothesis.
    """
    if not supabase: return {"id": "mock", **hypothesis.dict()}
    try:
        response = supabase.table("hypotheses").insert([hypothesis.dict(exclude_none=True, exclude_unset=True)]).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class HypothesisUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    mitre_id: Optional[str] = None
    mitre_tactic: Optional[str] = None
    splunk_query: Optional[str] = None
    sentinel_kql: Optional[str] = None
    hunting_logic: Optional[str] = None

@router.patch("/{id}")
def update_hypothesis(id: str, update: HypothesisUpdate):
    """
    Partially updates a hypothesis (edit mode).
    Only the fields explicitly provided are updated.
    """
    if not supabase: return {"id": id, **update.dict(exclude_none=True)}
    try:
        payload = update.dict(exclude_none=True, exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=400, detail="No fields to update.")
        response = supabase.table("hypotheses").update(payload).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-query")
def generate_queries_endpoint(req: GenerateQueryRequest):
    """
    Uses Gemini AI to generate SIEM queries (Splunk SPL and/or Sentinel KQL)
    based on the client's configured SIEMs and their schemas.
    Returns:
      { "splunk_query": str | null, "sentinel_kql": str | null, "siem_type": "splunk"|"sentinel"|"both"|"none" }
    """
    from services.llm_service import generate_splunk_query, generate_sentinel_kql

    # Fetch the client's full SIEM config from Supabase
    client_data = {}
    if supabase:
        try:
            res = supabase.table("clients").select(
                "splunk_url,splunk_token,splunk_schema,splunk_indexes,splunk_sourcetypes,splunk_key_fields,"
                "sentinel_workspace_id,sentinel_tenant_id,sentinel_client_id,sentinel_client_secret,sentinel_schema,vendor_log_sources"
            ).eq("id", req.client_id).single().execute()
            client_data = res.data or {}
        except Exception as e:
            print(f"Error fetching client SIEM config: {e}")

    has_splunk   = bool(client_data.get("splunk_url") and client_data.get("splunk_token"))
    has_sentinel = bool(client_data.get("sentinel_workspace_id"))

    # If neither is configured fall back to generating Splunk only (backward compat)
    if not has_splunk and not has_sentinel:
        has_splunk = True

    result = {"splunk_query": None, "sentinel_kql": None}

    try:
        if has_splunk:
            result["splunk_query"] = generate_splunk_query(
                title=req.title,
                description=req.description or "",
                hunting_logic=req.hunting_logic or "",
                mitre_id=req.mitre_id or "",
                splunk_schema=client_data.get("splunk_schema") or "",
                splunk_indexes=client_data.get("splunk_indexes") or "",
                splunk_sourcetypes=client_data.get("splunk_sourcetypes") or "",
                splunk_key_fields=client_data.get("splunk_key_fields") or "",
                vendor_log_sources=client_data.get("vendor_log_sources") or "",
            )

        if has_sentinel:
            result["sentinel_kql"] = generate_sentinel_kql(
                title=req.title,
                description=req.description or "",
                hunting_logic=req.hunting_logic or "",
                mitre_id=req.mitre_id or "",
                sentinel_schema=client_data.get("sentinel_schema") or "",
                vendor_log_sources=client_data.get("vendor_log_sources") or "",
            )

        if has_splunk and has_sentinel:
            result["siem_type"] = "both"
        elif has_sentinel:
            result["siem_type"] = "sentinel"
        else:
            result["siem_type"] = "splunk"

        # Legacy field for backward compatibility
        result["query"] = result["splunk_query"] or result["sentinel_kql"] or ""

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk")
def create_hypotheses_bulk(hypotheses: List[HypothesisCreate]):
    """
    Creates multiple hypotheses at once (bulk import).
    """
    if not supabase: return [{"id": "mock", **h.dict()} for h in hypotheses]
    try:
        payload = [h.dict(exclude_none=True, exclude_unset=True) for h in hypotheses]
        response = supabase.table("hypotheses").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}/approve")
def approve_hypothesis(id: str):
    """
    Approves a hypothesis.
    """
    if not supabase: return {"id": id, "status": "approved"}
    try:
        response = supabase.table("hypotheses").update({"status": "approved"}).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RejectRequest(BaseModel):
    reason: str

@router.put("/{id}/reject")
def reject_hypothesis(id: str, req: RejectRequest):
    """
    Rejects a hypothesis by setting a rejected_reason.
    Pass an empty string to clear the rejection (reconsider/un-reject).
    """
    if not supabase: return {"id": id, "status": "draft", "rejected_reason": req.reason}
    try:
        update_payload = {"rejected_reason": req.reason}
        # If clearing the rejection, also reset status back to draft
        if not req.reason:
            update_payload["rejected_reason"] = None
            update_payload["status"] = "draft"
        response = supabase.table("hypotheses").update(update_payload).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}/status")
def update_status(id: str, update: StatusUpdate):
    """
    Updates the status of a hypothesis.
    """
    if not supabase: return {"id": id, "status": update.status}
    try:
        response = supabase.table("hypotheses").update({"status": update.status}).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{client_id}/{hypothesis_id}/execute")
def execute_hypothesis_in_splunk(client_id: str, hypothesis_id: str):
    """
    Executes a specific hypothesis query in Splunk directly.
    """
    from services.splunk_service import execute_splunk_query
    try:
        if not supabase:
            raise Exception("Supabase client not initialized")
            
        res = supabase.table("hypotheses").select("splunk_query").eq("id", hypothesis_id).eq("client_id", client_id).single().execute()
        
        if not res.data or not res.data.get("splunk_query"):
            raise Exception("Hypothesis not found or has no query.")
            
        query = res.data["splunk_query"]
        results = execute_splunk_query(query)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Daily Hunt Scheduler ─────────────────────────────

class DailyToggleRequest(BaseModel):
    is_daily: bool

@router.put("/{id}/daily")
def toggle_daily(id: str, req: DailyToggleRequest):
    """
    Pins or unpins a hypothesis from the daily 12 PM hunt schedule.
    """
    if not supabase: return {"id": id, "is_daily": req.is_daily}
    try:
        # Enforce max 10 daily hunts when pinning
        if req.is_daily:
            res = supabase.table("hypotheses").select("id").eq("is_daily", True).execute()
            if res.data and len(res.data) >= 10:
                raise HTTPException(status_code=400, detail="Maximum of 10 daily hunts allowed. Unpin one first.")
        response = supabase.table("hypotheses").update({"is_daily": req.is_daily}).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily/{client_id}/run")
def run_daily_hunts(client_id: str):
    """
    Executes all is_daily=true hypotheses for the given client.
    Called automatically by the frontend at 12 PM, or manually via 'Run Now'.
    """
    from services.splunk_service import execute_splunk_query
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not available")
    try:
        res = supabase.table("hypotheses").select("id, title, splunk_query, sentinel_kql").or_(f"client_id.eq.{client_id},client_id.is.null").eq("is_daily", True).execute()
        daily_hypos = res.data or []
        results = []
        for h in daily_hypos:
            try:
                if h.get("splunk_query"):
                    r = execute_splunk_query(h["splunk_query"])
                    supabase.table("hypotheses").update({"status": "running"}).eq("id", h["id"]).execute()
                    results.append({"id": h["id"], "title": h["title"], "status": "ran", "results_count": len(r) if r else 0})
                else:
                    results.append({"id": h["id"], "title": h["title"], "status": "skipped", "reason": "no query"})
            except Exception as e:
                results.append({"id": h["id"], "title": h["title"], "status": "error", "reason": str(e)})
        return {"ran": len([r for r in results if r["status"] == "ran"]), "results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def delete_hypothesis(id: str):
    """
    Permanently deletes a hypothesis and its associated hunt results.
    """
    if not supabase: return {"deleted": True}
    try:
        response = supabase.table("hypotheses").delete().eq("id", id).execute()
        if response.data is None:
            raise HTTPException(status_code=404, detail="Hypothesis not found")
        return {"deleted": True, "id": id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
