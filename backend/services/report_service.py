import os
import asyncio
import google.generativeai as genai
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class ReportService:
    def __init__(self):
        self.model_name = "gemini-2.0-flash"

    async def _call_gemini(self, prompt: str) -> str:
        """Core async call to Gemini 2.0 Flash with rate limit handling."""
        try:
            model = genai.GenerativeModel(self.model_name)
            response = await asyncio.to_thread(model.generate_content, prompt)
            return response.text
        except Exception as e:
            if "429" in str(e):
                print("Rate limit hit (429) for Gemini 2.0 Flash. Sleeping 60 seconds...")
                await asyncio.sleep(60)
                try:
                    model = genai.GenerativeModel(self.model_name)
                    response = await asyncio.to_thread(model.generate_content, prompt)
                    return response.text
                except Exception as retry_e:
                    raise HTTPException(status_code=503, detail="Gemini report service unavailable after retry.")
            else:
                raise HTTPException(status_code=503, detail=f"Gemini API error: {str(e)}")

    async def generate_hunt_report(self, hypothesis: dict, findings: list[dict]) -> str:
        """
        Generates a full markdown threat hunt report for a given hypothesis and its findings.

        Args:
            hypothesis: dict with name, description, mitre_id, mitre_name,
                        hunting_logic, false_positive, query
            findings:   list of dicts representing what was found during the hunt
                        e.g. [{timestamp, host, user, event_id, details}, ...]

        Returns:
            Full markdown report string
        """
        name         = hypothesis.get("name", "Unknown Hypothesis")
        description  = hypothesis.get("description", "")
        mitre_id     = hypothesis.get("mitre_id", "")
        mitre_name   = hypothesis.get("mitre_name", "")
        hunting_logic= hypothesis.get("hunting_logic", "")
        false_pos    = hypothesis.get("false_positive", "")
        query        = hypothesis.get("query", "")

        findings_block = "No findings were recorded." if not findings else "\n".join(
            [f"- {f}" for f in findings]
        )

        prompt = f"""You are a senior threat hunting analyst writing a professional, detailed threat hunt report.

Generate a full markdown report for the following hunt:

## Hypothesis
Name: {name}
Description: {description}
MITRE ATT&CK: {mitre_id} — {mitre_name}
Hunting Logic: {hunting_logic}
Known False Positives: {false_pos}
SIEM Query Used: {query}

## Raw Findings
{findings_block}

---

Write the report in the following structure:
1. **Executive Summary** — 2-3 sentences for management
2. **Hypothesis Overview** — Restate the hypothesis and MITRE technique context
3. **Hunt Methodology** — How the hunt was conducted, what data sources were queried
4. **Findings & Analysis** — Detailed breakdown of each finding, severity, and context
5. **False Positive Assessment** — Which findings may be benign and why
6. **Threat Assessment** — Overall risk level (Critical/High/Medium/Low/None), attacker intent
7. **Recommended Actions** — Specific remediation and detection engineering steps
8. **Conclusion** — Summary and next steps

Use professional security language. Use markdown tables for findings where appropriate.
Use bold for key terms. Keep it concise but thorough."""

        return await self._call_gemini(prompt)

    async def generate_ioc_report(self, ioc_value: str, ioc_type: str, enrichment: dict, related_hypotheses: list[dict]) -> str:
        """
        Generates a full markdown IOC threat intelligence report.

        Args:
            ioc_value:            The indicator value (e.g. IP, domain, hash)
            ioc_type:             IOC type (ip, domain, sha256, url, email)
            enrichment:           Result from ioc_ai_service.enrich_ioc()
            related_hypotheses:   List of similar hypotheses from hypothesis_ai_service

        Returns:
            Full markdown report string
        """
        source = enrichment.get("source", "unknown")
        source_label = "OpenCTI (Local Threat Intel)" if source == "opencti" else "AI Analysis (Groq Llama-3.3)"

        enrichment_block = "\n".join([f"- **{k}:** {v}" for k, v in enrichment.items()])

        hyp_block = "No related hunt hypotheses found." if not related_hypotheses else "\n".join(
            [f"- {h.get('name', '')} ({h.get('mitre_id', '')})" for h in related_hypotheses]
        )

        prompt = f"""You are a senior threat intelligence analyst writing a professional IOC investigation report.

## Indicator Under Investigation
- **Type:** {ioc_type}
- **Value:** {ioc_value}
- **Intelligence Source:** {source_label}

## Enrichment Data
{enrichment_block}

## Related Hunt Hypotheses
{hyp_block}

---

Write a full markdown IOC threat intelligence report with the following structure:
1. **Executive Summary** — One paragraph on what this IOC represents
2. **Indicator Details** — Type, value, classification, confidence score
3. **Threat Intelligence** — What was found in OpenCTI or the AI analysis
4. **Kill Chain Mapping** — Which MITRE ATT&CK phases this IOC maps to
5. **Risk Assessment** — Overall risk level with justification
6. **Related Attack Patterns** — Techniques and TTPs associated with this IOC
7. **Recommended Actions** — Block, monitor, investigate steps
8. **Hunting Recommendations** — Link to related hypotheses above

Use professional threat intel language. Be concise and actionable."""

        return await self._call_gemini(prompt)

    async def generate_campaign_summary(self, client_slug: str, hypotheses: list[dict], iocs: list[dict]) -> str:
        """
        Generates a high-level executive campaign summary for a client.

        Args:
            client_slug:  Client identifier
            hypotheses:   List of hypotheses hunted this period
            iocs:         List of IOCs discovered/enriched this period

        Returns:
            Full markdown executive summary string
        """
        hyp_block = "\n".join([
            f"- {h.get('name', '')} | {h.get('mitre_id', '')} | Priority: {h.get('priority', 'N/A')}"
            for h in hypotheses
        ]) or "None this period."

        ioc_block = "\n".join([
            f"- {i.get('type', '').upper()}: {i.get('value', '')} | Risk: {i.get('risk_level', 'N/A')}"
            for i in iocs
        ]) or "None this period."

        prompt = f"""You are a senior threat hunting manager writing an executive campaign summary report.

## Client: {client_slug}

## Hypotheses Hunted This Period
{hyp_block}

## IOCs Investigated This Period
{ioc_block}

---

Write a professional executive campaign summary in markdown with:
1. **Campaign Overview** — Period summary, total hunts, total IOCs
2. **Key Findings** — Most significant threats discovered
3. **MITRE ATT&CK Coverage** — Which tactics and techniques were covered
4. **Risk Posture** — Overall client risk assessment this period
5. **Recommended Priorities** — Top 3 actions for next period
6. **Conclusion**

Write for a CISO audience. Keep it concise, strategic, and actionable."""

        return await self._call_gemini(prompt)

report_service = ReportService()
