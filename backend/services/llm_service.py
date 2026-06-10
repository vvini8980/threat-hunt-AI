import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# ──────────────────────────────────────────────────────────────────────────────
# Hunt result analysis
# ──────────────────────────────────────────────────────────────────────────────

def analyze_hunt_results_with_llm(hunt_context: str, raw_results: str) -> str:
    """
    Sends hunt hypothesis context and raw SIEM results to Gemini to determine TP/FP/Clean.
    """
    if not GEMINI_API_KEY:
        return "Mocked Analysis: Based on the provided context, this appears to be a False Positive (FP) as the activity aligns with known administrative behavior."

    prompt = f"""
    You are an expert Security Operations Center (SOC) analyst.
    Please review the following threat hunt hypothesis and context, along with the raw search results from the SIEM.
    Determine if this is a True Positive (TP) indicating malicious activity, a False Positive (FP) indicating benign activity, or Clean.
    Provide a brief explanation of your reasoning (Analyst Notes).

    Format your response exactly like this:
    VERDICT: [TP/FP/clean]
    NOTES: [Your detailed reasoning]

    HUNT CONTEXT:
    {hunt_context}

    RAW RESULTS:
    {raw_results}
    """
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"LLM Analysis failed: {e}")
        return f"VERDICT: Error\nNOTES: LLM analysis failed: {e}"


# ──────────────────────────────────────────────────────────────────────────────
# Splunk SPL generation
# ──────────────────────────────────────────────────────────────────────────────

def _build_splunk_schema_block(
    splunk_schema: str = "",
    splunk_indexes: str = "",
    splunk_sourcetypes: str = "",
    splunk_key_fields: str = "",
) -> str:
    """Assembles a rich schema context block for the SPL generation prompt."""
    parts = []
    if splunk_indexes and splunk_indexes.strip():
        parts.append("## Available Indexes\n" + splunk_indexes.strip())
    if splunk_sourcetypes and splunk_sourcetypes.strip():
        parts.append("## Available SourceTypes\n" + splunk_sourcetypes.strip())
    if splunk_key_fields and splunk_key_fields.strip():
        parts.append("## Important Fields\n" + splunk_key_fields.strip())
    if splunk_schema and splunk_schema.strip():
        parts.append("## Additional Schema Notes\n" + splunk_schema.strip())
    if not parts:
        return "index=main (no schema configured — use index=main as fallback)"
    return "\n\n".join(parts)


def generate_splunk_query(
    title: str,
    description: str,
    hunting_logic: str,
    mitre_id: str,
    splunk_schema: str = "",
    splunk_indexes: str = "",
    splunk_sourcetypes: str = "",
    splunk_key_fields: str = "",
    vendor_log_sources: str = "",
) -> str:
    """
    Uses Gemini to generate a precise Splunk SPL query based on hypothesis details
    and the client's structured Splunk schema. Returns just the raw SPL string.
    """
    if not GEMINI_API_KEY:
        return 'index=main sourcetype=_json | stats count BY host | sort -count'

    schema_block = _build_splunk_schema_block(
        splunk_schema, splunk_indexes, splunk_sourcetypes, splunk_key_fields
    )

    prompt = f"""You are an elite Splunk Detection Engineer at a world-class MSSP.
Your job is to write a single precise Splunk SPL search query based on the threat hunt hypothesis below.

=== CLIENT SPLUNK SCHEMA ===
The following are the EXACT indexes, sourcetypes, and fields available in this client's Splunk environment.
You MUST only use indexes and sourcetypes from this list. Never invent field names.

{schema_block}

=== VENDOR TECHNOLOGIES ===
This client uses the following security vendors and log sources. Use this context if you need to know which technologies are present:
{vendor_log_sources or 'Not specified'}

=== HYPOTHESIS DETAILS ===
Title: {title}
MITRE ATT&CK ID: {mitre_id or 'Not specified'}
Description: {description or 'Not provided'}
Hunting Logic / Detection Idea: {hunting_logic or 'Not provided'}

=== YOUR TASK ===
Write a single valid Splunk SPL query that:
1. Uses ONLY the indexes and sourcetypes from the schema above
2. Targets the specific behavior described in the hypothesis
3. Always ends with a | stats aggregation to prevent huge result floods
4. Uses correct Splunk syntax (no made-up functions or field names)
5. Uses field names from the Important Fields list if relevant

=== OUTPUT FORMAT ===
Return ONLY the raw SPL query — no explanation, no markdown, no code fences.
Just the query starting with index= or search or |

Example:
index="windows" sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1 Image="*powershell.exe*" (CommandLine="*-enc*" OR CommandLine="*-w hidden*") | stats count AS hits, values(host) AS hosts, earliest(_time) AS first_seen, latest(_time) AS last_seen BY CommandLine | sort -hits
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        query = response.text.strip()
        if query.startswith("```"):
            query = "\n".join(query.split("\n")[1:])
        if query.endswith("```"):
            query = "\n".join(query.split("\n")[:-1])
        return query.strip()
    except Exception as e:
        print(f"SPL generation failed: {e}")
        return f"index=main | search {title} | stats count BY host"


# ──────────────────────────────────────────────────────────────────────────────
# Microsoft Sentinel KQL generation
# ──────────────────────────────────────────────────────────────────────────────

def generate_sentinel_kql(
    title: str,
    description: str,
    hunting_logic: str,
    mitre_id: str,
    sentinel_schema: str = "",
    vendor_log_sources: str = "",
) -> str:
    """
    Uses Gemini to generate a Microsoft Sentinel KQL query based on hypothesis details
    and the client's Log Analytics workspace schema. Returns just the raw KQL string.
    """
    if not GEMINI_API_KEY:
        return (
            "SecurityEvent\n"
            "| where TimeGenerated > ago(30d)\n"
            "| summarize count() by Computer, EventID\n"
            "| sort by count_ desc"
        )

    schema_block = (
        sentinel_schema.strip()
        if sentinel_schema and sentinel_schema.strip()
        else "SecurityEvent, SigninLogs, AuditLogs, DeviceProcessEvents, DeviceNetworkEvents (default Sentinel tables — use these as fallback)"
    )

    prompt = f"""You are an elite Microsoft Sentinel Detection Engineer and KQL expert at a world-class MSSP.
Your job is to write a single precise Microsoft Sentinel KQL hunting query based on the threat hunt hypothesis below.

=== CLIENT SENTINEL SCHEMA ===
The following are the exact tables available in the client's Azure Log Analytics workspace.
You MUST only query these tables. Never invent table names.

{schema_block}

=== VENDOR TECHNOLOGIES ===
This client uses the following security vendors and log sources. Use this context if you need to know which technologies are present:
{vendor_log_sources or 'Not specified'}

=== HYPOTHESIS DETAILS ===
Title: {title}
MITRE ATT&CK ID: {mitre_id or 'Not specified'}
Description: {description or 'Not provided'}
Hunting Logic / Detection Idea: {hunting_logic or 'Not provided'}

=== YOUR TASK ===
Write a single valid Microsoft Sentinel KQL query that:
1. Uses ONLY the tables from the schema above
2. Targets the specific behavior described in the hypothesis
3. Always includes a time filter: | where TimeGenerated > ago(30d)
4. Always ends with a summarize or project aggregation
5. Uses correct KQL syntax (no made-up operators or functions)
6. Uses field names from the schema if listed

=== OUTPUT FORMAT ===
Return ONLY the raw KQL query — no explanation, no markdown, no code fences.
Start with the table name, then pipe operators.

Example:
SecurityEvent
| where TimeGenerated > ago(30d)
| where EventID == 4688
| where Process has_any ("powershell.exe", "cmd.exe")
| where CommandLine has_any ("-enc", "-w hidden", "bypass")
| summarize Count=count(), Hosts=make_set(Computer), FirstSeen=min(TimeGenerated), LastSeen=max(TimeGenerated) by CommandLine, Account
| sort by Count desc
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        query = response.text.strip()
        if query.startswith("```"):
            query = "\n".join(query.split("\n")[1:])
        if query.endswith("```"):
            query = "\n".join(query.split("\n")[:-1])
        return query.strip()
    except Exception as e:
        print(f"KQL generation failed: {e}")
        return f'SecurityEvent\n| where TimeGenerated > ago(30d)\n| where * has "{title}"\n| summarize count() by Computer'

import requests

def analyze_logs_with_ollama(ollama_url: str, query: str, events: list) -> str:
    """
    Sends raw SIEM results to a local Ollama instance for analysis.
    """
    if not ollama_url.startswith("http"):
        ollama_url = f"http://{ollama_url}"
    if not ollama_url.endswith("/api/generate"):
        ollama_url = f"{ollama_url.rstrip('/')}/api/generate"

    prompt = f"""
You are an expert Security Operations Center (SOC) analyst.
Please review the following raw SIEM logs returned from the query: {query}

Raw Events:
{events}

Determine if this is a True Positive (TP) indicating malicious activity, a False Positive (FP) indicating benign activity, or Clean.
Provide a brief explanation of your reasoning (Analyst Notes).
"""
    try:
        response = requests.post(ollama_url, json={
            "model": "llama3.2:1b",
            "prompt": prompt,
            "stream": False
        })
        response.raise_for_status()
        return response.json().get("response", "No response from LLM.")
    except Exception as e:
        print(f"Ollama Analysis failed: {e}")
        return f"Error connecting to Ollama at {ollama_url}: {e}"

def analyze_logs_with_gemini(query: str, events: list, api_key: str = None) -> str:
    """
    Sends raw SIEM results to Google Gemini for ultra-fast analysis.
    """
    effective_key = api_key if api_key else GEMINI_API_KEY
    if not effective_key:
        return "Error: Gemini API Key is missing. Please provide it in the UI."

    prompt = f"""
You are an expert Security Operations Center (SOC) analyst.
Please review the following raw SIEM logs returned from the query: {query}

Raw Events:
{events}

Determine if this is a True Positive (TP) indicating malicious activity, a False Positive (FP) indicating benign activity, or Clean.
Provide a brief explanation of your reasoning (Analyst Notes).
"""
    try:
        genai.configure(api_key=effective_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        # Restore original config just in case
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
        return response.text.strip()
    except Exception as e:
        print(f"Gemini Analysis failed: {e}")
        # Restore original config just in case
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
        return f"Error connecting to Cloud AI (Gemini): {e}"

