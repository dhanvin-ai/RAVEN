from pydantic import BaseModel, Field


class ToolRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=1)
    tools: list[ToolRequest] = Field(default_factory=list)
class AgentVersionCreate(BaseModel):
    model: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=1)
