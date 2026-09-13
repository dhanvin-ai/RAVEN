from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.database import Base


agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column(
        "agent_id",
        Integer,
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tool_id",
        Integer,
        ForeignKey("tools.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Agent(Base):
    __tablename__ = "agents"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(100),
        unique=True,
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    model = Column(
        String(100),
        nullable=False,
    )

    ponytail_mode = Column(
        String(20),
        default="OFF",
        nullable=False,
    )

    versions = relationship(
        "AgentVersion",
        back_populates="agent",
        cascade="all, delete-orphan",
    )

    tools = relationship(
        "Tool",
        secondary=agent_tools,
        back_populates="agents",
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"

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

    version = Column(
        Integer,
        nullable=False,
    )
    model_name = Column(
        String(100),
        nullable=False,
    )

    system_prompt = Column(
        Text,
        nullable=False,
    )

    agent = relationship(
        "Agent",
        back_populates="versions",
    )