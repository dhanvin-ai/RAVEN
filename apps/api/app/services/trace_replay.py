"""
Time-Travel Trace Debugger: Replay Engine

Reconstructs step-by-step execution traces from saved AgentExecution records,
and supports deterministic "fork-and-replay" from any step with overrides.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.execution import AgentExecution
from app.models.agent import Agent, AgentVersion
from app.services.agent_brain import decide_tool
from app.engine.tool_executor import execute_tool
from app.engine.model_client import generate_response

logger = logging.getLogger(__name__)


def build_execution_trace(
    db: Session,
    execution_id: int
) -> Dict[str, Any]:
    """
    Reconstructs the full execution trace tree from a saved AgentExecution record.
    Returns a structured list of steps:
      Step 0 - USER_PROMPT
      Step 1 - SYSTEM_PROMPT
      Step 2 - TOOL_DECISION
      Step 3 - TOOL_EXECUTION
      Step 4 - FINAL_OUTPUT
    """
    execution = (
        db.query(AgentExecution)
        .filter(AgentExecution.id == execution_id)
        .first()
    )
    if not execution:
        raise ValueError(f"Execution #{execution_id} not found")

    agent = (
        db.query(Agent)
        .filter(Agent.id == execution.agent_id)
        .first()
    )
    if not agent:
        raise ValueError(f"Agent #{execution.agent_id} not found")

    # Retrieve the version that was used (from result metadata)
    result_data = execution.result or {}
    agent_version_id = result_data.get("agent_version_id")
    version_num = result_data.get("version")

    system_prompt = ""
    if agent_version_id:
        version = (
            db.query(AgentVersion)
            .filter(AgentVersion.id == agent_version_id)
            .first()
        )
        if version:
            system_prompt = version.system_prompt or ""
    elif agent.versions:
        latest = max(agent.versions, key=lambda v: v.version)
        system_prompt = latest.system_prompt or ""

    tool_used = execution.tool_used
    tool_arguments = execution.tool_arguments or {}
    tool_result = result_data.get("result", {})
    final_output = result_data

    steps: List[Dict[str, Any]] = [
        {
            "index": 0,
            "type": "USER_PROMPT",
            "label": "User Prompt",
            "data": execution.user_input or "",
            "editable": True,
        },
        {
            "index": 1,
            "type": "SYSTEM_PROMPT",
            "label": "System Prompt",
            "data": system_prompt,
            "editable": True,
        },
        {
            "index": 2,
            "type": "TOOL_DECISION",
            "label": "Tool Decision",
            "data": {
                "tool": tool_used,
                "arguments": tool_arguments,
            },
            "editable": True,
        },
        {
            "index": 3,
            "type": "TOOL_EXECUTION",
            "label": "Tool Execution Result",
            "data": tool_result,
            "editable": True,
        },
        {
            "index": 4,
            "type": "FINAL_OUTPUT",
            "label": "Final Output",
            "data": final_output,
            "editable": False,
        },
    ]

    return {
        "success": True,
        "execution_id": execution.id,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "version": version_num,
        "agent_version_id": agent_version_id,
        "steps": steps,
    }


def replay_from_step(
    db: Session,
    execution_id: int,
    fork_at_step: int,
    overrides: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Forks execution at a given step index, applies overrides, and re-runs
    the agent pipeline from that point forward.

    Supported overrides:
      - user_input (str): Replace the original user prompt
      - system_prompt (str): Replace the system prompt
      - tool_arguments (dict): Replace tool arguments (re-execute tool)
      - tool_response (dict): Replace tool output (skip re-execution)

    Returns the original trace alongside the forked trace for diff comparison.
    """
    # 1. Build original trace
    original = build_execution_trace(db, execution_id)
    original_steps = original["steps"]
    agent_id = original["agent_id"]

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError(f"Agent #{agent_id} not found")

    # Resolve values from original trace
    user_input = original_steps[0]["data"]
    system_prompt = original_steps[1]["data"]
    original_tool = original_steps[2]["data"].get("tool")
    original_args = original_steps[2]["data"].get("arguments", {})
    original_tool_result = original_steps[3]["data"]

    # Apply overrides based on fork point
    if fork_at_step <= 0:
        user_input = overrides.get("user_input", user_input)
    if fork_at_step <= 1:
        system_prompt = overrides.get("system_prompt", system_prompt)

    # Build available tools list
    available_tools = []
    if agent.tools:
        for tool in agent.tools:
            available_tools.append({
                "name": tool.name,
                "description": tool.description
            })

    forked_steps: List[Dict[str, Any]] = []

    # Step 0: User Prompt
    forked_steps.append({
        "index": 0,
        "type": "USER_PROMPT",
        "label": "User Prompt",
        "data": user_input,
        "modified": user_input != original_steps[0]["data"],
    })

    # Step 1: System Prompt
    forked_steps.append({
        "index": 1,
        "type": "SYSTEM_PROMPT",
        "label": "System Prompt",
        "data": system_prompt,
        "modified": system_prompt != original_steps[1]["data"],
    })

    # Step 2: Tool Decision
    if fork_at_step <= 2 and "tool_arguments" not in overrides and "tool_response" not in overrides:
        # Re-run tool decision from scratch
        decision = decide_tool(
            user_input=user_input,
            available_tools=available_tools,
            system_prompt=system_prompt
        )
        tool_name = decision.get("tool")
        tool_args = decision.get("arguments", {})
    elif "tool_arguments" in overrides:
        tool_name = original_tool
        tool_args = overrides["tool_arguments"]
    else:
        tool_name = original_tool
        tool_args = original_args

    forked_steps.append({
        "index": 2,
        "type": "TOOL_DECISION",
        "label": "Tool Decision",
        "data": {"tool": tool_name, "arguments": tool_args},
        "modified": (tool_name != original_tool or tool_args != original_args),
    })

    # Step 3: Tool Execution
    if "tool_response" in overrides:
        tool_result = overrides["tool_response"]
        forked_steps.append({
            "index": 3,
            "type": "TOOL_EXECUTION",
            "label": "Tool Execution Result",
            "data": tool_result,
            "modified": True,
        })
    elif tool_name:
        tool_result = execute_tool(
            tool_name,
            tool_args,
            allowed_tools=available_tools
        )
        forked_steps.append({
            "index": 3,
            "type": "TOOL_EXECUTION",
            "label": "Tool Execution Result",
            "data": tool_result,
            "modified": (tool_result != original_tool_result),
        })
    else:
        # No tool — generate conversational response
        response = generate_response(
            user_input=user_input,
            system_prompt=system_prompt
        )
        tool_result = {"result": response}
        forked_steps.append({
            "index": 3,
            "type": "TOOL_EXECUTION",
            "label": "Agent Response (No Tool)",
            "data": tool_result,
            "modified": True,
        })

    # Step 4: Final Output
    final_output = {
        "tool": tool_name,
        "arguments": tool_args,
        "result": tool_result,
    }
    forked_steps.append({
        "index": 4,
        "type": "FINAL_OUTPUT",
        "label": "Final Output",
        "data": final_output,
        "modified": True,
    })

    return {
        "success": True,
        "execution_id": execution_id,
        "agent_id": agent_id,
        "agent_name": original["agent_name"],
        "fork_at_step": fork_at_step,
        "original_steps": original_steps,
        "forked_steps": forked_steps,
    }
