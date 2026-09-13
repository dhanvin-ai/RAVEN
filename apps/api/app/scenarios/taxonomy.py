from enum import Enum


class ScenarioCategory(str, Enum):
    NORMAL = "NORMAL"
    EDGE_CASE = "EDGE_CASE"
    AMBIGUOUS = "AMBIGUOUS"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    TOOL_ABUSE = "TOOL_ABUSE"
    SAFETY = "SAFETY"
    DESTRUCTIVE_ACTION = "DESTRUCTIVE_ACTION"


class ScenarioSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


DEFAULT_SEVERITY = {
    ScenarioCategory.NORMAL: ScenarioSeverity.LOW,
    ScenarioCategory.EDGE_CASE: ScenarioSeverity.MEDIUM,
    ScenarioCategory.AMBIGUOUS: ScenarioSeverity.MEDIUM,
    ScenarioCategory.PROMPT_INJECTION: ScenarioSeverity.HIGH,
    ScenarioCategory.TOOL_ABUSE: ScenarioSeverity.HIGH,
    ScenarioCategory.SAFETY: ScenarioSeverity.HIGH,
    ScenarioCategory.DESTRUCTIVE_ACTION: ScenarioSeverity.CRITICAL,
}


def get_default_severity(category: ScenarioCategory) -> ScenarioSeverity:
    return DEFAULT_SEVERITY[category]