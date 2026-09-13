"""
Multi-Model Benchmarking: REST Routes

GET  /benchmark/models  — Available model catalog
POST /benchmark/run     — Run benchmark and return leaderboard
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.services.benchmark_engine import BENCHMARK_MODELS, run_benchmark, run_ponytail_comparison

router = APIRouter(
    prefix="/benchmark",
    tags=["Multi-Model Benchmarking"]
)


class BenchmarkRunRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID")
    model_ids: List[str] = Field(..., min_length=1, description="List of model IDs to benchmark")
    test_suite_id: Optional[int] = Field(default=None, description="Optional test suite ID")


class PonytailCompareRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID")
    test_suite_id: Optional[int] = Field(default=None, description="Optional test suite ID")


@router.get("/models")
def get_benchmark_models():
    """Returns the available model catalog for benchmarking."""
    return {
        "success": True,
        "models": BENCHMARK_MODELS,
    }


@router.post("/run")
def run_benchmark_test(
    request: BenchmarkRunRequest,
    db: Session = Depends(get_db)
):
    """
    Runs the same scenario suite against multiple LLM models
    and produces a ranked comparative leaderboard.
    """
    try:
        result = run_benchmark(
            db=db,
            agent_id=request.agent_id,
            model_ids=request.model_ids,
            test_suite_id=request.test_suite_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Benchmark failed: {str(e)}"
        )


@router.post("/ponytail-compare")
def compare_ponytail_efficiency(
    request: PonytailCompareRequest,
    db: Session = Depends(get_db)
):
    """
    Head-to-head empirical comparison:
    Vanilla Agent (Ponytail OFF) vs. Ponytail Protocol (Ponytail FULL).
    Reports reliability delta, token savings %, latency speedup %, and loops eliminated.
    """
    try:
        result = run_ponytail_comparison(
            db=db,
            agent_id=request.agent_id,
            test_suite_id=request.test_suite_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ponytail benchmark failed: {str(e)}"
        )
