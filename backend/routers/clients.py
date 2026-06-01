from fastapi import APIRouter, HTTPException
from models.schemas import ClientCreate, ClientUpdate
from services.supabase_client import supabase

router = APIRouter()

@router.get("/")
def get_clients():
    """
    Retrieves all clients.
    """
    if not supabase: return []
    try:
        response = supabase.table("clients").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}")
def get_client(id: str):
    """
    Retrieves a single client by ID.
    """
    if not supabase: return {}
    try:
        response = supabase.table("clients").select("*").eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Client not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_client(client: ClientCreate):
    """
    Creates a new client.
    """
    if not supabase: return {"id": "mock", **client.dict()}
    try:
        response = supabase.table("clients").insert([client.dict()]).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}")
def update_client(id: str, client: ClientUpdate):
    """
    Updates an existing client.
    """
    if not supabase: return {"id": id, **client.dict(exclude_unset=True)}
    try:
        update_data = client.dict(exclude_unset=True)
        response = supabase.table("clients").update(update_data).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Client not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
