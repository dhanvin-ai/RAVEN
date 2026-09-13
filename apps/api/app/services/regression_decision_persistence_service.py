from sqlalchemy.orm import Session

from app.models.regression_decision import RegressionDecision
from app.services.regression_decision_service import get_regression_decision


def save_regression_decision(db: Session, agent_id: int):
    result = get_regression_decision(
        db=db,
        agent_id=agent_id,
    )

    if not result["success"]:
        return result

    baseline_version_id = result.get("baseline_agent_version_id")
    current_version_id = result.get("current_agent_version_id")
    baseline_report_id = result.get("baseline_report_id")
    current_report_id = result.get("current_report_id")

    # Check whether this exact version-to-version decision
    # has already been persisted.
    existing_decision = (
        db.query(RegressionDecision)
        .filter(
            RegressionDecision.agent_id == agent_id,
            RegressionDecision.baseline_version_id == baseline_version_id,
            RegressionDecision.current_version_id == current_version_id,
            RegressionDecision.baseline_report_id == baseline_report_id,
            RegressionDecision.current_report_id == current_report_id,
        )
        .order_by(RegressionDecision.id.desc())
        .first()
    )

    if existing_decision:
        return {
            "success": True,
            "decision_id": existing_decision.id,
            "agent_id": existing_decision.agent_id,
            "baseline_version_id": existing_decision.baseline_version_id,
            "current_version_id": existing_decision.current_version_id,
            "baseline_report_id": existing_decision.baseline_report_id,
            "current_report_id": existing_decision.current_report_id,
            "baseline_reliability_score": (
                existing_decision.baseline_reliability_score
            ),
            "current_reliability_score": (
                existing_decision.current_reliability_score
            ),
            "reliability_change": existing_decision.reliability_change,
            "pass_rate_change": existing_decision.pass_rate_change,
            "new_failure_count": existing_decision.new_failure_count,
            "new_pass_count": existing_decision.new_pass_count,
            "persistent_failure_count": (
                existing_decision.persistent_failure_count
            ),
            "persistent_pass_count": (
                existing_decision.persistent_pass_count
            ),
            "regression_detected": existing_decision.regression_detected,
            "direction": existing_decision.direction,
            "severity": existing_decision.severity,
            "decision": existing_decision.decision,
            "ci_gate": {
                "status": existing_decision.ci_gate_status,
                "allowed": existing_decision.ci_gate_allowed,
            },
            "reason": existing_decision.reason,
            "already_exists": True,
        }

    decision = RegressionDecision(
        agent_id=agent_id,
        baseline_version_id=baseline_version_id,
        current_version_id=current_version_id,
        baseline_report_id=baseline_report_id,
        current_report_id=current_report_id,
        baseline_reliability_score=result.get(
            "baseline_reliability_score"
        ),
        current_reliability_score=result.get(
            "current_reliability_score"
        ),
        reliability_change=result.get(
            "reliability_change"
        ),
        pass_rate_change=result.get(
            "pass_rate_change"
        ),
        new_failure_count=result.get(
            "new_failure_count",
            0,
        ),
        new_pass_count=result.get(
            "new_pass_count",
            0,
        ),
        persistent_failure_count=result.get(
            "persistent_failure_count",
            0,
        ),
        persistent_pass_count=result.get(
            "persistent_pass_count",
            0,
        ),
        regression_detected=result.get(
            "regression_detected",
            False,
        ),
        direction=result.get(
            "direction",
            "UNKNOWN",
        ),
        severity=result.get(
            "severity",
            "UNKNOWN",
        ),
        decision=result.get(
            "decision",
            "UNKNOWN",
        ),
        ci_gate_status=result.get(
            "ci_gate",
            {},
        ).get(
            "status",
            "UNKNOWN",
        ),
        ci_gate_allowed=result.get(
            "ci_gate",
            {},
        ).get(
            "allowed",
            False,
        ),
        reason=result.get("reason"),
    )

    db.add(decision)
    db.commit()
    db.refresh(decision)

    return {
        "success": True,
        "decision_id": decision.id,
        "agent_id": decision.agent_id,
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
        "reliability_change": decision.reliability_change,
        "pass_rate_change": decision.pass_rate_change,
        "new_failure_count": decision.new_failure_count,
        "new_pass_count": decision.new_pass_count,
        "persistent_failure_count": (
            decision.persistent_failure_count
        ),
        "persistent_pass_count": (
            decision.persistent_pass_count
        ),
        "regression_detected": decision.regression_detected,
        "direction": decision.direction,
        "severity": decision.severity,
        "decision": decision.decision,
        "ci_gate": {
            "status": decision.ci_gate_status,
            "allowed": decision.ci_gate_allowed,
        },
        "reason": decision.reason,
        "already_exists": False,
    }
