import os
import json
import httpx
from services.embedding_service import embedding_service
from services.vector_store_service import vector_store
from services.llm_service import llm_service
from dotenv import load_dotenv

load_dotenv()

OPENCTI_URL = os.getenv("OPENCTI_URL", "http://68.233.108.165:8080")
OPENCTI_TOKEN = os.getenv("OPENCTI_TOKEN")

class IOCAIService:
    async def index_ioc(self, client_slug: str, ioc: dict):
        ioc_id = ioc.get("id")
        ioc_value = ioc.get("value", "")
        ioc_type = ioc.get("type", "")
        confidence = ioc.get("confidence", "")
        description = ioc.get("description", "")
        
        embed_text = f"{ioc_type} {ioc_value} {description}".strip()
        if not embed_text:
            return
            
        embedding = await embedding_service.embed_text(embed_text)
        
        collection_name = f"iocs_{client_slug}"
        
        metadata = {
            "value": ioc_value,
            "type": ioc_type,
            "confidence": confidence,
            "client_slug": client_slug
        }
        
        if not ioc_id:
            ioc_id = str(hash(embed_text))
            
        document = {
            "id": str(ioc_id),
            "text": embed_text,
            "metadata": metadata
        }
        
        vector_store.add_documents(
            collection_name=collection_name,
            documents=[document],
            embeddings=[embedding]
        )

    async def search_iocs(self, query: str, client_slug: str, top_k: int = 5) -> list[dict]:
        query_embedding = await embedding_service.embed_text(query)
        collection_name = f"iocs_{client_slug}"
        
        # No extra filters needed since collection is isolated per client_slug
        results = vector_store.query(
            collection_name=collection_name,
            query_embedding=query_embedding,
            n_results=top_k,
            filters=None 
        )
        
        formatted = []
        for r in results:
            meta = r.get("metadata", {})
            distance = r.get("distance")
            sim_score = 1.0 - distance if distance is not None else 0.0
            
            formatted.append({
                "value": meta.get("value", ""),
                "type": meta.get("type", ""),
                "confidence": meta.get("confidence", ""),
                "similarity_score": sim_score
            })
        return formatted

    async def enrich_ioc(self, ioc_value: str, ioc_type: str) -> dict:
        # First query OpenCTI
        graphql_query = f"""
        query {{
          indicators(filters: {{
            key: "value", 
            values: ["{ioc_value}"]
          }}) {{
            edges {{
              node {{
                id
                name
                description
                confidence
                killChainPhases {{ phase_name }}
                created_by {{ name }}
              }}
            }}
          }}
        }}
        """
        
        graphql_endpoint = f"{OPENCTI_URL.rstrip('/')}/graphql"
        headers = {
            "Authorization": f"Bearer {OPENCTI_TOKEN}",
            "Content-Type": "application/json"
        }
        
        opencti_results = None
        if OPENCTI_TOKEN:
            try:
                # Using httpx for async http requests
                async with httpx.AsyncClient(verify=False) as client:
                    response = await client.post(
                        graphql_endpoint, 
                        json={"query": graphql_query},
                        headers=headers,
                        timeout=10.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        edges = data.get("data", {}).get("indicators", {}).get("edges", [])
                        if edges:
                            opencti_results = edges[0].get("node", {})
            except Exception as e:
                print(f"OpenCTI Query Error: {e}")
            
        if opencti_results:
            kill_chain = [phase.get("phase_name") for phase in opencti_results.get("killChainPhases", [])]
            
            created_by_node = opencti_results.get("created_by")
            created_by = created_by_node.get("name", "Unknown") if isinstance(created_by_node, dict) else "Unknown"
            
            return {
                "found": True,
                "source": "opencti",
                "name": opencti_results.get("name", ioc_value),
                "description": opencti_results.get("description", ""),
                "confidence": opencti_results.get("confidence", 0),
                "kill_chain_phases": kill_chain,
                "created_by": created_by
            }
            
        # Fallback to Groq AI Analysis if not found in OpenCTI
        system_prompt = "You are a threat intelligence analyst."
        user_prompt = f"""Analyse this IOC:
Type: {ioc_type}
Value: {ioc_value}

Return JSON:
{{
  "found": false,
  "source": "ai_analysis",
  "risk_level": "low|medium|high|critical",
  "possible_threat_actor": "str",
  "attack_patterns": ["str"],
  "recommended_action": "str",
  "notes": "str"
}}"""
        
        response_str = await llm_service.generate(system=system_prompt, user=user_prompt, json_mode=True)
        try:
            return json.loads(response_str)
        except json.JSONDecodeError:
            print("Failed to parse JSON from Groq for IOC")
            return {
                "found": False,
                "source": "ai_analysis",
                "risk_level": "unknown",
                "notes": "Failed to analyse due to JSON decode error."
            }

ioc_ai_service = IOCAIService()
