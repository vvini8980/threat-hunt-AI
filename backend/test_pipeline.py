import os
import sys
import requests
import time

API_URL = "http://localhost:8000"

def test_pipeline():
    print("--- Starting ThreatHunt CrewAI Pipeline Test ---")
    
    print("\n[Step 1] Ensure your FastAPI backend is running on port 8000.")
    print("Command: uvicorn main:app --reload")
    
    if len(sys.argv) < 2:
        print("\nUsage: python test_pipeline.py <CLIENT_ID>")
        print("Please provide a valid Client UUID from your Supabase database.")
        sys.exit(1)
        
    client_id = sys.argv[1]
    print(f"\n[Step 2] Triggering the Daily Hunt Crew for Client: {client_id}")
    
    try:
        start_time = time.time()
        # This is a synchronous call in FastAPI right now, so it will block until the crew finishes.
        res = requests.post(f"{API_URL}/test-crew/{client_id}/hunt")
        
        if res.status_code == 200:
            print(f"\n✅ SUCCESS! CrewAI Execution Completed.")
            print(f"Response: {res.json()}")
            
            elapsed = time.time() - start_time
            print(f"Time taken: {elapsed:.2f} seconds")
            
            print("\n[Step 3] Go check the React Frontend!")
            print("1. Open the Pipeline Health page to view the execution logs.")
            print("2. Check the Hunt Results page for the newly logged findings.")
        else:
            print(f"\n❌ FAILED. API returned status code: {res.status_code}")
            print(f"Error details: {res.text}")
            
    except Exception as e:
        print(f"\n❌ Connection Failed: {e}")
        print("Could not connect to localhost:8000. Please start your backend.")

if __name__ == "__main__":
    test_pipeline()
