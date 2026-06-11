import os
import sys
import json
import uuid
import time
import asyncio
import httpx
import argparse
from dotenv import load_dotenv

# Add backend directory to sys.path so we can import services
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from services.hypothesis_ai_service import hypothesis_ai_service
from services.embedding_service import embedding_service
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def run_pipeline(mode: str):
    start_time = time.time()
    print(f"--- Starting Full Pipeline in mode: {mode} ---")

    # STEP 1: Fetch from Supabase
    print("\n[STEP 1] Fetching from Supabase...")
    res = supabase.table("hypotheses").select("id, name, description, mitre_id, mitre_name, query, false_positive, hunting_logic").execute()
    all_hypotheses = res.data or []
    
    complete = []
    incomplete = []
    existing_names = set()
    
    for h in all_hypotheses:
        name = h.get("name", "")
        if name:
            existing_names.add(name)
            
        # Check if any field is empty
        fields_to_check = ["name", "description", "mitre_id", "mitre_name", "query", "false_positive", "hunting_logic"]
        is_complete = True
        for f in fields_to_check:
            val = h.get(f)
            if val is None or str(val).strip() == "":
                is_complete = False
                break
                
        if is_complete:
            complete.append(h)
        else:
            incomplete.append(h)
            
    print(f"Complete: {len(complete)} | Needs enrichment: {len(incomplete)}")

    new_from_github = []

    # STEP 2: GitHub Import
    if mode in ["all", "import-only"]:
        print("\n[STEP 2] Importing from GitHub...")
        config_path = os.path.join(BASE_DIR, "config", "github_repos.json")
        repos = []
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                repos = json.load(f)
        
        headers = {}
        if GITHUB_TOKEN and GITHUB_TOKEN != "your_github_token":
            headers["Authorization"] = f"token {GITHUB_TOKEN}"
            
        async with httpx.AsyncClient() as client:
            for repo in repos:
                repo_url = repo.get("url")
                # Parse the GitHub repository tree
                api_url = repo_url.replace("https://github.com/", "https://api.github.com/repos/") + "/git/trees/main?recursive=1"
                try:
                    resp = await client.get(api_url, headers=headers)
                    if resp.status_code == 200:
                        tree = resp.json().get("tree", [])
                        for item in tree:
                            path = item.get("path", "")
                            if path.endswith(".yml") or path.endswith(".yaml") or path.endswith(".toml") or path.endswith(".md"):
                                doc_name = path.split("/")[-1]
                                if doc_name not in existing_names:
                                    new_hyp = {
                                        "id": str(uuid.uuid4()),
                                        "name": doc_name,
                                        "description": "",
                                        "mitre_id": "",
                                        "mitre_name": "",
                                        "query": "",
                                        "false_positive": "",
                                        "hunting_logic": ""
                                    }
                                    new_from_github.append(new_hyp)
                                    incomplete.append(new_hyp)
                                    existing_names.add(doc_name)
                except Exception as e:
                    print(f"Error fetching repo {repo_url}: {e}")
                    
        print(f"Imported {len(new_from_github)} new from GitHub")

    # STEP 3: Enrich incomplete
    enriched_count = 0
    if mode in ["all", "enrich-only"]:
        print("\n[STEP 3] Enriching incomplete hypotheses...")
        for i, hyp in enumerate(incomplete):
            # The hypothesis_ai_service handles the 429 logic via llm_service
            enriched_hyp = await hypothesis_ai_service.enrich_hypothesis(hyp)
            hyp.update(enriched_hyp)
            enriched_count += 1
            
            if enriched_count % 50 == 0:
                print(f"Progress: Enriched {enriched_count} / {len(incomplete)}")
                
            await asyncio.sleep(0.5)
            
        print(f"Enriched {enriched_count} hypotheses")

    # STEP 4: Upsert to Supabase
    print("\n[STEP 4] Saving to Supabase...")
    saved_count = 0
    records_to_upsert = complete + incomplete
    
    if mode in ["all", "enrich-only", "import-only"]:
        batch_size = 100
        for i in range(0, len(records_to_upsert), batch_size):
            batch = records_to_upsert[i:i+batch_size]
            try:
                supabase.table("hypotheses").upsert(batch).execute()
                saved_count += len(batch)
            except Exception as e:
                print(f"Error saving to Supabase: {e}")
                
    print(f"Saved {saved_count} to Supabase")

    # STEP 5: Sync all to ChromaDB
    if mode in ["all", "sync-only"]:
        print("\n[STEP 5] Syncing to ChromaDB...")
        # Fetch fresh complete list after upserts
        res = supabase.table("hypotheses").select("*").execute()
        all_final = res.data or []
        
        final_complete = []
        for h in all_final:
            fields_to_check = ["name", "description", "mitre_id", "mitre_name", "query", "false_positive", "hunting_logic"]
            if all(h.get(f) and str(h.get(f)).strip() != "" for f in fields_to_check):
                final_complete.append(h)
                
        texts_to_embed = []
        for h in final_complete:
            text = f"{h.get('name')} {h.get('mitre_id')} {h.get('mitre_name')} {h.get('description')} {h.get('hunting_logic')}".strip()
            texts_to_embed.append(text)
            
        if texts_to_embed:
            embeddings = await embedding_service.embed_batch(texts_to_embed, delay=0.5)
            
            documents = []
            for i, h in enumerate(final_complete):
                metadata = {
                    "name": h.get("name", ""),
                    "mitre_id": h.get("mitre_id", ""),
                    "mitre_name": h.get("mitre_name", ""),
                    "false_positive": h.get("false_positive", ""),
                }
                documents.append({
                    "id": str(h.get("id")),
                    "text": texts_to_embed[i],
                    "metadata": metadata
                })
                
            from services.vector_store_service import vector_store
            vector_store.add_documents("hypotheses_global", documents, embeddings)
                
        print(f"Indexed {len(final_complete)} hypotheses into ChromaDB")

    end_time = time.time()
    mins, secs = divmod(end_time - start_time, 60)
    print(f"\n--- Pipeline finished in {int(mins)}m {int(secs)}s ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["all", "enrich-only", "import-only", "sync-only"], default="all")
    args = parser.parse_args()
    
    asyncio.run(run_pipeline(args.mode))
