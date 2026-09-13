import shlex


class GuardrailService:
    """
    Application-level security policy for sandbox commands.
    """

    BLOCKED_COMMANDS = {
        "rm",
        "rmdir",
        "mkfs",
        "mount",
        "umount",
        "fdisk",
        "shutdown",
        "reboot",
        "poweroff",
    }

    BLOCKED_PATTERNS = {
        "docker": "CONTAINER_ESCAPE",
        "kubectl": "CONTAINER_ESCAPE",
        "sudo": "PRIVILEGE_ESCALATION",
        "su ": "PRIVILEGE_ESCALATION",
        "chmod 777": "PERMISSION_ABUSE",
        "chown root": "PRIVILEGE_ESCALATION",
        "/dev/": "DEVICE_ACCESS",
        "/proc/": "SYSTEM_ACCESS",
        "/sys/": "SYSTEM_ACCESS",
    }

    def check(self, command: str):
        """
        Validate a command before sandbox execution.
        """

        if not command or not command.strip():
            return {
                "allowed": False,
                "category": "INPUT",
                "rule": "EMPTY_COMMAND",
                "severity": "LOW",
                "command": command,
                "reason": "Command is empty.",
            }

        normalized = command.strip().lower()

        try:
            tokens = shlex.split(normalized)
        except ValueError as exc:
            return {
                "allowed": False,
                "category": "INPUT",
                "rule": "INVALID_SYNTAX",
                "severity": "MEDIUM",
                "command": command,
                "reason": f"Invalid command syntax: {exc}",
            }

        if not tokens:
            return {
                "allowed": False,
                "category": "INPUT",
                "rule": "EMPTY_COMMAND",
                "severity": "LOW",
                "command": command,
                "reason": "Command is empty.",
            }

        first_command = tokens[0]

        if first_command in self.BLOCKED_COMMANDS:
            return {
                "allowed": False,
                "category": "SECURITY",
                "rule": "BLOCKED_COMMAND",
                "severity": "CRITICAL",
                "command": command,
                "reason": (
                    f"Command '{first_command}' is blocked "
                    "by RAVEN guardrails."
                ),
            }

        for pattern, rule in self.BLOCKED_PATTERNS.items():
            if pattern in normalized:
                return {
                    "allowed": False,
                    "category": "SECURITY",
                    "rule": rule,
                    "severity": "HIGH",
                    "command": command,
                    "reason": (
                        f"Command contains blocked pattern: "
                        f"'{pattern}'."
                    ),
                }

        return {
            "allowed": True,
            "category": "NONE",
            "rule": "ALLOWED",
            "severity": "NONE",
            "command": command,
            "reason": "Command passed RAVEN guardrails.",
        }
