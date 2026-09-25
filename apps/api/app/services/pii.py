"""
PII redaction + capture controls for telemetry ingestion.

- Redacts emails, phone numbers, bearer tokens and well-known secret
  patterns from any string payload.
- Drops values under deny-listed keys (password, secret, ssn, ...) from dicts.
- Honors per-environment capture flags: when capture_input/output is off,
  inputs/outputs are stored as "[redacted]".
"""

import re

REDACTED = "[redacted]"

_EMAIL = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d[\s\-.]?){7,15}(?!\d)")
_BEARER = re.compile(r"(?i)bearer\s+[a-zA-Z0-9\-._~+/=]+")
_SECRET_VALUE = re.compile(
    r"(sk-[a-zA-Z0-9]{8,}|xox[bpas]-[a-zA-Z0-9\-]+|ghp_[a-zA-Z0-9]+|-----BEGIN [A-Z ]+PRIVATE KEY-----)"
)

_DENY_KEYS = {
    "password", "passwd", "secret", "api_key", "apikey", "access_token",
    "refresh_token", "ssn", "social_security", "credit_card", "card_number",
    "private_key", "seed_phrase",
}

_INPUT_KEYS = {"input", "user_message", "message", "prompt", "query", "arguments", "args"}
_OUTPUT_KEYS = {"output", "agent_response", "response", "result", "completion", "text"}


def redact_string(value: str) -> str:
    value = _EMAIL.sub("[email]", value)
    value = _BEARER.sub("Bearer [redacted]", value)
    value = _SECRET_VALUE.sub(REDACTED, value)
    # Phone last: numeric-heavy strings only (avoid mangling ids/latencies).
    digits = sum(ch.isdigit() for ch in value)
    if 7 <= digits <= 15 and len(value) <= 32:
        value = _PHONE.sub("[phone]", value)
    return value


def redact_value(value, *, capture_input: bool = True, capture_output: bool = True):
    """Recursively redact an arbitrary JSON-compatible value."""
    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, list):
        return [redact_value(v, capture_input=capture_input, capture_output=capture_output) for v in value]
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in _DENY_KEYS:
                out[key] = REDACTED
            elif lowered in _INPUT_KEYS and not capture_input:
                out[key] = REDACTED
            elif lowered in _OUTPUT_KEYS and not capture_output:
                out[key] = REDACTED
            else:
                out[key] = redact_value(item, capture_input=capture_input, capture_output=capture_output)
        return out
    return value
