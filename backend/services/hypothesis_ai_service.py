import os
import json
from services.embedding_service import embedding_service
from services.vector_store_service import vector_store
from services.llm_service import llm_service

class HypothesisAIService:
    COLLECTION = "hypotheses_global"

    async def index_hypothesis(self, hypothesis: dict):
        name = hypothesis.get("name", "")
        description = hypothesis.get("description", "")
        mitre_id = hypothesis.get("mitre_id", "")
        mitre_name = hypothesis.get("mitre_name", "")
        hunting_logic = hypothesis.get("hunting_logic", "")
        false_positive = hypothesis.get("false_positive", "")
        client_slug = hypothesis.get("client_slug", "")
        
        # Build embed text
        embed_text = f"{name} {mitre_id} {mitre_name} {description} {hunting_logic}".strip()
        if not embed_text:
            return
            
        # Get embedding using the external embedding service
        embedding = await embedding_service.embed_text(embed_text)
        
        # Store in vector store
        metadata = {
            "name": name,
            "mitre_id": mitre_id,
            "mitre_name": mitre_name,
            "false_positive": false_positive,
        }
        if client_slug:
            metadata["client_slug"] = client_slug
            
        # Use a hash of the text if no explicit ID is provided
        doc_id = hypothesis.get("id")
        if not doc_id:
            doc_id = str(hash(embed_text))
            
        document = {
            "id": str(doc_id),
            "text": embed_text,
            "metadata": metadata
        }
        
        vector_store.add_documents(
            collection_name=self.COLLECTION,
            documents=[document],
            embeddings=[embedding]
        )

    async def search_similar(self, query: str, client_slug: str = None, top_k: int = 5) -> list[dict]:
        query_embedding = await embedding_service.embed_text(query)
        
        filters = {}
        if client_slug:
            filters["client_slug"] = client_slug
            
        results = vector_store.query(
            collection_name=self.COLLECTION,
            query_embedding=query_embedding,
            n_results=top_k,
            filters=filters if filters else None
        )
        
        formatted = []
        for r in results:
            meta = r.get("metadata", {})
            distance = r.get("distance")
            # Convert cosine distance to a similarity score (1.0 - distance)
            sim_score = 1.0 - distance if distance is not None else 0.0
            
            formatted.append({
                "id": r.get("id"),
                "name": meta.get("name", ""),
                "mitre_id": meta.get("mitre_id", ""),
                "mitre_name": meta.get("mitre_name", ""),
                "false_positive": meta.get("false_positive", ""),
                "similarity_score": sim_score
            })
        return formatted

    async def suggest_hypotheses(self, tactic: str, technique: str) -> list[dict]:
        search_query = f"{tactic} {technique}"
        existing_context = await self.search_similar(search_query, top_k=3)
        
        existing_list_str = "None found."
        if existing_context:
            lines = []
            for i, c in enumerate(existing_context):
                lines.append(f"{i+1}. {c.get('name', '')} ({c.get('mitre_id', '')} - {c.get('mitre_name', '')})")
            existing_list_str = "\n".join(lines)
            
        system_prompt = "You are a senior threat hunting expert."
        user_prompt = f"""Suggest 5 new hunt hypotheses for:
Tactic: {tactic}
Technique: {technique}

Existing hypotheses for context (do not repeat):
{existing_list_str}

Return JSON array:
[{{
  "name": "str",
  "description": "str",
  "mitre_id": "str",
  "mitre_name": "str",
  "hunting_logic": "str",
  "false_positive": "str",
  "priority": "high|medium|low"
}}]"""
        
        response_str = await llm_service.generate(system=system_prompt, user=user_prompt, json_mode=True)
        try:
            return json.loads(response_str)
        except json.JSONDecodeError:
            print("Failed to parse JSON for suggest_hypotheses")
            return []

    async def score_hypothesis(self, name: str, description: str, mitre_id: str, mitre_name: str, hunting_logic: str, false_positive: str) -> dict:
        system_prompt = "You are a senior threat hunting expert."
        user_prompt = f"""Score this threat hunt hypothesis:

Name: {name}
MITRE: {mitre_id} - {mitre_name}
Description: {description}
Hunting Logic: {hunting_logic}
Known False Positives: {false_positive}

Return JSON:
{{
  "specificity": 1-10,
  "detectability": 1-10,
  "risk_coverage": 1-10,
  "false_positive_risk": 1-10,
  "overall": 1-10,
  "reasoning": "str",
  "improvements": ["str"],
  "suggested_log_sources": ["str"]
}}"""
        
        response_str = await llm_service.generate(system=system_prompt, user=user_prompt, json_mode=True)
        try:
            return json.loads(response_str)
        except json.JSONDecodeError:
            print("Failed to parse JSON for score_hypothesis")
            return {}

    async def enrich_hypothesis(self, partial: dict) -> dict:
        # Extract only known/filled fields
        known_fields = {k: v for k, v in partial.items() if v and str(v).strip()}
        all_fields = ["name", "description", "mitre_id", "mitre_name", "query", "false_positive", "hunting_logic"]
        
        # Identify what is missing
        empty_fields = [f for f in all_fields if f not in known_fields]
        
        if not empty_fields:
            return partial # Nothing to enrich
            
        system_prompt = "You are a senior threat hunting expert."
        user_prompt = f"""Complete this threat hunt hypothesis.

Known fields:
{json.dumps(known_fields, indent=2)}

Generate ALL missing fields from this list:
{empty_fields}

Return complete JSON:
{{
  "name": "str",
  "description": "str",
  "mitre_id": "str",
  "mitre_name": "str",
  "query": "str (SPL or KQL SIEM query)",
  "false_positive": "str",
  "hunting_logic": "str"
}}"""
        
        response_str = await llm_service.generate(system=system_prompt, user=user_prompt, json_mode=True)
        try:
            enriched_data = json.loads(response_str)
            # Merge without overwriting existing fields
            for k, v in enriched_data.items():
                if k not in known_fields and v is not None:
                    partial[k] = v
            return partial
        except json.JSONDecodeError:
            print("Failed to parse JSON for enrich_hypothesis")
            return partial

hypothesis_ai_service = HypothesisAIService()
