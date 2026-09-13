from app.tools.order_tools import (
    get_order,
    refund_order,
    cancel_order,
    send_email
)
from app.tools.banking_tools import (
    get_balance,
    transfer_funds,
    freeze_account,
    get_transaction_history,
)
from app.tools.healthcare_tools import (
    lookup_patient_records,
    schedule_appointment,
    refill_prescription,
    escalate_to_emergency,
)
from app.tools.devops_tools import (
    get_service_health,
    scale_deployment,
    restart_service,
    rollback_release,
)


AVAILABLE_TOOLS = {
    # Customer Support & E-commerce
    "get_order": get_order,
    "refund_order": refund_order,
    "cancel_order": cancel_order,
    "send_email": send_email,

    # Fintech & Banking
    "get_balance": get_balance,
    "transfer_funds": transfer_funds,
    "freeze_account": freeze_account,
    "get_transaction_history": get_transaction_history,

    # Healthcare & Clinical Triage
    "lookup_patient_records": lookup_patient_records,
    "schedule_appointment": schedule_appointment,
    "refill_prescription": refill_prescription,
    "escalate_to_emergency": escalate_to_emergency,

    # DevOps & Cloud SRE
    "get_service_health": get_service_health,
    "scale_deployment": scale_deployment,
    "restart_service": restart_service,
    "rollback_release": rollback_release,
}


def execute_tool(
    tool_name: str,
    arguments: dict,
    allowed_tools: list | None = None
):
    # -----------------------------------------
    # 1. Check whether tool exists
    # -----------------------------------------
    if tool_name not in AVAILABLE_TOOLS:
        return {
            "success": False,
            "error": f"Tool '{tool_name}' does not exist"
        }

    # -----------------------------------------
    # 2. Check whether agent is allowed
    #    to use this tool
    # -----------------------------------------
    if allowed_tools is not None:

        allowed_tool_names = [
            tool["name"]
            for tool in allowed_tools
        ]

        if tool_name not in allowed_tool_names:
            return {
                "success": False,
                "error": (
                    f"Tool '{tool_name}' is not "
                    "assigned to this agent"
                )
            }

    # -----------------------------------------
    # 3. Get actual Python function
    # -----------------------------------------
    tool_function = AVAILABLE_TOOLS[tool_name]

    # -----------------------------------------
    # 4. Validate arguments
    # -----------------------------------------
    if not isinstance(arguments, dict):
        return {
            "success": False,
            "error": "Tool arguments must be an object"
        }

    # -----------------------------------------
    # 5. Execute tool safely
    # -----------------------------------------
    try:

        result = tool_function(**arguments)

        return {
            "success": True,
            "result": result
        }

    except TypeError as e:

        return {
            "success": False,
            "error": f"Invalid tool arguments: {str(e)}"
        }

    except Exception as e:

        return {
            "success": False,
            "error": f"Tool execution failed: {str(e)}"
        }


def execute_sandbox_command(
    command: str,
    timeout: int | None = None,
):
    """
    Execute an untrusted shell command through the
    RAVEN guardrail + Docker sandbox pipeline.
    """

    from app.sandbox.sandbox_service import SandboxService

    sandbox = SandboxService()

    result = sandbox.run(
        command=command,
        timeout=timeout,
    )

    return result
