from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import auth, clients, hypotheses, hunt, ioc, reports, intel

from agents.scheduler import start_scheduler

app = FastAPI(
    title="Threat Hunt API",
    description="Backend API for Threat Hunt MDR Platform",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    print("Starting APScheduler for CrewAI...")
    start_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(clients.router, prefix="/clients", tags=["Clients"])
app.include_router(hypotheses.router, prefix="/hypotheses", tags=["Hypotheses"])
app.include_router(hunt.router, prefix="/hunt", tags=["Hunt Execution"])
app.include_router(ioc.router, prefix="/ioc", tags=["IOC Management"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])
app.include_router(intel.router, prefix="/intel", tags=["Proactive Intel"])

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Threat Hunt API is running."}

@app.post("/test-crew/{client_id}/{crew_type}")
def trigger_test_crew(client_id: str, crew_type: str):
    from agents.crew_definitions import get_daily_hunt_crew, get_ioc_collection_crew
    try:
        if crew_type == "hunt":
            crew = get_daily_hunt_crew(client_id)
            crew.kickoff()
            return {"status": "success", "message": "Daily hunt crew executed."}
        elif crew_type == "ioc":
            crew = get_ioc_collection_crew(client_id)
            crew.kickoff()
            return {"status": "success", "message": "IOC collection crew executed."}
        else:
            return {"status": "error", "message": "Invalid crew type. Use 'hunt' or 'ioc'."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
