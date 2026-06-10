"""
Reports Router — On-demand report generation for multiple report types.
Supports: daily, weekly, hunt, ioc, executive, coverage
"""
from fastapi import APIRouter, HTTPException, Query
from services.supabase_client import supabase
from services.report_generator import (
    generate_hunt_report,
    generate_ioc_reports,
    build_ioc_report,
    build_daily_summary_data,
    build_weekly_summary_data,
    generate_daily_pdf,
    generate_weekly_pdf,
    generate_executive_pdf,
    generate_coverage_pdf,
)
from services.email_service import send_report_email
import datetime
import os

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _date_window(date_range: str):
    """Returns (start_dt, end_dt) based on the range string."""
    now = datetime.datetime.utcnow()
    end = now
    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "yesterday":
        start = (now - datetime.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "week":
        start = now - datetime.timedelta(days=7)
    elif date_range == "month":
        start = now - datetime.timedelta(days=30)
    else:
        start = datetime.datetime(2000, 1, 1)  # all time
    return start, end


def _save_report(client_id: str, report_type: str, summary: str, file_url: str = None) -> dict:
    """Inserts a report record into Supabase and returns it."""
    try:
        record = {
            "client_id": client_id,
            "report_type": report_type,
            "report_date": datetime.datetime.utcnow().isoformat(),
            "file_url": file_url,
            "summary": summary,
        }
        res = supabase.table("reports").insert([record]).execute()
        return res.data[0] if res.data else record
    except Exception as e:
        print(f"Warning: could not save report record: {e}")
        return {}


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/")
def get_reports(client_id: str = Query(...)):
    """Returns all reports for a client."""
    if not supabase:
        return []
    try:
        res = (
            supabase.table("reports")
            .select("*")
            .eq("client_id", client_id)
            .order("report_date", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily/{client_id}")
def create_daily_report(client_id: str, date_range: str = Query(default="today")):
    """Generates a Daily Hunt Summary report."""
    if not supabase:
        return {"status": "mocked"}
    try:
        start, end = _date_window(date_range)
        data = build_daily_summary_data(client_id, start, end)
        pdf_path = generate_daily_pdf(client_id, data)
        file_url = _upload_or_mock(pdf_path)
        summary  = f"Daily summary: {data['total_hunts']} hunts, {data['tp_count']} TPs, {data['fp_count']} FPs"
        return _save_report(client_id, "daily", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly/{client_id}")
def create_weekly_report(client_id: str, date_range: str = Query(default="week")):
    """Generates a Weekly Executive Summary report."""
    if not supabase:
        return {"status": "mocked"}
    try:
        start, end = _date_window("week")
        data = build_weekly_summary_data(client_id, start, end)
        pdf_path = generate_weekly_pdf(client_id, data)
        file_url = _upload_or_mock(pdf_path)
        summary  = f"Weekly executive summary: {data['total_hunts']} hunts over 7 days"
        return _save_report(client_id, "weekly", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hunt/{client_id}")
def create_hunt_report(client_id: str, date_range: str = Query(default="week")):
    """Generates a Hunt Results report."""
    if not supabase:
        return {"status": "mocked"}
    try:
        start, end = _date_window(date_range)
        res = (
            supabase.table("hunt_results")
            .select("*, hypotheses(title, mitre_id)")
            .eq("client_id", client_id)
            .gte("executed_at", start.isoformat())
            .lte("executed_at", end.isoformat())
            .execute()
        )
        results = []
        for row in (res.data or []):
            results.append({
                "hypothesis": row.get("hypotheses", {}).get("title", "Unknown"),
                "mitre_id":   row.get("hypotheses", {}).get("mitre_id", ""),
                "verdict":    row.get("verdict", "pending"),
                "executed_at": row.get("executed_at", ""),
                "evidence":   (row.get("evidence") or "")[:500],
            })
        pdf_path = generate_hunt_report(client_id, results)
        file_url = _upload_or_mock(pdf_path)
        summary  = f"Hunt results report: {len(results)} hunts in range"
        return _save_report(client_id, "hunt", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ioc/{client_id}")
def create_ioc_report(client_id: str, date_range: str = Query(default="today")):
    """Generates an IOC Intelligence report."""
    if not supabase:
        return {"status": "mocked"}
    try:
        date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        report_data = build_ioc_report(client_id, date_str)
        files    = generate_ioc_reports(client_id, date_str, report_data)
        file_url = _upload_or_mock(files.get("pdf", ""))
        ioc_count = sum(len(v) for v in report_data.get("iocs", {}).values())
        summary  = f"IOC report: {ioc_count} IOCs from {len(report_data.get('threat_actors', []))} threat actors"
        return _save_report(client_id, "ioc", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/executive/{client_id}")
def create_executive_report(client_id: str, date_range: str = Query(default="month")):
    """Generates a C-suite Executive Threat Brief."""
    if not supabase:
        return {"status": "mocked"}
    try:
        start, end = _date_window(date_range)
        data     = build_weekly_summary_data(client_id, start, end)  # reuse weekly data
        pdf_path = generate_executive_pdf(client_id, data)
        file_url = _upload_or_mock(pdf_path)
        summary  = f"Executive threat brief: {date_range} overview"
        return _save_report(client_id, "executive", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/coverage/{client_id}")
def create_coverage_report(client_id: str, date_range: str = Query(default="all")):
    """Generates a MITRE ATT&CK Coverage report."""
    if not supabase:
        return {"status": "mocked"}
    try:
        res = supabase.table("hypotheses").select("mitre_id, title, status").eq("client_id", client_id).execute()
        hyps = res.data or []
        pdf_path = generate_coverage_pdf(client_id, hyps)
        file_url = _upload_or_mock(pdf_path)
        unique_techniques = len(set(h.get("mitre_id") for h in hyps if h.get("mitre_id")))
        summary = f"MITRE coverage: {unique_techniques} techniques covered across {len(hyps)} hypotheses"
        return _save_report(client_id, "coverage", summary, file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send/{client_id}")
def send_reports_to_client(client_id: str, report_id: str = Query(default=None)):
    """Emails the latest (or specific) report to the client."""
    if not supabase:
        return {"status": "mocked"}
    try:
        # Fetch client info
        client_res = supabase.table("clients").select("name, contact_email").eq("id", client_id).execute()
        if not client_res.data:
            raise HTTPException(status_code=404, detail="Client not found")
        client = client_res.data[0]
        email  = client.get("contact_email") or f"contact@{client['name'].lower().replace(' ', '')}.com"

        # Fetch target report
        if report_id:
            report_res = supabase.table("reports").select("*").eq("id", report_id).execute()
        else:
            report_res = (
                supabase.table("reports")
                .select("*")
                .eq("client_id", client_id)
                .order("report_date", desc=True)
                .limit(1)
                .execute()
            )

        if not report_res.data:
            raise HTTPException(status_code=404, detail="No reports found")
        report = report_res.data[0]

        subject = f"[ThreatHunt AI] {report.get('report_type', 'Hunt').title()} Report — {client['name']}"
        body    = (
            f"Dear {client['name']} team,\n\n"
            f"Please find your latest {report.get('report_type', 'threat hunt')} report attached.\n\n"
            f"Summary: {report.get('summary', 'See attached report for details.')}\n\n"
            f"Report date: {report.get('report_date', '')}\n"
            f"Download: {report.get('file_url', 'N/A')}\n\n"
            f"-- ThreatHunt AI Platform"
        )

        send_report_email(to_email=email, subject=subject, body=body)
        supabase.table("reports").update({"sent_at": datetime.datetime.utcnow().isoformat()}).eq("id", report["id"]).execute()
        return {"status": "success", "message": f"Report emailed to {email}"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline / Metrics (kept for Dashboard)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/health")
def get_pipeline_health(time_range: str = Query("all")):
    """Returns pipeline execution logs and health status."""
    if not supabase:
        return {"status": "mocked", "logs": []}
    try:
        query = supabase.table("pipeline_logs").select("*").order("run_date", desc=True)
        if time_range == "today":
            cutoff = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            query = query.gte("run_date", cutoff)
        elif time_range == "week":
            cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).isoformat()
            query = query.gte("run_date", cutoff)
        res = query.limit(50).execute()
        return {"status": "success", "logs": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
def get_pipeline_metrics(time_range: str = Query("all")):
    """Returns aggregation metrics for the dashboard."""
    if not supabase:
        return {"status": "mocked", "metrics": {}}
    try:
        res        = supabase.table("hypotheses").select("status, rejected_reason, created_at").execute()
        hypotheses = res.data or []
        hunt_res   = supabase.table("hunt_results").select("id, verdict, executed_at").execute()
        hunt_results = hunt_res.data or []

        if time_range != "all":
            now = datetime.datetime.utcnow()
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0) if time_range == "today" else now - datetime.timedelta(days=7)
            def after(d):
                if not d: return False
                try:
                    dt = datetime.datetime.fromisoformat(d.replace("Z", "+00:00"))
                    if dt.tzinfo: dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                    return dt >= cutoff
                except: return False
            hypotheses   = [h for h in hypotheses if after(h.get("created_at"))]
            hunt_results = [h for h in hunt_results if after(h.get("executed_at"))]

        return {
            "status": "success",
            "metrics": {
                "total":       len(hypotheses),
                "draft":       sum(1 for h in hypotheses if h.get("status") == "draft"),
                "approved":    sum(1 for h in hypotheses if h.get("status") == "approved"),
                "rejected":    sum(1 for h in hypotheses if h.get("rejected_reason")),
                "complete":    sum(1 for h in hypotheses if h.get("status") == "complete"),
                "total_hunts": len(hunt_results),
                "tp_count":    sum(1 for h in hunt_results if h.get("verdict") == "TP"),
                "fp_count":    sum(1 for h in hunt_results if h.get("verdict") == "FP"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Internal
# ──────────────────────────────────────────────────────────────────────────────

def _upload_or_mock(pdf_path: str) -> str:
    """In production, upload to Supabase Storage. For now return a local mock URL."""
    if not pdf_path:
        return None
    filename = os.path.basename(pdf_path)
    # TODO: upload to Supabase Storage bucket and return signed URL
    return f"/reports/download/{filename}"
