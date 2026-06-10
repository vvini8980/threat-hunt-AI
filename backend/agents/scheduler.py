from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from agents.crew_definitions import get_daily_hunt_crew, get_ioc_collection_crew
from services.supabase_client import supabase
import datetime
import asyncio

def log_pipeline_run(crew_type: str, client_id: str, status: str, error_msg: str = None):
    if not supabase: return
    try:
        supabase.table("pipeline_logs").insert({
            "crew_type": crew_type,
            "client_id": client_id,
            "status": status,
            "error_msg": error_msg,
            "run_date": datetime.datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        print(f"Failed to log pipeline run: {e}")

def run_daily_hunt():
    print("[SCHEDULER] Starting Daily Hunt Crew...")
    if not supabase:
        print("[SCHEDULER] Supabase not initialized, aborting.")
        return
        
    try:
        # Fetch all active clients to run the hunt for
        res = supabase.table("clients").select("id").execute()
        clients = res.data or []
        for c in clients:
            client_id = c["id"]
            print(f"[SCHEDULER] Running Daily Hunt for Client: {client_id}")
            log_pipeline_run("hunt", client_id, "started")
            try:
                crew = get_daily_hunt_crew(client_id)
                crew.kickoff()
                log_pipeline_run("hunt", client_id, "success")
            except Exception as e:
                log_pipeline_run("hunt", client_id, "failed", str(e))
                print(f"Error in hunt for {client_id}: {e}")
    except Exception as e:
        print(f"[SCHEDULER] Daily Hunt failed globally: {e}")

def run_ioc_collection():
    print("[SCHEDULER] Starting IOC Collection Crew...")
    if not supabase:
        print("[SCHEDULER] Supabase not initialized, aborting.")
        return
        
    try:
        res = supabase.table("clients").select("id").execute()
        clients = res.data or []
        for c in clients:
            client_id = c["id"]
            print(f"[SCHEDULER] Running IOC Collection for Client: {client_id}")
            log_pipeline_run("ioc", client_id, "started")
            try:
                crew = get_ioc_collection_crew(client_id)
                crew.kickoff()
                log_pipeline_run("ioc", client_id, "success")
            except Exception as e:
                log_pipeline_run("ioc", client_id, "failed", str(e))
                print(f"Error in IOC collection for {client_id}: {e}")
    except Exception as e:
        print(f"[SCHEDULER] IOC Collection failed globally: {e}")

def run_daily_intel_report():
    """
    Runs at midnight (12:00 AM) each day.
    Generates a daily intel report from the previous day's IOC data.
    """
    print("[SCHEDULER] Running Midnight Daily Intel Report Generation...")
    try:
        from services.intel_report_service import generate_daily_intel_report
        yesterday = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        report = loop.run_until_complete(generate_daily_intel_report(yesterday))
        loop.close()
        print(f"[SCHEDULER] Daily Intel Report generated: {report.get('ioc_count', 0)} IOCs, {report.get('actor_count', 0)} actors")
    except Exception as e:
        print(f"[SCHEDULER] Daily Intel Report failed: {e}")


def start_scheduler():
    scheduler = BackgroundScheduler()

    # Run Daily Hunt at 6:00 AM
    scheduler.add_job(
        run_daily_hunt,
        trigger=CronTrigger(hour=6, minute=0),
        id="daily_hunt_job",
        name="Run Daily Hunt Crew every morning at 6 AM",
        replace_existing=True
    )

    # Run IOC Collection at 7:00 AM
    scheduler.add_job(
        run_ioc_collection,
        trigger=CronTrigger(hour=7, minute=0),
        id="ioc_collection_job",
        name="Run IOC Collection Crew every morning at 7 AM",
        replace_existing=True
    )

    # ── Run Daily Intel Report at MIDNIGHT (12:00 AM) ──────────────────────
    scheduler.add_job(
        run_daily_intel_report,
        trigger=CronTrigger(hour=0, minute=0),
        id="daily_intel_report_job",
        name="Generate Daily IOC Intel Report at midnight",
        replace_existing=True
    )

    scheduler.start()
    print("[SCHEDULER] APScheduler started. Jobs: Daily Hunt (6AM), IOC Collection (7AM), Daily Intel Report (12AM).")
