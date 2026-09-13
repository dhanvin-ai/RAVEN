from pydantic import BaseModel, Field


class ScenarioGenerateRequest(BaseModel):
    agent_id: int = Field(..., gt=0)
    count: int = Field(default=10, ge=1, le=100)


class GeneratedScenario(BaseModel):
    name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    severity: str = Field(..., min_length=1)
    user_input: str = Field(..., min_length=1)
    expected_behavior: str = Field(..., min_length=1)
    forbidden_actions: str | None = None


class ScenarioGenerateResponse(BaseModel):
    success: bool
    agent_id: int
    scenarios: list[GeneratedScenario]
class ScenarioGenerateResponse(BaseModel):
    success: bool
    agent_id: int
    scenarios: list[GeneratedScenario]


class TestSuiteScenarioResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    agent_id: int
    scenarios: list[GeneratedScenario]
