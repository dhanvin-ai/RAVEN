from sqlalchemy.orm import Session

from app.services.regression_history_service import (
    get_regression_history,
)


def get_regression_summary(
    db: Session,
    agent_id: int,
):
    """
    Return a compact summary of the agent's
    version regression history.
    """

    result = get_regression_history(
        db=db,
        agent_id=agent_id,
    )

    if not result["success"]:
        return result

    history = result.get("history", [])

    if not history:
        return {
            "success": True,
            "agent_id": agent_id,
            "total_versions": 0,
            "total_regressions": 0,
            "total_improvements": 0,
            "total_unchanged": 0,
            "latest_version": None,
            "latest_agent_version_id": None,
            "latest_report_id": None,
            "latest_reliability_score": None,
            "latest_pass_rate": None,
            "latest_status": None,
            "overall_trend": "NO_DATA",
        }

    # History is returned in chronological order:
    # oldest version -> newest version.
    # Therefore, the latest version is the last item.
    latest = history[-1]

    # Find versions that actually have a comparison
    # with a previous version.
    compared_versions = [
        item
        for item in history
        if item["direction"] != "BASELINE"
    ]

    if not compared_versions:
        overall_trend = "BASELINE"
    else:
        # The last comparison represents the latest
        # version-to-version change.
        overall_trend = compared_versions[-1]["direction"]

    return {
        "success": True,
        "agent_id": agent_id,

        "total_versions": (
            result["total_versions"]
        ),

        "total_regressions": (
            result["total_regressions"]
        ),

        "total_improvements": (
            result["total_improvements"]
        ),

        "total_unchanged": (
            result["total_unchanged"]
        ),

        "latest_version": (
            latest["version"]
        ),

        "latest_agent_version_id": (
            latest["agent_version_id"]
        ),

        "latest_report_id": (
            latest["report_id"]
        ),

        "latest_reliability_score": (
            latest["reliability_score"]
        ),

        "latest_pass_rate": (
            latest["pass_rate"]
        ),

        "latest_status": (
            latest["status"]
        ),

        "overall_trend": overall_trend,
    }