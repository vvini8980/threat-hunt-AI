"""
Intel Report Service — Real OpenCTI + Gemini AI Pipeline
- fetch_and_analyze_opencti_feed(): Fetches real IOCs from OpenCTI, groups by threat actor,
  uses Gemini to generate full structured threat campaign cards (same format as frontend expects)
- generate_daily_intel_report(): Builds and persists the daily midnight report
- get_daily_report(): Retrieves a stored daily report
"""

import os
import json
import datetime
import asyncio
from typing import Optional

import google.generativeai as genai
from services.opencti_service import fetch_iocs_from_opencti
from services.supabase_client import supabase

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENCTI_URL    = os.getenv("OPENCTI_URL", "")
OPENCTI_TOKEN  = os.getenv("OPENCTI_TOKEN", "")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "daily_reports")

def _get_cached_report(date_str: str) -> Optional[dict]:
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{date_str}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Daily Report Cache] Error reading cache for {date_str}: {e}")
    return None

def _save_report_to_cache(date_str: str, report: dict):
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{date_str}.json")
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"[Daily Report Cache] Saved report for {date_str} to cache")
    except Exception as e:
        print(f"[Daily Report Cache] Error writing cache for {date_str}: {e}")


# ── Gemini response schema for a campaign card ────────────────────────────────
CAMPAIGN_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "id":   {"type": "STRING"},
        "name": {"type": "STRING"},
        "date": {"type": "STRING"},
        "metadata": {
            "type": "OBJECT",
            "properties": {
                "actor":          {"type": "STRING"},
                "aliases":        {"type": "STRING"},
                "origin":         {"type": "STRING"},
                "activeSince":    {"type": "STRING"},
                "targetSector":   {"type": "STRING"},
                "dwellTime":      {"type": "STRING"},
                "sophistication": {"type": "STRING"},
                "cisaAlert":      {"type": "STRING"},
                "confidence":     {"type": "STRING"},
            },
            "required": ["actor", "aliases", "origin", "activeSince", "targetSector",
                         "dwellTime", "sophistication", "cisaAlert", "confidence"]
        },
        "poc": {
            "type": "OBJECT",
            "properties": {
                "hypothesis": {"type": "STRING"},
                "triageQuery": {"type": "STRING"},
                "falsePositives": {"type": "STRING"},
                "huntingSteps": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "step":        {"type": "STRING"},
                            "description": {"type": "STRING"},
                        },
                        "required": ["step", "description"]
                    }
                },
                "logSources": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "source":    {"type": "STRING"},
                            "indicator": {"type": "STRING"},
                            "query":     {"type": "STRING"},
                        },
                        "required": ["source", "indicator", "query"]
                    }
                }
            },
            "required": ["hypothesis", "triageQuery", "falsePositives", "huntingSteps", "logSources"]
        },
        "references": {"type": "ARRAY", "items": {"type": "STRING"}},
        "iocs": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type":    {"type": "STRING"},
                    "value":   {"type": "STRING"},
                    "context": {"type": "STRING"},
                },
                "required": ["type", "value", "context"]
            }
        },
        "hypotheses": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "hypoName":          {"type": "STRING"},
                    "description":       {"type": "STRING"},
                    "mitreId":           {"type": "STRING"},
                    "tactic":            {"type": "STRING"},
                    "platform":          {"type": "STRING"},
                    "dataSource":        {"type": "STRING"},
                    "actorContext":      {"type": "STRING"},
                    "confidence":        {"type": "STRING"},
                    "source":            {"type": "STRING"},
                    "lastSeen":          {"type": "STRING"},
                    "huntingLogic":      {"type": "STRING"},
                    "falsePositiveRisk": {"type": "STRING"},
                    "truePositiveAction":{"type": "STRING"},
                    "splunkSPL":         {"type": "STRING"},
                    "sentinelKQL":       {"type": "STRING"},
                },
                "required": ["hypoName", "description", "mitreId", "tactic", "platform",
                             "dataSource", "actorContext", "confidence", "source", "lastSeen",
                             "huntingLogic", "falsePositiveRisk", "truePositiveAction",
                             "splunkSPL", "sentinelKQL"]
            }
        }
    },
    "required": ["id", "name", "date", "metadata", "poc", "references", "iocs", "hypotheses"]
}


def _group_iocs_by_actor(iocs: list) -> dict:
    """Groups raw IOC records by threat_actor, returning a dict of actor -> [iocs]."""
    groups = {}
    for ioc in iocs:
        actor = ioc.get("threat_actor") or "Unknown"
        groups.setdefault(actor, []).append(ioc)
    return groups


def _build_campaign_prompt(actor: str, iocs: list) -> str:
    """Builds a Gemini prompt from real OpenCTI IOCs for a specific threat actor."""
    ioc_lines = "\n".join(
        f"  - Type: {i.get('type','?')}, Value: {i.get('value','?')}, "
        f"Confidence: {i.get('confidence','?')}, Notes: {i.get('notes') or i.get('description','')}"
        for i in iocs[:20]  # cap at 20 IOCs per actor
    )

    return f"""You are a senior Threat Intelligence Analyst at a Tier-3 SOC.

The following REAL Indicators of Compromise (IOCs) have been pulled from a live OpenCTI threat intelligence platform.
They are all attributed to threat actor: "{actor}"

LIVE IOCs FROM OPENCTI:
{ioc_lines}

Your task:
1. Using your threat intelligence knowledge, create a comprehensive, realistic threat campaign profile for this actor.
2. Generate specific MITRE ATT&CK-aligned hunting hypotheses based on the IOC types observed.
3. Write advanced Splunk SPL and Microsoft Sentinel KQL queries targeting these specific IOCs and TTPs.
4. Use literal \\n characters in JSON strings for line breaks.
5. Do NOT wrap output in markdown code blocks — return raw JSON only.

Generate the full campaign card JSON following the exact schema provided."""


def _analyze_actor_with_gemini(actor: str, iocs: list) -> Optional[dict]:
    """
    Calls Gemini to analyze a threat actor's IOCs from OpenCTI
    and returns a full structured campaign card.
    """
    if not GEMINI_API_KEY:
        print(f"[Intel] No Gemini key — skipping AI analysis for {actor}")
        return None

    try:
        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=CAMPAIGN_SCHEMA,
            )
        )
        prompt  = _build_campaign_prompt(actor, iocs)
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        print(f"[Intel] Gemini analysis failed for {actor}: {e}")
        return None


# ── Build a basic campaign card from IOCs without Gemini ─────────────────────
def _build_basic_campaign(actor: str, iocs: list) -> dict:
    """Fallback: builds a minimal campaign card from raw IOCs without Gemini."""
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    ioc_cards = [
        {"type": i.get("type", "unknown").upper(), "value": i.get("value", ""), "context": i.get("notes") or i.get("description", "IOC from OpenCTI")}
        for i in iocs
    ]
    return {
        "id":   f"atk-{actor.replace(' ', '-').lower()}-{today}",
        "name": f"{actor}: Active Campaign (OpenCTI Feed — {today})",
        "date": today,
        "metadata": {
            "actor":          actor,
            "aliases":        "See OpenCTI",
            "origin":         "Unknown",
            "activeSince":    "Current",
            "targetSector":   "Multiple Sectors",
            "dwellTime":      "Unknown",
            "sophistication": "Unknown",
            "cisaAlert":      "N/A",
            "confidence":     f"{iocs[0].get('confidence', 'Medium')} (from OpenCTI)",
        },
        "poc": {
            "hypothesis":    f"{actor} has active IOCs in your threat intel feed. Review the IOC list below and hunt for any matches in your SIEM.",
            "triageQuery":   f"| Comment: Hunt for {actor} IOCs\nindex=* earliest=-7d\n" + "\n".join(
                             f"  {i.get('value','?')}" for i in iocs[:5]),
            "falsePositives": "Review each IOC against your allowlist before escalating.",
            "huntingSteps": [
                {"step": "Review IOCs in Splunk/Sentinel", "description": f"Search for all {len(iocs)} IOC values from {actor} in your SIEM."},
                {"step": "Correlate with user/host activity", "description": "For any matching IOC, identify which hosts and users interacted with it."},
                {"step": "Enrich with threat context", "description": "Use OpenCTI to get full context on any matched IOC before escalating."},
            ],
            "logSources": [
                {"source": "Firewall / Proxy", "indicator": "Outbound connections to IOC IPs/Domains", "query": "index=network dest_ip IN [ioc_list]"},
                {"source": "DNS Logs", "indicator": "DNS queries to malicious domains", "query": "index=dns query IN [domain_ioc_list]"},
                {"source": "EDR / Sysmon", "indicator": "File hash matches from endpoint telemetry", "query": "index=edr file_hash IN [hash_ioc_list]"},
            ]
        },
        "references": [],
        "iocs": ioc_cards,
        "hypotheses": [
            {
                "hypoName":          f"Hunt {actor} IOC Activity",
                "description":       f"Search for any signs of {actor} infrastructure contact across your environment based on {len(iocs)} IOCs from OpenCTI.",
                "mitreId":           "T1071.001",
                "tactic":            "Command and Control",
                "platform":          "Cross-Platform",
                "dataSource":        "Network Telemetry / Firewall / DNS / Proxy",
                "actorContext":      f"These IOCs were ingested live from OpenCTI and attributed to {actor}.",
                "confidence":        iocs[0].get("confidence", "Medium"),
                "source":            "OpenCTI Live Feed",
                "lastSeen":          today,
                "huntingLogic":      f"1. Load all {len(iocs)} IOC values\n2. Search firewall logs for outbound connections\n3. Search DNS logs for domain queries\n4. Search EDR for hash matches\n5. Correlate hits with user/host identity",
                "falsePositiveRisk": "LOW to MEDIUM — validate against known-good lists",
                "truePositiveAction": f"🚨 Block all {actor} IOCs on perimeter\n🚨 Isolate any matching hosts\n🚨 Escalate to Incident Response",
                "splunkSPL":         f"index=* earliest=-30d\n(\n  " + " OR\n  ".join(f'"{i.get("value","?")}"' for i in iocs[:10]) + "\n)\n| stats count by host, src_ip, dest_ip\n| sort -count",
                "sentinelKQL":       f"let iocs = dynamic([" + ",".join(f'"{i.get("value","?")}"' for i in iocs[:10]) + "]);\nCommonSecurityLog\n| where TimeGenerated > ago(30d)\n| where DestinationIP in (iocs) or DestinationHostName in (iocs)\n| summarize count() by SourceIP, DestinationIP, TimeGenerated\n| order by count_ desc",
            }
        ]
    }


# ── Main pipeline: OpenCTI → Gemini → Campaign Cards ─────────────────────────
async def fetch_and_analyze_opencti_feed(opencti_url: str = None, opencti_token: str = None) -> list:
    """
    Full pipeline:
    1. Fetch fresh IOCs from OpenCTI (last 3 days, confidence >= 50)
    2. Group by threat actor
    3. For each actor: call Gemini to generate a full campaign card
    4. Return list of campaign cards (same schema as frontend expects)
    """
    print("[Intel Feed] Fetching IOCs from OpenCTI...")

    # Fetch IOCs from OpenCTI (no client_id filter — global feed)
    raw_iocs = []
    try:
        # Use a dummy client_id for the global fetch (passes through to global mode)
        raw_iocs = fetch_iocs_from_opencti(
            client_id="global",
            opencti_url=opencti_url or OPENCTI_URL,
            opencti_token=opencti_token or OPENCTI_TOKEN,
            days_back=3,
            min_confidence=50,
        )
        print(f"[Intel Feed] Fetched {len(raw_iocs)} IOCs from OpenCTI")
    except Exception as e:
        print(f"[Intel Feed] OpenCTI fetch failed: {e}")

    if not raw_iocs:
        print("[Intel Feed] No IOCs returned — using fallback mode")
        return []

    # Group by threat actor
    actor_groups = _group_iocs_by_actor(raw_iocs)
    print(f"[Intel Feed] Found {len(actor_groups)} threat actor groups: {list(actor_groups.keys())}")

    campaigns = []

    for actor, iocs in actor_groups.items():
        print(f"[Intel Feed] Analyzing {actor} ({len(iocs)} IOCs)...")

        # Try Gemini analysis first (richer result)
        campaign = _analyze_actor_with_gemini(actor, iocs)

        if not campaign:
            # Fallback: build basic card from raw IOCs
            campaign = _build_basic_campaign(actor, iocs)

        # Ensure the IOCs from OpenCTI are included/merged
        if campaign:
            if "generated_at" not in campaign:
                campaign["generated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
            ioc_lookup = {i.get("value"): i.get("id") for i in iocs}
            
            # Add OpenCTI IDs to existing IOCs generated by Gemini
            for camp_ioc in campaign.get("iocs", []):
                if camp_ioc.get("value") in ioc_lookup and ioc_lookup[camp_ioc.get("value")]:
                    camp_ioc["opencti_id"] = ioc_lookup[camp_ioc.get("value")]

            existing_values = {i.get("value") for i in campaign.get("iocs", [])}
            for ioc in iocs:
                if ioc.get("value") not in existing_values:
                    campaign.setdefault("iocs", []).append({
                        "type":    ioc.get("type", "unknown").upper(),
                        "value":   ioc.get("value", ""),
                        "context": ioc.get("notes") or ioc.get("description", "From OpenCTI"),
                        "opencti_id": ioc.get("id")
                    })
            campaigns.append(campaign)

        # Small delay between Gemini calls to avoid rate limiting
        await asyncio.sleep(1)

    print(f"[Intel Feed] Generated {len(campaigns)} campaign cards")
    return campaigns


# ── Daily Report Generation ───────────────────────────────────────────────────
async def generate_daily_intel_report(date_str: str, opencti_url: str = None, opencti_token: str = None, force: bool = False) -> dict:
    """
    Generates a daily intel report for the given date (YYYY-MM-DD).
    1. Checks cache unless force is True
    2. Fetches fresh IOCs from OpenCTI for the specific target date
    3. Saves new IOCs to Supabase ioc_reports table
    4. Runs Gemini/fallback analysis per actor to generate campaigns
    5. Caches and returns structured report
    """
    # ── Step 0: Check Cache ───────────────────────────────────────────────
    if not force:
        cached = _get_cached_report(date_str)
        if cached:
            print(f"[Daily Report Cache] Cache hit for {date_str}")
            return cached

    try:
        target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD.")

    print(f"[Daily Report] Generating report for {date_str}...")

    # ── Step 1: Fetch live IOCs from OpenCTI for the target date ──────────
    raw_iocs = []
    try:
        raw_iocs = fetch_iocs_from_opencti(
            client_id="global",
            opencti_url=opencti_url or OPENCTI_URL,
            opencti_token=opencti_token or OPENCTI_TOKEN,
            min_confidence=50,
            target_date=date_str,
        )
        print(f"[Daily Report] Fetched {len(raw_iocs)} IOCs from OpenCTI")
    except Exception as e:
        print(f"[Daily Report] OpenCTI fetch failed: {e}")

    # ── Step 2: Save IOCs to Supabase (for all clients) ───────────────────
    if supabase and raw_iocs:
        try:
            records = [
                {
                    "client_id":    "00000000-0000-0000-0000-000000000000",  # system-level
                    "ioc_type":     ioc.get("type", "unknown"),
                    "value":        ioc.get("value", ""),
                    "confidence":   ioc.get("confidence", "Medium"),
                    "threat_actor": ioc.get("threat_actor", "Unknown"),
                    "source":       "opencti-daily",
                    "report_date":  target_date.isoformat(),
                }
                for ioc in raw_iocs
            ]
            # Upsert to avoid duplicates
            supabase.table("ioc_reports").upsert(records, on_conflict="value,report_date").execute()
            print(f"[Daily Report] Saved {len(records)} IOCs to Supabase")
        except Exception as e:
            print(f"[Daily Report] Supabase save failed: {e}")

    # ── Step 3: Build report and campaigns ─────────────────────────────────
    actor_groups  = _group_iocs_by_actor(raw_iocs)
    actors_list   = [a for a in actor_groups if a != "Unknown"]
    type_breakdown = {}
    for ioc in raw_iocs:
        t = ioc.get("type", "unknown")
        type_breakdown[t] = type_breakdown.get(t, 0) + 1

    # Get top IOCs (highest confidence first)
    sorted_iocs  = sorted(raw_iocs, key=lambda i: 0 if i.get("confidence") == "High" else 1)
    top_iocs     = [
        {"type": i.get("type"), "value": i.get("value"), "confidence": i.get("confidence"), "threat_actor": i.get("threat_actor")}
        for i in sorted_iocs[:10]
    ]

    campaigns = []
    for actor, iocs in actor_groups.items():
        print(f"[Daily Report] Analyzing {actor} ({len(iocs)} IOCs)...")
        # Try Gemini analysis first (richer result)
        campaign = _analyze_actor_with_gemini(actor, iocs)
        if not campaign:
            campaign = _build_basic_campaign(actor, iocs)
        if campaign:
            if "generated_at" not in campaign:
                campaign["generated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
            # Stamp campaign date as target date_str
            campaign["date"] = date_str
            
            ioc_lookup = {i.get("value"): i.get("id") for i in iocs}
            for camp_ioc in campaign.get("iocs", []):
                if camp_ioc.get("value") in ioc_lookup and ioc_lookup[camp_ioc.get("value")]:
                    camp_ioc["opencti_id"] = ioc_lookup[camp_ioc.get("value")]

            existing_values = {i.get("value") for i in campaign.get("iocs", [])}
            for ioc in iocs:
                if ioc.get("value") not in existing_values:
                    campaign.setdefault("iocs", []).append({
                        "type":    ioc.get("type", "unknown").upper(),
                        "value":   ioc.get("value", ""),
                        "context": ioc.get("notes") or ioc.get("description", "From OpenCTI"),
                        "opencti_id": ioc.get("id")
                    })
            campaigns.append(campaign)
        # Small delay between Gemini calls to avoid rate limiting
        await asyncio.sleep(1)

    report = {
        "date":           date_str,
        "generated_at":   datetime.datetime.utcnow().isoformat(),
        "report_for":     date_str,
        "ioc_count":      len(raw_iocs),
        "actor_count":    len(actors_list),
        "attack_count":   len(campaigns),
        "type_breakdown": type_breakdown,
        "top_iocs":       top_iocs,
        "actors":         actors_list,
        "campaigns":      campaigns,
        "high_confidence_count": len([i for i in raw_iocs if i.get("confidence") == "High"]),
        "summary": (
            f"Daily Proactive Intel Report covering {len(campaigns)} active threat campaign{'s' if len(campaigns) != 1 else ''}, "
            f"{len(raw_iocs)} unique IOC{'s' if len(raw_iocs) != 1 else ''} across {len(actors_list)} threat actor{'s' if len(actors_list) != 1 else ''}. "
            f"Breakdown: {', '.join(f'{v} {k}' for k, v in type_breakdown.items())}. "
            + (f"Key actors: {', '.join(actors_list[:5])}." if actors_list else "No actor attribution available.")
        ),
        "download_url": None,
        "source": "opencti_live" if raw_iocs else "no_data",
    }

    print(f"[Daily Report] Report complete: {len(raw_iocs)} IOCs, {len(actors_list)} actors, {len(campaigns)} campaigns")
    
    # Save to cache
    _save_report_to_cache(date_str, report)
    return report


async def get_daily_report(date_str: str) -> Optional[dict]:
    """Retrieves or regenerates the daily report for a given date."""
    try:
        return await generate_daily_intel_report(date_str, force=False)
    except Exception as e:
        print(f"[Daily Report] Error for {date_str}: {e}")
        return None
