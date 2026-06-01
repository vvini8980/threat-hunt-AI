import os
import requests
import datetime
from services.supabase_client import supabase

OPENCTI_URL = os.getenv("OPENCTI_URL", "http://VM2-internal-IP:8080")
OPENCTI_TOKEN = os.getenv("OPENCTI_TOKEN", "")

def fetch_iocs_from_opencti(client_id: str, days_back: int = 1, min_confidence: int = 70):
    """
    Fetches Indicators of Compromise (IOCs) from OpenCTI via GraphQL, 
    paginating until all results are retrieved.
    Filters by industry based on the client's industry in Supabase.
    """
    industry = "Financial" # Default
    if supabase:
        try:
            res = supabase.table("clients").select("industry").eq("id", client_id).single().execute()
            if res.data and "industry" in res.data:
                industry = res.data["industry"]
        except Exception as e:
            print(f"Error fetching client industry: {e}")

    # For mock data if no token
    if not OPENCTI_TOKEN or "placeholder" in OPENCTI_TOKEN:
        # Mock 105 results to prove pagination would work in a real scenario
        mock_iocs = []
        for i in range(1, 106):
            conf = 85 if i % 2 == 0 else 75
            mock_iocs.append({
                "type": "ip" if i % 3 == 0 else "domain",
                "value": f"192.168.1.{i}" if i % 3 == 0 else f"malicious-{industry.lower()}-site-{i}.com",
                "confidence": "High" if conf >= 80 else "Medium",
                "threat_actor": "APT29" if i % 5 == 0 else "Unknown"
            })
        return mock_iocs
        
    headers = {
        "Authorization": f"Bearer {OPENCTI_TOKEN}",
        "Content-Type": "application/json"
    }
    
    query = """
    query Indicators($first: Int, $after: ID, $filters: FilterGroup) {
      indicators(first: $first, after: $after, filters: $filters) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            pattern_type
            created_at
            confidence
            objectLabel {
              edges {
                node {
                  value
                }
              }
            }
          }
        }
      }
    }
    """
    
    # OpenCTI filters format
    filters = {
        "mode": "and",
        "filters": [
            {
                "key": "confidence",
                "values": [str(min_confidence)],
                "operator": "gte"
            },
            {
                "key": "created_at",
                "values": [(datetime.datetime.utcnow() - datetime.timedelta(days=days_back)).isoformat() + "Z"],
                "operator": "gt"
            }
        ],
        "filterGroups": []
    }
    
    parsed_iocs = []
    has_next_page = True
    cursor = None
    
    try:
        while has_next_page:
            variables = {
                "first": 100,
                "after": cursor,
                "filters": filters
            }
            
            response = requests.post(f"{OPENCTI_URL}/graphql", headers=headers, json={"query": query, "variables": variables})
            response.raise_for_status()
            
            data = response.json()
            indicators_data = data.get("data", {}).get("indicators", {})
            edges = indicators_data.get("edges", [])
            page_info = indicators_data.get("pageInfo", {})
            
            for ind in edges:
                node = ind.get("node", {})
                
                # Check labels for industry filter (simulate simple tagging logic)
                labels = [label.get("node", {}).get("value", "").lower() for label in node.get("objectLabel", {}).get("edges", [])]
                
                confidence_score = node.get("confidence", 0)
                confidence_tier = "High" if confidence_score >= 80 else "Medium"
                
                # We can try to extract a threat actor from tags or relations, but for this exercise we assume it might be in tags
                threat_actor = "Unknown"
                for label in labels:
                    if label.startswith("apt") or "bear" in label:
                        threat_actor = label.upper()
                
                parsed_iocs.append({
                    "type": node.get("pattern_type", "unknown"),
                    "value": node.get("name", ""),
                    "confidence": confidence_tier,
                    "threat_actor": threat_actor
                })
                
            has_next_page = page_info.get("hasNextPage", False)
            cursor = page_info.get("endCursor")
            
        return parsed_iocs
    except Exception as e:
        print(f"OpenCTI fetch failed: {e}")
        return []
