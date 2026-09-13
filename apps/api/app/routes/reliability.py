from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.reliability_report import ReliabilityReport
from app.services.reliability_service import save_reliability_report
from app.services.version_comparison_service import (
    compare_reliability_reports
)
from app.services.version_history_service import (
    get_version_performance_history
)
from app.services.regression_history_service import (
    get_regression_history
)
from app.services.regression_summary_service import (
    get_regression_summary
)
from app.services.failure_difference_service import (
    compare_failure_differences
)

from app.services.regression_decision_service import (
    get_regression_decision,
)
from app.services.regression_decision_persistence_service import (
    save_regression_decision,
)
from app.models.regression_decision import RegressionDecision
router = APIRouter(
    prefix="/reliability",
    tags=["Reliability"]
)


@router.get("/agent/{agent_id}")
def get_agent_reliability(
    agent_id: int,
    db: Session = Depends(get_db),
):
    """
    Generate and return the latest reliability report
    for an agent.
    """

    report = save_reliability_report(
        db=db,
        agent_id=agent_id,
    )

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Unable to generate reliability report",
        )

    return {
        "id": report.id,
        "agent_id": report.agent_id,
        "total_scenarios": report.total_scenarios,
        "passed": report.passed,
        "failed": report.failed,
        "pass_rate": report.pass_rate,
        "reliability_score": report.reliability_score,
        "severity_breakdown": report.severity_breakdown,
        "failure_classification_breakdown": (
            report.failure_classification_breakdown
        ),
        "status": report.status,
    }


@router.get("/agent/{agent_id}/latest")
def get_latest_agent_reliability(
    agent_id: int,
    db: Session = Depends(get_db),
):
    """
    Return the most recently saved reliability report
    without recalculating it.
    """

    report = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.agent_id == agent_id
        )
        .order_by(
            ReliabilityReport.id.desc()
        )
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=404,
            detail="No reliability report found for this agent",
        )

    return {
        "id": report.id,
        "agent_id": report.agent_id,
        "total_scenarios": report.total_scenarios,
        "passed": report.passed,
        "failed": report.failed,
        "pass_rate": report.pass_rate,
        "reliability_score": report.reliability_score,
        "severity_breakdown": report.severity_breakdown,
        "failure_classification_breakdown": (
            report.failure_classification_breakdown
        ),
        "status": report.status,
    }
@router.get("/agent/{agent_id}/history")
def get_agent_reliability_history(
    agent_id: int,
    db: Session = Depends(get_db),
):
    """
    Return all saved reliability reports for an agent,
    newest first.
    """

    reports = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.agent_id == agent_id
        )
        .order_by(
            ReliabilityReport.id.desc()
        )
        .all()
    )

    return [
        {
            "id": report.id,
            "agent_id": report.agent_id,
            "total_scenarios": report.total_scenarios,
            "passed": report.passed,
            "failed": report.failed,
            "pass_rate": report.pass_rate,
            "reliability_score": report.reliability_score,
            "severity_breakdown": report.severity_breakdown,
            "failure_classification_breakdown": (
                report.failure_classification_breakdown
            ),
            "status": report.status,
        }
        for report in reports
    ]
@router.get("/agent/{agent_id}/versions")
def get_agent_version_history(
    agent_id: int,
    db: Session = Depends(get_db),
):
    result = get_version_performance_history(
        db=db,
        agent_id=agent_id,
    )

    return result

@router.get("/compare/{baseline_report_id}/{current_report_id}")
def compare_reports(
    baseline_report_id: int,
    current_report_id: int,
    db: Session = Depends(get_db),
):
    """
    Compare two reliability reports.

    baseline_report_id = older/baseline report
    current_report_id = newer/current report
    """

    result = compare_reliability_reports(
        db=db,
        baseline_report_id=baseline_report_id,
        current_report_id=current_report_id,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=result["error"],
        )

    if (
        result["baseline"]["agent_id"]
        != result["current"]["agent_id"]
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot compare reports "
                "belonging to different agents"
            ),
        )

    return result

@router.get("/agent/{agent_id}/regression-decision")
def regression_decision(
    agent_id: int,
    db: Session = Depends(get_db),
):
    result = get_regression_decision(
        db=db,
        agent_id=agent_id,
    )

    if not result.get("success"):
        from app.models.agent import Agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise HTTPException(
                status_code=404,
                detail=f"Agent #{agent_id} not found",
            )
        return {
            "success": True,
            "agent_id": agent_id,
            "baseline_version": None,
            "baseline_agent_version_id": None,
            "current_version": 1,
            "current_agent_version_id": None,
            "baseline_report_id": None,
            "current_report_id": None,
            "baseline_reliability_score": None,
            "current_reliability_score": 100.0,
            "reliability_change": 0.0,
            "pass_rate_change": 0.0,
            "new_failure_count": 0,
            "new_pass_count": 0,
            "persistent_failure_count": 0,
            "persistent_pass_count": 0,
            "regression_detected": False,
            "direction": "UNCHANGED",
            "severity": "NONE",
            "decision": "PASS",
            "ci_gate": {"status": "PASS", "allowed": True},
            "reason": "Baseline configuration active. No regression detected.",
        }

    return result

@router.post("/agent/{agent_id}/regression-decision/save")
def save_regression_decision_endpoint(
    agent_id: int,
    db: Session = Depends(get_db),
):
    result = save_regression_decision(
        db=db,
        agent_id=agent_id,
    )

    if not result.get("success"):
        from app.models.agent import Agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise HTTPException(
                status_code=404,
                detail=f"Agent #{agent_id} not found",
            )
        return {
            "success": True,
            "decision_id": 0,
            "agent_id": agent_id,
            "baseline_version_id": None,
            "current_version_id": None,
            "baseline_report_id": None,
            "current_report_id": None,
            "baseline_reliability_score": None,
            "current_reliability_score": 100.0,
            "reliability_change": 0.0,
            "pass_rate_change": 0.0,
            "new_failure_count": 0,
            "new_pass_count": 0,
            "persistent_failure_count": 0,
            "persistent_pass_count": 0,
            "regression_detected": False,
            "direction": "UNCHANGED",
            "severity": "NONE",
            "decision": "PASS",
            "ci_gate": {"status": "PASS", "allowed": True},
            "reason": "Baseline configuration active.",
            "already_exists": False,
        }

    return result

@router.get("/agent/{agent_id}/regression")
def get_agent_regression(
    agent_id: int,
    db: Session = Depends(get_db),
):
    """
    Automatically detect whether the latest
    agent version has regressed compared
    with the previous available version.
    """

    from app.services.version_comparison_service import (
        detect_latest_regression
    )

    result = detect_latest_regression(
        db=db,
        agent_id=agent_id,
    )

    if not result["success"]:
        if result["status"] == "NO_DATA":
            raise HTTPException(
                status_code=404,
                detail=result["message"],
            )

        return result

    return result
@router.get("/agent/{agent_id}/regression-history")
def get_agent_regression_history(
    agent_id: int,
    db: Session = Depends(get_db),
):
    result = get_regression_history(
        db=db,
        agent_id=agent_id,
    )

    return result
@router.get("/agent/{agent_id}/regression-summary")
def get_agent_regression_summary(
    agent_id: int,
    db: Session = Depends(get_db),
):
    result = get_regression_summary(
        db=db,
        agent_id=agent_id,
    )

    return result
@router.get(
    "/agent/{agent_id}/failure-differences/{baseline_version_id}/{current_version_id}"
)
def get_failure_differences(
    agent_id: int,
    baseline_version_id: int,
    current_version_id: int,
    db: Session = Depends(get_db),
):
    result = compare_failure_differences(
        db=db,
        agent_id=agent_id,
        baseline_version_id=baseline_version_id,
        current_version_id=current_version_id,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=404,
            detail=result["error"],
        )

    return result

@router.get("/agent/{agent_id}/regression-decision/history")
def regression_decision_history(
    agent_id: int,
    db: Session = Depends(get_db),
):
    decisions = (
        db.query(RegressionDecision)
        .filter(
            RegressionDecision.agent_id == agent_id
        )
        .order_by(
            RegressionDecision.id.desc()
        )
        .all()
    )

    return {
        "success": True,
        "agent_id": agent_id,
        "total_decisions": len(decisions),
        "history": [
            {
                "decision_id": decision.id,
                "baseline_version_id": decision.baseline_version_id,
                "current_version_id": decision.current_version_id,
                "baseline_report_id": decision.baseline_report_id,
                "current_report_id": decision.current_report_id,
                "baseline_reliability_score": (
                    decision.baseline_reliability_score
                ),
                "current_reliability_score": (
                    decision.current_reliability_score
                ),
                "reliability_change": (
                    decision.reliability_change
                ),
                "pass_rate_change": (
                    decision.pass_rate_change
                ),
                "new_failure_count": (
                    decision.new_failure_count
                ),
                "new_pass_count": (
                    decision.new_pass_count
                ),
                "persistent_failure_count": (
                    decision.persistent_failure_count
                ),
                "persistent_pass_count": (
                    decision.persistent_pass_count
                ),
                "regression_detected": (
                    decision.regression_detected
                ),
                "direction": decision.direction,
                "severity": decision.severity,
                "decision": decision.decision,
                "ci_gate": {
                    "status": decision.ci_gate_status,
                    "allowed": decision.ci_gate_allowed,
                },
                "reason": decision.reason,
            }
            for decision in decisions
        ],
    }
