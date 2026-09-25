from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from app.database import Base, engine

# ─────────────────────────────────────────────
# IMPORT MODELS
# SQLAlchemy needs these imports so all models
# are registered before create_all()
# ─────────────────────────────────────────────

from app.models import (
    Agent,
    AgentVersion,
    Tool,
    TestSuite,
    Scenario,
    ReliabilityReport,
    Organization,
    Project,
    Environment,
    ProjectAPIKey,
    EndUser,
    Conversation,
    Trace,
    Span,
    TelemetryEvent,
    ToolCall,
    ModelCall,
    IngestionFailure,
)

# ─────────────────────────────────────────────
# IMPORT ROUTERS
# ─────────────────────────────────────────────

from app.registry import router as registry_router
from app.agents.customer_support import CustomerSupportAgent
from app.routes import agents
from app.routes import runtime
from app.routes import scenarios
from app.routes import reliability
from app.routes import redteam
from app.routes import prompt_doctor
from app.routes import multiturn
from app.routes import trace
from app.routes import benchmark
from app.routes import ci
from app.routes import ingestion


# ─────────────────────────────────────────────
# CREATE DATABASE TABLES
# ─────────────────────────────────────────────

Base.metadata.create_all(bind=engine)

# Ensure ponytail_mode column exists for all agents
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS ponytail_mode VARCHAR(20) DEFAULT 'OFF';"))
        conn.commit()
except Exception:
    pass

# Auto-seed database if empty (ensures cloud/serverless instances have full enterprise data)
try:
    from app.database import SessionLocal
    from app.models.agent import Agent
    from app.models.reliability_report import ReliabilityReport
    with SessionLocal() as db:
        agent_count = db.query(Agent).count()
        report_count = db.query(ReliabilityReport).count()
        cs_agent = db.query(Agent).filter(Agent.name.ilike("%customer support%")).first()
        if agent_count == 0 or report_count == 0 or not cs_agent:
            from app.seeds.enterprise_seed import seed_enterprise
            seed_enterprise()
        # Phase 1/2 telemetry scope: seed only when telemetry tables are empty.
        try:
            from app.models.telemetry import Organization as TelemetryOrg
            if db.query(TelemetryOrg).count() == 0:
                from app.seeds.telemetry_seed import seed_telemetry
                seed_telemetry()
        except Exception as seed_exc:
            print(f"Startup telemetry-seeding notice: {seed_exc}")
except Exception as e:
    print(f"Startup auto-seeding notice: {e}")


# ─────────────────────────────────────────────
# FASTAPI APPLICATION
# ─────────────────────────────────────────────

app = FastAPI(
    title="RAVEN API",
    description="Backend API for RAVEN",
    version="0.2.0",
)


# ─────────────────────────────────────────────
# CORS
# Allows the Next.js frontend to communicate
# with the FastAPI backend.
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://web-green-five-64.vercel.app",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REGISTER ROUTERS
# ─────────────────────────────────────────────

app.include_router(registry_router)
app.include_router(agents.router)
app.include_router(runtime.router)
app.include_router(scenarios.router)
app.include_router(reliability.router)
app.include_router(redteam.router)
app.include_router(prompt_doctor.router)
app.include_router(multiturn.router)
app.include_router(trace.router)
app.include_router(benchmark.router)
app.include_router(ci.router)
app.include_router(ingestion.router)


# ─────────────────────────────────────────────
# CUSTOMER SUPPORT AGENT
# ─────────────────────────────────────────────

customer_support_agent = CustomerSupportAgent()


class AgentRequest(BaseModel):
    message: str


# ─────────────────────────────────────────────
# BASIC API ROUTES
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "RAVEN API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/db-test")
def database_test():

    with engine.connect() as connection:

        result = connection.execute(
            text("SELECT current_database()")
        )

        database_name = result.scalar()

    return {
        "database": database_name,
        "status": "connected",
    }


# ─────────────────────────────────────────────
# CUSTOMER SUPPORT TEST ENDPOINT
# ─────────────────────────────────────────────

@app.post("/agent/customer-support")
def customer_support(request: AgentRequest):

    result = customer_support_agent.run(
        request.message
    )

    return result