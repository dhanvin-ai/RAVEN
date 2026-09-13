from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent, AgentVersion
from app.models.tool import Tool
from app.schemas.agent import AgentCreate, AgentVersionCreate


router = APIRouter(
    prefix="/agents",
    tags=["Agent Registry"]
)


@router.post("/")
def create_agent(
    agent_data: AgentCreate,
    db: Session = Depends(get_db)
):
    try:
        # -----------------------------------------
        # 1. Check whether agent already exists
        # -----------------------------------------
        existing_agent = (
            db.query(Agent)
            .filter(Agent.name == agent_data.name)
            .first()
        )

        if existing_agent:
            raise HTTPException(
                status_code=400,
                detail="Agent already exists"
            )

        # -----------------------------------------
        # 2. Create the agent
        # -----------------------------------------
        agent = Agent(
            name=agent_data.name,
            description=agent_data.description
        )

        db.add(agent)
        db.flush()

        # -----------------------------------------
        # 3. Create version 1
        # -----------------------------------------
        version = AgentVersion(
            agent_id=agent.id,
            version=1,
            model_name=agent_data.model,
            system_prompt=agent_data.system_prompt
        )

        db.add(version)

        # -----------------------------------------
        # 4. Add tools
        # -----------------------------------------
        for tool_request in agent_data.tools:

            # Find existing tool by name
            tool = (
                db.query(Tool)
                .filter(Tool.name == tool_request.name)
                .first()
            )

            # Create tool if it doesn't exist
            if not tool:
                tool = Tool(
                    name=tool_request.name,
                    description=tool_request.description
                )

                db.add(tool)
                db.flush()

            # Attach tool to agent
            agent.tools.append(tool)

        # -----------------------------------------
        # 5. Save everything
        # -----------------------------------------
        db.commit()
        db.refresh(agent)

        # -----------------------------------------
        # 6. Return response
        # -----------------------------------------
        return {
            "success": True,
            "agent_id": agent.id,
            "name": agent.name,
            "version": 1,
            "model": agent_data.model,
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description
                }
                for tool in agent.tools
            ]
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create agent: {str(e)}"
        )
# -----------------------------------------
# Get all versions of an agent
# -----------------------------------------
@router.get("/{agent_id}/versions")
def get_agent_versions(
    agent_id: int,
    db: Session = Depends(get_db)
):
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    versions = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent_id)
        .order_by(AgentVersion.version.desc())
        .all()
    )

    return {
        "success": True,
        "agent_id": agent_id,
        "versions": [
            {
                "id": version.id,
                "version": version.version,
                "model": version.model_name,
                "system_prompt": version.system_prompt
            }
            for version in versions
        ]
    }


# -----------------------------------------
# Get all tools attached to an agent
# -----------------------------------------
@router.get("/{agent_id}/tools")
def get_agent_tools(
    agent_id: int,
    db: Session = Depends(get_db)
):
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    return {
        "success": True,
        "agent_id": agent_id,
        "tools": [
            {
                "id": tool.id,
                "name": tool.name,
                "description": tool.description
            }
            for tool in agent.tools
        ]
    }
# -----------------------------------------
# Create a new version of an agent
# -----------------------------------------
@router.post("/{agent_id}/versions")
def create_agent_version(
    agent_id: int,
    version_data: AgentVersionCreate,
    db: Session = Depends(get_db)
):
    # Find agent
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    # Find latest version
    latest_version = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent_id)
        .order_by(AgentVersion.version.desc())
        .first()
    )

    # Calculate next version number
    next_version = (
        latest_version.version + 1
        if latest_version
        else 1
    )

    # Create new version
    new_version = AgentVersion(
        agent_id=agent_id,
        version=next_version,
        model_name=version_data.model,
        system_prompt=version_data.system_prompt
    )

    db.add(new_version)

    # Keep Agent.model synchronized with latest version
    agent.model = version_data.model

    db.commit()
    db.refresh(new_version)

    return {
        "success": True,
        "agent_id": agent_id,
        "version": {
            "id": new_version.id,
            "version": new_version.version,
            "model": new_version.model_name,
            "system_prompt": new_version.system_prompt
        }
    }
# -----------------------------------------
# UPDATE AGENT
# -----------------------------------------

@router.put("/{agent_id}")
def update_agent(
    agent_id: int,
    agent_data: AgentCreate,
    db: Session = Depends(get_db)
):
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    try:
        # Update basic agent information
        agent.name = agent_data.name
        agent.description = agent_data.description

        # Find latest version number
        latest_version = (
            db.query(AgentVersion)
            .filter(AgentVersion.agent_id == agent_id)
            .order_by(AgentVersion.version.desc())
            .first()
        )

        next_version = (
            latest_version.version + 1
            if latest_version
            else 1
        )

        # Create a new version
        version = AgentVersion(
            agent_id=agent_id,
            version=next_version,
            model_name=agent_data.model,
            system_prompt=agent_data.system_prompt
        )

        db.add(version)

        db.commit()
        db.refresh(agent)

        return {
            "success": True,
            "agent": {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "version": next_version,
                "model": agent_data.model,
                "system_prompt": agent_data.system_prompt
            }
        }

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to update agent: {str(e)}"
        )


# -----------------------------------------
# DELETE AGENT
# -----------------------------------------

@router.delete("/{agent_id}")
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db)
):
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id)
        .first()
    )

    if not agent:
        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    try:
        db.delete(agent)
        db.commit()

        return {
            "success": True,
            "message": f"Agent {agent_id} deleted successfully"
        }

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete agent: {str(e)}"
        )


# -----------------------------------------
# PONYTAIL MODE UPDATE
# -----------------------------------------

class PonytailUpdateRequest(BaseModel):
    ponytail_mode: str = Field(..., description="Ponytail mode: OFF, LITE, FULL, ULTRA")


@router.patch("/{agent_id}/ponytail")
def update_agent_ponytail_mode(
    agent_id: int,
    request: PonytailUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Updates the active Ponytail Protocol intensity for an agent (OFF, LITE, FULL, ULTRA).
    """
    clean_mode = request.ponytail_mode.strip().upper()
    if clean_mode not in ["OFF", "LITE", "FULL", "ULTRA"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ponytail_mode '{request.ponytail_mode}'. Must be one of: OFF, LITE, FULL, ULTRA"
        )

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent #{agent_id} not found")

    agent.ponytail_mode = clean_mode
    db.commit()
    db.refresh(agent)

    return {
        "success": True,
        "agent_id": agent.id,
        "name": agent.name,
        "ponytail_mode": agent.ponytail_mode,
        "message": f"Agent #{agent.id} ({agent.name}) Ponytail Mode set to {clean_mode}."
    }
