import os
import datetime
from azure.identity import ClientSecretCredential
from azure.monitor.query import LogsQueryClient
from azure.core.exceptions import HttpResponseError

# Load credentials from environment
def get_sentinel_client():
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    
    if not all([tenant_id, client_id, client_secret]):
        raise ValueError("Azure credentials are not fully configured in the environment.")
        
    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret
    )
    return LogsQueryClient(credential)

def execute_sentinel_query(query: str, earliest: str = "-30d", latest: str = "now") -> dict:
    """
    Executes a KQL query against Microsoft Sentinel (Azure Log Analytics)
    and formats the result exactly like the Splunk service so the frontend
    doesn't break.
    """
    workspace_id = os.getenv("AZURE_WORKSPACE_ID")
    if not workspace_id:
        return {"error": "Azure Workspace ID is not configured."}
        
    try:
        client = get_sentinel_client()
        
        # Mapping simple time ranges (for POC, keeping it simple or None for all time)
        # Ideally you'd parse earliest/latest to datetime.timedelta but LogsQueryClient
        # takes timespan or the query itself handles it. For now, we will pass timespan=None
        # because usually the query handles TimeGenerated, or we just pull the last 30 days.
        from datetime import timedelta
        timespan = timedelta(days=30)
        
        # Execute Query
        response = client.query_workspace(
            workspace_id=workspace_id,
            query=query,
            timespan=timespan
        )
        
        # Parse Results
        results = []
        if response.tables:
            for table in response.tables:
                for row in table.rows:
                    row_dict = dict(zip(table.columns, row))
                    results.append(row_dict)
                    
        total_events = len(results)
        truncated = False
        if total_events > 2000:
            results = results[:2000]
            truncated = True
            
        return {
            "status": "success",
            "query": query,
            "total_events": total_events,
            "returned_events": len(results),
            "truncated": truncated,
            "summary": {"top_hosts": []},  # Can be expanded later
            "events": results,
            "error": None
        }
        
    except HttpResponseError as e:
        return {"error": f"Azure API Error: {e.message}"}
    except Exception as e:
        return {"error": f"Exception: {str(e)}"}
