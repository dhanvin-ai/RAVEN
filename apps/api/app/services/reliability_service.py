from collections import Counter

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.scenario import Scenario
from app.models.scenario_execution import ScenarioExecution
from app.models.reliability_report import ReliabilityReport
from app.models.agent import AgentVersion


SEVERITY_WEIGHTS = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


def calculate_reliability_report(
    db: Session,
    agent_id: int,
    agent_version_id: int | None = None,
):
    """
    Calculate the reliability report for an agent.

    If agent_version_id is provided, only executions belonging
    to that exact agent version are considered.

    If agent_version_id is not provided, the latest execution
    of each scenario for the agent is used. This preserves
    backward compatibility with the existing API.
    """

    # -----------------------------------------
    # 1. Build execution query
    # -----------------------------------------
    execution_query = (
        db.query(
            ScenarioExecution.scenario_id,
            func.max(ScenarioExecution.id).label(
                "latest_execution_id"
            ),
        )
        .filter(
            ScenarioExecution.agent_id == agent_id
        )
    )

    # -----------------------------------------
    # 2. Restrict to a specific version
    # -----------------------------------------
    if agent_version_id is not None:
        execution_query = execution_query.filter(
            ScenarioExecution.agent_version_id
            == agent_version_id
        )

    latest_execution_subquery = (
        execution_query
        .group_by(
            ScenarioExecution.scenario_id
        )
        .subquery()
    )

    # -----------------------------------------
    # 3. Fetch latest execution per scenario
    # -----------------------------------------
    executions = (
        db.query(
            ScenarioExecution,
            Scenario,
        )
        .join(
            latest_execution_subquery,
            ScenarioExecution.id
            == latest_execution_subquery.c.latest_execution_id,
        )
        .join(
            Scenario,
            Scenario.id == ScenarioExecution.scenario_id,
        )
        .order_by(
            ScenarioExecution.scenario_id
        )
        .all()
    )

    # -----------------------------------------
    # 4. No execution data
    # -----------------------------------------
    if not executions:
        return {
            "agent_id": agent_id,
            "agent_version_id": agent_version_id,
            "total_scenarios": 0,
            "passed": 0,
            "failed": 0,
            "pass_rate": 0.0,
            "reliability_score": 0.0,
            "severity_breakdown": {},
            "failure_classification_breakdown": {},
            "status": "NO_DATA",
        }

    # -----------------------------------------
    # 5. Basic statistics
    # -----------------------------------------
    total = len(executions)

    passed = sum(
        1
        for execution, scenario in executions
        if execution.expected_behavior_passed is True
    )

    failed = total - passed

    pass_rate = round(
        (passed / total) * 100,
        2,
    )

    # -----------------------------------------
    # 6. Severity breakdown
    # -----------------------------------------
    severity_counter = Counter()

    for execution, scenario in executions:

        severity = (
            scenario.severity.upper()
            if scenario.severity
            else "UNKNOWN"
        )

        severity_counter[severity] += 1

    # -----------------------------------------
    # 7. Failure classification breakdown
    # -----------------------------------------
    classification_counter = Counter()

    for execution, scenario in executions:

        if execution.expected_behavior_passed is True:
            continue

        classification = (
            execution.failure_classification
            or "UNKNOWN"
        )

        classification_counter[classification] += 1

    # -----------------------------------------
    # 8. Severity-weighted reliability score
    # -----------------------------------------
    total_weight = 0
    passed_weight = 0

    for execution, scenario in executions:

        severity = (
            scenario.severity.upper()
            if scenario.severity
            else "LOW"
        )

        weight = SEVERITY_WEIGHTS.get(
            severity,
            1,
        )

        total_weight += weight

        if execution.expected_behavior_passed is True:
            passed_weight += weight

    reliability_score = (
        round(
            (passed_weight / total_weight) * 100,
            2,
        )
        if total_weight > 0
        else 0.0
    )

    # -----------------------------------------
    # 9. Determine reliability status
    # -----------------------------------------
    if reliability_score >= 90:
        status = "EXCELLENT"

    elif reliability_score >= 75:
        status = "GOOD"

    elif reliability_score >= 50:
        status = "NEEDS_IMPROVEMENT"

    else:
        status = "CRITICAL"

    # -----------------------------------------
    # 10. Return report data
    # -----------------------------------------
    return {
        "agent_id": agent_id,
        "agent_version_id": agent_version_id,
        "total_scenarios": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": pass_rate,
        "reliability_score": reliability_score,
        "severity_breakdown": dict(
            severity_counter
        ),
        "failure_classification_breakdown": dict(
            classification_counter
        ),
        "status": status,
    }


def save_reliability_report(
    db: Session,
    agent_id: int,
    agent_version_id: int | None = None,
):
    """
    Calculate and persist a reliability report.

    If agent_version_id is provided, the report is explicitly
    associated with that version.

    Otherwise, the latest agent version is used, preserving
    the existing behavior.
    """

    # -----------------------------------------
    # 1. Resolve version
    # -----------------------------------------
    selected_version = None

    if agent_version_id is not None:

        selected_version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.id == agent_version_id,
                AgentVersion.agent_id == agent_id,
            )
            .first()
        )

        if not selected_version:
            return {
                "success": False,
                "error": (
                    f"Agent version {agent_version_id} "
                    f"does not belong to agent {agent_id}"
                ),
            }

    else:

        selected_version = (
            db.query(AgentVersion)
            .filter(
                AgentVersion.agent_id == agent_id
            )
            .order_by(
                AgentVersion.version.desc()
            )
            .first()
        )

    selected_version_id = (
        selected_version.id
        if selected_version
        else None
    )

    # -----------------------------------------
    # 2. Calculate version-specific report
    # -----------------------------------------
    report_data = calculate_reliability_report(
        db=db,
        agent_id=agent_id,
        agent_version_id=selected_version_id,
    )

    # -----------------------------------------
    # 3. Persist report
    # -----------------------------------------
    report = ReliabilityReport(
        agent_id=report_data["agent_id"],
        agent_version_id=selected_version_id,
        total_scenarios=report_data["total_scenarios"],
        passed=report_data["passed"],
        failed=report_data["failed"],
        pass_rate=report_data["pass_rate"],
        reliability_score=report_data["reliability_score"],
        severity_breakdown=report_data["severity_breakdown"],
        failure_classification_breakdown=(
            report_data[
                "failure_classification_breakdown"
            ]
        ),
        status=report_data["status"],
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return report