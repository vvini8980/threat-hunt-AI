from fastapi import APIRouter, HTTPException
from models.schemas import HypothesisCreate
from services.supabase_client import supabase
from pydantic import BaseModel

router = APIRouter()

class StatusUpdate(BaseModel):
    status: str

@router.get("/{client_id}")
def get_hypotheses(client_id: str):
    """
    Retrieves all hypotheses for a given client.
    """
    if not supabase: return []
    try:
        response = supabase.table("hypotheses").select("*").eq("client_id", client_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_hypothesis(hypothesis: HypothesisCreate):
    """
    Creates a new hypothesis.
    """
    if not supabase: return {"id": "mock", **hypothesis.dict()}
    try:
        response = supabase.table("hypotheses").insert([hypothesis.dict()]).execute()
        return response.data[0]
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

@router.put("/{id}/reject")
def reject_hypothesis(id: str):
    """
    Rejects a hypothesis.
    """
    if not supabase: return {"id": id, "status": "rejected"}
    try:
        response = supabase.table("hypotheses").update({"status": "rejected"}).eq("id", id).execute()
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
