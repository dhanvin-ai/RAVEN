from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent, AgentVersion
from app.models.scenario import TestSuite, Scenario
from app.schemas.scenario import (
GeneratedScenario,    
ScenarioGenerateRequest,
    ScenarioGenerateResponse,
TestSuiteScenarioResponse,
)

from app.services.scenario_generator import generate_scenarios
from app.services.test_suite_executor import execute_test_suite

router = APIRouter(
    prefix="/scenarios",
    tags=["Scenario Generation"],
)


@router.post(
    "/generate",
    response_model=ScenarioGenerateResponse,
)
def generate_agent_scenarios(
    request: ScenarioGenerateRequest,
    db: Session = Depends(get_db),
):
    # -----------------------------------------
    # 1. Find agent
    # -----------------------------------------
    agent = (
        db.query(Agent)
        .filter(Agent.id == request.agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found",
        )

    # -----------------------------------------
    # 2. Find latest agent version
    # -----------------------------------------
    latest_version = (
        db.query(AgentVersion)
        .filter(
            AgentVersion.agent_id == agent.id
        )
        .order_by(
            AgentVersion.version.desc()
        )
        .first()
    )

    if not latest_version:
        raise HTTPException(
            status_code=404,
            detail="No agent version found",
        )

    # -----------------------------------------
    # 3. Collect agent tools
    # -----------------------------------------
    tools = [
        {
            "name": tool.name,
            "description": tool.description,
        }
        for tool in agent.tools
    ]

    # -----------------------------------------
    # 4. Generate scenarios using Gemini
    # -----------------------------------------
    try:
        scenarios = generate_scenarios(
            agent_name=agent.name,
            agent_description=agent.description or "",
            system_prompt=latest_version.system_prompt or "",
            tools=tools,
            count=request.count,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scenario generation failed: {str(exc)}",
        ) from exc

    # -----------------------------------------
    # 5. Create a test suite
    # -----------------------------------------
    test_suite = TestSuite(
        name=f"{agent.name} - Generated Scenarios",
        description=f"AI-generated test scenarios for {agent.name}",
        agent_id=agent.id,
    )

    db.add(test_suite)
    db.flush()

    # -----------------------------------------
    # 6. Save generated scenarios
    # -----------------------------------------
    for generated in scenarios:
        scenario = Scenario(
            test_suite_id=test_suite.id,
            name=generated.name,
            category=generated.category,
            severity=generated.severity,
            user_input=generated.user_input,
            expected_behavior=generated.expected_behavior,
            forbidden_actions=generated.forbidden_actions,
        )

        db.add(scenario)

    # -----------------------------------------
    # 7. Commit everything
    # -----------------------------------------
    db.commit()

    # -----------------------------------------
    # 8. Return generated scenarios
    # -----------------------------------------
    return ScenarioGenerateResponse(
        success=True,
        agent_id=agent.id,
        scenarios=scenarios,
    )
@router.get(
    "/suite/{suite_id}",
    response_model=list[GeneratedScenario],
)
def get_suite_scenarios(
    suite_id: int,
    db: Session = Depends(get_db),
):
    scenarios = (
        db.query(Scenario)
        .filter(Scenario.test_suite_id == suite_id)
        .order_by(Scenario.id.asc())
        .all()
    )

    if not scenarios:
        raise HTTPException(
            status_code=404,
            detail="No scenarios found for this test suite",
        )

    return [
        GeneratedScenario(
            name=scenario.name,
            category=scenario.category,
            severity=scenario.severity,
            user_input=scenario.user_input,
            expected_behavior=scenario.expected_behavior,
            forbidden_actions=scenario.forbidden_actions,
        )
        for scenario in scenarios
    ]
@router.get(
    "/agent/{agent_id}",
    response_model=list[TestSuiteScenarioResponse],
)
def get_agent_test_suites(
    agent_id: int,
    db: Session = Depends(get_db),
):
    suites = (
        db.query(TestSuite)
        .filter(TestSuite.agent_id == agent_id)
        .order_by(TestSuite.id.desc())
        .all()
    )

    return [
        TestSuiteScenarioResponse(
            id=suite.id,
            name=suite.name,
            description=suite.description,
            agent_id=suite.agent_id,
            scenarios=[
                GeneratedScenario(
                    name=scenario.name,
                    category=scenario.category,
                    severity=scenario.severity,
                    user_input=scenario.user_input,
                    expected_behavior=scenario.expected_behavior,
                    forbidden_actions=scenario.forbidden_actions,
                )
                for scenario in suite.scenarios
            ],
        )
        for suite in suites
    ]       
@router.post("/suite/{suite_id}/execute")
def execute_suite(
    suite_id: int,
    db: Session = Depends(get_db),
):
    """
    Execute all scenarios in a test suite.

    Step 3.8:
    - Execute every scenario
    - Collect execution results
    - Return suite-level statistics
    """

    result = execute_test_suite(
        db=db,
        test_suite_id=suite_id,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=404,
            detail=result.get(
                "error",
                "Test suite execution failed",
            ),
        )

    return result
