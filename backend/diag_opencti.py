import os, sys, requests, json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

URL   = os.getenv("OPENCTI_URL", "").rstrip("/")
TOKEN = os.getenv("OPENCTI_TOKEN", "")
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

def gql(query, variables=None):
    r = requests.post(f"{URL}/graphql", headers=headers,
                      json={"query": query, "variables": variables or {}}, timeout=20)
    return r.json()

print("=== OpenCTI Connectors Status ===\n")

q = """
{
  connectors {
    id
    name
    connector_type
    connector_state
    active
    updated_at
    config {
      connection {
        host
        port
      }
    }
  }
}
"""
d = gql(q)
connectors = d.get("data", {}).get("connectors", [])
errors = d.get("errors", [])

if errors:
    print(f"GraphQL errors: {json.dumps(errors, indent=2)}")
elif not connectors:
    print("No connectors registered yet.")
else:
    print(f"Found {len(connectors)} connector(s):\n")
    for c in connectors:
        status = "ACTIVE" if c.get("active") else "INACTIVE"
        print(f"  [{status}] {c.get('name')}")
        print(f"           type={c.get('connector_type')}  state={c.get('connector_state')}")
        print(f"           updated={str(c.get('updated_at',''))[:19]}")
        print()
