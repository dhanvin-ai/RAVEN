from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class TestSuite(Base):
    __tablename__ = "test_suites"

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

    name = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    scenarios = relationship(
        "Scenario",
        back_populates="test_suite",
        cascade="all, delete-orphan",
    )

    agent = relationship(
        "Agent",
    )


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    test_suite_id = Column(
        Integer,
        ForeignKey(
            "test_suites.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    category = Column(
        String(50),
        nullable=False,
    )

    severity = Column(
        String(20),
        nullable=False,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    user_input = Column(
        Text,
        nullable=False,
    )

    expected_behavior = Column(
        Text,
        nullable=False,
    )
    forbidden_actions = Column(
        Text,
        nullable=True,
    )

    expected_tool = Column(
        String(100),
        nullable=True,
    )

    expected_tool_arguments = Column(
        JSON,
        nullable=True,
    )

    metadata_json = Column(
        JSON,
        nullable=True,
    )

    test_suite = relationship(
        "TestSuite",
        back_populates="scenarios",
    )
