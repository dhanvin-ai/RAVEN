from sqlalchemy.orm import Session

from app.models.scenario import Scenario, TestSuite
from app.services.scenario_executor import execute_scenario
from app.services.reliability_service import save_reliability_report


def execute_test_suite(
    db: Session,
    test_suite_id: int,
):
    test_suite = (
        db.query(TestSuite)
        .filter(TestSuite.id == test_suite_id)
        .first()
    )

    if not test_suite:
        return {
            "success": False,
            "error": "Test suite not found",
        }

    scenarios = (
        db.query(Scenario)
        .filter(
            Scenario.test_suite_id == test_suite_id
        )
        .order_by(Scenario.id)
        .all()
    )

    if not scenarios:
        return {
            "success": False,
            "error": "No scenarios found for test suite",
        }

    results = []

    for scenario in scenarios:
        result = execute_scenario(
            db=db,
            scenario_id=scenario.id,
        )

        results.append(result)

    total = len(results)

    passed = sum(
        1
        for result in results
        if result.get(
            "expected_behavior_passed"
        ) is True
    )

    failed = total - passed

    pass_rate = (
        round(
            (passed / total) * 100,
            2,
        )
        if total > 0
        else 0
    )

    reliability_report = save_reliability_report(
        db=db,
        agent_id=test_suite.agent_id,
    )

    return {
        "success": True,
        "test_suite_id": test_suite.id,
        "test_suite_name": test_suite.name,
        "agent_id": test_suite.agent_id,

        "total_scenarios": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": pass_rate,

        "reliability_report": {
            "id": reliability_report.id,
            "reliability_score": (
                reliability_report.reliability_score
            ),
            "status": reliability_report.status,
            "severity_breakdown": (
                reliability_report.severity_breakdown
            ),
            "failure_classification_breakdown": (
                reliability_report
                .failure_classification_breakdown
            ),
        },

        "results": results,
    }
