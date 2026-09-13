# RAVEN

RAVEN is an AI-powered application being developed as a full-stack project.

## Project Structure

RAVEN/
├── apps/
│   ├── api/
│   └── web/
├── docker/
├── docs/
├── .env.example
├── .gitignore
└── README.md

## Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL

### Frontend
- Next.js
- TypeScript

### Infrastructure
- Docker
- Docker Compose

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