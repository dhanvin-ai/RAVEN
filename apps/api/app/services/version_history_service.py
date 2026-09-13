from sqlalchemy.orm import Session

from app.models.reliability_report import ReliabilityReport
from app.models.agent import AgentVersion


def get_version_performance_history(
    db: Session,
    agent_id: int,
):
    """
    Return reliability performance history
    grouped by agent version.

    For each agent version, only the latest
    reliability report is returned.

    Each version also contains performance
    changes compared with the previous version.
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
            "versions": [],
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

                "agent_version_id": (
                    report.agent_version_id
                ),

                "version": (
                    version.version
                    if version
                    else None
                ),

                "reliability_score": (
                    report.reliability_score
                ),

                "pass_rate": (
                    report.pass_rate
                ),

                "total_scenarios": (
                    report.total_scenarios
                ),

                "passed": (
                    report.passed
                ),

                "failed": (
                    report.failed
                ),

                "status": (
                    report.status
                ),

                "severity_breakdown": (
                    report.severity_breakdown
                ),

                "failure_classification_breakdown": (
                    report.failure_classification_breakdown
                ),
            }
        )

    # Sort from oldest version to newest version.
    version_records.sort(
        key=lambda item: (
            item["version"]
            if item["version"] is not None
            else -1
        )
    )

    # Add comparison information.
    versions = []

    previous = None

    for current in version_records:

        reliability_change = None
        pass_rate_change = None
        direction = "BASELINE"

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

            else:
                direction = "UNCHANGED"

        current["previous_version"] = (
            previous["version"]
            if previous is not None
            else None
        )

        current["reliability_change"] = (
            reliability_change
        )

        current["pass_rate_change"] = (
            pass_rate_change
        )

        current["direction"] = direction

        versions.append(current)

        previous = current

    # Return newest version first.
    versions.reverse()

    return {
        "success": True,
        "agent_id": agent_id,
        "versions": versions,
    }
