from app.engine.tool_executor import execute_sandbox_command


def test_executor_allows_safe_command():
    result = execute_sandbox_command(
        "echo RAVEN_INTEGRATION_OK"
    )

    assert result["success"] is True
    assert result["blocked_by_guardrail"] is False
    assert "RAVEN_INTEGRATION_OK" in result["stdout"]


def test_executor_blocks_rm():
    result = execute_sandbox_command(
        "rm -rf /"
    )

    assert result["success"] is False
    assert result["blocked_by_guardrail"] is True
    assert "blocked" in result["stderr"].lower()


def test_executor_blocks_sudo():
    result = execute_sandbox_command(
        "sudo whoami"
    )

    assert result["success"] is False
    assert result["blocked_by_guardrail"] is True


def test_executor_timeout():
    result = execute_sandbox_command(
        "sleep 10",
        timeout=2,
    )

    assert result["success"] is False
    assert result["timed_out"] is True
    assert result["blocked_by_guardrail"] is False
