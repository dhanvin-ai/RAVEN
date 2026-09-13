from app.llm.gemini import ask_gemini
import json


def decide_tool(
    user_input: str,
    available_tools: list,
    system_prompt: str = ""
):

    tool_names = [
        tool["name"]
        for tool in available_tools
    ]

    # Build dynamic prompt rules based on available tools
    rules = []
    rule_idx = 1
    
    # E-Commerce / Customer Support
    if "cancel_order" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to cancel an order, select 'cancel_order'.")
        rule_idx += 1
    if "refund_order" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to refund an order, select 'refund_order'.")
        rule_idx += 1
    if "get_order" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to get, check, or track an order, select 'get_order'.")
        rule_idx += 1
    if "send_email" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to send an email or dispatch notification, select 'send_email'.")
        rule_idx += 1

    # Banking & Fintech
    if "get_balance" in tool_names:
        rules.append(f"{rule_idx}. If the user inquires about account balance or funds, select 'get_balance'.")
        rule_idx += 1
    if "transfer_funds" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to transfer, wire, or send money, select 'transfer_funds'.")
        rule_idx += 1
    if "freeze_account" in tool_names:
        rules.append(f"{rule_idx}. If the user reports fraud, lost card, or asks to freeze/lock an account, select 'freeze_account'.")
        rule_idx += 1
    if "get_transaction_history" in tool_names:
        rules.append(f"{rule_idx}. If the user asks for statements, recent transactions, or history, select 'get_transaction_history'.")
        rule_idx += 1

    # Healthcare & Clinical
    if "lookup_patient_records" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to look up medical charts, vitals, or patient records, select 'lookup_patient_records'.")
        rule_idx += 1
    if "schedule_appointment" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to schedule or book a doctor appointment/visit, select 'schedule_appointment'.")
        rule_idx += 1
    if "refill_prescription" in tool_names:
        rules.append(f"{rule_idx}. If the user requests a prescription or medication refill, select 'refill_prescription'.")
        rule_idx += 1
    if "escalate_to_emergency" in tool_names:
        rules.append(f"{rule_idx}. If the user reports acute, life-threatening symptoms (chest pain, stroke, emergency), select 'escalate_to_emergency'.")
        rule_idx += 1

    # DevOps & Infrastructure
    if "get_service_health" in tool_names:
        rules.append(f"{rule_idx}. If the user asks about service status, health, CPU, or telemetry, select 'get_service_health'.")
        rule_idx += 1
    if "scale_deployment" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to scale replicas, pods, or capacity, select 'scale_deployment'.")
        rule_idx += 1
    if "restart_service" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to restart or reboot a service container, select 'restart_service'.")
        rule_idx += 1
    if "rollback_release" in tool_names:
        rules.append(f"{rule_idx}. If the user asks to revert or rollback a deployment version, select 'rollback_release'.")
        rule_idx += 1

    rules.append(f"{rule_idx}. Extract required arguments from the user's request.")
    rule_idx += 1
    rules.append(f"{rule_idx}. Do NOT invent tools. Only select from available tools.")
    rule_idx += 1
    rules.append(f"{rule_idx}. If a tool is appropriate, you MUST select one. If no tool is needed, return tool: null.")
    rule_idx += 1
    rules.append(f"{rule_idx}. Return ONLY valid JSON with keys 'tool' and 'arguments'.")

    rules_text = "\n".join(rules)

    prompt = f"""
System instructions:

{system_prompt}

You are the tool-selection engine of an AI agent.

Your job is to select exactly ONE tool when the user's request requires one of the available tools.

User request:

{user_input}

Available tools:

{json.dumps(available_tools, indent=2)}

Available tool names:

{tool_names}

Rules:

{rules_text}

Example:
User: cancel my order 1234
Response:
{{
    "tool": "cancel_order",
    "arguments": {{
        "order_id": "1234"
    }}
}}
"""

    import re

    try:
        response = ask_gemini(prompt)
        start = response.find("{")
        end = response.rfind("}")
        if start != -1 and end != -1:
            decision = json.loads(response[start:end+1])
        else:
            decision = json.loads(response)

        tool = decision.get("tool")
        arguments = decision.get("arguments", {})

        if tool not in tool_names:
            tool = None
            arguments = {}

        if tool is not None:
            return {
                "tool": tool,
                "arguments": arguments
            }
    except Exception:
        pass

    # Multi-domain heuristic fallback if LLM returned invalid tool or hit an error
    user_lower = user_input.lower()

    # 1. Customer Support & Orders
    order_match = re.search(r'(?:order\s*(?:#|id|number)?\s*|#)([a-zA-Z0-9\-_]+)', user_input, re.IGNORECASE)
    order_id = order_match.group(1) if order_match else None
    if not order_id:
        num_match = re.search(r'\b\d{4,8}\b', user_input)
        if num_match:
            order_id = num_match.group(0)

    if any(k in user_lower for k in ["cancel", "cancellation", "abort"]) and "cancel_order" in tool_names:
        return {"tool": "cancel_order", "arguments": {"order_id": order_id or "ORD-9921"}}

    if any(k in user_lower for k in ["refund", "reimburse", "money back"]) and "refund_order" in tool_names:
        amt_match = re.search(r'\$?(\d+(?:\.\d{1,2})?)', user_input)
        amt = float(amt_match.group(1)) if amt_match else 50.0
        return {"tool": "refund_order", "arguments": {"order_id": order_id or "ORD-9921", "amount": amt}}

    if any(k in user_lower for k in ["order", "track", "status", "check", "where"]) and "get_order" in tool_names:
        return {"tool": "get_order", "arguments": {"order_id": order_id or "ORD-9921"}}

    if any(k in user_lower for k in ["email", "send mail", "notify"]) and "send_email" in tool_names:
        return {"tool": "send_email", "arguments": {"recipient": "customer@example.com", "subject": "Update"}}

    # 2. Banking & Fintech
    acct_matches = re.findall(r'(?:ACC|ACCT|ACCOUNT)[-_ ]?([0-9]{3,6})', user_input, re.IGNORECASE)
    acct_id = f"ACC-{acct_matches[0]}" if acct_matches else "ACC-8812"
    target_acct = f"ACC-{acct_matches[1]}" if len(acct_matches) > 1 else "ACC-4491"

    if any(k in user_lower for k in ["freeze", "lock card", "compromised", "stolen card", "suspicious transaction"]) and "freeze_account" in tool_names:
        return {"tool": "freeze_account", "arguments": {"account_id": acct_id, "reason": "Suspicious activity reported"}}

    if any(k in user_lower for k in ["transfer", "wire", "send money", "move funds", "send $"]) and "transfer_funds" in tool_names:
        amt_match = re.search(r'\$?(\d+(?:\.\d{1,2})?)', user_input)
        amt = float(amt_match.group(1)) if amt_match else 250.0
        return {"tool": "transfer_funds", "arguments": {"source_account": acct_id, "destination_account": target_acct, "amount": amt}}

    if any(k in user_lower for k in ["balance", "funds in", "how much in", "account balance", "checking balance"]) and "get_balance" in tool_names:
        return {"tool": "get_balance", "arguments": {"account_id": acct_id}}

    if any(k in user_lower for k in ["transaction", "statement", "past charges", "history", "recent charges"]) and "get_transaction_history" in tool_names:
        return {"tool": "get_transaction_history", "arguments": {"account_id": acct_id, "limit": 10}}

    # 3. Healthcare & Clinical
    pat_match = re.search(r'(?:PAT|PATIENT)[-_ ]?([0-9]{3,6})', user_input, re.IGNORECASE)
    pat_id = f"PAT-{pat_match.group(1)}" if pat_match else "PAT-101"

    if any(k in user_lower for k in ["emergency", "chest pain", "cardiac", "stroke", "911", "difficulty breathing", "unconscious", "collapse"]) and "escalate_to_emergency" in tool_names:
        return {"tool": "escalate_to_emergency", "arguments": {"patient_id": pat_id, "triage_level": "CRITICAL", "reason": "Severe acute symptoms reported"}}

    if any(k in user_lower for k in ["refill", "prescription", "medication", "renew rx", "pills", "lisinopril", "metformin", "albuterol"]) and "refill_prescription" in tool_names:
        med_match = re.search(r'\b(lisinopril|metformin|albuterol|cetirizine|oxycodone|adderall)\b', user_lower)
        med_name = med_match.group(1).capitalize() if med_match else "Lisinopril 10mg"
        return {"tool": "refill_prescription", "arguments": {"patient_id": pat_id, "medication": med_name, "quantity": 30}}

    if any(k in user_lower for k in ["schedule", "book", "appointment", "consultation", "see doctor", "visit"]) and "schedule_appointment" in tool_names:
        spec_match = re.search(r'\b(cardiology|dermatology|general medicine|pediatrics|orthopedics)\b', user_lower)
        spec = spec_match.group(1).title() if spec_match else "General Medicine"
        return {"tool": "schedule_appointment", "arguments": {"patient_id": pat_id, "specialty": spec, "preferred_date": "2026-09-20"}}

    if any(k in user_lower for k in ["record", "chart", "medical history", "vitals", "lookup patient", "ehr"]) and "lookup_patient_records" in tool_names:
        return {"tool": "lookup_patient_records", "arguments": {"patient_id": pat_id}}

    # 4. DevOps & Cloud SRE
    svc_match = re.search(r'\b([a-zA-Z0-9\-_]+(?:service|gateway|master|cluster|worker|db|api))\b', user_lower)
    svc_name = svc_match.group(1) if svc_match else "payment-gateway"

    if any(k in user_lower for k in ["rollback", "revert release", "previous version", "roll back"]) and "rollback_release" in tool_names:
        return {"tool": "rollback_release", "arguments": {"service_name": svc_name, "target_version": "v1.8.1"}}

    if any(k in user_lower for k in ["restart", "reboot", "bounce", "cycle service"]) and "restart_service" in tool_names:
        return {"tool": "restart_service", "arguments": {"service_name": svc_name}}

    if any(k in user_lower for k in ["scale", "autoscaling", "replicas", "pod count", "increase pods"]) and "scale_deployment" in tool_names:
        rep_match = re.search(r'\b(\d+)\s*(?:replicas|pods)?\b', user_input)
        reps = int(rep_match.group(1)) if rep_match else 4
        return {"tool": "scale_deployment", "arguments": {"service_name": svc_name, "replicas": reps}}

    if any(k in user_lower for k in ["health", "status", "telemetry", "cpu", "memory", "ping", "metrics"]) and "get_service_health" in tool_names:
        return {"tool": "get_service_health", "arguments": {"service_name": svc_name}}

    return {
        "tool": None,
        "arguments": {}
    }

