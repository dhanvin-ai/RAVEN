import subprocess
from typing import Optional

from app.guardrails.guardrail_service import GuardrailService


class SandboxService:
    """
    Runs commands inside a hardened, non-root Docker container
    after passing RAVEN application-level guardrails.
    """

    def __init__(
        self,
        image: str = "python:3.12-slim",
        timeout: int = 30,
        memory: str = "256m",
        cpus: str = "0.5",
        pids_limit: int = 64,
        user: str = "1000:1000",
    ):
        self.image = image
        self.timeout = timeout
        self.memory = memory
        self.cpus = cpus
        self.pids_limit = pids_limit
        self.user = user
        self.guardrails = GuardrailService()

    def run(
        self,
        command: str,
        timeout: Optional[int] = None,
    ):
        # -----------------------------------------
        # 1. Application-level guardrail check
        # -----------------------------------------
        guardrail_result = self.guardrails.check(command)

        if not guardrail_result["allowed"]:
            return {
                "success": False,
                "exit_code": None,
                "stdout": "",
                "stderr": guardrail_result["reason"],
                "timed_out": False,
                "blocked_by_guardrail": True,
            }

        execution_timeout = timeout or self.timeout

        # -----------------------------------------
        # 2. Hardened Docker execution
        # -----------------------------------------
        docker_command = [
            "docker",
            "run",
            "--rm",

            # Network isolation
            "--network",
            "none",

            # Resource limits
            "--memory",
            self.memory,
            "--cpus",
            self.cpus,
            "--pids-limit",
            str(self.pids_limit),

            # Security hardening
            "--read-only",
            "--security-opt",
            "no-new-privileges",

            # Non-root execution
            "--user",
            self.user,

            # Temporary writable filesystem
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",

            self.image,
            "sh",
            "-c",
            command,
        ]

        try:
            result = subprocess.run(
                docker_command,
                capture_output=True,
                text=True,
                timeout=execution_timeout,
            )

            return {
                "success": result.returncode == 0,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "timed_out": False,
                "blocked_by_guardrail": False,
            }

        except subprocess.TimeoutExpired as exc:
            return {
                "success": False,
                "exit_code": None,
                "stdout": exc.stdout or "",
                "stderr": exc.stderr or "",
                "timed_out": True,
                "blocked_by_guardrail": False,
            }

        except Exception as exc:
            return {
                "success": False,
                "exit_code": None,
                "stdout": "",
                "stderr": str(exc),
                "timed_out": False,
                "blocked_by_guardrail": False,
            }
