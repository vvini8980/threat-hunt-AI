import os
from supabase import create_client, Client
from dotenv import load_dotenv
import datetime

load_dotenv('backend/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Get the first client
client_res = supabase.table("clients").select("id").limit(1).execute()
if not client_res.data:
    print("No clients found in the database. Please create a client first.")
    exit()

client_id = client_res.data[0]["id"]

dummy_iocs = [
    {
        "client_id": client_id,
        "ioc_type": "ip",
        "value": "185.220.101.44",
        "confidence": "High",
        "threat_actor": "APT29",
        "source": "OpenCTI",
        "report_date": datetime.datetime.utcnow().isoformat()
    },
    {
        "client_id": client_id,
        "ioc_type": "domain",
        "value": "login-microsoft-secure.update-server.com",
        "confidence": "High",
        "threat_actor": "Lazarus Group",
        "source": "OpenCTI",
        "report_date": datetime.datetime.utcnow().isoformat()
    },
    {
        "client_id": client_id,
        "ioc_type": "hash",
        "value": "a5d893f4183e20e891b970eb2b978d389a6136d7",
        "confidence": "Medium",
        "threat_actor": "FIN7",
        "source": "OpenCTI",
        "report_date": datetime.datetime.utcnow().isoformat()
    },
    {
        "client_id": client_id,
        "ioc_type": "url",
        "value": "http://103.15.22.11/payload.exe",
        "confidence": "High",
        "threat_actor": "Unknown",
        "source": "OpenCTI",
        "report_date": (datetime.datetime.utcnow() - datetime.timedelta(days=2)).isoformat()
    },
    {
        "client_id": client_id,
        "ioc_type": "ip",
        "value": "45.133.1.109",
        "confidence": "Low",
        "threat_actor": "Sandworm",
        "source": "OpenCTI",
        "report_date": (datetime.datetime.utcnow() - datetime.timedelta(days=5)).isoformat()
    }
]

res = supabase.table("ioc_reports").insert(dummy_iocs).execute()
print(f"Successfully inserted {len(res.data)} dummy IOCs!")
