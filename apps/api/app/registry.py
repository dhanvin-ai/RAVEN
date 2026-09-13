from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent, AgentVersion
from app.models.tool import Tool
from app.schemas.agent import AgentCreate


router = APIRouter(
    prefix="/agents",
    tags=["Agent Registry"],
)


@router.post("/")
def create_agent(
    agent_data: AgentCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new agent and its first version.
    """

    # 1. Check duplicate agent
    existing_agent = (
        db.query(Agent)
        .filter(Agent.name == agent_data.name)
        .first()
    )

    if existing_agent:
        raise HTTPException(
            status_code=409,
            detail="An agent with this name already exists.",
        )


    # 2. Create Agent
    agent = Agent(
        name=agent_data.name,
        description=agent_data.description,
        model=agent_data.model,
    )

    db.add(agent)
    db.flush()


    # 3. Create / Attach tools
    for tool_request in agent_data.tools:

        tool = (
            db.query(Tool)
            .filter(Tool.name == tool_request.name)
            .first()
        )

        if tool is None:

            tool = Tool(
                name=tool_request.name,
                description=tool_request.description,
            )

            db.add(tool)
            db.flush()


        agent.tools.append(tool)



    # 4. Create Agent Version
    version = AgentVersion(
        agent_id=agent.id,
        version=1,
        model_name=agent_data.model,
        system_prompt=agent_data.system_prompt,
    )


    db.add(version)


    # 5. Commit
    db.commit()

    db.refresh(agent)
    db.refresh(version)



    return {
        "success": True,
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "model": agent.model,

            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                }
                for tool in agent.tools
            ],
        },

        "version": {
            "id": version.id,
            "version": version.version,
            "system_prompt": version.system_prompt,
        }
    }


@router.get("/")
def list_agents(
    db: Session = Depends(get_db),
):
    """
    Return all registered agents.
    """

    agents = (
        db.query(Agent)
        .order_by(Agent.id)
        .all()
    )

    results = []

    for agent in agents:

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

        results.append(
            {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "model": agent.model,
                "ponytail_mode": getattr(agent, "ponytail_mode", "OFF") or "OFF",
                "tools": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                    }
                    for tool in agent.tools
                ],
                "latest_version": (
                    {
                        "version": latest_version.version,
                        "system_prompt": latest_version.system_prompt,
                    }
                    if latest_version
                    else None
                ),
            }
        )

    return {
        "success": True,
        "agents": results,
    }


@router.get("/tools/list")
def list_tools(
    db: Session = Depends(get_db),
):
    """
    Return all registered tools.
    """

    tools = (
        db.query(Tool)
        .order_by(Tool.name)
        .all()
    )

    return {
        "success": True,
        "tools": [
            {
                "id": tool.id,
                "name": tool.name,
                "description": tool.description,
            }
            for tool in tools
        ],
    }


@router.get("/{agent_id}")
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
):
    """
    Return one agent and all its versions.
    """

    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found.",
        )

    versions = (
        db.query(AgentVersion)
        .filter(
            AgentVersion.agent_id == agent.id
        )
        .order_by(
            AgentVersion.version.desc()
        )
        .all()
    )

    return {
        "success": True,
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "model": agent.model,
            "tools": [
                {
                    "id": tool.id,
                    "name": tool.name,
                    "description": tool.description,
                }
                for tool in agent.tools
            ],
            "versions": [
                {
                    "id": version.id,
                    "version": version.version,
                    "system_prompt": version.system_prompt,
                }
                for version in versions
            ],
        },
    }