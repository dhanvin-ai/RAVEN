import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)  # SILENT_FAILURE, TOOL_ERROR, FRUSTRATION, VIOLATION, SUCCESS
    user_identifier = Column(String(100), nullable=False)
    user_message = Column(Text, nullable=False)
    agent_response = Column(Text, nullable=True)
    tool_name = Column(String(100), nullable=True)
    status = Column(String(20), default="FAILED")  # FAILED, VIOLATION, SUCCESS, WARNING
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("Agent")


class AgentViolation(Base):
    __tablename__ = "agent_violations"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    rule_name = Column(String(255), nullable=False)
    count = Column(Integer, default=1)
    trend = Column(String(20), default="+100%")
    last_seen = Column(String(50), default="Just now")

    agent = relationship("Agent")


class UserIntent(Base):
    __tablename__ = "user_intents"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    intent_name = Column(String(255), nullable=False)
    message_count = Column(Integer, default=5)
    trend = Column(String(20), default="0%")
    suggested = Column(Boolean, default=False)
    last_seen = Column(String(50), default="Just now")

    agent = relationship("Agent")


class ToolErrorStat(Base):
    __tablename__ = "tool_error_stats"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    tool_name = Column(String(100), nullable=False)
    error_count = Column(Integer, default=1)
    last_error = Column(Text, nullable=True)

    agent = relationship("Agent")
