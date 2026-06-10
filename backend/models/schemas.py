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
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    vendor_log_sources: Optional[str] = None
    # Splunk
    splunk_url: Optional[str] = None
    splunk_token: Optional[str] = None
    splunk_schema: Optional[str] = None
    splunk_indexes: Optional[str] = None
    splunk_sourcetypes: Optional[str] = None
    splunk_key_fields: Optional[str] = None
    # Microsoft Sentinel
    sentinel_workspace_id: Optional[str] = None
    sentinel_tenant_id: Optional[str] = None
    sentinel_client_id: Optional[str] = None
    sentinel_client_secret: Optional[str] = None
    sentinel_schema: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None
    contact_email: Optional[str] = None
    vendor_log_sources: Optional[str] = None
    # Splunk
    splunk_url: Optional[str] = None
    splunk_token: Optional[str] = None
    splunk_schema: Optional[str] = None
    splunk_indexes: Optional[str] = None
    splunk_sourcetypes: Optional[str] = None
    splunk_key_fields: Optional[str] = None
    # Microsoft Sentinel
    sentinel_workspace_id: Optional[str] = None
    sentinel_tenant_id: Optional[str] = None
    sentinel_client_id: Optional[str] = None
    sentinel_client_secret: Optional[str] = None
    sentinel_schema: Optional[str] = None

class HypothesisCreate(BaseModel):
    client_id: Optional[str] = None
    title: str
    description: str = ""
    tactic: Optional[str] = None
    mitre_id: Optional[str] = None
    mitre_tactic: Optional[str] = None
    splunk_query: Optional[str] = None
    sentinel_kql: Optional[str] = None
    hunting_logic: Optional[str] = None
    source: Optional[str] = "manual"
    status: str = "draft"

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
