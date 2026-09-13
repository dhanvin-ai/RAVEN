import re

from sqlalchemy.orm import Session

from app.models.scenario import Scenario
from app.models.agent import Agent, AgentVersion
from app.runtime.agent_runtime import AgentRuntime
from app.services.execution_service import save_scenario_execution
from app.services.evaluator import evaluate_scenario


from app.engine.tool_executor import AVAILABLE_TOOLS


def extract_forbidden_tools(
    forbidden_actions: str | None
) -> list[str]:
    if not forbidden_actions:
        return []

    known_tools = list(AVAILABLE_TOOLS.keys())
    forbidden_lower = forbidden_actions.lower()

    return [
        tool
        for tool in known_tools
        if tool in forbidden_lower
    ]


def execute_scenario(
    db: Session,
    scenario_id: int,
    agent_version_id: int | None = None,
):
    scenario = (
        db.query(Scenario)
        .filter(Scenario.id == scenario_id)
        .first()
    )

    if not scenario:
        return {
            "success": False,
            "error": "Scenario not found"
        }

    agent = (
        db.query(Agent)
        .filter(
            Agent.id == scenario.test_suite.agent_id
        )
        .first()
    )

    if not agent:
        return {
            "success": False,
            "error": "Agent not found for scenario"
        }

    # -----------------------------------------
    # 1. Select agent version
    # -----------------------------------------
    if agent_version_id is not None:

        selected_version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.id == agent_version_id,
                AgentVersion.agent_id == agent.id,
            )
            .first()
        )

        if not selected_version:
            return {
                "success": False,
                "error": (
                    f"Agent version {agent_version_id} "
                    f"does not belong to agent {agent.id}"
                ),
            }

    else:

        selected_version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.agent_id == agent.id
            )
            .order_by(
                AgentVersion.version.desc()
            )
            .first()
        )

    selected_version_id = (
        selected_version.id
        if selected_version
        else None
    )

    runtime = AgentRuntime(agent)

    try:
        result = runtime.run(
            user_input=scenario.user_input,
            agent_version_id=selected_version_id,
        )

    except Exception as exc:

        failure_reason = (
            f"LLM/API execution error: "
            f"{type(exc).__name__}: {str(exc)}"
        )

        save_scenario_execution(
            db=db,
            scenario_id=scenario.id,
            agent_id=agent.id,
            agent_version_id=selected_version_id,
            status="ERROR",
            actual_output={
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            tool_calls=[],
            forbidden_tool_calls=[],
            expected_behavior_passed=False,
            failure_reason=failure_reason,
            failure_classification="LLM_ERROR",
        )

        return {
            "success": False,
            "scenario_id": scenario.id,
            "agent_id": agent.id,
            "agent_version_id": selected_version_id,
            "user_input": scenario.user_input,
            "expected_behavior": scenario.expected_behavior,
            "forbidden_actions": scenario.forbidden_actions,
            "actual_result": None,
            "actual_tool": None,
            "forbidden_tools": extract_forbidden_tools(
                scenario.forbidden_actions
            ),
            "forbidden_tool_calls": [],
            "forbidden_call_detected": False,
            "expected_behavior_passed": False,
            "evaluation_reason": failure_reason,
            "failure_reason": failure_reason,
            "classification": "LLM_ERROR",
            "status": "ERROR",
        }

    actual_tool = None

    if isinstance(result, dict):
        actual_tool = result.get("tool")

    forbidden_tools = extract_forbidden_tools(
        scenario.forbidden_actions
    )

    forbidden_tool_calls = []

    if (
        actual_tool
        and actual_tool in forbidden_tools
    ):
        forbidden_tool_calls.append(
            actual_tool
        )

    forbidden_call_detected = (
        len(forbidden_tool_calls) > 0
    )

    evaluation = evaluate_scenario(
        expected_behavior=scenario.expected_behavior,
        forbidden_actions=scenario.forbidden_actions,
        actual_result=result,
    )

    status = (
        "PASSED"
        if evaluation["passed"]
        else "FAILED"
    )

    failure_reason = None

    if not evaluation["passed"]:
        failure_reason = evaluation["reason"]

    save_scenario_execution(
        db=db,
        scenario_id=scenario.id,
        agent_id=agent.id,
        agent_version_id=selected_version_id,
        status=status,
        actual_output=result,
        tool_calls=(
            [actual_tool]
            if actual_tool
            else []
        ),
        forbidden_tool_calls=forbidden_tool_calls,
        expected_behavior_passed=evaluation["passed"],
        failure_reason=failure_reason,
        failure_classification=evaluation["classification"],
    )

    return {
        "success": True,
        "scenario_id": scenario.id,
        "agent_id": agent.id,
        "agent_version_id": selected_version_id,
        "user_input": scenario.user_input,
        "expected_behavior": scenario.expected_behavior,
        "forbidden_actions": scenario.forbidden_actions,
        "actual_result": result,
        "actual_tool": actual_tool,
        "forbidden_tools": forbidden_tools,
        "forbidden_tool_calls": forbidden_tool_calls,
        "forbidden_call_detected": forbidden_call_detected,
        "expected_behavior_passed": evaluation["passed"],
        "evaluation_reason": evaluation["reason"],
        "classification": evaluation["classification"],
        "failure_reason": failure_reason,
        "status": status,
    }