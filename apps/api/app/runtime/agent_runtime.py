from app.engine.agent_runner import AgentRunner


class AgentRuntime:

    def __init__(self, agent):
        self.agent = agent
        self.runner = AgentRunner(agent)

    def run(
        self,
        user_input: str,
        agent_version_id=None
    ):
        return self.runner.run(
            user_input=user_input,
            agent_version_id=agent_version_id
        )