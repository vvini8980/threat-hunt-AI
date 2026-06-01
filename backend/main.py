from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import auth, clients, hypotheses, hunt, ioc, reports

app = FastAPI(
    title="Threat Hunt API",
    description="Backend API for Threat Hunt MDR Platform",
    version="1.0.0"
)

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

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Threat Hunt API is running."}
