import os
import sys
import argparse
import zipfile
import io
import re
import requests
from dotenv import load_dotenv
from supabase import create_client

# 1. Load env variables
load_dotenv('backend/.env')

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in backend/.env file.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# URL of the HEARTH repository ZIP archive
HEARTH_ZIP_URL = "https://github.com/THORCollective/HEARTH/archive/refs/heads/main.zip"

def parse_frontmatter(content):
    """
    Parses YAML frontmatter from a markdown file.
    Tries to use PyYAML first, falls back to a regex parser if PyYAML is not available.
    """
    # Find YAML boundaries
    lines = content.splitlines()
    if not lines or not lines[0].startswith('---'):
        return None, content
    
    yaml_lines = []
    body_lines = []
    in_yaml = False
    
    # Track if we've passed the second '---'
    passed_frontmatter = False
    
    for line in lines:
        if line.startswith('---') and not passed_frontmatter:
            if not in_yaml:
                in_yaml = True
                continue
            else:
                in_yaml = False
                passed_frontmatter = True
                continue
        if in_yaml:
            yaml_lines.append(line)
        else:
            body_lines.append(line)
            
    yaml_text = "\n".join(yaml_lines)
    body_text = "\n".join(body_lines).strip()
    
    # Try importing yaml (usually available in crewai environment)
    try:
        import yaml
        data = yaml.safe_load(yaml_text)
        return data, body_text
    except ImportError:
        pass
        
    # Fallback YAML parsing using simple regex
    data = {}
    current_key = None
    
    for line in yaml_lines:
        line_str = line.strip()
        if not line_str:
            continue
            
        # Check if it's a list item
        if line_str.startswith('- '):
            val = line_str[2:].strip("'\" ")
            if current_key and isinstance(data.get(current_key), list):
                data[current_key].append(val)
            continue
            
        # Check if it's a key-value pair
        if ':' in line_str:
            parts = line_str.split(':', 1)
            k = parts[0].strip()
            v = parts[1].strip().strip("'\" ")
            
            # If the value is empty, it might be the start of a list or block
            if not v:
                data[k] = []
                current_key = k
            else:
                data[k] = v
                current_key = None
                
    return data, body_text

def get_existing_hearth_ids():
    """Retrieves all global HEARTH IDs already imported."""
    try:
        res = supabase.table('hypotheses').select('created_by').is_('client_id', 'null').execute()
        existing_ids = set()
        for h in res.data or []:
            cb = h.get('created_by')
            if cb and cb.startswith('HEARTH-'):
                existing_ids.add(cb.replace('HEARTH-', ''))
        return existing_ids
    except Exception as e:
        print(f"Error fetching existing global hypotheses: {e}")
        return set()

def main():
    parser = argparse.ArgumentParser(description="Import threat hunting hypotheses globally from THORCollective/HEARTH on GitHub.")
    parser.add_argument("--status", default="approved", choices=["draft", "approved", "running", "complete"], 
                        help="Status to assign to imported hypotheses (default: approved)")
    args = parser.parse_args()

    print(f"Importing hypotheses globally...")
    print(f"Status assigned: {args.status}")

    # Step 1: Download the HEARTH repository ZIP archive
    print(f"\nDownloading HEARTH repository archive from GitHub...")
    try:
        r = requests.get(HEARTH_ZIP_URL, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"Failed to download repository: {e}")
        sys.exit(1)
        
    print("Download complete. Extracting files...")
    z = zipfile.ZipFile(io.BytesIO(r.content))
    
    # Filter for md files in Flames, Embers, and Alchemy directories
    md_files = [n for n in z.namelist() if n.endswith(".md") and ("/Flames/" in n or "/Embers/" in n or "/Alchemy/" in n)]
    print(f"Found {len(md_files)} hypothesis files in archive.")

    # Step 2: Fetch existing global HEARTH hypotheses to prevent duplicates
    existing_ids = get_existing_hearth_ids()
    print(f"Already imported globally: {len(existing_ids)} hypotheses")
    
    new_hypotheses = []
    skipped_count = 0
    
    for file_path in md_files:
        try:
            content = z.read(file_path).decode('utf-8')
            yaml_data, body = parse_frontmatter(content)
            if not yaml_data:
                continue
                
            hearth_id = yaml_data.get('id')
            if not hearth_id:
                continue
                
            # Skip duplicate check
            if hearth_id in existing_ids:
                skipped_count += 1
                continue
                
            hypothesis_title = yaml_data.get('hypothesis', f"Hunt: {hearth_id}")
            notes = yaml_data.get('notes', '')
            category = yaml_data.get('category', 'Flames')
            
            # Format description cleanly with PEAK category and details
            description_parts = []
            description_parts.append(f"**PEAK Framework Category**: {category}")
            description_parts.append(f"**HEARTH ID**: {hearth_id}")
            if notes:
                description_parts.append(f"**Notes**: {notes}")
            if body:
                description_parts.append("\n" + body)
            
            description = "\n\n".join(description_parts)
            
            # Extract tactics and techniques
            tactics = yaml_data.get('tactics', [])
            mitre_tactic = ", ".join(tactics) if isinstance(tactics, list) else str(tactics)
            
            techniques = yaml_data.get('techniques', [])
            mitre_id = ", ".join(techniques) if isinstance(techniques, list) else str(techniques)
            
            new_hypotheses.append({
                "client_id": None, # Global hypothesis
                "title": hypothesis_title,
                "description": description,
                "mitre_tactic": mitre_tactic or None,
                "mitre_id": mitre_id or None,
                "source": "manual",
                "status": args.status,
                "created_by": f"HEARTH-{hearth_id}"
            })
        except Exception as e:
            print(f"Error parsing file {file_path}: {e}")
            
    print(f"Parsed {len(new_hypotheses)} new hypotheses (skipped {skipped_count} duplicates).")
    
    # Step 3: Batch insert in chunks of 50 to Supabase
    if new_hypotheses:
        print(f"Inserting {len(new_hypotheses)} hypotheses globally in batches...")
        inserted_count = 0
        chunk_size = 50
        for i in range(0, len(new_hypotheses), chunk_size):
            chunk = new_hypotheses[i:i+chunk_size]
            try:
                res = supabase.table('hypotheses').insert(chunk).execute()
                inserted_count += len(res.data or chunk)
                print(f"  Inserted {inserted_count}/{len(new_hypotheses)}...")
            except Exception as e:
                print(f"  Error inserting batch starting at index {i}: {e}")
        print(f"Successfully imported {inserted_count} hypotheses globally.")
    else:
        print(f"No new hypotheses to import.")

    print("\nImport process completed successfully!")

if __name__ == "__main__":
    main()
