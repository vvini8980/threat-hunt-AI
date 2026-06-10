import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('backend/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Since we don't have a direct raw SQL endpoint via the Supabase python client without RPC,
# I will use a different trick: I will just insert a dummy record and update it, wait, that won't add a column.
print("Cannot easily run DDL via REST API. We will prompt the user to run it in the Supabase UI.")
