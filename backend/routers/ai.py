from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.hypothesis_ai_service import hypothesis_ai_service
from services.ioc_ai_service import ioc_ai_service

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])

# Request Models
class SearchHypothesisRequest(BaseModel):
    query: str
    client_slug: Optional[str] = None

class SuggestHypothesisRequest(BaseModel):
    tactic: str
    technique: str

class ScoreHypothesisRequest(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = ""
    mitre_id: Optional[str] = ""
    mitre_name: Optional[str] = ""
    hunting_logic: Optional[str] = ""
    false_positive: Optional[str] = ""

class EnrichHypothesisRequest(BaseModel):
    hypothesis: Dict[str, Any]

class SearchIOCRequest(BaseModel):
    query: str
    client_slug: str

class EnrichIOCRequest(BaseModel):
    ioc_value: str
    ioc_type: str

# Endpoints
@router.post("/hypothesis/search")
async def search_hypothesis(req: SearchHypothesisRequest):
    return await hypothesis_ai_service.search_similar(
        query=req.query,
        client_slug=req.client_slug
    )

@router.post("/hypothesis/suggest")
async def suggest_hypothesis(req: SuggestHypothesisRequest):
    return await hypothesis_ai_service.suggest_hypotheses(
        tactic=req.tactic,
        technique=req.technique
    )

@router.post("/hypothesis/score")
async def score_hypothesis(req: ScoreHypothesisRequest):
    return await hypothesis_ai_service.score_hypothesis(
        name=req.name,
        description=req.description,
        mitre_id=req.mitre_id,
        mitre_name=req.mitre_name,
        hunting_logic=req.hunting_logic,
        false_positive=req.false_positive
    )

@router.post("/hypothesis/enrich")
async def enrich_hypothesis(req: EnrichHypothesisRequest):
    return await hypothesis_ai_service.enrich_hypothesis(
        partial=req.hypothesis
    )

@router.post("/ioc/search")
async def search_ioc(req: SearchIOCRequest):
    return await ioc_ai_service.search_iocs(
        query=req.query,
        client_slug=req.client_slug
    )

@router.post("/ioc/enrich")
async def enrich_ioc(req: EnrichIOCRequest):
    return await ioc_ai_service.enrich_ioc(
        ioc_value=req.ioc_value,
        ioc_type=req.ioc_type
    )
