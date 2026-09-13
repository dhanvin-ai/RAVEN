from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    JSON,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ReliabilityReport(Base):
    __tablename__ = "reliability_reports"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    agent_id = Column(
        Integer,
        ForeignKey(
            "agents.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    agent_version_id = Column(
        Integer,
        ForeignKey(
            "agent_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    total_scenarios = Column(
        Integer,
        nullable=False,
    )

    passed = Column(
        Integer,
        nullable=False,
    )

    failed = Column(
        Integer,
        nullable=False,
    )

    pass_rate = Column(
        Float,
        nullable=False,
    )

    reliability_score = Column(
        Float,
        nullable=False,
    )

    severity_breakdown = Column(
        JSON,
        nullable=True,
    )

    failure_classification_breakdown = Column(
        JSON,
        nullable=True,
    )

    status = Column(
        String(50),
        nullable=False,
    )

    agent = relationship(
        "Agent",
    )

    agent_version = relationship(
        "AgentVersion",
    )