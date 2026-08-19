from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    service: str
    environment: str
    version: str
    time: datetime


class ReadinessResponse(BaseModel):
    status: str
    service: str
    database: str
    time: datetime
