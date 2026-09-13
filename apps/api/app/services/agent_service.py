from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.runtime.agent_runtime import AgentRuntime
from app.services.execution_service import save_execution


def get_agent_by_id(
    db: Session,
    agent_id: int
):
    return (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )


def run_agent(
    agent_id: int,
    user_input: str,
    db: Session
):

    # 1. Get agent
    agent = get_agent_by_id(
        db,
        agent_id
    )

    if not agent:
        return {
            "success": False,
            "error": "Agent not found"
        }

    # 2. Create runtime
    runtime = AgentRuntime(agent)

    # 3. Execute request
    result = runtime.run(
        user_input
    )

    # 4. Extract execution information
    tool_used = None
    tool_arguments = None

    if isinstance(result, dict):

        tool_used = result.get(
            "tool"
        )

        tool_arguments = result.get(
            "arguments"
        )

    # 5. Save execution history
    save_execution(
        db=db,
        agent_id=agent_id,
        user_input=user_input,
        tool_used=tool_used,
        tool_arguments=tool_arguments,
        result=result,
    )

    # 6. Return result
    return {
        "success": True,
        "response": result
    }