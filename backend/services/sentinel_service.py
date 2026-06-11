"""
Sentinel Service — Microsoft Sentinel (Azure Log Analytics) integration.

Handles:
- Per-client workspace IDs stored in Supabase (falls back to AZURE_WORKSPACE_ID env var)
- Dynamic time range parsing from Splunk-style '-30d', '-7h' strings
- Column name extraction from Azure SDK LogsTable objects
- Frontend-safe error returns (always includes all keys so the UI never crashes)
"""
import os
import datetime
from datetime import timedelta
from azure.identity import ClientSecretCredential
from azure.monitor.query import LogsQueryClient
from azure.core.exceptions import HttpResponseError


def _get_supabase():
    """Lazy import of supabase client to avoid crash on module load if env vars missing."""
    try:
        from services.supabase_client import supabase
        return supabase
    except Exception:
        return None


def _get_workspace_id(client_id: str = None) -> str:
    """
    Returns the Azure workspace ID for the given client.
    First tries the Supabase clients table (sentinel_workspace_id column),
    then falls back to the AZURE_WORKSPACE_ID env var.
    """
    if client_id:
        try:
            supabase = _get_supabase()
            if supabase:
                res = supabase.table("clients").select("sentinel_workspace_id").eq("id", client_id).single().execute()
                if res.data:
                    wid = res.data.get("sentinel_workspace_id")
                    if wid:
                        return wid
        except Exception:
            pass
    return os.getenv("AZURE_WORKSPACE_ID", "")


def _get_sentinel_client() -> LogsQueryClient:
    """Builds an authenticated Azure LogsQueryClient from env vars."""
    tenant_id     = os.getenv("AZURE_TENANT_ID")
    client_id     = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")

    if not all([tenant_id, client_id, client_secret]):
        raise ValueError(
            "Azure credentials not fully configured. "
            "Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in .env"
        )

    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret
    )
    return LogsQueryClient(credential)


def _parse_timespan(earliest: str) -> timedelta:
    """Converts Splunk-style '-30d', '-7h', '-90m' into timedelta. Defaults to 30 days."""
    import re
    if not earliest:
        return timedelta(days=30)
    m = re.match(r'^-?(\d+)([dhm])$', earliest.strip(), re.IGNORECASE)
    if m:
        num, unit = int(m.group(1)), m.group(2).lower()
        if unit == 'd': return timedelta(days=num)
        if unit == 'h': return timedelta(hours=num)
        if unit == 'm': return timedelta(minutes=num)
    return timedelta(days=30)


def _safe_value(val):
    """Convert Azure SDK typed values to JSON-serializable Python primitives."""
    if isinstance(val, datetime.datetime):
        return val.isoformat()
    if isinstance(val, (int, float, bool, str)) or val is None:
        return val
    return str(val)


def _sentinel_error(query: str, message: str) -> dict:
    """Returns a fully-keyed error response that won't crash the frontend."""
    return {
        "status":          "error",
        "query":           query,
        "total_events":    0,
        "returned_events": 0,
        "truncated":       False,
        "summary":         {"top_hosts": []},
        "events":          [],
        "error":           message,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def execute_sentinel_query(
    query:     str,
    earliest:  str = "-30d",
    latest:    str = "now",
    client_id: str = None,
) -> dict:
    """
    Executes a KQL query against Microsoft Sentinel / Azure Log Analytics.
    Returns a dict in the same shape as splunk_service.execute_splunk_query()
    so the frontend and hunt.py don't need special-casing.
    """
    workspace_id = _get_workspace_id(client_id)
    if not workspace_id:
        return _sentinel_error(query, "Azure Workspace ID is not configured. Add sentinel_workspace_id to your client settings or set AZURE_WORKSPACE_ID in .env.")

    try:
        logs_client = _get_sentinel_client()
        timespan    = _parse_timespan(earliest)

        response = logs_client.query_workspace(
            workspace_id=workspace_id,
            query=query,
            timespan=timespan,
        )

        # Build result rows — table.columns may be str or LogsTableColumn objects
        results = []
        if response.tables:
            for table in response.tables:
                col_names = []
                for col in table.columns:
                    col_names.append(col.name if hasattr(col, "name") else str(col))
                for row in table.rows:
                    row_dict = {k: _safe_value(v) for k, v in zip(col_names, row)}
                    results.append(row_dict)

        total_events = len(results)
        truncated    = False
        if total_events > 2000:
            results   = results[:2000]
            truncated = True

        return {
            "status":          "success",
            "query":           query,
            "total_events":    total_events,
            "returned_events": len(results),
            "truncated":       truncated,
            "summary":         {"top_hosts": []},
            "events":          results,
            "error":           None,
        }

    except HttpResponseError as e:
        return _sentinel_error(query, f"Azure API Error: {getattr(e, 'message', str(e))}")
    except ValueError as e:
        return _sentinel_error(query, str(e))
    except Exception as e:
        return _sentinel_error(query, f"Sentinel error: {str(e)}")
