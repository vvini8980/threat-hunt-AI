"""
Hunt Router — Executes hypotheses against Splunk, persists results, and runs LLM analysis.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.supabase_client import supabase
from services.splunk_service import execute_splunk_query, test_splunk_connection, build_spl_query_from_schema
from services.sentinel_service import execute_sentinel_query
from services.llm_service import analyze_hunt_results_with_llm, generate_splunk_query, generate_sentinel_kql, fix_siem_query_with_llm
import json
import datetime

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# IOC Hunt — fire a Splunk query directly for a specific indicator
# ──────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel as _BaseModel

class IOCHuntRequest(_BaseModel):
    client_id: str
    ioc_type: str   # IP | DOMAIN | HASH | FILE | URL | EMAIL
    ioc_value: str
    earliest: str = "-30d"
    latest: str = "now"

def _build_ioc_query(ioc_type: str, value: str, schema: str = "") -> str:
    """Build a type-appropriate Splunk query for the given IOC."""
    v = value.replace('"', '\\"')
    t = ioc_type.upper()

    if t in ("IP", "IP ADDRESS"):
        return (
            f'index=* (src_ip="{v}" OR dest_ip="{v}" OR src="{v}" OR dst="{v}" '
            f'OR clientip="{v}" OR remote_addr="{v}")\n'
            f'| eval ioc_match="{v}", ioc_type="IP"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(sourcetype) as sources by src_ip, dest_ip, action\n'
            f'| sort -count'
        )
    elif t in ("DOMAIN", "HOSTNAME", "FQDN"):
        return (
            f'index=* (dest_domain="{v}" OR query="{v}" OR url="*{v}*" '
            f'OR dns_query="{v}" OR domain="{v}")\n'
            f'| eval ioc_match="{v}", ioc_type="DOMAIN"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(sourcetype) as sources by dest_domain, src_ip, action\n'
            f'| sort -count'
        )
    elif t in ("HASH", "MD5", "SHA1", "SHA256", "SHA-256"):
        return (
            f'index=* (file_hash="{v}" OR md5="{v}" OR sha256="{v}" OR sha1="{v}" '
            f'OR FileHash="{v}" OR ProcessGuid="{v}")\n'
            f'| eval ioc_match="{v}", ioc_type="HASH"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(sourcetype) as sources by file_hash, file_name, user\n'
            f'| sort -count'
        )
    elif t in ("FILE", "FILENAME", "FILE NAME"):
        return (
            f'index=* (file_name="{v}" OR FileName="{v}" OR TargetFilename="*{v}*" '
            f'OR process_name="*{v}*" OR Image="*{v}*")\n'
            f'| eval ioc_match="{v}", ioc_type="FILE"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(user) as users by file_name, process_name\n'
            f'| sort -count'
        )
    elif t in ("URL",):
        return (
            f'index=* (url="*{v}*" OR uri="*{v}*" OR request_url="*{v}*")\n'
            f'| eval ioc_match="{v}", ioc_type="URL"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(src_ip) as source_ips by url, status\n'
            f'| sort -count'
        )
    else:
        # Generic fallback
        return (
            f'index=* "{v}"\n'
            f'| eval ioc_match="{v}", ioc_type="{ioc_type}"\n'
            f'| stats count earliest(_time) as first_seen latest(_time) as last_seen '
            f'values(host) as hosts values(sourcetype) as sources\n'
            f'| sort -count'
        )

def _build_ioc_kql_query(ioc_type: str, value: str, schema: str) -> str:
    """Builds an appropriate KQL query for hunting a specific IOC."""
    v = value.replace('"', '\\"')
    t = ioc_type.upper()

    if t in ("IP", "IP ADDRESS"):
        return (
            f"search \"{v}\"\n"
            f"| where RemoteIP == \"{v}\" or DestinationIP == \"{v}\" or SourceIP == \"{v}\" or IPAddress == \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer"
        )
    elif t in ("DOMAIN", "HOSTNAME", "FQDN"):
        return (
            f"search \"{v}\"\n"
            f"| where RemoteUrl contains \"{v}\" or DestinationHostName contains \"{v}\" or Query contains \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer"
        )
    elif t in ("HASH", "MD5", "SHA1", "SHA256", "SHA-256"):
        return (
            f"search \"{v}\"\n"
            f"| where SHA256 == \"{v}\" or SHA1 == \"{v}\" or MD5 == \"{v}\" or FileHash == \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer, FileName"
        )
    elif t in ("FILE", "FILENAME", "FILE NAME"):
        return (
            f"search \"{v}\"\n"
            f"| where FileName contains \"{v}\" or ProcessCommandLine contains \"{v}\" or TargetFileName contains \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer, Account"
        )
    elif t in ("URL",):
        return (
            f"search \"{v}\"\n"
            f"| where Url contains \"{v}\" or RemoteUrl contains \"{v}\" or RequestURL contains \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer"
        )
    else:
        # Generic fallback
        return (
            f"search \"{v}\"\n"
            f"| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type, Computer"
        )


@router.post("/ioc")
def hunt_ioc(req: IOCHuntRequest):
    """
    Directly hunt for a specific IOC (IP/Domain/Hash/File) in the configured SIEM.
    Builds the type-appropriate query and returns results.
    No hypothesis required — fires direct from the Intel Feed.
    """
    try:
        cfg = _get_client_siem_config(req.client_id)
        preferred = cfg["preferred"]
        
        # Build the right query
        if preferred == "sentinel":
            query = _build_ioc_kql_query(req.ioc_type, req.ioc_value, cfg["sentinel_schema"])
        else:
            query = _build_ioc_query(req.ioc_type, req.ioc_value, cfg["splunk_schema"])

        # Execute
        if preferred == "sentinel":
            result = execute_sentinel_query(
                query=query,
                earliest=req.earliest,
                latest=req.latest,
                client_id=req.client_id,
            )
        else:
            result = execute_splunk_query(
                query=query,
                client_id=req.client_id,
                earliest=req.earliest,
                latest=req.latest,
            )

        return {
            "status": "success",
            "ioc_type": req.ioc_type,
            "ioc_value": req.ioc_value,
            "query_used": query,
            "platform_used": preferred,
            "total_events": result.get("total_events", 0),
            "returned_events": result.get("returned_events", 0),
            "events": result.get("events", []),
            "summary": result.get("summary", {}),
            "error": result.get("error"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Helper: load full client SIEM config from Supabase
# ──────────────────────────────────────────────────────────────────────────────
def _get_client_siem_config(client_id: str) -> dict:
    """
    Fetches the client's SIEM configuration from Supabase.

    Routing priority (for platform='auto'):
      1. client.primary_siem field  ← set by the user in Settings page
      2. If both tools configured, primary_siem decides
      3. If only one tool configured, use that one
      4. If nothing configured, fall back to env defaults (mock mode)
    """
    defaults = {
        "has_splunk":    False,
        "has_sentinel":  False,
        "preferred":     "none",
        "primary_siem":  "splunk",
        "splunk_url":    os.getenv("SPLUNK_URL", ""),
        "splunk_token":  os.getenv("SPLUNK_TOKEN", ""),
        "splunk_schema": "",
        "sentinel_workspace_id":  os.getenv("AZURE_WORKSPACE_ID", ""),
        "sentinel_tenant_id":     os.getenv("AZURE_TENANT_ID", ""),
        "sentinel_client_id":     os.getenv("AZURE_CLIENT_ID", ""),
        "sentinel_client_secret": os.getenv("AZURE_CLIENT_SECRET", ""),
    }
    if not supabase or not client_id:
        # No DB — still check env for creds
        defaults["has_splunk"]   = bool(defaults["splunk_url"] and defaults["splunk_token"])
        defaults["has_sentinel"] = bool(defaults["sentinel_workspace_id"])
        if defaults["has_splunk"]:   defaults["preferred"] = "splunk"
        elif defaults["has_sentinel"]: defaults["preferred"] = "sentinel"
        return defaults
    try:
        res = supabase.table("clients").select(
            "splunk_url, splunk_token, splunk_schema, "
            "splunk_indexes, splunk_sourcetypes, splunk_key_fields, "
            "sentinel_workspace_id, sentinel_tenant_id, "
            "sentinel_client_id, sentinel_client_secret, sentinel_schema, "
            "vendor_log_sources, primary_siem"
        ).eq("id", client_id).single().execute()
        d = res.data or {}
        cfg = dict(defaults)

        # ── Splunk creds: DB overrides env ──
        cfg["splunk_url"]    = d.get("splunk_url")    or os.getenv("SPLUNK_URL", "")
        cfg["splunk_token"]  = d.get("splunk_token")  or os.getenv("SPLUNK_TOKEN", "")
        cfg["splunk_schema"] = d.get("splunk_schema") or ""
        cfg["splunk_indexes"] = d.get("splunk_indexes") or ""
        cfg["splunk_sourcetypes"] = d.get("splunk_sourcetypes") or ""
        cfg["splunk_key_fields"] = d.get("splunk_key_fields") or ""

        # ── Sentinel creds: DB overrides env ──
        cfg["sentinel_workspace_id"]  = d.get("sentinel_workspace_id")  or os.getenv("AZURE_WORKSPACE_ID", "")
        cfg["sentinel_tenant_id"]     = d.get("sentinel_tenant_id")     or os.getenv("AZURE_TENANT_ID", "")
        cfg["sentinel_client_id"]     = d.get("sentinel_client_id")     or os.getenv("AZURE_CLIENT_ID", "")
        cfg["sentinel_client_secret"] = d.get("sentinel_client_secret") or os.getenv("AZURE_CLIENT_SECRET", "")
        cfg["sentinel_schema"]        = d.get("sentinel_schema") or ""
        
        cfg["vendor_log_sources"]     = d.get("vendor_log_sources") or ""

        # ── Compute has_* flags ──
        cfg["has_splunk"]   = bool(cfg["splunk_url"] and cfg["splunk_token"])
        cfg["has_sentinel"] = bool(cfg["sentinel_workspace_id"] and cfg["sentinel_tenant_id"])

        # ── Determine preferred platform ──
        # primary_siem from DB is the user's explicit choice in Settings → always honour it
        db_primary = d.get("primary_siem") or "splunk"
        cfg["primary_siem"] = db_primary

        if db_primary == "sentinel" and cfg["has_sentinel"]:
            cfg["preferred"] = "sentinel"
        elif db_primary == "splunk" and cfg["has_splunk"]:
            cfg["preferred"] = "splunk"
        elif cfg["has_splunk"]:
            # primary set to sentinel but no sentinel creds — fall back to splunk
            cfg["preferred"] = "splunk"
        elif cfg["has_sentinel"]:
            cfg["preferred"] = "sentinel"
        else:
            cfg["preferred"] = "none"   # mock mode

        return cfg
    except Exception:
        return defaults


def _get_client_schema(client_id: str) -> str:
    """Returns splunk_schema from clients table, or default empty string."""
    return _get_client_siem_config(client_id).get("splunk_schema", "")


def _save_hunt_result(client_id: str, hypothesis_id: str, splunk_result: dict, status: str = "running") -> dict:
    """
    Persists a hunt result to the hunt_results table and updates hypothesis status.
    Returns the saved record.
    """
    evidence_text = _format_evidence(splunk_result)

    record = {
        "hypothesis_id": hypothesis_id,
        "client_id": client_id,
        "verdict": "clean",
        "evidence": evidence_text,
        "analyst_notes": (
            f"⚠️ Truncated: {splunk_result['total_events']} events matched, "
            f"showing first {splunk_result['returned_events']}."
            if splunk_result.get("truncated") else
            "Awaiting LLM analysis."
        ),
        "executed_at": datetime.datetime.utcnow().isoformat(),
    }

    if supabase:
        saved = supabase.table("hunt_results").insert([record]).execute()
        # Update hypothesis status
        supabase.table("hypotheses").update({"status": status}).eq("id", hypothesis_id).execute()
        return saved.data[0] if saved.data else record

    return record


def _format_evidence(splunk_result: dict) -> str:
    """Formats Splunk results into a readable evidence string for storage."""
    lines = []

    if splunk_result.get("error"):
        return f"❌ Splunk Error: {splunk_result['error']}"

    total  = splunk_result.get("total_events", 0)
    shown  = splunk_result.get("returned_events", 0)
    trunc  = splunk_result.get("truncated", False)

    lines.append(f"📊 Query: {splunk_result.get('query', 'N/A')}")
    lines.append(f"🔍 Total matched: {total} events | Returned: {shown} events")
    if trunc:
        lines.append(f"⚠️  Results truncated to first {shown} events (limit: protect Splunk resources)")
    lines.append("")

    # Summary
    summary = splunk_result.get("summary", {})
    if summary.get("top_hosts"):
        lines.append("📌 Top Hosts:")
        for host, count in summary["top_hosts"][:5]:
            lines.append(f"   {host}: {count} events")
        lines.append("")

    # Events
    events = splunk_result.get("events", [])
    if events:
        lines.append(f"🔎 Sample Events (showing {min(20, len(events))} of {shown}):")
        for i, ev in enumerate(events[:20]):
            lines.append(f"\n--- Event {i + 1} ---")
            for key in ["_time", "host", "sourcetype", "src_ip", "dest_ip", "user",
                        "process_name", "Image", "CommandLine", "EventCode", "_raw"]:
                if key in ev and ev[key]:
                    val = str(ev[key])[:500]  # cap each field at 500 chars
                    lines.append(f"  {key}: {val}")
    else:
        lines.append("✅ No matching events found in the specified time range.")

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/execute/{hypothesis_id}")
def execute_hunt(
    hypothesis_id: str,
    client_id: Optional[str] = Query(default=None),
    earliest: str = Query(default="-30d"),
    latest: str   = Query(default="now"),
    platform: str = Query(default="auto"),
):
    """
    Executes the stored SPL query for a hypothesis against Splunk.
    Persists results to hunt_results table.
    Falls back to schema-aware query generation if no query is stored.
    """
    if not supabase:
        return {"status": "mocked", "message": "Supabase not configured"}

    try:
        # Fetch hypothesis
        hyp_res = supabase.table("hypotheses").select("*").eq("id", hypothesis_id).execute()
        if not hyp_res.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")

        hypothesis = hyp_res.data[0]
        active_client_id = client_id or hypothesis.get("client_id")
        if not active_client_id:
            raise HTTPException(status_code=400, detail="client_id must be provided for global hypotheses.")
            
        cfg = _get_client_siem_config(active_client_id)
        schema = cfg["splunk_schema"]

        # ── Platform resolution ────────────────────────────────────────────────
        if platform == "auto":
            preferred = cfg["preferred"]
            
            if preferred == "sentinel":
                query = hypothesis.get("sentinel_kql") or ""
                platform = "sentinel"
            else:
                query = hypothesis.get("splunk_query") or ""
                platform = "splunk"
        elif platform == "sentinel":
            query = hypothesis.get("sentinel_kql") or ""
            platform = "sentinel"
        else:
            query = hypothesis.get("splunk_query") or ""
            platform = "splunk"

        # ── Fallback query generation (if no query is saved) ───────────────────
        generated_query = False
        if not query or len(query.strip()) < 10:
            generated_query = True
            if platform == "sentinel":
                query = generate_sentinel_kql(
                    title=hypothesis.get("title", "Unknown Hunt"),
                    description=hypothesis.get("description", ""),
                    hunting_logic=hypothesis.get("hunting_logic", ""),
                    mitre_id=hypothesis.get("mitre_id", ""),
                    sentinel_schema=cfg.get("sentinel_schema", ""),
                    vendor_log_sources=cfg.get("vendor_log_sources", ""),
                )
            else:
                query = generate_splunk_query(
                    title=hypothesis.get("title", "Unknown Hunt"),
                    description=hypothesis.get("description", ""),
                    hunting_logic=hypothesis.get("hunting_logic", ""),
                    mitre_id=hypothesis.get("mitre_id", ""),
                    splunk_schema=cfg.get("splunk_schema", ""),
                    splunk_indexes=cfg.get("splunk_indexes", ""),
                    splunk_sourcetypes=cfg.get("splunk_sourcetypes", ""),
                    splunk_key_fields=cfg.get("splunk_key_fields", ""),
                    vendor_log_sources=cfg.get("vendor_log_sources", ""),
                )

        # ── Execute ────────────────────────────────────────────────────────────
        def _run_query(q):
            if platform == "sentinel":
                return execute_sentinel_query(
                    query=q, earliest=earliest, latest=latest, client_id=active_client_id
                )
            else:
                return execute_splunk_query(
                    query=q, client_id=active_client_id, earliest=earliest, latest=latest
                )

        result = _run_query(query)

        # ── Auto-Correction / Self-Healing (Up to 5 retries) ───────────────────
        retries = 0
        max_retries = 5
        while result.get("error") and retries < max_retries:
            schema_block = cfg.get("sentinel_schema", "") if platform == "sentinel" else cfg.get("splunk_schema", "")
            fixed_query = fix_siem_query_with_llm(
                bad_query=query,
                error_message=result["error"],
                schema_block=schema_block,
                platform=platform
            )
            
            # Break early if the AI gave up or didn't change anything
            if not fixed_query or fixed_query.strip() == query.strip():
                break
                
            query = fixed_query
            generated_query = True  # Flag as generated so the fix saves to the DB
            result = _run_query(query)
            retries += 1

        # ── Save generated query ONLY if successful ────────────────────────────
        if generated_query:
            if not result.get("error"):
                if supabase:
                    field = "sentinel_kql" if platform == "sentinel" else "splunk_query"
                    supabase.table("hypotheses").update({field: query, "status": "active" if result.get("total_events", 0) > 0 else "complete"}).eq("id", hypothesis_id).execute()
            else:
                result["error"] += f"\n(Note: The AI attempted to write/fix this query but it still failed execution after {retries} attempts. Please manually edit the Hypothesis to fix the query.)"
                if supabase:
                    supabase.table("hypotheses").update({"status": "error"}).eq("id", hypothesis_id).execute()

        # Persist result
        saved = _save_hunt_result(active_client_id, hypothesis_id, result, status="complete")

        return {
            "status": "success",
            "hunt_result_id": saved.get("id"),
            "total_events": result["total_events"],
            "returned_events": result["returned_events"],
            "truncated": result["truncated"],
            "summary": result["summary"],
            "events": result["events"],
            "error": result.get("error"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-with-query/{hypothesis_id}")
def execute_hunt_with_custom_query(
    hypothesis_id: str,
    payload: dict,
):
    """
    Executes a custom SPL query for a hypothesis (used by the UI 'Hunt in Logs' button).
    Expects: {"query": "...", "earliest": "-7d", "latest": "now"}
    """
    if not supabase:
        return {"status": "mocked"}

    try:
        query    = payload.get("query", "")
        earliest = payload.get("earliest", "-30d")
        latest   = payload.get("latest", "now")
        platform = payload.get("platform", "auto")

        hyp_res = supabase.table("hypotheses").select("client_id").eq("id", hypothesis_id).execute()
        if not hyp_res.data:
            raise HTTPException(status_code=404, detail="Hypothesis not found")

        client_id = payload.get("client_id") or hyp_res.data[0]["client_id"]
        if not client_id:
            raise HTTPException(status_code=400, detail="client_id is required for custom query execution on global hypotheses.")

        if not query:
            raise HTTPException(status_code=400, detail="No query provided.")

        if platform == "auto":
            cfg = _get_client_siem_config(client_id)
            preferred = cfg["preferred"]
            
            # Since this is a custom query, we just look at the query syntax if both are configured
            if preferred == "sentinel" or preferred == "splunk":
                # For custom query, if we prefer sentinel and they typed a query, we have to guess if it's KQL
                kql_keywords = ["summarize", "extend", "project", "let ", "datatable", "timegenerated", "ingestiontime"]
                is_kql = any(kw in query.lower() for kw in kql_keywords)
                # But honor the preferred if it matches
                if preferred == "sentinel" and is_kql:
                    platform = "sentinel"
                elif preferred == "splunk" and not is_kql:
                    platform = "splunk"
                else:
                    platform = "sentinel" if is_kql else "splunk"
            else:
                 platform = "splunk"
        
        if platform == "sentinel":
            result = execute_sentinel_query(query=query, earliest=earliest, latest=latest, client_id=client_id)
        else:
            result = execute_splunk_query(query=query, client_id=client_id, earliest=earliest, latest=latest)
            
        saved  = _save_hunt_result(client_id, hypothesis_id, result, status="complete")

        return {
            "status": "success",
            "hunt_result_id": saved.get("id"),
            "total_events": result["total_events"],
            "returned_events": result["returned_events"],
            "truncated": result["truncated"],
            "summary": result["summary"],
            "events": result["events"],
            "error": result.get("error"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-query")
def test_query(payload: dict):
    """
    Lightweight endpoint to test a query without saving it to the database.
    Expects: {"client_id": "...", "query": "...", "earliest": "-30d", "latest": "now", "platform": "auto"}
    """
    try:
        query = payload.get("query", "").strip()
        client_id = payload.get("client_id", "")
        earliest = payload.get("earliest", "-30d")
        latest = payload.get("latest", "now")
        platform = payload.get("platform", "auto")

        if not query:
            raise HTTPException(status_code=400, detail="No query provided.")
            
        if platform == "auto":
            cfg = _get_client_siem_config(client_id)
            kql_keywords = ["summarize", "extend", "project", "let ", "datatable", "timegenerated", "ingestiontime"]
            is_kql = any(kw in query.lower() for kw in kql_keywords)
            if cfg["preferred"] == "sentinel":
                platform = "sentinel"
            elif cfg["preferred"] == "splunk":
                platform = "splunk"
            else:
                platform = "sentinel" if is_kql else "splunk"

        if platform == "sentinel":
            result = execute_sentinel_query(query=query, earliest=earliest, latest=latest, client_id=client_id)
        else:
            if not client_id:
                raise HTTPException(status_code=400, detail="client_id is required for Splunk queries.")
            result = execute_splunk_query(query=query, client_id=client_id, earliest=earliest, latest=latest)

        return {
            "status": "success",
            "platform": platform,
            "total_events": result.get("total_events", 0),
            "returned_events": result.get("returned_events", 0),
            "events": result.get("events", []),
            "error": result.get("error"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{client_id}")
def get_hunt_results(client_id: str, limit: int = Query(default=100)):
    """Returns all hunt results for a client, newest first."""
    if not supabase:
        return []
    try:
        response = (
            supabase.table("hunt_results")
            .select("*, hypotheses(*)")
            .eq("client_id", client_id)
            .order("executed_at", desc=True)
            .limit(limit)
            .execute()
        )
        # Normalize hypothesis data: support both 'title' and 'hypoName' column names
        results = []
        for row in (response.data or []):
            hypo = row.get("hypotheses") or {}
            row["_hypo_title"]    = hypo.get("title") or hypo.get("hypoName") or "Unknown Hypothesis"
            row["_hypo_mitre_id"] = hypo.get("mitre_id") or hypo.get("mitreId") or ""
            row["_hypo_query"]    = hypo.get("splunk_query") or hypo.get("splunkSPL") or ""
            results.append(row)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/{result_id}")
def analyze_hunt(result_id: str):
    """Triggers LLM analysis for a hunt result to determine TP/FP/Clean."""
    if not supabase:
        return {"status": "analyzed"}

    try:
        res = supabase.table("hunt_results").select("*, hypotheses(*)").eq("id", result_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Hunt result not found")

        hunt_result = res.data[0]
        hypothesis  = hunt_result.get("hypotheses", {})
        context     = f"Title: {hypothesis.get('title')}\nMITRE: {hypothesis.get('mitre_id')}\nDescription: {hypothesis.get('description', '')[:500]}"
        raw_evidence = hunt_result.get("evidence", "")

        analysis_text = analyze_hunt_results_with_llm(context, raw_evidence)

        verdict = "clean"
        if "VERDICT: TP" in analysis_text.upper() or "TRUE POSITIVE" in analysis_text.upper():
            verdict = "TP"
        elif "VERDICT: FP" in analysis_text.upper() or "FALSE POSITIVE" in analysis_text.upper():
            verdict = "FP"

        update_res = supabase.table("hunt_results").update({
            "verdict": verdict,
            "analyst_notes": analysis_text,
        }).eq("id", result_id).execute()

        return update_res.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/splunk/test")
def splunk_test_connection(payload: dict):
    """
    Tests Splunk connectivity with provided URL and token.
    Body: {"url": "...", "token": "..."}
    """
    url   = payload.get("url", "").strip()
    token = payload.get("token", "").strip()

    if not url or not token:
        raise HTTPException(status_code=400, detail="url and token are required")

    result = test_splunk_connection(url, token)
    if result["ok"]:
        return {"status": "ok", "message": result["message"]}
    raise HTTPException(status_code=400, detail=result["message"])


# ──────────────────────────────────────────────────────────────────────────────
# Background executor (existing trigger-executor flow)
# ──────────────────────────────────────────────────────────────────────────────
import threading
from agents.crew_definitions import get_hunt_execution_crew


def _run_hunt_executor_background(client_id: str, log_id: str):
    try:
        crew = get_hunt_execution_crew(client_id)
        crew.kickoff()
        supabase.table("pipeline_logs").update({"status": "success"}).eq("id", log_id).execute()
    except Exception as e:
        supabase.table("pipeline_logs").update({"status": "failed", "error_msg": str(e)}).eq("id", log_id).execute()


@router.post("/trigger-executor/{client_id}")
def trigger_hunt_executor(client_id: str):
    """Triggers the CrewAI Hunt Executor for all approved hypotheses."""
    if not supabase:
        return {"status": "mocked"}
    try:
        res = supabase.table("hypotheses").select("id").or_(f"client_id.eq.{client_id},client_id.is.null").eq("status", "approved").execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="No approved hypotheses found.")

        log_res = supabase.table("pipeline_logs").insert({
            "client_id": client_id, "crew_type": "Hunt Executor", "status": "started"
        }).execute()
        log_id = log_res.data[0]["id"]

        thread = threading.Thread(target=_run_hunt_executor_background, args=(client_id, log_id))
        thread.start()

        return {"status": "started", "message": "Hunt Executor Crew is running."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fallback_query_from_schema(schema: str, tactic: str) -> str:
    """
    Builds a minimal but schema-correct fallback query when no SPL is stored.
    """
    if not schema:
        return f'index=* "{tactic}"'

    indexes = []
    for line in schema.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        import re
        m = re.search(r'index=(\S+)', line, re.IGNORECASE)
        if m:
            indexes.append(m.group(1))

    if not indexes:
        return f'index=* "{tactic}"'

    idx_filter = " OR ".join([f'index="{i}"' for i in set(indexes)])
    keyword    = tactic.replace('"', '').strip()
    return f'({idx_filter}) "{keyword}" | stats count values(host) AS hosts earliest(_time) AS first_seen by sourcetype | sort -count'


def _fallback_kql_query_from_schema(schema: str, tactic: str) -> str:
    """
    Builds a minimal but schema-correct fallback KQL query when no KQL is stored.
    Extracts table names from the user's Sentinel schema definition.
    """
    keyword = tactic.replace('"', '').strip()
    if not schema:
        return f'search "{keyword}"\n| summarize count() by Type, Computer'

    tables = []
    import re
    for line in schema.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Heuristic: the first word of a line in the schema text box is usually the table name (e.g. "SecurityEvent -- Windows...")
        table = line.split()[0]
        # Ignore things that look like descriptions or generic words
        if re.match(r'^[A-Za-z0-9_]+$', table) and table.lower() not in ('use', 'admin', 'index', 'sourcetype', 'note', 'the'):
            tables.append(table)

    if not tables:
        return f'search "{keyword}"\n| summarize count() by Type, Computer'

    # Create a targeted search across all discovered tables
    table_list = ", ".join(set(tables))
    return f'search in ({table_list}) "{keyword}"\n| summarize count(), min(TimeGenerated), max(TimeGenerated) by Type'


from services.llm_service import analyze_logs_with_ollama, analyze_logs_with_gemini

@router.post("/analyze-logs-cloud")
def analyze_logs_cloud(payload: dict):
    """
    Sends logs to Google Gemini for blazing-fast Cloud AI analysis.
    """
    try:
        query = payload.get("query", "No query provided")
        events = payload.get("events", [])
        gemini_api_key = payload.get("gemini_api_key")
        
        analysis_result = analyze_logs_with_gemini(query, events, api_key=gemini_api_key)
        return {"analysis": analysis_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-logs-local")
def analyze_logs_local(payload: dict):
    """
    Sends logs directly to a user-provided Ollama URL (Oracle Cloud) for analysis.
    """
    try:
        ollama_url = payload.get("ollama_url")
        query = payload.get("query", "No query provided")
        events = payload.get("events", [])
        
        if not ollama_url:
            raise HTTPException(status_code=400, detail="Ollama URL is required")
            
        analysis_result = analyze_logs_with_ollama(ollama_url, query, events)
        return {"analysis": analysis_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
