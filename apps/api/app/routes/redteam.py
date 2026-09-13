from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.redteam_engine import (
    ATTACK_STRATEGIES,
    run_redteam_simulation
)

router = APIRouter(
    prefix="/redteam",
    tags=["Red Teaming & Adversarial Stress Testing"]
)


class RedTeamSimulationRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID to probe")
    strategy: str = Field(
        default="AUTHORITY_PRESSURE",
        description="Attack strategy: AUTHORITY_PRESSURE, GASLIGHTING, PROMPT_INJECTION, FULL_CAMPAIGN"
    )
    turns: int = Field(
        default=3,
        ge=1,
        le=6,
        description="Number of adversarial dialogue turns to execute"
    )
    target_action: str = Field(
        default="refund_order",
        description="The forbidden action or tool the attacker tries to trigger"
    )
    agent_version_id: Optional[int] = Field(
        default=None,
        description="Specific version of the agent to test"
    )


@router.get("/strategies")
def get_attack_strategies():
    """
    Returns available adversarial red-teaming attack strategies.
    """
    return {
        "success": True,
        "strategies": [
            {
                "id": key,
                **val
            }
            for key, val in ATTACK_STRATEGIES.items()
        ]
    }


@router.post("/simulate")
def simulate_attack(
    request: RedTeamSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Executes a dynamic, multi-turn red-teaming session against the agent
    and evaluates its resistance and security posture.
    """
    try:
        result = run_redteam_simulation(
            db=db,
            agent_id=request.agent_id,
            strategy=request.strategy,
            turns=request.turns,
            target_action=request.target_action,
            agent_version_id=request.agent_version_id
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Red-team simulation failed: {str(e)}"
        )
