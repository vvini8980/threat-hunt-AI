import os
from dotenv import load_dotenv

load_dotenv()

from services.sentinel_service import execute_sentinel_query

if __name__ == "__main__":
    print("Checking Microsoft Sentinel Logs...")
    query = """
    search * 
    | summarize count() by Type
    """
    
    result = execute_sentinel_query(query)
    
    if result.get("error"):
        print("[ERROR]", result["error"])
    else:
        print("[SUCCESS]")
        print(f"Returned {result['returned_events']} table types.")
        for ev in result['events']:
            print(f"Table: {ev.get('Type')} | Count: {ev.get('count_')}")
