from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class AgentExecution(Base):

    __tablename__ = "agent_executions"


    id = Column(
        Integer,
        primary_key=True,
        index=True
    )


    agent_id = Column(
        Integer,
        ForeignKey(
            "agents.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )


    user_input = Column(
        Text,
        nullable=False
    )


    tool_used = Column(
        String(100),
        nullable=True
    )


    tool_arguments = Column(
        JSON,
        nullable=True
    )


    result = Column(
        JSON,
        nullable=True
    )


    agent = relationship(
        "Agent"
    )