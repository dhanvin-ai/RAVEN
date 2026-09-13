from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Boolean,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RegressionDecision(Base):
    __tablename__ = "regression_decisions"

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

    baseline_version_id = Column(
        Integer,
        ForeignKey(
            "agent_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    current_version_id = Column(
        Integer,
        ForeignKey(
            "agent_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    baseline_report_id = Column(
        Integer,
        ForeignKey(
            "reliability_reports.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    current_report_id = Column(
        Integer,
        ForeignKey(
            "reliability_reports.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    baseline_reliability_score = Column(
        Float,
        nullable=True,
    )

    current_reliability_score = Column(
        Float,
        nullable=True,
    )

    reliability_change = Column(
        Float,
        nullable=True,
    )

    pass_rate_change = Column(
        Float,
        nullable=True,
    )

    new_failure_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    new_pass_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    persistent_failure_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    persistent_pass_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    regression_detected = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    direction = Column(
        String(50),
        nullable=False,
    )

    severity = Column(
        String(50),
        nullable=False,
    )

    decision = Column(
        String(20),
        nullable=False,
    )

    ci_gate_status = Column(
        String(20),
        nullable=False,
    )

    ci_gate_allowed = Column(
        Boolean,
        nullable=False,
    )

    reason = Column(
        String,
        nullable=True,
    )

    agent = relationship(
        "Agent",
    )

    baseline_version = relationship(
        "AgentVersion",
        foreign_keys=[baseline_version_id],
    )

    current_version = relationship(
        "AgentVersion",
        foreign_keys=[current_version_id],
    )

    baseline_report = relationship(
        "ReliabilityReport",
        foreign_keys=[baseline_report_id],
    )

    current_report = relationship(
        "ReliabilityReport",
        foreign_keys=[current_report_id],
    )
