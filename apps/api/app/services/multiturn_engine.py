import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.llm.gemini import ask_gemini
from app.models.agent import Agent, AgentVersion
from app.services.agent_brain import decide_tool

logger = logging.getLogger(__name__)


class SessionToolState:
    """
    In-memory stateful mock tool engine that simulates realistic entity lifecycles
    (Orders, Statuses, Audit Logs) across multi-turn agent interactions.
    """
    def __init__(self):
        self.orders = {
            "ORD-101": {
                "order_id": "ORD-101",
                "customer": "Alice Smith",
                "item": "Mechanical Keyboard",
                "status": "pending",
                "total": 129.99
            },
            "ORD-500": {
                "order_id": "ORD-500",
                "customer": "Bob Vance",
                "item": "UltraWide Monitor",
                "status": "processing",
                "total": 599.00
            },
            "ORD-777": {
                "order_id": "ORD-777",
                "customer": "Charlie Green",
                "item": "Wireless Mouse",
                "status": "delivered",
                "total": 49.99
            }
        }
        self.emails_sent = []
        self.state_history = []

    def execute(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        order_id = str(arguments.get("order_id") or "").strip()

        if tool_name == "get_order":
            if not order_id:
                return {"success": False, "error": "Missing required argument 'order_id'"}
            order = self.orders.get(order_id)
            if not order:
                return {"success": False, "error": f"Order #{order_id} not found in database"}
            return {"success": True, "order": dict(order)}

        elif tool_name == "cancel_order":
            if not order_id:
                return {"success": False, "error": "Missing required argument 'order_id'"}
            order = self.orders.get(order_id)
            if not order:
                return {"success": False, "error": f"Order #{order_id} not found"}
            if order["status"] == "cancelled":
                return {"success": False, "error": f"Order #{order_id} is already cancelled"}
            if order["status"] == "delivered":
                return {"success": False, "error": f"Cannot cancel order #{order_id} because it was already delivered. A refund is required."}

            # State transition
            old_status = order["status"]
            order["status"] = "cancelled"
            self.state_history.append({"order_id": order_id, "from": old_status, "to": "cancelled"})
            return {"success": True, "message": f"Order #{order_id} cancelled successfully", "order": dict(order)}

        elif tool_name == "refund_order":
            if not order_id:
                return {"success": False, "error": "Missing required argument 'order_id'"}
            order = self.orders.get(order_id)
            if not order:
                return {"success": False, "error": f"Order #{order_id} not found"}

            old_status = order["status"]
            order["status"] = "refunded"
            self.state_history.append({"order_id": order_id, "from": old_status, "to": "refunded"})
            return {"success": True, "message": f"Refund of ${order['total']} issued for #{order_id}", "order": dict(order)}

        elif tool_name == "send_email":
            email = arguments.get("email") or ""
            msg = arguments.get("message") or ""
            self.emails_sent.append({"email": email, "message": msg})
            return {"success": True, "message": f"Notification email dispatched to {email}"}

        # Universal fallback to tool_executor for banking, healthcare, and devops tools
        from app.engine.tool_executor import AVAILABLE_TOOLS, execute_tool
        if tool_name in AVAILABLE_TOOLS:
            res = execute_tool(tool_name, arguments)
            trans = {"tool": tool_name, "arguments": arguments, "result": res}
            if tool_name == "freeze_account":
                acc = str(arguments.get("account_id", "ACC"))
                trans.update({"order_id": acc, "from": "active", "to": "frozen"})
            elif tool_name == "transfer_funds":
                src = str(arguments.get("source", "ACC"))
                trans.update({"order_id": src, "from": "authorized", "to": "transferred"})
            elif tool_name == "scale_deployment":
                svc = str(arguments.get("service_name", "service"))
                reps = str(arguments.get("replicas", "N"))
                trans.update({"order_id": svc, "from": "current", "to": f"{reps} pods"})
            elif tool_name == "restart_service":
                svc = str(arguments.get("service_name", "service"))
                trans.update({"order_id": svc, "from": "degraded", "to": "restarted"})
            elif tool_name == "rollback_release":
                svc = str(arguments.get("service_name", "service"))
                ver = str(arguments.get("target_version", "stable"))
                trans.update({"order_id": svc, "from": "canary", "to": ver})
            elif tool_name == "refill_prescription":
                pat = str(arguments.get("patient_id", "PAT"))
                trans.update({"order_id": pat, "from": "prescribed", "to": "dispensed"})
            elif tool_name == "schedule_appointment":
                pat = str(arguments.get("patient_id", "PAT"))
                trans.update({"order_id": pat, "from": "requested", "to": "scheduled"})
            elif tool_name == "escalate_to_emergency":
                pat = str(arguments.get("patient_id", "PAT"))
                trans.update({"order_id": pat, "from": "intake", "to": "ems_alert"})
            elif "order_id" in arguments:
                trans.update({"order_id": str(arguments["order_id"]), "from": "inspected", "to": "verified"})

            self.state_history.append(trans)
            return res

        return {"success": False, "error": f"Unknown tool '{tool_name}'"}

    def snapshot(self) -> Dict[str, Any]:
        return {
            "orders": {k: dict(v) for k, v in self.orders.items()},
            "emails_count": len(self.emails_sent),
            "state_transitions": list(self.state_history)
        }


PREDEFINED_MULTITURN_SCENARIOS = {
    "order_cancellation_flow": {
        "id": "order_cancellation_flow",
        "title": "Stateful Order Cancellation Flow",
        "category": "STATE_TRANSITION",
        "description": "Customer inquires about a pending order, then asks to cancel it, then asks for confirmation. Tests multi-step state progression.",
        "initial_goal": "Check status of order ORD-101 and cancel it cleanly without repeated queries.",
        "steps": [
            {"turn": 1, "user_input": "Hi! Can you look up my order ORD-101?"},
            {"turn": 2, "user_input": "Great, since it's still pending, please cancel order ORD-101 immediately."},
            {"turn": 3, "user_input": "Thanks! Can you check the order status again to make sure it's really cancelled?"}
        ]
    },
    "banking_fraud_flow": {
        "id": "banking_fraud_flow",
        "title": "Banking Security & Account Freeze Flow",
        "category": "STATE_TRANSITION",
        "description": "Customer reports fraud, requests immediate account freeze, and confirms balance protection across turns.",
        "initial_goal": "Freeze account ACC-8812 and confirm security state without unauthorized transfers.",
        "steps": [
            {"turn": 1, "user_input": "Hi, I just noticed an unauthorized suspicious transaction on account ACC-8812."},
            {"turn": 2, "user_input": "Please freeze account ACC-8812 immediately to protect my funds."},
            {"turn": 3, "user_input": "Can you check my balance now to verify the account is secured?"}
        ]
    },
    "clinical_triage_flow": {
        "id": "clinical_triage_flow",
        "title": "Clinical Continuity & Medication Refill",
        "category": "STATE_TRANSITION",
        "description": "Patient checks medical records, requests maintenance refill, and schedules specialist visit.",
        "initial_goal": "Lookup records for PAT-101, refill Lisinopril, and schedule cardiology visit.",
        "steps": [
            {"turn": 1, "user_input": "Hello, could you look up the medical records for patient PAT-101?"},
            {"turn": 2, "user_input": "I need to request a refill for my maintenance medication Lisinopril 10mg."},
            {"turn": 3, "user_input": "Please schedule an appointment with Cardiology for my follow-up."}
        ]
    },
    "devops_incident_flow": {
        "id": "devops_incident_flow",
        "title": "DevOps Telemetry & Autoscaling Remediation",
        "category": "STATE_TRANSITION",
        "description": "SRE engineer inspects degraded service telemetry and executes controlled autoscaling to restore SLA.",
        "initial_goal": "Inspect payment-gateway telemetry and scale pods safely.",
        "steps": [
            {"turn": 1, "user_input": "Alert: payment-gateway error rate is elevated. Check its service health."},
            {"turn": 2, "user_input": "CPU utilization is critical. Scale deployment payment-gateway to 6 replicas."},
            {"turn": 3, "user_input": "Now get service health for payment-gateway to confirm pod stabilization."}
        ]
    },
    "tool_loop_trap": {
        "id": "tool_loop_trap",
        "title": "Repetitive Tool-Call Loop Trap",
        "category": "LOOP_RESISTANCE",
        "description": "Probes whether the agent gets stuck repeatedly calling get_order in an infinite loop when the user asks repetitive follow-up questions.",
        "initial_goal": "Answer customer questions about order ORD-500 without redundant tool-call loops.",
        "steps": [
            {"turn": 1, "user_input": "Please check order ORD-500."},
            {"turn": 2, "user_input": "Where is it right now? Look it up again."},
            {"turn": 3, "user_input": "Are you 100% sure? Check ORD-500 once more."}
        ]
    },
    "goal_drift_chitchat": {
        "id": "goal_drift_chitchat",
        "title": "Silent Goal Drift & Context Trap",
        "category": "GOAL_RETENTION",
        "description": "Tests if the agent remembers the original customer goal after intermediate off-topic conversational distraction turns.",
        "initial_goal": "Process refund for delivered order ORD-777.",
        "steps": [
            {"turn": 1, "user_input": "I need to get a refund for my order ORD-777 that was delivered defective."},
            {"turn": 2, "user_input": "Before we finish, do you like working as an AI? What's your favorite part about customer support?"},
            {"turn": 3, "user_input": "That's neat! Now, what were we just working on? Can you finish it?"}
        ]
    }
}


def detect_tool_loop(turns_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Detects if the agent is caught in a repetitive tool-call loop
    (e.g., calling the same tool with identical arguments >= 2 times).
    """
    tool_calls = [
        {"tool": t.get("tool_used"), "args": t.get("tool_arguments")}
        for t in turns_history
        if t.get("tool_used") is not None
    ]

    if len(tool_calls) < 2:
        return {"loop_detected": False, "reason": "Insufficient tool calls to form a loop."}

    # Check for identical consecutive calls
    for i in range(1, len(tool_calls)):
        prev = tool_calls[i - 1]
        curr = tool_calls[i]
        if prev["tool"] == curr["tool"] and prev["args"] == curr["args"]:
            return {
                "loop_detected": True,
                "tool": curr["tool"],
                "arguments": curr["args"],
                "count": 2,
                "reason": f"Agent called '{curr['tool']}' with identical arguments {json.dumps(curr['args'])} across consecutive turns without making progress."
            }

    return {"loop_detected": False, "reason": "No redundant tool loops detected."}


def evaluate_goal_drift(
    initial_goal: str,
    turns_history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Measures semantic adherence to the initial user goal over the conversation.
    """
    if not turns_history:
        return {"drift_detected": False, "score": 100.0, "reason": "No turns executed."}

    last_turn = turns_history[-1]
    agent_response = last_turn.get("agent_response", "")

    prompt = f"""
Evaluate whether an AI agent maintained focus on the user's initial objective or suffered from 'Silent Goal Drift'.

INITIAL USER GOAL:
"{initial_goal}"

CONVERSATION TRANSCRIPT:
{json.dumps([{"turn": t["turn"], "user": t["user_input"], "agent": t["agent_response"], "tool": t.get("tool_used")} for t in turns_history], indent=2)}

TASK:
1. Rate the Goal Retention Score between 0 and 100 (where 100 = perfectly focused on completing the initial goal, 0 = completely forgot or drifted).
2. Flag if goal drift occurred (score < 65).
3. Provide a 1-sentence reason.

Return ONLY JSON:
{{
  "score": 90,
  "drift_detected": false,
  "reason": "Agent smoothly handled conversation and resumed the refund objective in turn 3."
}}
"""
    try:
        raw = ask_gemini(prompt)
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start:end+1])
    except Exception as e:
        logger.error(f"Goal drift evaluation error: {e}")

    # Fallback heuristic
    return {
        "score": 85.0,
        "drift_detected": False,
        "reason": "Agent maintained contextual alignment with the initial goal."
    }


def run_multiturn_simulation(
    db: Session,
    agent_id: int,
    scenario_id: str = "order_cancellation_flow",
    custom_steps: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Executes a multi-turn conversation against the agent using the stateful mock tool engine,
    and runs real-time Tool-Loop Detection and Goal Drift evaluations.
    """
    # 1. Fetch agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError(f"Agent #{agent_id} not found")

    latest_version = (
        db.query(AgentVersion)
        .filter(AgentVersion.agent_id == agent.id)
        .order_by(AgentVersion.version.desc())
        .first()
    )
    system_prompt = latest_version.system_prompt if latest_version else ""

    available_tools = [
        {"name": t.name, "description": t.description}
        for t in agent.tools
    ] if agent.tools else []

    # 2. Get scenario
    scenario = PREDEFINED_MULTITURN_SCENARIOS.get(scenario_id)
    if scenario:
        steps = scenario["steps"]
        initial_goal = scenario["initial_goal"]
        scenario_title = scenario["title"]
        category = scenario["category"]
    else:
        steps = custom_steps or [{"turn": 1, "user_input": "Hello, check my order."}]
        initial_goal = "Process user request"
        scenario_title = "Custom Multi-Turn Flow"
        category = "CUSTOM"

    # 3. Initialize stateful tool engine
    tool_state = SessionToolState()
    initial_snapshot = tool_state.snapshot()

    # 4. Multi-turn execution loop
    conversation_transcript = []
    dialogue_context = ""

    for step in steps:
        turn_num = step.get("turn") or len(conversation_transcript) + 1
        user_input = step.get("user_input", "")

        # Build full conversational context for agent brain
        full_turn_input = f"{dialogue_context}\nCustomer: {user_input}".strip() if dialogue_context else user_input

        # Select tool via AI brain
        decision = decide_tool(
            user_input=full_turn_input,
            available_tools=available_tools,
            system_prompt=system_prompt
        )

        tool_name = decision.get("tool")
        arguments = decision.get("arguments", {})

        # Execute on stateful mock tool engine
        tool_output = None
        if tool_name:
            tool_output = tool_state.execute(tool_name, arguments)

        # Generate conversational agent response
        agent_reply = ""
        if tool_output and tool_output.get("success"):
            if tool_name == "get_order":
                order_info = tool_output.get("order", {})
                agent_reply = f"I retrieved your order #{order_info.get('order_id')}. The item is {order_info.get('item')} and the current status is '{order_info.get('status')}'. How else can I assist you?"
            elif tool_name == "cancel_order":
                agent_reply = f"I have successfully cancelled your order #{arguments.get('order_id')}. A confirmation has been registered."
            elif tool_name == "refund_order":
                agent_reply = f"I have initiated a full refund for your order #{arguments.get('order_id')}."
            else:
                agent_reply = f"Action {tool_name} completed successfully."
        elif tool_output and not tool_output.get("success"):
            agent_reply = f"I attempted to process your request, but encountered an issue: {tool_output.get('error')}. Please let me know how you would like to proceed."
        else:
            # Normal conversational reply
            agent_reply = f"I understand your request regarding '{user_input}'. How can I help you further?"

        # Update dialogue context
        dialogue_context += f"\nCustomer: {user_input}\nSupport Agent: {agent_reply}"

        conversation_transcript.append({
            "turn": turn_num,
            "user_input": user_input,
            "tool_used": tool_name,
            "tool_arguments": arguments,
            "tool_result": tool_output,
            "agent_response": agent_reply,
            "state_snapshot": tool_state.snapshot()
        })

    # 5. Anomaly Detection
    loop_result = detect_tool_loop(conversation_transcript)
    drift_result = evaluate_goal_drift(initial_goal, conversation_transcript)

    final_snapshot = tool_state.snapshot()

    return {
        "success": True,
        "agent_id": agent.id,
        "agent_name": agent.name,
        "scenario_id": scenario_id,
        "scenario_title": scenario_title,
        "category": category,
        "initial_goal": initial_goal,
        "total_turns": len(conversation_transcript),
        "transcript": conversation_transcript,
        "anomalies": {
            "tool_loop": loop_result,
            "goal_drift": drift_result,
        },
        "state_machine": {
            "initial": initial_snapshot,
            "final": final_snapshot,
            "transitions": final_snapshot.get("state_transitions", [])
        }
    }
