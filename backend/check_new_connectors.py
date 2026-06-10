import os, sys, requests, json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

URL   = os.getenv("OPENCTI_URL", "").rstrip("/")
TOKEN = os.getenv("OPENCTI_TOKEN", "")
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def gql(query):
    r = requests.post(f"{URL}/graphql", headers=headers, json={"query": query}, timeout=20)
    return r.json()

print("=== Checking Connectors via API ===\n")

q = """
{
  connectors {
    id
    name
    active
    updated_at
  }
}
"""
try:
    d = gql(q)
    connectors = d.get("data", {}).get("connectors", [])
    
    if connectors:
        print(f"Found {len(connectors)} total connectors.")
        # Filter to just show the new ones or interesting ones
        targets = ["urlhaus", "alienvault", "threatfox", "cisa"]
        found = False
        for c in connectors:
            name = c.get('name', '').lower()
            if any(t in name for t in targets):
                status = "ACTIVE" if c.get("active") else "INACTIVE"
                print(f"  [{status}] {c.get('name')} (Last update: {str(c.get('updated_at'))[:19]})")
                found = True
        
        if not found:
            print("\nNone of the new connectors (URLhaus, AlienVault, ThreatFox, CISA) are registered in the API!")
    else:
        print("No connectors found at all or error:", d)
except Exception as e:
    print(f"Error querying OpenCTI: {e}")
