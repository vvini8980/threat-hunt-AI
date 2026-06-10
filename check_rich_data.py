import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

res = s.table('hypotheses').select('*').order('created_at', desc=True).limit(1).execute()
if res.data:
    h = res.data[0]
    print("Title:", h.get('title'))
    desc = h.get('description', '')
    print("Raw description starts with:", desc[:100])
    try:
        data = json.loads(desc)
        print("Parsed JSON keys:", list(data.keys()))
        if 'parentAttack' in data:
            print("parentAttack keys:", list(data['parentAttack'].keys()))
            # Print parentAttack contents
            print(json.dumps(data['parentAttack'], indent=2)[:1000])
        else:
            print("Full data:")
            print(json.dumps(data, indent=2)[:1000])
    except Exception as e:
        print("Parsing error:", e)
