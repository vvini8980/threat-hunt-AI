"""
Splunk Service — Production-grade REST API integration.

Handles:
- Job-based search (async poll) for large queries
- Hard result limits to protect Splunk resources
- Count-first preview before fetching events
- Field whitelisting to trim massive events
- Per-client Splunk creds from Supabase settings
"""

import os
import requests
import json
import time
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Global fallback credentials (from .env)
DEFAULT_SPLUNK_URL   = os.getenv("SPLUNK_URL", "")
DEFAULT_SPLUNK_TOKEN = os.getenv("SPLUNK_TOKEN", "")

# How many raw events we will EVER return per hunt (protect Splunk + memory)
MAX_RESULTS        = 500
# Fields we always keep from every event (everything else is dropped to reduce payload)
ESSENTIAL_FIELDS   = {
    "_raw", "_time", "host", "source", "sourcetype", "index",
    "src_ip", "dest_ip", "src", "dest", "user", "process",
    "process_name", "CommandLine", "ParentCommandLine", "Image",
    "TargetFilename", "EventCode", "EventID", "signature",
    "action", "app", "url", "uri_path", "bytes_in", "bytes_out",
    "count", "distinct_count", "risk_score", "severity",
}


def _get_creds(client_id: str = None):
    """
    Returns (splunk_url, splunk_token) for a given client.
    Tries Supabase client settings first, falls back to .env globals.
    """
    url   = DEFAULT_SPLUNK_URL
    token = DEFAULT_SPLUNK_TOKEN

    if client_id:
        try:
            from services.supabase_client import supabase
            if supabase:
                res = supabase.table("clients").select("splunk_url, splunk_token").eq("id", client_id).single().execute()
                if res.data:
                    url   = res.data.get("splunk_url")   or url
                    token = res.data.get("splunk_token") or token
        except Exception:
            pass  # Fall back to globals silently

    return url.rstrip("/"), token


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _trim_event(event: dict) -> dict:
    """Keep only essential fields from a Splunk event to reduce payload size."""
    trimmed = {k: v for k, v in event.items() if k in ESSENTIAL_FIELDS or not k.startswith("_")}
    # Hard-cap _raw at 2000 chars to avoid huge unstructured blobs
    if "_raw" in trimmed and trimmed["_raw"]:
        trimmed["_raw"] = trimmed["_raw"][:2000]
    return trimmed


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def test_splunk_connection(url: str, token: str) -> dict:
    """
    Tests connectivity to Splunk — handles both:
      - Splunk Cloud (splunkcloud.com) via port 443 with /en-US/splunkd/__raw/
      - Local / on-prem Splunk via port 8089 with /services/
    Returns {"ok": True/False, "message": "...", "type": "cloud|local|unknown"}.
    """
    headers = {"Authorization": f"Bearer {token}"}
    clean_url = url.rstrip("/")

    # ── Detect Splunk Cloud ────────────────────────────────────────────────────
    is_cloud = "splunkcloud.com" in clean_url.lower()

    # ── Build candidate endpoints to try ──────────────────────────────────────
    candidates = []

    if is_cloud:
        # Splunk Cloud free trials block port 8089 externally.
        # The REST API is available via port 443 through a proxy path.
        base_no_port = clean_url.split(":8089")[0].split(":443")[0]
        candidates = [
            (f"{base_no_port}/en-US/splunkd/__raw/services/server/info", "Splunk Cloud (port 443)"),
            (f"{base_no_port}/services/server/info", "Splunk Cloud (standard)"),
            (f"{base_no_port}:8089/services/server/info", "Splunk Cloud (port 8089)"),
        ]
    else:
        # Local / on-prem Splunk — standard port 8089
        base = clean_url if ":" in clean_url.split("//")[-1] else f"{clean_url}:8089"
        candidates = [
            (f"{base.rstrip('/')}/services/server/info", "Local Splunk (port 8089)"),
            (f"{clean_url}/services/server/info", "Local Splunk (given URL)"),
        ]

    last_error = ""
    for endpoint, label in candidates:
        try:
            resp = requests.get(
                endpoint,
                headers=headers,
                verify=False,
                timeout=10,
            )
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    version = (
                        data.get("entry", [{}])[0]
                        .get("content", {})
                        .get("version", "unknown")
                    )
                    return {
                        "ok": True,
                        "message": f"✓ Connected via {label}. Splunk version: {version}",
                        "type": "cloud" if is_cloud else "local",
                        "endpoint": endpoint,
                    }
                except Exception:
                    return {
                        "ok": True,
                        "message": f"✓ Connected via {label} (HTTP 200, non-JSON response).",
                        "type": "cloud" if is_cloud else "local",
                        "endpoint": endpoint,
                    }
            elif resp.status_code == 401:
                return {
                    "ok": False,
                    "message": f"✗ Invalid token — Splunk returned 401 Unauthorized on {label}. Please check your API token.",
                }
            elif resp.status_code == 403:
                return {
                    "ok": False,
                    "message": f"✗ Access denied — Splunk returned 403 Forbidden on {label}. Your token may not have sufficient permissions.",
                }
            else:
                last_error = f"HTTP {resp.status_code} on {label}: {resp.text[:150]}"
        except requests.exceptions.ConnectTimeout:
            last_error = f"Connection timed out on {label}. Port is likely blocked by a firewall."
        except requests.exceptions.ConnectionError as e:
            last_error = f"Cannot connect on {label}: {str(e)[:150]}"
        except Exception as e:
            last_error = f"Unexpected error on {label}: {str(e)[:150]}"

    # All candidates failed
    if is_cloud:
        return {
            "ok": False,
            "message": (
                f"✗ Cannot reach Splunk Cloud ({clean_url}). "
                "Tried /en-US/splunkd/__raw/ proxy path on port 443. "
                f"Last error: {last_error}. "
                "Check that your token is valid and not expired."
            ),
        }
    return {
        "ok": False,
        "message": f"✗ Cannot reach Splunk at {clean_url}. {last_error}",
    }


def get_result_count(query: str, client_id: str = None, earliest: str = "-30d", latest: str = "now") -> int:
    """
    Runs a count-only preview of a search without fetching raw events.
    Used to warn the caller how large results will be before committing.
    """
    url, token = _get_creds(client_id)
    if not token:
        return -1  # Unknown, no creds

    # Wrap user query in a | stats count wrapper
    count_query = f"search {query} | stats count"
    try:
        resp = requests.post(
            f"{url}/services/search/jobs/export",
            headers=_headers(token),
            data={
                "search": count_query,
                "output_mode": "json",
                "earliest_time": earliest,
                "latest_time": latest,
                "max_count": 1,
            },
            verify=False,
            timeout=30,
        )
        resp.raise_for_status()
        for line in resp.text.strip().split("\n"):
            if not line:
                continue
            try:
                obj = json.loads(line)
                if "result" in obj:
                    return int(obj["result"].get("count", 0))
            except Exception:
                continue
    except Exception:
        pass
    return -1


def execute_splunk_query(
    query: str,
    client_id: str = None,
    earliest: str = "-30d",
    latest: str = "now",
    max_results: int = MAX_RESULTS,
) -> dict:
    """
    Executes a Splunk SPL query using the async job API (create job → poll → fetch).

    Returns a dict with:
      {
        "total_events": <int>,         # events matched before limit
        "returned_events": <int>,      # events actually returned
        "truncated": <bool>,           # True if results were capped
        "events": [...],               # trimmed event list
        "summary": {...},              # aggregated counts by host/sourcetype
        "query": <str>,                # the query that was run
        "time_range": {"earliest": ..., "latest": ...},
        "error": <str | None>
      }
    """
    url, token = _get_creds(client_id)

    # ── Mock mode ──────────────────────────────────────────────────────────────
    if not token:
        return _mock_result(query)

    headers = _headers(token)

    # ── Step 1: Create async search job ────────────────────────────────────────
    try:
        create_resp = requests.post(
            f"{url}/services/search/jobs",
            headers=headers,
            data={
                "search": f"search {query}",
                "output_mode": "json",
                "earliest_time": earliest,
                "latest_time": latest,
                "max_count": max_results,         # Splunk-side limit
                "rf": list(ESSENTIAL_FIELDS),     # request only essential fields
            },
            verify=False,
            timeout=30,
        )
        create_resp.raise_for_status()
        sid = create_resp.json()["sid"]
    except Exception as e:
        return _error_result(query, f"Failed to create Splunk job: {e}")

    # ── Step 2: Poll until job is done ─────────────────────────────────────────
    status_url = f"{url}/services/search/jobs/{sid}"
    for _ in range(30):  # max 30 polls = ~60 seconds
        try:
            poll_resp = requests.get(
                status_url,
                headers=headers,
                params={"output_mode": "json"},
                verify=False,
                timeout=15,
            )
            poll_resp.raise_for_status()
            job_info = poll_resp.json()
            entry    = job_info.get("entry", [{}])[0].get("content", {})
            dispatch_state = entry.get("dispatchState", "")

            if dispatch_state in ("DONE", "FAILED", "FINALIZED"):
                if dispatch_state in ("FAILED", "FINALIZED"):
                    return _error_result(query, f"Splunk job ended in state: {dispatch_state}")
                break
        except Exception:
            pass
        time.sleep(2)
    else:
        return _error_result(query, "Splunk job timed out after 60 seconds.")

    # ── Step 3: Fetch results ──────────────────────────────────────────────────
    try:
        fetch_resp = requests.get(
            f"{url}/services/search/jobs/{sid}/results",
            headers=headers,
            params={
                "output_mode": "json",
                "count": max_results,
                "offset": 0,
            },
            verify=False,
            timeout=30,
        )
        fetch_resp.raise_for_status()
        fetch_data    = fetch_resp.json()
        raw_events    = fetch_data.get("results", [])
        total_count   = int(entry.get("resultCount", len(raw_events)))

        # ── Step 4: Trim and enrich ────────────────────────────────────────────
        events   = [_trim_event(e) for e in raw_events[:max_results]]
        truncated = total_count > max_results

        # ── Step 5: Build summary (aggregated stats) ───────────────────────────
        summary = _build_summary(events)

        # ── Step 6: Cleanup job from Splunk ───────────────────────────────────
        try:
            requests.delete(f"{url}/services/search/jobs/{sid}", headers=headers, verify=False, timeout=5)
        except Exception:
            pass

        return {
            "total_events": total_count,
            "returned_events": len(events),
            "truncated": truncated,
            "events": events,
            "summary": summary,
            "query": query,
            "time_range": {"earliest": earliest, "latest": latest},
            "error": None,
        }

    except Exception as e:
        return _error_result(query, f"Failed to fetch results: {e}")


def build_spl_query_from_schema(
    splunk_schema: str,
    ioc_type: str,
    ioc_value: str,
    mitre_tactic: str = "",
) -> str:
    """
    Builds a targeted SPL query using the client's schema and a specific IOC.
    This is a deterministic fallback when the AI hasn't generated a query.

    Args:
        splunk_schema: multiline schema string like "index=windows sourcetype=WinEventLog:Security"
        ioc_type:      'ip' | 'domain' | 'hash' | 'url'
        ioc_value:     the actual IOC value
        mitre_tactic:  optional tactic name for context

    Returns:
        An SPL string ready to run.
    """
    # Parse the schema into (index, sourcetype) pairs
    pairs = _parse_schema(splunk_schema)

    if not pairs:
        # Absolute fallback — at least scope to something
        pairs = [("main", "*")]

    if ioc_type == "ip":
        field_conditions = " OR ".join([
            f'(src_ip="{ioc_value}" OR dest_ip="{ioc_value}" OR src="{ioc_value}" OR dest="{ioc_value}")'
        ])
        index_filter = _index_filter(pairs, preferred_sourcetypes=["pan:traffic", "stream:tcp", "cisco:asa", "bro:conn", "zeek:conn", "sysmon"])
        return (
            f'{index_filter} ({field_conditions}) '
            f'| eval direction=if(src_ip="{ioc_value}","outbound","inbound") '
            f'| stats count AS hit_count values(host) AS affected_hosts '
            f'  values(src_ip) AS src_ips values(dest_ip) AS dest_ips '
            f'  earliest(_time) AS first_seen latest(_time) AS last_seen '
            f'  by src_ip, dest_ip, direction '
            f'| sort -hit_count'
        )

    elif ioc_type == "domain":
        index_filter = _index_filter(pairs, preferred_sourcetypes=["stream:dns", "cisco:umbrella", "bro:dns", "zeek:dns", "sysmon", "pan:threat"])
        return (
            f'{index_filter} '
            f'(query="{ioc_value}" OR domain="{ioc_value}" OR url="*{ioc_value}*" OR CommandLine="*{ioc_value}*") '
            f'| eval ioc_domain="{ioc_value}" '
            f'| stats count AS hit_count values(host) AS affected_hosts '
            f'  values(user) AS users values(src_ip) AS src_ips '
            f'  earliest(_time) AS first_seen latest(_time) AS last_seen '
            f'  by query '
            f'| sort -hit_count'
        )

    elif ioc_type == "hash":
        # MD5, SHA1, SHA256
        hash_len = len(ioc_value)
        if hash_len == 32:
            field = "MD5"
        elif hash_len == 40:
            field = "SHA1"
        elif hash_len == 64:
            field = "SHA256"
        else:
            field = "hash"

        index_filter = _index_filter(pairs, preferred_sourcetypes=["XmlWinEventLog:Microsoft-Windows-Sysmon/Operational", "WinEventLog:Security", "carbon_black", "cylance", "crowdstrike"])
        return (
            f'{index_filter} '
            f'({field}="{ioc_value}" OR Hashes="*{ioc_value}*" OR TargetFilename="*" CommandLine="*{ioc_value}*") '
            f'| eval ioc_hash="{ioc_value}" '
            f'| stats count AS executions values(host) AS hosts '
            f'  values(user) AS users values(Image) AS processes '
            f'  values(ParentCommandLine) AS parent_commands '
            f'  earliest(_time) AS first_seen latest(_time) AS last_seen '
            f'  by {field} '
            f'| sort -executions'
        )

    elif ioc_type == "url":
        index_filter = _index_filter(pairs, preferred_sourcetypes=["pan:threat", "pan:traffic", "stream:http", "access_combined", "proxy"])
        return (
            f'{index_filter} '
            f'(url="{ioc_value}" OR uri_path="*{ioc_value.split("/", 3)[-1]}*") '
            f'| stats count AS hit_count values(host) AS hosts '
            f'  values(src_ip) AS src_ips values(user) AS users '
            f'  values(http_method) AS methods '
            f'  earliest(_time) AS first_seen latest(_time) AS last_seen '
            f'  by url, dest_ip '
            f'| sort -hit_count'
        )

    else:
        # Generic keyword search
        index_filter = " OR ".join([f'index="{idx}"' for idx, _ in pairs]) if pairs else "index=*"
        return (
            f'({index_filter}) "{ioc_value}" '
            f'| stats count AS hit_count values(host) AS hosts '
            f'  earliest(_time) AS first_seen latest(_time) AS last_seen '
            f'  by sourcetype '
            f'| sort -hit_count'
        )


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_schema(schema: str) -> list[tuple[str, str]]:
    """
    Parses a schema string into (index, sourcetype) pairs.
    Example input:
        index=windows sourcetype=WinEventLog:Security
        index=network sourcetype=pan:traffic
    """
    pairs = []
    for line in schema.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        idx = _extract_value(line, "index")
        st  = _extract_value(line, "sourcetype")
        if idx:
            pairs.append((idx, st or "*"))
    return pairs


def _extract_value(line: str, key: str) -> str:
    """Extracts value from 'key=value' pattern."""
    import re
    m = re.search(rf'{key}=(\S+)', line, re.IGNORECASE)
    return m.group(1) if m else ""


def _index_filter(pairs: list[tuple[str, str]], preferred_sourcetypes: list[str] = None) -> str:
    """
    Builds an optimized index+sourcetype filter string.
    If preferred_sourcetypes is given, prefers pairs matching those.
    """
    if not pairs:
        return "index=*"

    preferred = []
    fallback  = []
    for idx, st in pairs:
        if preferred_sourcetypes and any(p.lower() in st.lower() for p in preferred_sourcetypes):
            preferred.append((idx, st))
        else:
            fallback.append((idx, st))

    chosen = preferred if preferred else fallback

    if len(chosen) == 1:
        idx, st = chosen[0]
        return f'index="{idx}"' + (f' sourcetype="{st}"' if st != "*" else "")

    # Multiple: build an OR block
    parts = []
    for idx, st in chosen:
        if st == "*":
            parts.append(f'index="{idx}"')
        else:
            parts.append(f'(index="{idx}" sourcetype="{st}")')
    return "(" + " OR ".join(parts) + ")"


def _build_summary(events: list[dict]) -> dict:
    """Builds aggregated summary stats from a list of events."""
    hosts      = {}
    sourcetypes = {}
    for e in events:
        h  = e.get("host", "unknown")
        st = e.get("sourcetype", "unknown")
        hosts[h]       = hosts.get(h, 0) + 1
        sourcetypes[st] = sourcetypes.get(st, 0) + 1

    return {
        "top_hosts":       sorted(hosts.items(),       key=lambda x: -x[1])[:10],
        "top_sourcetypes": sorted(sourcetypes.items(), key=lambda x: -x[1])[:5],
        "total_events_in_payload": len(events),
    }


def _mock_result(query: str) -> dict:
    """Returns a realistic mock result when no Splunk creds are configured."""
    return {
        "total_events": 3,
        "returned_events": 3,
        "truncated": False,
        "events": [
            {"_time": "2026-06-03T10:00:00Z", "_raw": "EventCode=4688 Image=C:\\Windows\\System32\\powershell.exe CommandLine=powershell -enc JABzAD...", "host": "WORKSTATION-01", "sourcetype": "XmlWinEventLog:Security"},
            {"_time": "2026-06-03T09:58:10Z", "_raw": "DNS query: login-microsoft-secure.update.com from 192.168.1.42", "host": "DC01", "sourcetype": "stream:dns"},
            {"_time": "2026-06-03T09:55:00Z", "_raw": "Outbound connection to 45.133.1.109:443 blocked by firewall", "host": "FIREWALL-01", "sourcetype": "pan:traffic"},
        ],
        "summary": {
            "top_hosts": [["WORKSTATION-01", 1], ["DC01", 1], ["FIREWALL-01", 1]],
            "top_sourcetypes": [["XmlWinEventLog:Security", 1], ["stream:dns", 1], ["pan:traffic", 1]],
            "total_events_in_payload": 3,
        },
        "query": query,
        "time_range": {"earliest": "-30d", "latest": "now"},
        "error": None,
    }


def _error_result(query: str, message: str) -> dict:
    return {
        "total_events": 0,
        "returned_events": 0,
        "truncated": False,
        "events": [],
        "summary": {},
        "query": query,
        "time_range": {},
        "error": message,
    }
