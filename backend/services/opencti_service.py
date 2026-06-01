import os
import requests

OPENCTI_URL = os.getenv("OPENCTI_URL", "http://VM2-internal-IP:8080")
OPENCTI_TOKEN = os.getenv("OPENCTI_TOKEN", "")

def fetch_iocs_from_opencti(limit: int = 50):
    """
    Fetches Indicators of Compromise (IOCs) from OpenCTI via GraphQL.
    Returns mocked results if token is missing.
    """
    if not OPENCTI_TOKEN:
        # Mocked return
        return [
            {"type": "ip", "value": "192.168.1.100", "confidence": "High", "threat_actor": "APT29"},
            {"type": "domain", "value": "malicious-site.com", "confidence": "Medium", "threat_actor": "Unknown"}
        ]
        
    headers = {
        "Authorization": f"Bearer {OPENCTI_TOKEN}",
        "Content-Type": "application/json"
    }
    
    query = """
    query Indicators($first: Int) {
      indicators(first: $first) {
        edges {
          node {
            id
            name
            pattern_type
            valid_from
            confidence
          }
        }
      }
    }
    """
    
    try:
        response = requests.post(f"{OPENCTI_URL}/graphql", headers=headers, json={"query": query, "variables": {"first": limit}})
        response.raise_for_status()
        
        data = response.json()
        indicators = data.get("data", {}).get("indicators", {}).get("edges", [])
        
        parsed_iocs = []
        for ind in indicators:
            node = ind.get("node", {})
            parsed_iocs.append({
                "type": node.get("pattern_type", "unknown"),
                "value": node.get("name", ""),
                "confidence": "High" if node.get("confidence", 0) > 75 else "Medium",
                "threat_actor": "Unknown" # OpenCTI typically requires deeper relation queries for this
            })
            
        return parsed_iocs
    except Exception as e:
        print(f"OpenCTI fetch failed: {e}")
        return []
