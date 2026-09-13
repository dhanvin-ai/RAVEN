from app.sandbox.sandbox_service import SandboxService


def test_allowed_command():
    sandbox = SandboxService()

    result = sandbox.run("echo RAVEN_SECURITY_TEST_OK")

    assert result["success"] is True
    assert result["blocked_by_guardrail"] is False
    assert "RAVEN_SECURITY_TEST_OK" in result["stdout"]


def test_rm_blocked():
    sandbox = SandboxService()

    result = sandbox.run("rm -rf /")

    assert result["success"] is False
    assert result["blocked_by_guardrail"] is True
    assert "blocked" in result["stderr"].lower()


def test_sudo_blocked():
    sandbox = SandboxService()

    result = sandbox.run("sudo whoami")

    assert result["success"] is False
    assert result["blocked_by_guardrail"] is True


def test_non_root_execution():
    sandbox = SandboxService()

    result = sandbox.run("id")

    assert result["success"] is True
    assert "uid=1000" in result["stdout"]
    assert "gid=1000" in result["stdout"]


def test_read_only_root_filesystem():
    sandbox = SandboxService()

    result = sandbox.run(
        "touch /raven-root-test 2>&1 || true"
    )

    assert result["success"] is True
    assert "Read-only file system" in result["stdout"]


def test_tmp_writable():
    sandbox = SandboxService()

    result = sandbox.run(
        "echo RAVEN_TMP_OK > /tmp/raven-test && "
        "cat /tmp/raven-test"
    )

    assert result["success"] is True
    assert "RAVEN_TMP_OK" in result["stdout"]


def test_network_disabled():
    sandbox = SandboxService()

    result = sandbox.run(
        "python -c "
        "'import urllib.request; "
        "urllib.request.urlopen(\\\"https://example.com\\\", timeout=3)'"
    )

    assert result["success"] is False
    assert result["timed_out"] is False


def test_resource_limits():
    sandbox = SandboxService()

    assert sandbox.memory == "256m"
    assert sandbox.cpus == "0.5"
    assert sandbox.pids_limit == 64


def test_timeout():
    sandbox = SandboxService()

    result = sandbox.run(
        "sleep 10",
        timeout=2,
    )

    assert result["success"] is False
    assert result["timed_out"] is True
