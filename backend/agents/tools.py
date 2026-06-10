from crewai.tools import BaseTool
import json
import datetime
from services.supabase_client import supabase
from services.opencti_service import fetch_iocs_from_opencti
from services.splunk_service import execute_splunk_query
from services.report_generator import build_ioc_report, generate_ioc_reports
from services.email_service import send_report_email

class OpenCTIFetchTool(BaseTool):
    name: str = "OpenCTI Fetch Tool"
    description: str = "Fetches the latest IOCs from OpenCTI for a given client_id. Input: client_id"
    opencti_url: str = ""
    opencti_token: str = ""
    
    def _run(self, client_id: str) -> str:
        try:
            iocs = fetch_iocs_from_opencti(client_id, self.opencti_url, self.opencti_token, days_back=1, min_confidence=50)
            
            # Since the mock service returns a list directly, let's insert them into Supabase
            if supabase and iocs:
                records = []
                for ioc in iocs:
                    records.append({
                        "client_id": client_id,
                        "ioc_type": ioc["type"],
                        "value": ioc["value"],
                        "confidence": ioc["confidence"],
                        "threat_actor": ioc["threat_actor"],
                        "report_date": datetime.datetime.utcnow().isoformat()
                    })
                supabase.table("ioc_reports").insert(records).execute()
                
            return json.dumps(iocs)
        except Exception as e:
            return f"Error fetching IOCs: {e}"

class SupabaseHypothesisTool(BaseTool):
    name: str = "Supabase Hypothesis Tool"
    description: str = "Reads existing hypotheses or writes new DRAFT hypotheses. Action must be 'read' or 'write'. If write, provide JSON hypothesis_data."
    
    def _run(self, action: str, client_id: str, hypothesis_data: str = None) -> str:
        """
        action: 'read' or 'write'
        hypothesis_data: JSON string of hypotheses to write, e.g. [{"title": "...", "description": "...", "mitre_id": "...", "splunk_query": "..."}]
        """
        if not supabase:
            return "Supabase not initialized."
            
        if action == "read":
            res = supabase.table("hypotheses").select("mitre_id, title").or_(f"client_id.eq.{client_id},client_id.is.null").execute()
            return json.dumps(res.data)
            
        elif action == "write":
            if not hypothesis_data:
                return "No hypothesis data provided."
            try:
                # Clean up any potential markdown formatting from the LLM
                clean_data = hypothesis_data.strip()
                if clean_data.startswith("```json"):
                    clean_data = clean_data[7:]
                if clean_data.startswith("```"):
                    clean_data = clean_data[3:]
                if clean_data.endswith("```"):
                    clean_data = clean_data[:-3]
                clean_data = clean_data.strip()
                
                hypotheses = json.loads(clean_data)
                records = []
                for h in hypotheses:
                    rich_description_data = {
                        "isRichFormat": True,
                        "lastSeen": h.get("threatActor", {}).get("activeSince", "Current"),
                        "confidence": h.get("threatActor", {}).get("confidence", "HIGH 90%"),
                        "source": h.get("threatActor", {}).get("cisaAlert", "OpenCTI Feed"),
                        "actorContext": json.dumps(h.get("threatActor", {})),
                        "description": h.get("intelSummary", ""),
                        "huntingLogic": json.dumps(h.get("huntingSteps", [])),
                        "falsePositiveRisk": h.get("falsePositives", ""),
                        "truePositiveAction": "Escalate to Incident Response.",
                        
                        # New Rich Data Arrays
                        "threatActor": h.get("threatActor", {}),
                        "intelSummary": h.get("intelSummary", ""),
                        "iocs": h.get("iocs", []),
                        "logSources": h.get("logSources", []),
                        "huntingSteps": h.get("huntingSteps", []),
                        "triageQuery": h.get("triageQuery", ""),
                        "falsePositives": h.get("falsePositives", ""),
                        "references": h.get("references", [])
                    }
                    records.append({
                        "client_id": client_id,
                        "title": h.get("title", ""),
                        "description": json.dumps(rich_description_data),
                        "mitre_id": h.get("mitre_id", ""),
                        "splunk_query": h.get("splunk_query", ""),
                        "sentinel_kql": h.get("sentinel_kql", ""),
                        "status": "draft",
                        "source": "ai",
                        "created_at": datetime.datetime.utcnow().isoformat()
                    })
                supabase.table("hypotheses").insert(records).execute()
                print(f"DEBUG: Saved {len(records)} hypotheses successfully!")
                return f"Successfully saved {len(records)} draft hypotheses."
            except Exception as e:
                print(f"DEBUG JSON Parse Error! Raw data was:\n{hypothesis_data}\nError: {e}")
                return f"Error writing hypotheses: {e}"

class SplunkExecuteTool(BaseTool):
    name: str = "Splunk Execute Tool"
    description: str = "Pulls 'approved' hypotheses for a client and executes their Splunk queries. Input: client_id"
    
    def _run(self, client_id: str) -> str:
        if not supabase:
            return "Supabase not initialized."
        try:
            # Only pull APPROVED hypotheses (client-specific + global)
            res = supabase.table("hypotheses").select("*").or_(f"client_id.eq.{client_id},client_id.is.null").eq("status", "approved").execute()
            hypotheses = res.data
            if not hypotheses:
                return "No approved hypotheses found to execute."
                
            results = []
            for h in hypotheses:
                query = h.get("splunk_query")
                if query:
                    # Execute mock Splunk
                    result_data = execute_splunk_query(query)
                    
                    # Store result in Supabase
                    supabase.table("hunt_results").insert({
                        "client_id": client_id,
                        "hypothesis_id": h["id"],
                        "evidence": json.dumps(result_data),
                        "executed_at": datetime.datetime.utcnow().isoformat()
                    }).execute()
                    
                    # Mark hypothesis as complete so it isn't run again
                    supabase.table("hypotheses").update({"status": "complete"}).eq("id", h["id"]).execute()
                    
                    results.append({
                        "hypothesis_id": h["id"],
                        "title": h["title"],
                        "splunk_results": result_data
                    })
            return json.dumps(results)
        except Exception as e:
            return f"Error executing Splunk queries: {e}"

class HuntAnalysisUpdateTool(BaseTool):
    name: str = "Hunt Analysis Update Tool"
    description: str = "Updates a hunt result with the final verdict and analyst notes. Input must be a JSON string with keys: 'hypothesis_id', 'verdict' (TP/FP/Clean), and 'analyst_notes'."
    
    def _run(self, input_json: str) -> str:
        if not supabase:
            return "Supabase not initialized."
        try:
            data = json.loads(input_json)
            h_id = data.get("hypothesis_id")
            verdict = data.get("verdict")
            notes = data.get("analyst_notes")
            
            if not h_id or not verdict:
                return "Error: hypothesis_id and verdict are required."
                
            # Normalize verdict to match DB constraint ('TP', 'FP', 'clean')
            verdict_upper = verdict.upper()
            if verdict_upper in ['TP', 'FP']:
                final_verdict = verdict_upper
            elif verdict_upper == 'CLEAN':
                final_verdict = 'clean'
            else:
                final_verdict = 'clean' # Default fallback
                
            supabase.table("hunt_results").update({
                "verdict": final_verdict,
                "analyst_notes": notes
            }).eq("hypothesis_id", h_id).execute()
            
            return f"Successfully updated verdict for hypothesis {h_id} to {verdict}."
        except Exception as e:
            return f"Error updating hunt analysis: {e}"

class ReportWriterTool(BaseTool):
    name: str = "Report Writer Tool"
    description: str = "Generates PDF/CSV reports and optionally emails them to the client. Input: report_type ('ioc' or 'hunt'), client_id"
    
    def _run(self, report_type: str, client_id: str) -> str:
        """
        report_type: 'ioc' or 'hunt'
        """
        try:
            date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            if report_type == "ioc":
                report_data = build_ioc_report(client_id, date_str)
                files = generate_ioc_reports(client_id, date_str, report_data)
                
                # Mock sending email
                send_report_email(f"contact@{client_id}.com", "New IOC Report", "Attached")
                
                return f"Generated IOC report at {files.get('pdf')} and emailed client."
            else:
                return "Hunt report generator not fully implemented in tools yet."
        except Exception as e:
            return f"Error generating report: {e}"
