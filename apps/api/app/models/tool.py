from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Tool(Base):
    __tablename__ = "tools"

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

    agents = relationship(
        "Agent",
        secondary="agent_tools",
        back_populates="tools",
    )