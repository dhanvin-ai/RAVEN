import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Auto-detect cloud / Vercel / serverless environment
is_cloud = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
is_local_pg = bool(DATABASE_URL and ("localhost:5432" in DATABASE_URL or "127.0.0.1:5432" in DATABASE_URL))

if not DATABASE_URL or (is_cloud and is_local_pg):
    db_path = "/tmp/raven.db" if os.path.exists("/tmp") else "./raven.db"
    DATABASE_URL = f"sqlite:///{db_path}"

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
        )
except Exception:
    db_path = "/tmp/raven.db" if os.path.exists("/tmp") else "./raven.db"
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()