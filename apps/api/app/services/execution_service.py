from sqlalchemy.orm import Session

from app.models.execution import AgentExecution
from app.models.scenario_execution import ScenarioExecution

def save_execution(
    db: Session,
    agent_id: int,
    user_input: str,
    tool_used: str | None = None,
    tool_arguments: dict | None = None,
    result=None,
):
    """
    Save a normal agent execution.
    """

    execution = AgentExecution(
        agent_id=agent_id,
        user_input=user_input,
        tool_used=tool_used,
        tool_arguments=tool_arguments,
        result=result,
    )

    db.add(execution)
    db.commit()
    db.refresh(execution)

    return execution


def get_agent_executions(
    db: Session,
    agent_id: int,
):
    """
    Return all normal agent executions
    belonging to an agent.
    """

    return (
        db.query(AgentExecution)
        .filter(
            AgentExecution.agent_id == agent_id
        )
        .order_by(
            AgentExecution.id.desc()
        )
        .all()
    )


def save_scenario_execution(
    db: Session,
    scenario_id: int,
    agent_id: int,
    status: str,
    actual_output,
    tool_calls,
    forbidden_tool_calls,
    expected_behavior_passed: bool,
    failure_reason: str | None = None,
    failure_classification: str | None = None,
    agent_version_id: int | None = None,
):
    """
    Save the result of a scenario execution.

    agent_version_id identifies the exact agent version
    that produced this execution result.
    """

    execution = ScenarioExecution(
        scenario_id=scenario_id,
        agent_id=agent_id,
        agent_version_id=agent_version_id,
        status=status,
        actual_output=str(actual_output),
        tool_calls=tool_calls,
        forbidden_tool_calls=forbidden_tool_calls,
        expected_behavior_passed=expected_behavior_passed,
        failure_reason=failure_reason,
        failure_classification=failure_classification,
    )

    db.add(execution)
    db.commit()
    db.refresh(execution)

    return execution
