import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

res = s.table('hypotheses').select('*').order('created_at', desc=True).limit(10).execute()
print(f"Total returned: {len(res.data)}")
for h in res.data:
    print(f"[{h.get('created_at')[:19]}] {h.get('title')[:50]}")
