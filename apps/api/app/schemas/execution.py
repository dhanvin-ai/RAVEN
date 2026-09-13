from pydantic import BaseModel, Field


class ScenarioExecutionRequest(BaseModel):
    scenario_id: int = Field(..., gt=0)


class ToolCallResult(BaseModel):
    tool_name: str = Field(..., min_length=1)
    arguments: dict | None = None
    result: dict | None = None


class ScenarioExecutionResponse(BaseModel):
    id: int
    scenario_id: int
    agent_id: int
    status: str

    actual_output: str | None = None

    tool_calls: list[ToolCallResult] = []

    forbidden_tool_calls: list[str] = []

    expected_behavior_passed: bool | None = None

    failure_reason: str | None = None
