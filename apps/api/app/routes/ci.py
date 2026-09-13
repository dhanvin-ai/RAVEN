"""
CI/CD Integration: REST Route

POST /ci/run — Atomic CI pipeline: execute suite → reliability → regression → markdown report
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.agent import Agent
from app.models.scenario import TestSuite
from app.models.reliability_report import ReliabilityReport
from app.services.test_suite_executor import execute_test_suite

router = APIRouter(
    prefix="/ci",
    tags=["CI/CD Integration"]
)


class CIRunRequest(BaseModel):
    agent_id: int = Field(..., gt=0, description="Target Agent ID")
    fail_under: float = Field(default=80.0, ge=0, le=100, description="Minimum reliability score to pass")
    suite_id: Optional[int] = Field(default=None, description="Specific test suite ID (uses latest if omitted)")


@router.post("/run")
def run_ci_pipeline(
    request: CIRunRequest,
    db: Session = Depends(get_db)
):
    """
    Atomic CI pipeline:
    1. Executes the test suite
    2. Generates reliability report
    3. Checks for regressions
    4. Returns structured CI gate result with markdown summary
    """
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent #{request.agent_id} not found")

    # 1. Find test suite
    if request.suite_id:
        test_suite = db.query(TestSuite).filter(TestSuite.id == request.suite_id).first()
    else:
        test_suite = (
            db.query(TestSuite)
            .filter(TestSuite.agent_id == agent.id)
            .order_by(TestSuite.id.desc())
            .first()
        )

    if not test_suite:
        raise HTTPException(status_code=404, detail=f"No test suite found for agent #{request.agent_id}")

    # 2. Get previous report for comparison
    prev_report = (
        db.query(ReliabilityReport)
        .filter(ReliabilityReport.agent_id == agent.id)
        .order_by(ReliabilityReport.id.desc())
        .first()
    )
    prev_score = prev_report.reliability_score if prev_report else None
    prev_passed = prev_report.passed if prev_report else 0
    prev_failed = prev_report.failed if prev_report else 0

    # 3. Execute test suite (this also generates new reliability report)
    try:
        execution_result = execute_test_suite(db=db, test_suite_id=test_suite.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test suite execution failed: {str(e)}")

    # 4. Get new reliability report
    new_report = (
        db.query(ReliabilityReport)
        .filter(ReliabilityReport.agent_id == agent.id)
        .order_by(ReliabilityReport.id.desc())
        .first()
    )
    new_score = new_report.reliability_score if new_report else 0.0
    new_passed = new_report.passed if new_report else 0
    new_failed = new_report.failed if new_report else 0
    new_total = new_report.total_scenarios if new_report else 0
    new_pass_rate = new_report.pass_rate if new_report else 0.0

    # 5. Calculate changes
    if prev_score is not None:
        score_change = round(new_score - prev_score, 2)
        score_change_str = f"{'+' if score_change >= 0 else ''}{score_change}% vs previous"
        fixed_failures = max(0, prev_failed - new_failed)
        new_failures = max(0, new_failed - prev_failed)
    else:
        score_change = 0.0
        score_change_str = "baseline (no previous run)"
        fixed_failures = 0
        new_failures = new_failed

    regression_detected = score_change < -5.0

    # 6. Gate decision
    gate_passed = new_score >= request.fail_under and not regression_detected
    gate_status = "PASS" if gate_passed else "FAIL"
    gate_icon = "✅" if gate_passed else "❌"
    regression_icon = "✅ No regressions" if not regression_detected else "⚠️ Regression detected"

    # 7. Build markdown summary
    markdown = f"""## 🦅 RAVEN CI Report — {agent.name}

| Metric | Value |
|--------|-------|
| **Reliability Score** | {new_score}% ({score_change_str}) |
| **Pass Rate** | {new_pass_rate}% |
| **Passed / Total** | {new_passed} / {new_total} |
| **CI Gate** | {gate_icon} **{gate_status}** (threshold: {request.fail_under}%) |
| **Regression** | {regression_icon} |
| **New Failures** | {new_failures} |
| **Fixed Failures** | {fixed_failures} |

### Summary
- Agent: **{agent.name}** (ID: {agent.id})
- Test Suite: **{test_suite.name}** (ID: {test_suite.id})
- Scenarios: {new_total} total, {new_passed} passed, {new_failed} failed
"""

    return {
        "success": True,
        "gate_status": gate_status,
        "gate_passed": gate_passed,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "reliability_score": new_score,
        "pass_rate": new_pass_rate,
        "passed": new_passed,
        "failed": new_failed,
        "total": new_total,
        "score_change": score_change,
        "score_change_str": score_change_str,
        "new_failures": new_failures,
        "fixed_failures": fixed_failures,
        "regression_detected": regression_detected,
        "fail_under": request.fail_under,
        "markdown_summary": markdown,
    }
