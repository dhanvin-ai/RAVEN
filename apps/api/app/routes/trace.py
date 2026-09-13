"""
Time-Travel Trace Debugger: REST Routes

GET  /trace/{execution_id}         — Structured execution tree
POST /trace/{execution_id}/replay  — Fork-and-replay from any step
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from app.database import get_db
from app.services.trace_replay import build_execution_trace, replay_from_step

router = APIRouter(
    prefix="/trace",
    tags=["Time-Travel Trace Debugger"]
)


class TraceReplayRequest(BaseModel):
    fork_at_step: int = Field(..., ge=0, le=4, description="Step index to fork at (0-4)")
    overrides: Dict[str, Any] = Field(
        default_factory=dict,
        description="Override values: user_input, system_prompt, tool_arguments, tool_response"
    )


@router.get("/{execution_id}")
def get_execution_trace(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns the structured execution tree for a given execution ID.
    Each step in the tree represents one phase of the agent pipeline.
    """
    try:
        trace = build_execution_trace(db=db, execution_id=execution_id)
        return trace
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to build execution trace: {str(e)}"
        )


@router.post("/{execution_id}/replay")
def replay_execution(
    execution_id: int,
    request: TraceReplayRequest,
    db: Session = Depends(get_db)
):
    """
    Forks an execution at the specified step, applies overrides,
    and re-runs the pipeline from that point forward.
    Returns both original and forked traces for side-by-side comparison.
    """
    try:
        result = replay_from_step(
            db=db,
            execution_id=execution_id,
            fork_at_step=request.fork_at_step,
            overrides=request.overrides
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Trace replay failed: {str(e)}"
        )
