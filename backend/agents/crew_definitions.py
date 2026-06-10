import os
from crewai import Agent, Task, Crew, Process
from crewai import LLM
from agents.tools import OpenCTIFetchTool, SupabaseHypothesisTool, SplunkExecuteTool, ReportWriterTool, HuntAnalysisUpdateTool

# LLM Configuration
gemini_llm = LLM(
    model="gemini/gemini-2.5-flash",
    api_key=os.getenv("GEMINI_API_KEY", "mock-gemini-key"),
    temperature=0.2
)

opencti_tool_fallback = OpenCTIFetchTool() # Fallback if needed
supabase_tool = SupabaseHypothesisTool()
splunk_tool = SplunkExecuteTool()
report_tool = ReportWriterTool()
hunt_analysis_tool = HuntAnalysisUpdateTool()

def create_agents(opencti_url: str = "", opencti_token: str = ""):
    opencti_tool = OpenCTIFetchTool(opencti_url=opencti_url, opencti_token=opencti_token)
    
    intel_analyst = Agent(
        role="Senior Threat Intelligence Analyst",
        goal="Find latest threats from OpenCTI relevant to client industry",
        backstory="An elite cyber intelligence analyst monitoring the global threat landscape.",
        verbose=False,
        allow_delegation=False,
        llm=gemini_llm,
        tools=[opencti_tool]
    )

    hypothesis_generator = Agent(
        role="Expert Threat Hunt Hypothesis Creator",
        goal="Generate specific non-generic hypotheses based on real intel.",
        backstory="A seasoned SOC architect who designs targeted hunts based on raw intelligence. You strictly save drafts for human approval.",
        verbose=False,
        allow_delegation=False,
        llm=gemini_llm,
        tools=[supabase_tool]
    )

    hunt_executor = Agent(
        role="SOC Detection Engineer",
        goal="Execute Splunk queries for approved hypotheses and collect results accurately",
        backstory="A technical engineer skilled in querying SIEM platforms to uncover hidden threats.",
        verbose=False,
        allow_delegation=False,
        llm=gemini_llm,
        tools=[splunk_tool]
    )

    log_analyst = Agent(
        role="Senior SOC Analyst",
        goal="Analyze hunt results and determine True Positive (TP) or False Positive (FP) accurately, then log results.",
        backstory="A meticulous log analyst who can spot the difference between benign activity and malicious intent.",
        verbose=False,
        allow_delegation=False,
        llm=gemini_llm,
        tools=[hunt_analysis_tool]
    )

    report_writer = Agent(
        role="Security Report Specialist",
        goal="Write clear professional hunt findings reports",
        backstory="A professional technical writer specializing in cyber security executive summaries and blocklists.",
        verbose=False,
        allow_delegation=False,
        llm=gemini_llm,
        tools=[report_tool]
    )
    
    return intel_analyst, hypothesis_generator, hunt_executor, log_analyst, report_writer

def get_draft_hypothesis_description(client_id: str, splunk_schema: str = "") -> str:
    schema_block = splunk_schema.strip() if splunk_schema else "index=* (no schema configured — use index=* as fallback)"
    return f"""You are an elite Tier-3 Threat Hunt Engineer and Detection Engineer at a world-class MSSP.
I will provide you a JSON list of IOCs (IPs, domains, hashes) fetched from threat intelligence for client: {client_id}.

=== CLIENT SPLUNK SCHEMA ===
The following are the EXACT indexes and sourcetypes available for this client's Splunk environment.
You MUST only reference indexes and sourcetypes from this list. Never use index=* in the final query.

{schema_block}

=== YOUR TASK ===
Generate exactly 1 highly detailed "Master Kill-Chain Hypothesis" based on the provided intel.
This single hypothesis MUST comprehensively combine both IOC-driven and Behavior-driven hunting into one massive, master threat hunt.

- Title: Give it an authoritative name (e.g., "Comprehensive VOLT TYPHOON Kill-Chain Master Hunt").
- Description / intelSummary: Write a highly detailed summary explaining that this hunt targets both the static infrastructure (specific IPs, domains, hashes) AND the precise behavioral execution footprint (TTPs, process chains) of the active campaign.
- SIEM Query (splunk_query): You MUST write an advanced, multi-part master query using 'OR' logic for Splunk. 
- Sentinel Query (sentinel_kql): You MUST write an advanced, multi-part master query using 'or' logic for Microsoft Sentinel (KQL).
  For both splunk_query and sentinel_kql:
  Part 1 of the query must explicitly search for the exact static IOCs provided in the intel.
  Part 2 of the query must search for the behavioral footprint (e.g., specific CommandLine arguments, unexpected child processes). 
  CRITICAL: Use inline code comments to visually separate the two logic blocks, and use literal '\\n' for structural line breaks.

Both parts of the queries must:
1. Actually run correctly in this client's environment.
2. Use the client's exact schema logic.

=== SPL QUERY RULES (STRICT) ===
Rule 1 — CORRECT SPLUNK SYNTAX & HIGHLY SPECIFIC LOGIC:
  - You MUST write extremely good, straightforward, and highly targeted queries. Do NOT write generic or broad queries.
  ✅ GOOD: index="windows" sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" (dest_ip="45.133.1.109" OR src_ip="45.133.1.109")
  ❌ BAD:  index=* sourcetype=* "malicious" | eval | join ...nonsense...
  ❌ BAD:  Any query using fake field names or undefined functions

Rule 2 — EMBED THE ACTUAL IOC VALUE in the query using the right field:
  - For IP IOCs:     use (src_ip="VALUE" OR dest_ip="VALUE" OR src="VALUE" OR dest="VALUE")
  - For domain IOCs: use (query="VALUE" OR url="*VALUE*" OR CommandLine="*VALUE*")
  - For hash IOCs:   use (MD5="VALUE" OR SHA256="VALUE" OR Hashes="*VALUE*")
  - For URL IOCs:    use (url="*VALUE*" OR uri_path="*VALUE*")

Rule 3 — STRICT EVENT LIMITS & AGGREGATION (CRITICAL FOR LLM ANALYSIS):
  To prevent returning 10,000+ events which crashes the downstream LLM analysis, EVERY query MUST end with a strict aggregation and a hard limit of 2000 rows.
  Example suffix that you MUST append to every query:
  | stats count AS hits, values(host) AS hosts, earliest(_time) AS first_seen, latest(_time) AS last_seen BY [appropriate field]
  | sort -hits
  | head 2000

Rule 4 — PICK THE RIGHT INDEX for the IOC type:
  - IP-based threats      → prefer network/firewall indexes (pan:traffic, cisco:asa, zeek:conn)
  - Domain/DNS threats    → prefer DNS indexes (stream:dns, cisco:umbrella, zeek:dns)
  - Hash/process threats  → prefer endpoint indexes (Sysmon, WinEventLog:Security, carbon_black)
  - Web/URL threats       → prefer proxy/web indexes (access_combined, stream:http, pan:threat)

=== OUTPUT FORMAT ===
Check existing hypotheses using the Supabase tool (action='read', client_id='{client_id}') first.
Do NOT duplicate existing hunts (same IOC or same core behavior).
Then use the Supabase tool (action='write', client_id='{client_id}', hypothesis_data='[JSON ARRAY]') to save.

Your write payload must be a JSON array where each object has these exact keys:
[
  {{
    "title": "Hunt for [Threat] activity",
    "threatActor": {{
      "actor": "Actor Name",
      "aliases": "Alias 1, Alias 2",
      "origin": "Origin",
      "activeSince": "Year",
      "targets": "Industry",
      "dwellTime": "Time",
      "sophistication": "High/Med/Low",
      "cisaAlert": "Alert ID",
      "confidence": "HIGH 90%"
    }},
    "intelSummary": "Detailed Intel Summary & Attack Chain.",
    "iocs": [
      {{ "type": "IP", "value": "1.1.1.1", "context": "C2 Server", "description": "Used for exfil" }}
    ],
    "logSources": [
      {{ "source": "Sysmon", "indicator": "Process Creation", "query": "EventCode=1" }}
    ],
    "huntingSteps": [
      {{ "step": "Review alerts...", "description": "Look for X" }}
    ],
    "triageQuery": "index=* sourcetype=* | stats count",
    "falsePositives": "Specific legitimate scenarios that look similar.",
    "references": [ "https://example.com" ],
    "mitre_id": "T1071.001",
    "splunk_query": "index=\"exact_index\" sourcetype=\"exact_sourcetype\" (field=\"ioc_value\") | stats count AS hits, values(host) AS hosts, earliest(_time) AS first_seen, latest(_time) AS last_seen BY src_ip | sort -hits | head 2000",
    "sentinel_kql": "SecurityEvent | where EventID == 4688 and (CommandLine contains \"ioc_value\") | summarize hits=count(), hosts=make_set(Computer), first_seen=min(TimeGenerated), last_seen=max(TimeGenerated) by Account | sort by hits desc | take 2000"
  }}
]
"""


def get_daily_hunt_crew(client_id: str, opencti_url: str = "", opencti_token: str = ""):
    intel_analyst, hypothesis_generator, hunt_executor, log_analyst, report_writer = create_agents(opencti_url, opencti_token)
    
    fetch_intel_task = Task(
        description=f"Fetch the latest IOCs from OpenCTI for client: {client_id}.",
        expected_output="A JSON summary of the newly fetched IOCs.",
        agent=intel_analyst
    )
    
    draft_hypotheses_task = Task(
        description=get_draft_hypothesis_description(client_id),
        expected_output="Confirmation that new DRAFT hypotheses were saved to Supabase.",
        agent=hypothesis_generator
    )
    
    execute_hunt_task = Task(
        description=f"Use the Splunk Execute Tool to run all previously APPROVED hypotheses for client: {client_id}.",
        expected_output="Raw logs from Splunk for the executed hypotheses.",
        agent=hunt_executor
    )
    
    analyze_logs_task = Task(
        description="Analyze the raw Splunk logs returned from the executor. Determine if each result is a True Positive (TP) or False Positive (FP).",
        expected_output="A detailed summary of TP/FP findings for each hypothesis.",
        agent=log_analyst
    )
    
    report_task = Task(
        description=f"Use the Report Writer tool to generate the 'hunt' report for client: {client_id} based on the analyzed findings, and email it.",
        expected_output="Confirmation that the PDF was generated and emailed.",
        agent=report_writer
    )
    
    crew = Crew(
        agents=[intel_analyst, hypothesis_generator, hunt_executor, log_analyst, report_writer],
        tasks=[fetch_intel_task, draft_hypotheses_task, execute_hunt_task, analyze_logs_task, report_task],
        process=Process.sequential,
        verbose=False
    )
    return crew

def get_ioc_collection_crew(client_id: str, opencti_url: str = "", opencti_token: str = ""):
    intel_analyst, _, _, _, report_writer = create_agents(opencti_url, opencti_token)
    
    fetch_intel_task = Task(
        description=f"Fetch the latest IOCs from OpenCTI for client: {client_id}.",
        expected_output="A JSON summary of the newly fetched IOCs.",
        agent=intel_analyst
    )
    
    ioc_report_task = Task(
        description=f"Use the Report Writer tool (report_type='ioc') to generate the PDF and CSV blocklists for client: {client_id}, and email it.",
        expected_output="Confirmation that the IOC PDF and CSV files were generated and emailed.",
        agent=report_writer
    )
    
    crew = Crew(
        agents=[intel_analyst, report_writer],
        tasks=[fetch_intel_task, ioc_report_task],
        process=Process.sequential,
        verbose=False
    )
    return crew

def get_hypothesis_generation_crew(client_id: str, splunk_schema: str = "Default Schema (index=*)", opencti_url: str = "", opencti_token: str = ""):
    intel_analyst, hypothesis_generator, _, _, _ = create_agents(opencti_url, opencti_token)
    
    fetch_intel_task = Task(
        description=f"Fetch the latest IOCs from OpenCTI for client: {client_id}.",
        expected_output="A JSON summary of the newly fetched IOCs.",
        agent=intel_analyst
    )
    
    draft_hypotheses_task = Task(
        description=get_draft_hypothesis_description(client_id, splunk_schema),
        expected_output="Confirmation that new DRAFT hypotheses were saved to Supabase.",
        agent=hypothesis_generator
    )
    
    crew = Crew(
        agents=[intel_analyst, hypothesis_generator],
        tasks=[fetch_intel_task, draft_hypotheses_task],
        process=Process.sequential,
        verbose=False
    )
    return crew

def get_hunt_execution_crew(client_id: str, opencti_url: str = "", opencti_token: str = ""):
    _, _, hunt_executor, log_analyst, _ = create_agents(opencti_url, opencti_token)
    
    execute_hunt_task = Task(
        description=f"Use the Splunk Execute Tool to pull all 'approved' hypotheses for client: {client_id}, execute them against the SIEM, and save the raw logs. Provide the JSON array of the results to the next agent.",
        expected_output="JSON array of raw Splunk results containing hypothesis_id, title, and splunk_results.",
        agent=hunt_executor
    )
    
    analyze_logs_task = Task(
        description="""Analyze the raw Splunk logs returned by the Hunt Executor. 
        For each hypothesis result in the JSON array:
        1. Determine if the result is a True Positive (TP), False Positive (FP), or Clean.
        2. Write a detailed analyst note explaining your reasoning.
        3. Use the Hunt Analysis Update Tool to save your verdict and notes back to the database. You MUST use the exact 'hypothesis_id' from the Executor's JSON array. Call the tool once for EACH hypothesis analyzed.""",
        expected_output="Confirmation that all executed hypotheses have been analyzed and updated in the database.",
        agent=log_analyst
    )
    
    crew = Crew(
        agents=[hunt_executor, log_analyst],
        tasks=[execute_hunt_task, analyze_logs_task],
        process=Process.sequential,
        verbose=False
    )
    return crew
