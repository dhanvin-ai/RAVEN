from sqlalchemy.orm import Session

from app.models.scenario import Scenario
from app.models.scenario_execution import ScenarioExecution
from app.models.reliability_report import ReliabilityReport


def get_latest_execution_for_version(
    db: Session,
    agent_id: int,
    agent_version_id: int,
):
    """
    Return the latest execution of every scenario
    for a specific agent version.
    """

    executions = (
        db.query(
            ScenarioExecution,
            Scenario,
        )
        .join(
            Scenario,
            Scenario.id == ScenarioExecution.scenario_id,
        )
        .filter(
            ScenarioExecution.agent_id == agent_id,
            ScenarioExecution.agent_version_id
            == agent_version_id,
        )
        .order_by(
            ScenarioExecution.scenario_id,
            ScenarioExecution.id.desc(),
        )
        .all()
    )

    latest_execution_by_scenario = {}

    for execution, scenario in executions:

        if scenario.id not in latest_execution_by_scenario:

            latest_execution_by_scenario[
                scenario.id
            ] = {
                "scenario": scenario,
                "execution": execution,
            }

    return latest_execution_by_scenario


def compare_failure_differences(
    db: Session,
    agent_id: int,
    baseline_version_id: int,
    current_version_id: int,
):
    """
    Compare scenario-level results between two
    specific agent versions.

    Categories:

    NEW_FAILURE:
        Passed in baseline, failed in current.

    NEW_PASS:
        Failed in baseline, passed in current.

    PERSISTENT_FAILURE:
        Failed in both versions.

    PERSISTENT_PASS:
        Passed in both versions.
    """

    if baseline_version_id == current_version_id:
        return {
            "success": False,
            "error": (
                "Baseline and current versions "
                "must be different"
            ),
        }

    baseline_report = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.agent_id == agent_id,
            ReliabilityReport.agent_version_id
            == baseline_version_id,
        )
        .order_by(
            ReliabilityReport.id.desc()
        )
        .first()
    )

    if not baseline_report:
        return {
            "success": False,
            "error": (
                f"No reliability report found "
                f"for baseline version "
                f"{baseline_version_id}"
            ),
        }

    current_report = (
        db.query(ReliabilityReport)
        .filter(
            ReliabilityReport.agent_id == agent_id,
            ReliabilityReport.agent_version_id
            == current_version_id,
        )
        .order_by(
            ReliabilityReport.id.desc()
        )
        .first()
    )

    if not current_report:
        return {
            "success": False,
            "error": (
                f"No reliability report found "
                f"for current version "
                f"{current_version_id}"
            ),
        }

    baseline_executions = (
        get_latest_execution_for_version(
            db=db,
            agent_id=agent_id,
            agent_version_id=baseline_version_id,
        )
    )

    current_executions = (
        get_latest_execution_for_version(
            db=db,
            agent_id=agent_id,
            agent_version_id=current_version_id,
        )
    )

    all_scenario_ids = sorted(
        set(baseline_executions.keys())
        | set(current_executions.keys())
    )

    new_failures = []
    new_passes = []
    persistent_failures = []
    persistent_passes = []

    for scenario_id in all_scenario_ids:

        baseline_data = baseline_executions.get(
            scenario_id
        )

        current_data = current_executions.get(
            scenario_id
        )

        # A scenario must exist in both versions
        # to be classified as a difference.
        if not baseline_data or not current_data:
            continue

        baseline_execution = (
            baseline_data["execution"]
        )

        current_execution = (
            current_data["execution"]
        )

        scenario = current_data["scenario"]

        baseline_passed = (
            baseline_execution.expected_behavior_passed
            is True
        )

        current_passed = (
            current_execution.expected_behavior_passed
            is True
        )

        scenario_data = {
            "scenario_id": scenario.id,

            "scenario_name": scenario.name,

            "category": scenario.category,

            "severity": scenario.severity,

            "user_input": scenario.user_input,

            "expected_behavior": (
                scenario.expected_behavior
            ),

            "baseline_passed": baseline_passed,

            "current_passed": current_passed,

            "baseline_execution_id": (
                baseline_execution.id
            ),

            "current_execution_id": (
                current_execution.id
            ),

            "baseline_failure_classification": (
                baseline_execution.failure_classification
            ),

            "current_failure_classification": (
                current_execution.failure_classification
            ),

            "baseline_failure_reason": (
                baseline_execution.failure_reason
            ),

            "current_failure_reason": (
                current_execution.failure_reason
            ),

            "baseline_tool_calls": (
                baseline_execution.tool_calls
            ),

            "current_tool_calls": (
                current_execution.tool_calls
            ),

            "baseline_forbidden_tool_calls": (
                baseline_execution.forbidden_tool_calls
            ),

            "current_forbidden_tool_calls": (
                current_execution.forbidden_tool_calls
            ),
        }

        if (
            baseline_passed
            and not current_passed
        ):
            new_failures.append(
                scenario_data
            )

        elif (
            not baseline_passed
            and current_passed
        ):
            new_passes.append(
                scenario_data
            )

        elif (
            not baseline_passed
            and not current_passed
        ):
            persistent_failures.append(
                scenario_data
            )

        elif (
            baseline_passed
            and current_passed
        ):
            persistent_passes.append(
                scenario_data
            )

    return {
        "success": True,

        "agent_id": agent_id,

        "baseline_version_id": (
            baseline_version_id
        ),

        "current_version_id": (
            current_version_id
        ),

        "baseline_report_id": (
            baseline_report.id
        ),

        "current_report_id": (
            current_report.id
        ),

        "baseline_execution_count": (
            len(baseline_executions)
        ),

        "current_execution_count": (
            len(current_executions)
        ),

        "new_failure_count": (
            len(new_failures)
        ),

        "new_pass_count": (
            len(new_passes)
        ),

        "persistent_failure_count": (
            len(persistent_failures)
        ),

        "persistent_pass_count": (
            len(persistent_passes)
        ),

        "new_failures": new_failures,

        "new_passes": new_passes,

        "persistent_failures": (
            persistent_failures
        ),

        "persistent_passes": persistent_passes,
    }
