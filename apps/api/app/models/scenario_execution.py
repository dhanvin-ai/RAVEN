from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class ScenarioExecution(Base):
    __tablename__ = "scenario_executions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    scenario_id = Column(
        Integer,
        ForeignKey(
            "scenarios.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    agent_id = Column(
        Integer,
        ForeignKey(
            "agents.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    agent_version_id = Column(
        Integer,
        ForeignKey(
            "agent_versions.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    status = Column(
        String(50),
        nullable=False,
        default="PENDING"
    )

    actual_output = Column(
        Text,
        nullable=True
    )

    tool_calls = Column(
        JSON,
        nullable=True
    )

    forbidden_tool_calls = Column(
        JSON,
        nullable=True
    )

    expected_behavior_passed = Column(
        Boolean,
        nullable=True
    )

    failure_reason = Column(
        Text,
        nullable=True
    )

    failure_classification = Column(
        String(50),
        nullable=True
    )

    scenario = relationship(
        "Scenario"
    )

    agent = relationship(
        "Agent"
    )

    agent_version = relationship(
        "AgentVersion"
    )
