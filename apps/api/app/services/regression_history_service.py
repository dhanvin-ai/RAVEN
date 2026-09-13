from sqlalchemy.orm import Session

from app.models.reliability_report import ReliabilityReport
from app.models.agent import AgentVersion


def get_regression_history(
    db: Session,
    agent_id: int,
):
    """
    Return version-by-version regression history.

    Only the latest reliability report for each
    agent version is considered.
    """

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
            "success": True,
            "agent_id": agent_id,
            "history": [],
        }

    # Keep only the latest report for each version.
    latest_report_by_version = {}

    for report in reports:
        version_id = report.agent_version_id

        if version_id not in latest_report_by_version:
            latest_report_by_version[version_id] = report

    version_records = []

    for report in latest_report_by_version.values():

        version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.id
                == report.agent_version_id
            )
            .first()
        )

        version_records.append(
            {
                "report_id": report.id,
                "agent_version_id": report.agent_version_id,
                "version": (
                    version.version
                    if version
                    else None
                ),
                "reliability_score": (
                    report.reliability_score
                ),
                "pass_rate": report.pass_rate,
                "total_scenarios": report.total_scenarios,
                "passed": report.passed,
                "failed": report.failed,
                "status": report.status,
            }
        )

    # Oldest version first.
    version_records.sort(
        key=lambda item: (
            item["version"]
            if item["version"] is not None
            else -1
        )
    )

    history = []

    previous = None

    for current in version_records:

        reliability_change = None
        pass_rate_change = None
        direction = "BASELINE"
        regression_detected = False

        if previous is not None:

            reliability_change = round(
                current["reliability_score"]
                - previous["reliability_score"],
                2,
            )

            pass_rate_change = round(
                current["pass_rate"]
                - previous["pass_rate"],
                2,
            )

            if reliability_change > 0:
                direction = "IMPROVED"

            elif reliability_change < 0:
                direction = "REGRESSED"
                regression_detected = True

            else:
                direction = "UNCHANGED"

        history.append(
            {
                "version": current["version"],
                "agent_version_id": (
                    current["agent_version_id"]
                ),
                "report_id": current["report_id"],

                "reliability_score": (
                    current["reliability_score"]
                ),

                "pass_rate": (
                    current["pass_rate"]
                ),

                "total_scenarios": (
                    current["total_scenarios"]
                ),

                "passed": (
                    current["passed"]
                ),

                "failed": (
                    current["failed"]
                ),

                "status": current["status"],

                "previous_version": (
                    previous["version"]
                    if previous is not None
                    else None
                ),

                "previous_reliability_score": (
                    previous["reliability_score"]
                    if previous is not None
                    else None
                ),

                "reliability_change": (
                    reliability_change
                ),

                "pass_rate_change": (
                    pass_rate_change
                ),

                "direction": direction,

                "regression_detected": (
                    regression_detected
                ),
            }
        )

        previous = current

    # Newest version first.

    total_regressions = sum(
        1
        for item in history
        if item["regression_detected"]
    )

    total_improvements = sum(
        1
        for item in history
        if item["direction"] == "IMPROVED"
    )

    total_unchanged = sum(
        1
        for item in history
        if item["direction"] == "UNCHANGED"
    )

    return {
        "success": True,
        "agent_id": agent_id,
        "total_versions": len(history),
        "total_regressions": total_regressions,
        "total_improvements": total_improvements,
        "total_unchanged": total_unchanged,
        "history": history,
    }
