from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.services.prompt_doctor import (
    diagnose_and_generate_patch,
    apply_patch_and_verify
)

router = APIRouter(
    prefix="/prompt-doctor",
    tags=["Prompt Doctor & Auto-Remediation"]
)


class DiagnoseRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID to diagnose")
    test_suite_id: Optional[int] = Field(default=None, description="Optional Test Suite ID with failures")


class ApplyPatchRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID")
    patched_prompt: str = Field(..., min_length=10, description="The hardened candidate prompt to deploy")
    test_suite_id: Optional[int] = Field(default=None, description="Optional Test Suite ID to re-benchmark")
    model: Optional[str] = Field(default=None, description="Optional model to use")
    ponytail_mode: Optional[str] = Field(default=None, description="Optional Ponytail mode to activate (OFF, LITE, FULL, ULTRA)")


@router.post("/diagnose")
def diagnose_agent_failures(
    request: DiagnoseRequest,
    db: Session = Depends(get_db)
):
    """
    Analyzes failed benchmark scenarios, extracts root vulnerabilities,
    and returns a hardened candidate system prompt.
    """
    try:
        diagnosis = diagnose_and_generate_patch(
            db=db,
            agent_id=request.agent_id,
            test_suite_id=request.test_suite_id
        )
        return diagnosis
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prompt Doctor diagnosis failed: {str(e)}"
        )


@router.post("/apply")
def apply_candidate_patch(
    request: ApplyPatchRequest,
    db: Session = Depends(get_db)
):
    """
    Deploys the candidate prompt as a new version, automatically re-runs the benchmark,
    and verifies the reliability score jump.
    """
    try:
        result = apply_patch_and_verify(
            db=db,
            agent_id=request.agent_id,
            patched_prompt=request.patched_prompt,
            test_suite_id=request.test_suite_id,
            model=request.model,
            ponytail_mode=request.ponytail_mode
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deploy and verify prompt patch: {str(e)}"
        )
