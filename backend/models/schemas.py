from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class AuthRequest(BaseModel):
    token: str

class AuthResponse(BaseModel):
    user_id: str
    email: str
    role: str

class ClientCreate(BaseModel):
    name: str
    status: str = "active"

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None

class HypothesisCreate(BaseModel):
    client_id: str
    title: str
    description: str
    tactic: str
    status: str = "pending"

class HuntResultResponse(BaseModel):
    id: str
    hypothesis_id: str
    client_id: str
    executed_at: datetime
    verdict: str
    evidence: str
    analyst_notes: str

class IOCResponse(BaseModel):
    id: str
    client_id: str
    ioc_type: str
    value: str
    confidence: str
    threat_actor: Optional[str] = None
    report_date: datetime
