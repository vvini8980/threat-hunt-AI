import os
import sys
from dotenv import load_dotenv

# Add current dir to path to import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.opencti_service import fetch_iocs_from_opencti

if __name__ == "__main__":
    print("Testing OpenCTI Connection...")
    print(f"URL: {os.getenv('OPENCTI_URL')}")
    # Run fetch
    try:
        iocs = fetch_iocs_from_opencti(client_id="6577edb3-b38c-4bdb-a077-035ab89e70be", days_back=365, min_confidence=0)
        print(f"\nSuccess! Fetched {len(iocs)} IOCs from OpenCTI.")
        if len(iocs) > 0:
            print("\nSample IOCs:")
            for i, ioc in enumerate(iocs[:3]):
                print(f"  {i+1}. {ioc}")
    except Exception as e:
        print(f"Failed to fetch: {e}")
