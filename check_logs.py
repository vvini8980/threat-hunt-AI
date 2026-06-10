import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

res = supabase.table('pipeline_logs').select('*').execute()
for log in res.data[-5:]:
    print(f"{log.get('crew_type')} - {log.get('status')} - {log.get('error_msg')}")
