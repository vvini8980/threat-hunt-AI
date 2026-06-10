"""
Intel Router — Proactive Intel Feed & Daily Report Generation
GET  /intel/feed        — Returns the live AI-analyzed threat campaign feed (from OpenCTI + Gemini)
POST /intel/daily-run   — Triggers daily IOC sync + Gemini analysis (called at midnight)
GET  /intel/daily-report/{date} — Retrieve a daily report for a given date
GET  /intel/status      — Health check
"""

from fastapi import APIRouter, HTTPException, Request
from services.intel_report_service import (
    generate_daily_intel_report,
    get_daily_report,
    fetch_and_analyze_opencti_feed,
)
import datetime
import os

router = APIRouter()


@router.get("/feed")
async def get_intel_feed(request: Request):
    """
    Returns the live proactive threat intel feed.
    Fetches real IOCs from OpenCTI, groups them by threat actor,
    then uses Gemini to generate structured threat campaign cards.
    Called by the frontend on page load and on manual refresh.
    """
    try:
        opencti_url = request.headers.get("x-opencti-url")
        opencti_token = request.headers.get("x-opencti-token")
        campaigns = await fetch_and_analyze_opencti_feed(opencti_url, opencti_token)
        return {
            "status": "success",
            "count": len(campaigns),
            "campaigns": campaigns,
            "generated_at": datetime.datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-run")
async def run_daily_intel(request: Request, date_str: str = None, force: bool = False):
    """
    Trigger a daily intel report generation.
    - Syncs fresh IOCs from OpenCTI
    - Groups by threat actor
    - Uses Gemini to generate full campaign analysis
    - Saves report to Supabase
    Called automatically at midnight by the backend scheduler AND frontend timer.
    """
    try:
        opencti_url = request.headers.get("x-opencti-url")
        opencti_token = request.headers.get("x-opencti-token")

        if not date_str:
            yesterday = datetime.datetime.utcnow() - datetime.timedelta(days=1)
            date_str = yesterday.strftime("%Y-%m-%d")

        report = await generate_daily_intel_report(date_str, opencti_url, opencti_token, force=force)
        return {
            "status": "success",
            "message": f"Daily intel report generated for {date_str}",
            "report": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-report/{date_str}")
async def fetch_daily_report(date_str: str):
    """
    Retrieve a daily intel report for a given date (YYYY-MM-DD).
    """
    try:
        report = await get_daily_report(date_str)
        if not report:
            return {"status": "not_found", "message": f"No report found for {date_str}"}
        return {"status": "success", "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
def intel_status():
    """Returns current intel feed status and connector health."""
    opencti_url   = os.getenv("OPENCTI_URL", "")
    opencti_token = os.getenv("OPENCTI_TOKEN", "")
    gemini_key    = os.getenv("GEMINI_API_KEY", "")
    return {
        "status": "ok",
        "opencti_configured": bool(opencti_url and opencti_token and "placeholder" not in opencti_token),
        "gemini_configured":  bool(gemini_key and "mock" not in gemini_key),
        "next_daily_run": "12:00 AM (midnight) local time",
        "description": "Real-time OpenCTI IOC sync + Gemini AI campaign analysis"
    }
