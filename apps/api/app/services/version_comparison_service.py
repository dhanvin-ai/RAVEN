from sqlalchemy.orm import Session

from app.models.reliability_report import ReliabilityReport
from app.models.agent import AgentVersion
from app.services.failure_difference_service import (
    compare_failure_differences,
)


def compare_reliability_reports(
    db: Session,
    baseline_report_id: int,
    current_report_id: int,
):
    """
    Compare two reliability reports.

    baseline_report = older/baseline version
    current_report = newer/current version
    """

    baseline = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.id == baseline_report_id
        )
        .first()
    )

    if not baseline:
        return {
            "success": False,
            "error": (
                f"Baseline report "
                f"{baseline_report_id} not found"
            ),
        }

    current = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.id == current_report_id
        )
        .first()
    )

    if not current:
        return {
            "success": False,
            "error": (
                f"Current report "
                f"{current_report_id} not found"
            ),
        }

    if baseline.agent_id != current.agent_id:
        return {
            "success": False,
            "error": (
                "Cannot compare reports "
                "belonging to different agents"
            ),
        }

    # Version-aware validation.
    if (
        baseline.agent_version_id is not None
        and current.agent_version_id is not None
        and baseline.agent_version_id
        == current.agent_version_id
    ):
        return {
            "success": False,
            "error": (
                "Cannot compare two reports "
                "belonging to the same agent version"
            ),
        }

    reliability_change = round(
        current.reliability_score
        - baseline.reliability_score,
        2,
    )

    pass_rate_change = round(
        current.pass_rate
        - baseline.pass_rate,
        2,
    )

    passed_change = (
        current.passed
        - baseline.passed
    )

    failed_change = (
        current.failed
        - baseline.failed
    )

    if reliability_change > 0:
        direction = "IMPROVED"

    elif reliability_change < 0:
        direction = "REGRESSED"

    else:
        direction = "UNCHANGED"

    regression_detected = (
        reliability_change < 0
    )

    return {
        "success": True,

        "baseline": {
            "report_id": baseline.id,
            "agent_id": baseline.agent_id,
            "agent_version_id": (
                baseline.agent_version_id
            ),
            "reliability_score": (
                baseline.reliability_score
            ),
            "pass_rate": baseline.pass_rate,
            "passed": baseline.passed,
            "failed": baseline.failed,
            "status": baseline.status,
        },

        "current": {
            "report_id": current.id,
            "agent_id": current.agent_id,
            "agent_version_id": (
                current.agent_version_id
            ),
            "reliability_score": (
                current.reliability_score
            ),
            "pass_rate": current.pass_rate,
            "passed": current.passed,
            "failed": current.failed,
            "status": current.status,
        },

        "changes": {
            "reliability_score": reliability_change,
            "pass_rate": pass_rate_change,
            "passed": passed_change,
            "failed": failed_change,
        },

        "direction": direction,
        "regression_detected": regression_detected,
    }


def detect_latest_regression(
    db: Session,
    agent_id: int,
):
    """
    Automatically compare the latest reliability report
    against the latest report belonging to the previous
    agent version.

    Reports without an agent version are ignored.

    Also returns scenario-level failure evidence.
    """

    # --------------------------------------------------
    # 1. Get version-specific reports only
    # --------------------------------------------------

    reports = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.agent_id == agent_id,
            ReliabilityReport.agent_version_id.isnot(None),
        )
        .order_by(
            ReliabilityReport.id.desc()
        )
        .all()
    )

    if not reports:
        return {
            "success": False,
            "status": "NO_DATA",
            "message": (
                "No version-specific reliability "
                "reports found for this agent"
            ),
        }

    # --------------------------------------------------
    # 2. Keep latest report for each version
    # --------------------------------------------------

    latest_report_by_version = {}

    for report in reports:

        version_id = report.agent_version_id

        if version_id not in latest_report_by_version:

            latest_report_by_version[version_id] = report

    # --------------------------------------------------
    # 3. Load actual AgentVersion records
    # --------------------------------------------------

    version_records = []

    for version_id, report in (
        latest_report_by_version.items()
    ):

        version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.id == version_id,
                AgentVersion.agent_id == agent_id,
            )
            .first()
        )

        if not version:
            continue

        version_records.append(
            {
                "version": version.version,
                "version_id": version.id,
                "report": report,
            }
        )

    if not version_records:

        return {
            "success": False,
            "status": "NO_DATA",
            "message": (
                "No valid agent versions found "
                "for version-specific reports"
            ),
        }

    # --------------------------------------------------
    # 4. Sort by actual version number
    # --------------------------------------------------

    version_records.sort(
        key=lambda item: item["version"]
    )

    # --------------------------------------------------
    # 5. Need at least two versions
    # --------------------------------------------------

    if len(version_records) < 2:

        current = version_records[-1]

        return {
            "success": False,
            "status": "INSUFFICIENT_HISTORY",
            "message": (
                "At least two agent versions with "
                "reliability reports are required"
            ),
            "current_report_id": (
                current["report"].id
            ),
            "current_agent_version_id": (
                current["version_id"]
            ),
        }

    # --------------------------------------------------
    # 6. Compare previous version to latest
    # --------------------------------------------------

    baseline = version_records[-2]
    current = version_records[-1]

    comparison = compare_reliability_reports(
        db=db,
        baseline_report_id=baseline["report"].id,
        current_report_id=current["report"].id,
    )

    if not comparison["success"]:
        return comparison

    # --------------------------------------------------
    # 7. Get scenario-level failure evidence
    # --------------------------------------------------

    failure_evidence = compare_failure_differences(
        db=db,
        agent_id=agent_id,
        baseline_version_id=baseline["version_id"],
        current_version_id=current["version_id"],
    )

    # --------------------------------------------------
    # 8. Handle failure evidence errors safely
    # --------------------------------------------------

    if not failure_evidence.get("success"):

        failure_evidence = {
            "success": False,
            "error": failure_evidence.get(
                "error",
                "Unable to calculate failure evidence",
            ),
            "new_failure_count": 0,
            "new_pass_count": 0,
            "persistent_failure_count": 0,
            "persistent_pass_count": 0,
            "new_failures": [],
            "new_passes": [],
            "persistent_failures": [],
            "persistent_passes": [],
        }

    # --------------------------------------------------
    # 9. Return complete regression result
    # --------------------------------------------------

    return {
        "success": True,

        "status": (
            "REGRESSION_DETECTED"
            if comparison["regression_detected"]
            else comparison["direction"]
        ),

        "regression_detected": (
            comparison["regression_detected"]
        ),

        "baseline_report_id": (
            baseline["report"].id
        ),

        "baseline_agent_version_id": (
            baseline["version_id"]
        ),

        "baseline_version": (
            baseline["version"]
        ),

        "current_report_id": (
            current["report"].id
        ),

        "current_agent_version_id": (
            current["version_id"]
        ),

        "current_version": (
            current["version"]
        ),

        "baseline_reliability_score": (
            baseline["report"].reliability_score
        ),

        "current_reliability_score": (
            current["report"].reliability_score
        ),

        "reliability_change": (
            comparison["changes"][
                "reliability_score"
            ]
        ),

        "pass_rate_change": (
            comparison["changes"][
                "pass_rate"
            ]
        ),

        "direction": (
            comparison["direction"]
        ),

        # ------------------------------------------
        # Scenario-level evidence
        # ------------------------------------------

        "failure_evidence": {
            "new_failure_count": (
                failure_evidence[
                    "new_failure_count"
                ]
            ),

            "new_pass_count": (
                failure_evidence[
                    "new_pass_count"
                ]
            ),

            "persistent_failure_count": (
                failure_evidence[
                    "persistent_failure_count"
                ]
            ),

            "persistent_pass_count": (
                failure_evidence[
                    "persistent_pass_count"
                ]
            ),

            "new_failures": (
                failure_evidence[
                    "new_failures"
                ]
            ),

            "new_passes": (
                failure_evidence[
                    "new_passes"
                ]
            ),

            "persistent_failures": (
                failure_evidence[
                    "persistent_failures"
                ]
            ),

            "persistent_passes": (
                failure_evidence[
                    "persistent_passes"
                ]
            ),
        },
    }