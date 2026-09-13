from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.agent_service import run_agent
from app.services.execution_service import get_agent_executions


router = APIRouter(
    prefix="/runtime",
    tags=["Agent Runtime"]
)


@router.post("/{agent_id}/run")
def run(
    agent_id: int,
    user_input: str,
    db: Session = Depends(get_db)
):
    result = run_agent(
        agent_id,
        user_input,
        db
    )

    if "error" in result:
        raise HTTPException(
            status_code=404,
            detail=result["error"]
        )

    return result


@router.get("/{agent_id}/history")
def get_history(
    agent_id: int,
    db: Session = Depends(get_db)
):
    executions = get_agent_executions(
        db,
        agent_id
    )

    return {
        "success": True,
        "agent_id": agent_id,
        "executions": [
            {
                "id": execution.id,
                "user_input": execution.user_input,
                "tool_used": execution.tool_used,
                "tool_arguments": execution.tool_arguments,
                "result": execution.result,
            }
            for execution in executions
        ]
    }
