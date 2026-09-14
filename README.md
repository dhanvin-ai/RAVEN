# RAVEN

# RAVEN — AI Agent Evaluation & Reliability Engine

> **Test. Evaluate. Secure. Monitor. Improve.**

RAVEN (Reliability Assessment & Validation Engine for AI Agents) is an AI-agent evaluation and reliability platform designed to test autonomous agents against realistic scenarios, detect failures, classify unsafe behavior, measure reliability, track regressions across versions, and execute untrusted operations inside a hardened sandbox.

As AI agents become capable of reasoning, using tools, and taking actions autonomously, traditional software testing is no longer enough.

**RAVEN provides an evaluation layer between AI agents and real-world deployment.**

---

## Why RAVEN?

Modern AI agents can:

- Make incorrect decisions
- Call the wrong tools
- Perform unauthorized actions
- Follow malicious instructions
- Produce inconsistent results
- Regress after a model or prompt update
- Execute potentially dangerous commands

Traditional unit testing cannot effectively capture many of these behaviors.

RAVEN approaches the problem as an **AI-agent reliability testing system**.


                    AI AGENT
                       │
                       ▼
              ┌─────────────────┐
              │      RAVEN      │
              │                 │
              │ Scenario Tests  │
              │ Tool Validation │
              │ Failure Analysis│
              │ Reliability     │
              │ Regression      │
              │ Security        │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       Reliability Score    Failure Report

## Techstack

Layer	Technology
Frontend	Next.js + TypeScript
UI	Tailwind CSS + shadcn/ui
Backend	Python + FastAPI
Agent orchestration	LangGraph
LLM	Gemini API / OpenAI API
Structured output	Pydantic
Evaluation	Python + custom evaluators
Database	SQLite initially
Optional DB	PostgreSQL
Charts	Recharts
Agent traces	Custom JSON traces
Optional observability	LangSmith
Deployment	Vercel + Render/Railway
Version control	GitHub

## Backend Setup

cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

## Start PostgreSQL

cd docker
docker compose up -d
docker compose ps

## Start FastAPI

fastapi dev app/main.py     # from apps/api

## API

Backend:            http://localhost:8000
Swagger docs:       http://localhost:8000/docs
Health check:       http://localhost:8000/health
Database test:      http://localhost:8000/db-test

## Environment Variables

Create apps/api/.env with:
DATABASE_URL=postgresql+psycopg://raven:raven_password@localhost:5432/raven

Never commit .env to Git.
