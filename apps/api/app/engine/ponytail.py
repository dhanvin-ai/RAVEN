"""
Ponytail Protocol Engine for RAVEN

Inspired by DietrichGebert/ponytail ("He says nothing. He writes one line. It works.")
Injects the Senior Developer Decision Ladder into autonomous AI agents to:
1. Eliminate over-engineering and bloated tool calls.
2. Prevent repetitive tool-call loops and speculative actions.
3. Reduce token consumption (-20% to -40%) and accelerate response latency.
4. Retain 100% of safety, HIPAA, AML/financial limits, and authorization guardrails.
"""

from typing import Any, Dict, List, Optional
import re


PONYTAIL_MODES = ["OFF", "LITE", "FULL", "ULTRA"]

PONYTAIL_LADDER_LITE = """
### PONYTAIL PROTOCOL [LITE]:
- Apply YAGNI (You Aren't Gonna Need It): If an inquiry can be answered directly using information already present in the prompt or dialogue history, DO NOT invoke unnecessary tools.
- Never cut validation, security policies, or error handling.
"""

PONYTAIL_LADDER_FULL = """
### PONYTAIL PROTOCOL [FULL — SENIOR DEV LADDER]:
Before deciding on any action or tool call, stop at the FIRST rung of the ladder that holds:
1. DOES THIS ACTION NEED TO EXIST? → No: skip it (YAGNI). Answer directly without calling tools.
2. ALREADY IN CONTEXT? → Reuse previous dialogue state; do NOT re-query or re-lookup identical identifiers.
3. CAN DIRECT RESPONSE HANDLE IT? → Prefer a direct text clarification over speculative tool executions.
4. ACTIVE LOOP OR REPETITION DETECTED? → Halt immediately. Never call the same tool with identical arguments repeatedly.
5. ONE DIRECT STEP? → Take the single most concise, targeted tool action.
6. ONLY THEN: Execute the absolute minimum tool necessary to fulfill the authorized request.
* STRICT BOUNDARY: Lazy about unnecessary tools, NEVER negligent about security boundaries, required policy authorizations, or safety constraints.
"""

PONYTAIL_LADDER_ULTRA = """
### PONYTAIL PROTOCOL [ULTRA — ZERO-BLOAT GUARDIAN]:
Ultra-minimal action economy. Maximum token and step efficiency.
1. ZERO TOLERANCE FOR SPECULATIVE OR REDUNDANT TOOL CALLS.
2. If required authorization parameters or IDs are missing or ambiguous, ask one direct clarifying question instead of guessing or executing tools.
3. Strictly apply the 7-rung minimalist ladder:
   - Does it need to be called? (No → Skip)
   - Already in context? (Yes → Reuse)
   - Loop detected? (Yes → Halt)
   - One line / one step? (Yes → Execute minimum)
4. Eliminate conversational padding, verbose introductions, and unnecessary justifications.
5. Retain 100% of security rules, financial limits, and compliance guardrails.
"""


def get_ponytail_ladder(mode: str = "FULL") -> str:
    """Returns the decision ladder text for the requested Ponytail mode."""
    clean_mode = str(mode).strip().upper()
    if clean_mode == "LITE":
        return PONYTAIL_LADDER_LITE.strip()
    elif clean_mode == "ULTRA":
        return PONYTAIL_LADDER_ULTRA.strip()
    elif clean_mode == "FULL":
        return PONYTAIL_LADDER_FULL.strip()
    return ""


def inject_ponytail_ladder(system_prompt: str, mode: str = "FULL") -> str:
    """
    Augments the agent's system prompt with the Ponytail Decision Ladder.
    If mode is 'OFF' or empty, returns the original system prompt unaltered.
    """
    clean_mode = str(mode).strip().upper()
    if clean_mode == "OFF" or not clean_mode:
        return system_prompt

    ladder = get_ponytail_ladder(clean_mode)
    if not ladder:
        return system_prompt

    # Avoid duplicate injection
    if "PONYTAIL PROTOCOL" in system_prompt:
        return system_prompt

    return f"{system_prompt.strip()}\n\n{ladder}"


def detect_tool_bloat(
    tool_calls: List[Dict[str, Any]],
    user_input: str = "",
    expected_tool: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyzes an execution trace for tool bloat, loops, and over-engineering.
    Returns quantitative bloat indicators and estimated token savings.
    """
    total_calls = len(tool_calls)
    if total_calls == 0:
        return {
            "has_bloat": False,
            "loops_detected": 0,
            "redundant_calls": 0,
            "tokens_saved_estimate": 0,
            "bloat_score": 0.0,
            "recommendation": "Optimal tool economy."
        }

    # 1. Loop detection: identical tool called with identical arguments
    seen_calls = set()
    loops_detected = 0
    redundant_calls = 0

    for call in tool_calls:
        tool_name = call.get("tool") if isinstance(call, dict) else str(call)
        args_str = str(sorted(call.get("arguments", {}).items())) if isinstance(call, dict) else ""
        signature = f"{tool_name}:{args_str}"
        if signature in seen_calls:
            loops_detected += 1
            redundant_calls += 1
        else:
            seen_calls.add(signature)

    # 2. Speculative bloat: calling more than 2 tools for a single-turn request
    if total_calls > 2 and not loops_detected:
        redundant_calls += (total_calls - 1)

    has_bloat = (loops_detected > 0) or (redundant_calls > 0)
    tokens_saved_estimate = redundant_calls * 180 + loops_detected * 250
    bloat_score = min(100.0, round((redundant_calls / max(1, total_calls)) * 100, 1))

    recommendation = "Optimal tool economy."
    if loops_detected > 0:
        recommendation = "CRITICAL BLOAT: Tool loop detected. Enable Ponytail Mode (FULL/ULTRA) to enforce the halt-on-repeat ladder."
    elif redundant_calls > 0:
        recommendation = f"MODERATE BLOAT: {redundant_calls} redundant tool calls detected. Ponytail Mode can eliminate ~{tokens_saved_estimate} tokens."

    return {
        "has_bloat": has_bloat,
        "total_calls": total_calls,
        "loops_detected": loops_detected,
        "redundant_calls": redundant_calls,
        "tokens_saved_estimate": tokens_saved_estimate,
        "bloat_score": bloat_score,
        "recommendation": recommendation
    }
