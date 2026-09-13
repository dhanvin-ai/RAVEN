from app.services.agent_brain import decide_tool
from app.engine.tool_executor import execute_tool
from app.engine.model_client import generate_response
from app.engine.ponytail import inject_ponytail_ladder


class AgentRunner:

    def __init__(self, agent):
        self.agent = agent

    def _get_version(self, agent_version_id=None):
        """
        Get the agent version to use.

        If agent_version_id is provided, use that exact version.
        Otherwise, fall back to the latest version.
        """

        if not self.agent.versions:
            return None

        if agent_version_id is not None:
            for version in self.agent.versions:
                if version.id == agent_version_id:
                    return version

            raise ValueError(
                f"Agent version {agent_version_id} "
                f"does not belong to agent {self.agent.id}"
            )

        return max(
            self.agent.versions,
            key=lambda version: version.version
        )

    def run(
        self,
        user_input: str,
        agent_version_id=None
    ):

        # -----------------------------------------
        # 1. Select agent version
        # -----------------------------------------
        selected_version = self._get_version(
            agent_version_id=agent_version_id
        )

        # -----------------------------------------
        # 2. Get system prompt
        # -----------------------------------------
        system_prompt = ""

        if selected_version:
            system_prompt = selected_version.system_prompt

        # Apply Ponytail protocol ladder if active
        ponytail_mode = getattr(self.agent, "ponytail_mode", "OFF") or "OFF"
        if ponytail_mode != "OFF":
            system_prompt = inject_ponytail_ladder(system_prompt, mode=ponytail_mode)

        # -----------------------------------------
        # 3. Get tools available to this agent
        # -----------------------------------------
        available_tools = []

        if self.agent.tools:
            for tool in self.agent.tools:
                available_tools.append({
                    "name": tool.name,
                    "description": tool.description
                })

        # -----------------------------------------
        # 4. Ask AI to decide which tool to use
        # -----------------------------------------
        decision = decide_tool(
            user_input=user_input,
            available_tools=available_tools,
            system_prompt=system_prompt
        )

        tool_name = decision.get("tool")
        arguments = decision.get("arguments", {})

        # -----------------------------------------
        # 5. Normal response if no tool required
        # -----------------------------------------
        if not tool_name:

            response = generate_response(
                user_input=user_input,
                system_prompt=system_prompt
            )

            return {
                "tool": None,
                "arguments": {},
                "result": response,
                "version": (
                    selected_version.version
                    if selected_version
                    else None
                ),
                "agent_version_id": (
                    selected_version.id
                    if selected_version
                    else None
                )
            }

        # -----------------------------------------
        # 6. Execute selected tool
        # -----------------------------------------
        result = execute_tool(
            tool_name,
            arguments,
            allowed_tools=available_tools
        )

        # -----------------------------------------
        # 7. Return complete runtime result
        # -----------------------------------------
        return {
            "tool": tool_name,
            "arguments": arguments,
            "result": result,
            "version": (
                selected_version.version
                if selected_version
                else None
            ),
            "agent_version_id": (
                selected_version.id
                if selected_version
                else None
            )
        }