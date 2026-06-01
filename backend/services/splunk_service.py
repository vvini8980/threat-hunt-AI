import os
import requests

SPLUNK_URL = os.getenv("SPLUNK_URL", "https://localhost:8089")
SPLUNK_TOKEN = os.getenv("SPLUNK_TOKEN", "")

def execute_splunk_query(query: str):
    """
    Executes a search query against Splunk via the REST API.
    Returns mocked results for now to avoid breaking without actual splunk creds.
    """
    if not SPLUNK_TOKEN:
        # Mocked return
        return [
            {"_raw": "Mocked raw log indicating potential threat", "source": "win_event_log", "host": "WORKSTATION-01"}
        ]
        
    headers = {
        "Authorization": f"Bearer {SPLUNK_TOKEN}"
    }
    
    # Typical splunk search endpoint:
    # POST /services/search/jobs/export
    # Using output_mode=json
    
    data = {
        "search": f"search {query}",
        "output_mode": "json"
    }
    
    try:
        response = requests.post(f"{SPLUNK_URL}/services/search/jobs/export", headers=headers, data=data, verify=False)
        response.raise_for_status()
        
        # Splunk export endpoint returns multiple JSON objects separated by newlines
        results = []
        for line in response.text.strip().split('\n'):
            if line:
                import json
                try:
                    res = json.loads(line)
                    if "result" in res:
                        results.append(res["result"])
                except Exception:
                    pass
        return results
    except Exception as e:
        print(f"Splunk query failed: {e}")
        return []
