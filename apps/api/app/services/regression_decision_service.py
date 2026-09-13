from sqlalchemy.orm import Session

from app.services.version_comparison_service import (
    detect_latest_regression,
)


def get_regression_decision(
    db: Session,
    agent_id: int,
):
    """
    Convert the latest regression analysis into a
    structured decision suitable for CI/CD gates,
    dashboards, and automated deployment checks.
    """

    result = detect_latest_regression(
        db=db,
        agent_id=agent_id,
    )

    if not result.get("success"):
        if result.get("status") in ["INSUFFICIENT_HISTORY", "NO_DATA"]:
            from app.models.reliability_report import ReliabilityReport
            from app.models.agent import AgentVersion

            report = None
            if result.get("current_report_id"):
                report = (
                    db.query(ReliabilityReport)
                    .filter(ReliabilityReport.id == result.get("current_report_id"))
                    .first()
                )
            if not report:
                report = (
                    db.query(ReliabilityReport)
                    .filter(ReliabilityReport.agent_id == agent_id)
                    .order_by(ReliabilityReport.id.desc())
                    .first()
                )

            version = None
            if result.get("current_agent_version_id"):
                version = (
                    db.query(AgentVersion)
                    .filter(AgentVersion.id == result.get("current_agent_version_id"))
                    .first()
                )
            if not version and report and report.agent_version_id:
                version = (
                    db.query(AgentVersion)
                    .filter(AgentVersion.id == report.agent_version_id)
                    .first()
                )
            if not version:
                version = (
                    db.query(AgentVersion)
                    .filter(AgentVersion.agent_id == agent_id)
                    .order_by(AgentVersion.version.desc())
                    .first()
                )

            v_num = version.version if version else 1
            v_id = version.id if version else None
            score = report.reliability_score if report else 100.0
            pass_rate = report.pass_rate if report else 100.0
            failed = report.failed if report else 0
            passed = report.passed if report else 0
            rep_id = report.id if report else None

            return {
                "success": True,
                "agent_id": agent_id,
                "baseline_version": None,
                "baseline_agent_version_id": None,
                "current_version": v_num,
                "current_agent_version_id": v_id,
                "baseline_report_id": None,
                "current_report_id": rep_id,
                "baseline_reliability_score": None,
                "current_reliability_score": score,
                "reliability_change": 0.0,
                "pass_rate_change": 0.0,
                "new_failure_count": 0,
                "new_pass_count": 0,
                "persistent_failure_count": failed,
                "persistent_pass_count": passed,
                "regression_detected": False,
                "direction": "UNCHANGED",
                "severity": "LOW" if failed > 0 else "NONE",
                "decision": "PASS",
                "ci_gate": {
                    "status": "PASS",
                    "allowed": True,
                },
                "reason": (
                    f"Baseline version v{v_num} active. "
                    "Initial reliability baseline established. No prior version exists to regress against."
                ),
            }

        return result

    reliability_change = result.get(
        "reliability_change",
        0.0,
    )

    pass_rate_change = result.get(
        "pass_rate_change",
        0.0,
    )

    failure_evidence = result.get(
        "failure_evidence",
        {},
    )

    new_failure_count = failure_evidence.get(
        "new_failure_count",
        0,
    )

    new_pass_count = failure_evidence.get(
        "new_pass_count",
        0,
    )

    persistent_failure_count = failure_evidence.get(
        "persistent_failure_count",
        0,
    )

    if result["regression_detected"]:
        decision = "FAIL"

        if reliability_change <= -20:
            severity = "CRITICAL"
        elif reliability_change <= -10:
            severity = "HIGH"
        else:
            severity = "MEDIUM"

        reason = (
            "Reliability regression detected between "
            "the latest agent versions."
        )

    elif new_pass_count > 0 and reliability_change > 0:
        decision = "PASS"
        severity = "NONE"

        reason = (
            "Agent reliability improved compared with "
            "the previous version."
        )

    elif persistent_failure_count > 0:
        decision = "PASS"
        severity = "LOW"

        reason = (
            "No new regression was detected, but "
            "persistent failures remain."
        )

    else:
        decision = "PASS"
        severity = "NONE"

        reason = (
            "No reliability regression detected "
            "between the latest agent versions."
        )

    return {
        "success": True,
        "agent_id": agent_id,

        "baseline_version": result.get(
    "baseline_version"
),

"baseline_agent_version_id": result.get(
    "baseline_agent_version_id"
),

"current_version": result.get(
    "current_version"
),

"current_agent_version_id": result.get(
    "current_agent_version_id"
),

        "baseline_report_id": result.get(
            "baseline_report_id"
        ),

        "current_report_id": result.get(
            "current_report_id"
        ),

        "baseline_reliability_score": result.get(
            "baseline_reliability_score"
        ),

        "current_reliability_score": result.get(
            "current_reliability_score"
        ),

        "reliability_change": reliability_change,

        "pass_rate_change": pass_rate_change,

        "new_failure_count": new_failure_count,

        "new_pass_count": new_pass_count,

        "persistent_failure_count": (
            persistent_failure_count
        ),

        "persistent_pass_count": (
            failure_evidence.get(
                "persistent_pass_count",
                0,
            )
        ),

        "regression_detected": result[
            "regression_detected"
        ],

        "direction": result.get(
            "direction"
        ),

        "severity": severity,

        "decision": decision,

        "ci_gate": {
            "status": decision,
            "allowed": decision == "PASS",
        },

        "reason": reason,
    }
