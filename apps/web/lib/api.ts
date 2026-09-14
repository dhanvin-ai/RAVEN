export function getApiBaseUrl(): string {
  // If running in browser and NOT on localhost/127.0.0.1, always route to live cloud backend
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "https://api-ten-iota-10.vercel.app";
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

const API_BASE_URL = getApiBaseUrl();

// ============================================================
// TYPES
// ============================================================

export interface AgentTool {
  name: string;
  description: string;
}

export interface Agent {
  id: number;
  name: string;
  description: string;
  model: string;
  ponytail_mode?: "OFF" | "LITE" | "FULL" | "ULTRA" | string;
  tools: AgentTool[];
  latest_version?: {
    version: number;
    system_prompt: string;
  };
}

export interface AgentsResponse {
  success: boolean;
  agents: Agent[];
}

export interface AgentVersion {
  id: number;
  version: number;
  system_prompt: string;
  created_at?: string;
}

export interface AgentVersionsResponse {
  success?: boolean;
  versions: AgentVersion[];
}

export interface AgentToolsResponse {
  success?: boolean;
  tools: AgentTool[];
}

export interface Execution {
  id: number;
  user_input: string;
  tool_used: string | null;
  tool_arguments: Record<string, unknown>;
  result: {
    tool?: string | null;
    arguments?: Record<string, unknown>;
    result?: unknown;
    version?: number;
    message?: string;
  };
}

export interface ExecutionHistoryResponse {
  success: boolean;
  agent_id: number;
  executions: Execution[];
}

export interface Scenario {
  name: string;
  category: string;
  severity: string;
  user_input: string;
  expected_behavior: string;
  forbidden_actions: string;
}

export interface ScenarioSuite {
  id: number;
  name: string;
  description: string;
  agent_id: number;
  scenarios: Scenario[];
}

export interface ReliabilityReport {
  id: number;
  agent_id: number;
  total_scenarios: number;
  passed: number;
  failed: number;
  pass_rate: number;
  reliability_score: number;
  severity_breakdown: Record<string, number>;
  failure_classification_breakdown: Record<string, number>;
  status: string;
}

export interface RegressionSummary {
  success: boolean;
  agent_id: number;
  total_versions: number;
  total_regressions: number;
  total_improvements: number;
  total_unchanged: number;
  latest_version: number;
  latest_agent_version_id: number;
  latest_report_id: number;
  latest_reliability_score: number;
  latest_pass_rate: number;
  latest_status: string;
  overall_trend: string;
}

export interface ReliabilityComparison {
  success: boolean;
  baseline: {
    agent_id: number;
    report_id: number;
    reliability_score: number;
    pass_rate: number;
    passed: number;
    failed: number;
    total_scenarios: number;
    status: string;
  };
  current: {
    agent_id: number;
    report_id: number;
    reliability_score: number;
    pass_rate: number;
    passed: number;
    failed: number;
    total_scenarios: number;
    status: string;
  };
  comparison: {
    reliability_change: number;
    pass_rate_change: number;
    direction: string;
  };
}

export interface RegressionDetection {
  success: boolean;
  status?: string;
  message?: string;
  agent_id?: number;
  regression_detected?: boolean;
  direction?: string;
  baseline_version?: number;
  current_version?: number;
  baseline_score?: number;
  current_score?: number;
  score_change?: number;
  pass_rate_change?: number;
}

export interface RegressionDecision {
  success: boolean;
  agent_id: number;
  decision: string;
  direction: string;
  severity: string;
  regression_detected: boolean;
  ci_gate: {
    status: string;
    allowed: boolean;
  };
  reason: string;
  baseline_version_id?: number;
  current_version_id?: number;
  baseline_reliability_score?: number;
  current_reliability_score?: number;
  reliability_change?: number;
  pass_rate_change?: number;
  new_failure_count?: number;
  new_pass_count?: number;
  persistent_failure_count?: number;
  persistent_pass_count?: number;
}

export interface RegressionDecisionHistoryItem {
  decision_id: number;
  baseline_version_id: number;
  current_version_id: number;
  baseline_report_id: number;
  current_report_id: number;
  baseline_reliability_score: number;
  current_reliability_score: number;
  reliability_change: number;
  pass_rate_change: number;
  new_failure_count: number;
  new_pass_count: number;
  persistent_failure_count: number;
  persistent_pass_count: number;
  regression_detected: boolean;
  direction: string;
  severity: string;
  decision: string;
  ci_gate: {
    status: string;
    allowed: boolean;
  };
  reason: string;
}

export interface RegressionDecisionHistoryResponse {
  success: boolean;
  agent_id: number;
  total_decisions: number;
  history: RegressionDecisionHistoryItem[];
}

export interface FailureDifferences {
  success: boolean;
  agent_id: number;
  baseline_version_id: number;
  current_version_id: number;
  new_failures: string[];
  new_passes: string[];
  persistent_failures: string[];
  persistent_passes: string[];
  error?: string;
}

export interface VersionPerformance {
  agent_version_id: number;
  version: number;
  reliability_score: number;
  pass_rate: number;
  passed: number;
  failed: number;
  total_scenarios: number;
  status: string;
}

export interface AgentVersionCreateRequest {
  model: string;
  system_prompt: string;
}


// ============================================================
// GENERIC API REQUEST
// ============================================================

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },

      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `API request failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}


// ============================================================
// AGENTS
// ============================================================

export async function getAgents(): Promise<AgentsResponse> {
  return request<AgentsResponse>("/agents/");
}

export async function getAgent(
  agentId: number
): Promise<Agent> {
  return request<Agent>(
    `/agents/${agentId}`
  );
}

export async function updateAgent(
  agentId: number,
  data: {
    name?: string;
    description?: string;
    model?: string;
  }
): Promise<Agent> {
  return request<Agent>(
    `/agents/${agentId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function updateAgentPonytailMode(
  agentId: number,
  mode: "OFF" | "LITE" | "FULL" | "ULTRA" | string
): Promise<{ success: boolean; agent_id: number; ponytail_mode: string; message: string }> {
  return request<{ success: boolean; agent_id: number; ponytail_mode: string; message: string }>(
    `/agents/${agentId}/ponytail`,
    {
      method: "PATCH",
      body: JSON.stringify({ ponytail_mode: mode }),
    }
  );
}


// ============================================================
// AGENT VERSIONS
// ============================================================

export async function getAgentVersions(
  agentId: number
): Promise<AgentVersion[]> {
  const response = await request<
    AgentVersionsResponse | AgentVersion[]
  >(
    `/agents/${agentId}/versions`
  );

  return Array.isArray(response)
    ? response
    : response.versions || [];
}


// ============================================================
// AGENT TOOLS
// ============================================================

export async function getAgentTools(
  agentId: number
): Promise<AgentTool[]> {
  const response = await request<
    AgentToolsResponse | AgentTool[]
  >(
    `/agents/${agentId}/tools`
  );

  return Array.isArray(response)
    ? response
    : response.tools || [];
}


// ============================================================
// RUNTIME / EXECUTIONS
// ============================================================

export async function getExecutionHistory(
  agentId: number
): Promise<ExecutionHistoryResponse> {
  return request<ExecutionHistoryResponse>(
    `/runtime/${agentId}/history`
  );
}

// ============================================================
// AGENT RUNTIME
// ============================================================

export interface RuntimeExecutionResult {
  tool?: string | null;
  arguments?: Record<string, unknown>;
  result?: unknown;
  version?: number;
  agent_version_id?: number;
  message?: string;
}

export interface RuntimeRunResponse {
  success?: boolean;
  response?: {
    tool?: string | null;
    arguments?: Record<string, unknown>;
    result?: unknown;
    version?: number;
    agent_version_id?: number;
    message?: string;
  };
  user_input?: string;
  tool?: string | null;
  arguments?: Record<string, unknown>;
  result?: unknown;
  version?: number;
  agent_version_id?: number;
  message?: string;
}

export async function runAgent(
  agentId: number,
  userInput: string,
  agentVersionId?: number
): Promise<RuntimeRunResponse> {
  const params = new URLSearchParams();

  params.set("user_input", userInput);

  if (agentVersionId !== undefined) {
    params.set(
      "agent_version_id",
      String(agentVersionId)
    );
  }

  return request<RuntimeRunResponse>(
    `/runtime/${agentId}/run?${params.toString()}`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// SCENARIOS
// ============================================================

export async function getAgentScenarios(
  agentId: number
): Promise<ScenarioSuite[]> {
  return request<ScenarioSuite[]>(
    `/scenarios/agent/${agentId}`
  );
}

export async function getScenarioSuite(
  suiteId: number
): Promise<ScenarioSuite> {
  return request<ScenarioSuite>(
    `/scenarios/suite/${suiteId}`
  );
}


// ============================================================
// TEST SUITE EXECUTION
// ============================================================

export async function executeScenarioSuite(
  suiteId: number
) {
  return request(
    `/scenarios/suite/${suiteId}/execute`,
    {
      method: "POST",
    }
  );
}


// ============================================================
// RELIABILITY
// ============================================================

export async function getReliability(
  agentId: number
): Promise<ReliabilityReport> {
  return request<ReliabilityReport>(
    `/reliability/agent/${agentId}`
  );
}

export async function getLatestReliability(
  agentId: number
): Promise<ReliabilityReport> {
  return request<ReliabilityReport>(
    `/reliability/agent/${agentId}/latest`
  );
}

export async function getReliabilityHistory(
  agentId: number
): Promise<ReliabilityReport[]> {
  return request<ReliabilityReport[]>(
    `/reliability/agent/${agentId}/history`
  );
}

export async function getReliabilityVersions(
  agentId: number
): Promise<AgentVersion[]> {
  return request<AgentVersion[]>(
    `/reliability/agent/${agentId}/versions`
  );
}


// ============================================================
// REGRESSION
// ============================================================

export async function getRegressionSummary(
  agentId: number
): Promise<RegressionSummary> {
  return request<RegressionSummary>(
    `/reliability/agent/${agentId}/regression-summary`
  );
}

export async function getRegressionHistory(
  agentId: number
) {
  return request(
    `/reliability/agent/${agentId}/regression-history`
  );
}

export async function detectRegression(
  agentId: number
): Promise<RegressionDetection> {
  return request<RegressionDetection>(
    `/reliability/agent/${agentId}/regression`
  );
}

export async function compareReliabilityReports(
  baselineReportId: number,
  currentReportId: number
): Promise<ReliabilityComparison> {
  return request<ReliabilityComparison>(
    `/reliability/compare/${baselineReportId}/${currentReportId}`
  );
}

export async function getRegressionDecision(
  agentId: number
): Promise<RegressionDecision> {
  return request<RegressionDecision>(
    `/reliability/agent/${agentId}/regression-decision`
  );
}

export async function saveRegressionDecision(
  agentId: number
): Promise<RegressionDecision> {
  return request<RegressionDecision>(
    `/reliability/agent/${agentId}/regression-decision/save`,
    { method: "POST" }
  );
}

export async function getRegressionDecisionHistory(
  agentId: number
): Promise<RegressionDecisionHistoryResponse> {
  return request<RegressionDecisionHistoryResponse>(
    `/reliability/agent/${agentId}/regression-decision/history`
  );
}

export async function getFailureDifferences(
  agentId: number,
  baselineVersionId: number,
  currentVersionId: number
): Promise<FailureDifferences> {
  return request<FailureDifferences>(
    `/reliability/agent/${agentId}/failure-differences/${baselineVersionId}/${currentVersionId}`
  );
}


// ============================================================
// AGENT VERSION MANAGEMENT
// ============================================================

export async function createAgentVersion(
  agentId: number,
  data: AgentVersionCreateRequest
) {
  return request(
    `/agents/${agentId}/versions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteAgent(
  agentId: number
) {
  return request(
    `/agents/${agentId}`,
    { method: "DELETE" }
  );
}

export async function generateScenarios(
  agentId: number,
  count: number = 5
) {
  return request<{ success: boolean; agent_id: number; scenarios: unknown[] }>(
    `/scenarios/generate`,
    {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, count }),
    }
  );
}


// ============================================================
// RED-TEAMING & ADVERSARIAL STRESS TESTING
// ============================================================

export interface RedTeamStrategy {
  id: string;
  name: string;
  description: string;
  example: string;
}

export interface RedTeamTurn {
  turn: number;
  attacker_message: string;
  agent_response: string;
  tool_used: string | null;
  tool_arguments: Record<string, unknown>;
  status: "RESISTED" | "BREACHED";
  breached: boolean;
  rationale: string;
}

export interface ResistanceScorecard {
  overall_status: "SHIELD_INTACT" | "VULNERABLE" | "COMPROMISED";
  risk_level: "LOW" | "MEDIUM" | "CRITICAL";
  tolerance_score: number;
  total_turns: number;
  resisted_turns: number;
  breached_turns: number;
  vector_breakdown: {
    authority_resistance?: number;
    gaslighting_resistance?: number;
    injection_resistance?: number;
  };
  vulnerabilities: string[];
  recommendations: string[];
}

export interface RedTeamSimulationResult {
  success: boolean;
  agent_id: number;
  agent_name: string;
  strategy: string;
  strategy_info: {
    name?: string;
    description?: string;
    example?: string;
  };
  target_action: string;
  total_turns: number;
  transcript: RedTeamTurn[];
  scorecard: ResistanceScorecard;
}

export interface RedTeamSimulationRequest {
  agent_id: number;
  strategy: string;
  turns?: number;
  target_action?: string;
  agent_version_id?: number | null;
}

export async function getRedTeamStrategies(): Promise<{ success: boolean; strategies: RedTeamStrategy[] }> {
  return request<{ success: boolean; strategies: RedTeamStrategy[] }>("/redteam/strategies");
}

export async function runRedTeamSimulation(
  data: RedTeamSimulationRequest
): Promise<RedTeamSimulationResult> {
  return request<RedTeamSimulationResult>(
    "/redteam/simulate",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}


// ============================================================
// PROMPT DOCTOR (AUTO-REMEDIATION)
// ============================================================

export interface PromptDoctorDiagnosis {
  success: boolean;
  agent_id: number;
  agent_name: string;
  current_version: number;
  total_failures_analyzed: number;
  failures: Array<{
    scenario_name: string;
    category: string;
    user_input: string;
    expected_behavior: string;
    forbidden_actions?: string;
    actual_tool?: string | null;
    failure_reason?: string;
    classification?: string;
  }>;
  vulnerabilities: string[];
  defensive_clauses: string[];
  original_prompt: string;
  patched_prompt: string;
  diff_summary: string;
  ponytail_recommended?: boolean;
  ponytail_ladder?: string;
  ponytail_patched_prompt?: string;
}

export interface PromptDoctorApplyResponse {
  success: boolean;
  agent_id: number;
  agent_name: string;
  deployed_version: number;
  deployed_version_id: number;
  baseline_version: number;
  baseline_score: number;
  new_score: number;
  score_delta: number;
  baseline_pass_rate: number;
  new_pass_rate: number;
  pass_rate_delta: number;
  ci_gate_status: "APPROVED" | "REVIEW_REQUIRED";
  message: string;
  execution_summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export async function diagnosePromptFailures(
  agentId: number,
  testSuiteId?: number
): Promise<PromptDoctorDiagnosis> {
  return request<PromptDoctorDiagnosis>("/prompt-doctor/diagnose", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, test_suite_id: testSuiteId }),
  });
}

export async function applyPromptPatch(
  agentId: number,
  patchedPrompt: string,
  testSuiteId?: number,
  model?: string,
  ponytailMode?: string
): Promise<PromptDoctorApplyResponse> {
  return request<PromptDoctorApplyResponse>("/prompt-doctor/apply", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      patched_prompt: patchedPrompt,
      test_suite_id: testSuiteId,
      model: model,
      ponytail_mode: ponytailMode,
    }),
  });
}


// ============================================================
// MULTI-TURN & TOOL-LOOP DETECTION
// ============================================================

export interface MultiTurnStep {
  turn: number;
  user_input: string;
  tool_used: string | null;
  tool_arguments: Record<string, unknown>;
  tool_result: Record<string, unknown> | null;
  agent_response: string;
  state_snapshot: Record<string, unknown>;
}

export interface MultiTurnScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  initial_goal: string;
  steps: Array<{ turn: number; user_input: string }>;
}

export interface MultiTurnResult {
  success: boolean;
  agent_id: number;
  agent_name: string;
  scenario_id: string;
  scenario_title: string;
  category: string;
  initial_goal: string;
  total_turns: number;
  transcript: MultiTurnStep[];
  anomalies: {
    tool_loop: {
      loop_detected: boolean;
      tool?: string;
      arguments?: Record<string, unknown>;
      count?: number;
      reason: string;
    };
    goal_drift: {
      score: number;
      drift_detected: boolean;
      reason: string;
    };
  };
  state_machine: {
    initial: Record<string, unknown>;
    final: Record<string, unknown>;
    transitions: Array<{ order_id?: string; tool?: string; from?: string; to?: string; [key: string]: any }>;
  };
}

export async function getMultiTurnScenarios(): Promise<{ success: boolean; scenarios: MultiTurnScenario[] }> {
  return request<{ success: boolean; scenarios: MultiTurnScenario[] }>("/multiturn/scenarios");
}

export async function runMultiTurnTest(
  agentId: number,
  scenarioId: string = "order_cancellation_flow"
): Promise<MultiTurnResult> {
  return request<MultiTurnResult>("/multiturn/run", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, scenario_id: scenarioId }),
  });
}


// ============================================================
// TIME-TRAVEL TRACE DEBUGGER
// ============================================================

export interface TraceStep {
  index: number;
  type: "USER_PROMPT" | "SYSTEM_PROMPT" | "TOOL_DECISION" | "TOOL_EXECUTION" | "FINAL_OUTPUT";
  label: string;
  data: any;
  editable?: boolean;
  modified?: boolean;
}

export interface ExecutionTrace {
  success: boolean;
  execution_id: number;
  agent_id: number;
  agent_name: string;
  version?: number;
  agent_version_id?: number;
  steps: TraceStep[];
}

export interface TraceReplayResult {
  success: boolean;
  execution_id: number;
  agent_id: number;
  agent_name: string;
  fork_at_step: number;
  original_steps: TraceStep[];
  forked_steps: TraceStep[];
}

export async function getExecutionTrace(executionId: number): Promise<ExecutionTrace> {
  return request<ExecutionTrace>(`/trace/${executionId}`);
}

export async function replayExecution(
  executionId: number,
  forkAtStep: number,
  overrides: Record<string, any>
): Promise<TraceReplayResult> {
  return request<TraceReplayResult>(`/trace/${executionId}/replay`, {
    method: "POST",
    body: JSON.stringify({
      fork_at_step: forkAtStep,
      overrides,
    }),
  });
}


// ============================================================
// MULTI-MODEL BENCHMARKING
// ============================================================

export interface BenchmarkModel {
  id: string;
  name: string;
  provider: string;
  cost_per_1k: number;
}

export interface BenchmarkScenarioResult {
  scenario_name: string;
  passed: boolean;
  tool_used?: string | null;
  classification: string;
  used_forbidden: boolean;
  hallucinated: boolean;
  latency_ms: number;
}

export interface BenchmarkModelResult {
  rank?: number;
  model_id: string;
  model_name: string;
  provider: string;
  reliability_score: number;
  pass_rate: number;
  passed: number;
  failed: number;
  total_scenarios: number;
  hallucination_rate: number;
  hallucination_count: number;
  injection_vulnerability_count: number;
  avg_latency_ms: number;
  cost_per_1k: number;
  status: "BEST" | "RECOMMENDED" | "ACCEPTABLE" | "AVOID";
  scenario_results: BenchmarkScenarioResult[];
}

export interface BenchmarkLeaderboard {
  success: boolean;
  agent_id: number;
  agent_name: string;
  test_suite_id: number;
  total_scenarios: number;
  models_tested: number;
  leaderboard: BenchmarkModelResult[];
}

export async function getBenchmarkModels(): Promise<{ success: boolean; models: BenchmarkModel[] }> {
  return request<{ success: boolean; models: BenchmarkModel[] }>("/benchmark/models");
}

export async function runBenchmark(
  agentId: number,
  modelIds: string[],
  testSuiteId?: number
): Promise<BenchmarkLeaderboard> {
  return request<BenchmarkLeaderboard>("/benchmark/run", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      model_ids: modelIds,
      test_suite_id: testSuiteId,
    }),
  });
}

export interface PonytailScenarioDiff {
  scenario_id: number;
  scenario_name: string;
  category: string;
  user_input: string;
  vanilla_passed: boolean;
  vanilla_tool: string | null;
  vanilla_tokens: number;
  vanilla_latency_ms: number;
  ponytail_passed: boolean;
  ponytail_tool: string | null;
  ponytail_tokens: number;
  ponytail_latency_ms: number;
  tokens_saved: number;
  improvement: "FIXED_BY_PONYTAIL" | "IDENTICAL" | "REGRESSED";
}

export interface PonytailMetrics {
  reliability_score: number;
  pass_rate: number;
  passed: number;
  failed: number;
  avg_latency_ms: number;
  total_tokens: number;
  tool_loops: number;
  redundant_calls: number;
}

export interface PonytailComparisonResult {
  success: boolean;
  agent_id: number;
  agent_name: string;
  test_suite_id: number;
  test_suite_name: string;
  total_scenarios: number;
  vanilla_metrics: PonytailMetrics;
  ponytail_metrics: PonytailMetrics;
  comparison: {
    reliability_jump: string;
    score_delta: number;
    latency_speedup_percent: number;
    token_savings_percent: number;
    total_tokens_saved: number;
    tool_loops_eliminated: number;
    safety_retention_percent: number;
    cost_reduction_summary: string;
  };
  scenario_comparisons: PonytailScenarioDiff[];
}

export async function runPonytailBenchmark(
  agentId: number,
  testSuiteId?: number
): Promise<PonytailComparisonResult> {
  return request<PonytailComparisonResult>("/benchmark/ponytail-compare", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      test_suite_id: testSuiteId,
    }),
  });
}


// ============================================================
// CI/CD PIPELINE
// ============================================================

export interface CIRunResult {
  success: boolean;
  gate_status: "PASS" | "FAIL";
  gate_passed: boolean;
  agent_id: number;
  agent_name: string;
  reliability_score: number;
  pass_rate: number;
  passed: number;
  failed: number;
  total: number;
  score_change: number;
  score_change_str: string;
  new_failures: number;
  fixed_failures: number;
  regression_detected: boolean;
  fail_under: number;
  markdown_summary: string;
}

export async function runCIPipeline(
  agentId: number,
  failUnder: number = 80.0,
  suiteId?: number
): Promise<CIRunResult> {
  return request<CIRunResult>("/ci/run", {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      fail_under: failUnder,
      suite_id: suiteId,
    }),
  });
}