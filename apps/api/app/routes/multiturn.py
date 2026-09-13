from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.services.multiturn_engine import (
    PREDEFINED_MULTITURN_SCENARIOS,
    run_multiturn_simulation
)

router = APIRouter(
    prefix="/multiturn",
    tags=["Multi-Turn Execution & Tool-Loop Detection"]
)


class MultiTurnRunRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID")
    scenario_id: str = Field(default="order_cancellation_flow", description="Scenario ID to execute")
    custom_steps: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional custom conversation steps")


@router.get("/scenarios")
def get_multiturn_scenarios():
    """
    Returns available multi-turn evaluation benchmark scenarios.
    """
    return {
        "success": True,
        "scenarios": list(PREDEFINED_MULTITURN_SCENARIOS.values())
    }


@router.post("/run")
def execute_multiturn_test(
    request: MultiTurnRunRequest,
    db: Session = Depends(get_db)
):
    """
    Executes a multi-turn conversational benchmark, tracking stateful tools,
    detecting tool-call loops, and measuring silent goal drift.
    """
    try:
        result = run_multiturn_simulation(
            db=db,
            agent_id=request.agent_id,
            scenario_id=request.scenario_id,
            custom_steps=request.custom_steps
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Multi-turn benchmark failed: {str(e)}"
        )
