"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Clock3,
  Code2,
  Cpu,
  Database,
  Download,
  Eye,
  GitBranch,
  Layers,
  LayoutGrid,
  Maximize2,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyPromptPatch,
  diagnosePromptFailures,
  executeScenarioSuite,
  generateScenarios,
  getAgents,
  getAgentScenarios,
  getLatestReliability,
  type Agent,
  type PromptDoctorApplyResponse,
  type PromptDoctorDiagnosis,
  type ReliabilityReport,
  type Scenario,
  type ScenarioSuite,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

type ScenarioExecutionResult = {
  success: boolean;
  scenario_id: number;
  agent_id: number;
  agent_version_id: number;
  user_input: string;
  expected_behavior: string;
  forbidden_actions: string;
  actual_result: {
    tool?: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    version?: number;
    agent_version_id?: number;
  };
  actual_tool: string | null;
  forbidden_tools: string[];
  forbidden_tool_calls: string[];
  forbidden_call_detected: boolean;
  expected_behavior_passed: boolean;
  evaluation_reason: string;
  classification: string;
  failure_reason: string | null;
  status: string;
};

type SuiteExecutionResult = {
  success: boolean;
  test_suite_id: number;
  test_suite_name: string;
  agent_id: number;
  total_scenarios: number;
  passed: number;
  failed: number;
  pass_rate: number;
  reliability_report?: {
    id: number;
    reliability_score: number;
    status: string;
    severity_breakdown: Record<string, number>;
    failure_classification_breakdown: Record<string, number>;
  };
  results: ScenarioExecutionResult[];
};

export default function ScenariosPage() {
  const [suites, setSuites] = useState<ScenarioSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<ScenarioSuite | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(DEFAULT_AGENT_ID);
  const [reliability, setReliability] = useState<ReliabilityReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SuiteExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null);

  // Table active tab
  const [activeTab, setActiveTab] = useState<"scenarios" | "results">("scenarios");
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);

  // Prompt Doctor state
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [applyingPatch, setApplyingPatch] = useState(false);
  const [doctorDiagnosis, setDoctorDiagnosis] = useState<PromptDoctorDiagnosis | null>(null);
  const [doctorApplyResult, setDoctorApplyResult] = useState<PromptDoctorApplyResponse | null>(null);



  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadData(targetAgentId?: number) {
    const agentId = targetAgentId ?? selectedAgentId;
    try {
      setError(null);
      const [agentsRes, scenarioData, reliabilityData] = await Promise.all([
        getAgents().catch(() => ({ success: true, agents: [] })),
        getAgentScenarios(agentId).catch(() => []),
        getLatestReliability(agentId).catch(() => null),
      ]);

      const agentList = agentsRes.agents || [];
      setAgents(agentList);
      setSuites(scenarioData || []);
      setReliability(reliabilityData || null);

      if (scenarioData && scenarioData.length > 0) {
        setSelectedSuite((current) => {
          if (!current || current.agent_id !== agentId) return scenarioData[0];
          return scenarioData.find((suite) => suite.id === current.id) || scenarioData[0];
        });
      } else {
        setSelectedSuite(null);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load scenarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(selectedAgentId);
  }, []);

  async function handleSelectAgent(agentId: number) {
    setSelectedAgentId(agentId);
    setSelectedSuite(null);
    setResult(null);
    setLoading(true);
    await loadData(agentId);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadData(selectedAgentId);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleGenerate(count: number = 5) {
    try {
      setGenerating(true);
      setError(null);
      await generateScenarios(selectedAgentId, count);
      await loadData(selectedAgentId);
    } catch (err: any) {
      setError(err?.message || "Failed to generate scenarios with AI");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRunSuite() {
    if (!selectedSuite) return;
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const executionResult = await executeScenarioSuite(selectedSuite.id);
      setResult(executionResult as SuiteExecutionResult);
      setActiveTab("results");

      try {
        const updatedReliability = await getLatestReliability(selectedAgentId);
        setReliability(updatedReliability);
      } catch {
        // Keep execution result even if reliability refresh fails.
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to execute test suite.");
    } finally {
      setRunning(false);
    }
  }

  // Prompt Doctor handlers
  async function handleOpenPromptDoctor() {
    if (!selectedSuite) return;
    setDoctorModalOpen(true);
    setDiagnosing(true);
    setDoctorApplyResult(null);
    try {
      const diag = await diagnosePromptFailures(selectedAgentId, selectedSuite.id);
      setDoctorDiagnosis(diag);
    } catch (err: any) {
      setError(err?.message || "Prompt Doctor diagnosis failed");
    } finally {
      setDiagnosing(false);
    }
  }

  async function handleApplyPatch() {
    if (!doctorDiagnosis || !selectedSuite) return;
    setApplyingPatch(true);
    try {
      const res = await applyPromptPatch(
        selectedAgentId,
        doctorDiagnosis.patched_prompt,
        selectedSuite.id
      );
      setDoctorApplyResult(res);
      await loadData(selectedAgentId);
    } catch (err: any) {
      setError(err?.message || "Failed to deploy patched prompt version");
    } finally {
      setApplyingPatch(false);
    }
  }

  async function handleApplyPonytailPatch() {
    if (!doctorDiagnosis || !selectedSuite) return;
    setApplyingPatch(true);
    try {
      const promptToUse =
        doctorDiagnosis.ponytail_patched_prompt || doctorDiagnosis.patched_prompt;
      const res = await applyPromptPatch(
        selectedAgentId,
        promptToUse,
        selectedSuite.id,
        undefined,
        "FULL"
      );
      setDoctorApplyResult(res);
      await loadData(selectedAgentId);
    } catch (err: any) {
      setError(err?.message || "Failed to deploy Ponytail patched prompt version");
    } finally {
      setApplyingPatch(false);
    }
  }



  // ============================================================
  // DERIVED DATA
  // ============================================================

  const reliabilityScore = reliability?.reliability_score ?? 7.1;
  const passRate = reliability?.pass_rate ?? 20.0;
  const passed = reliability?.passed ?? 1;
  const failed = reliability?.failed ?? 4;
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const agentAccentColors = [
    { border: "bg-[#2563eb]", text: "text-[#2563eb]", dot: "bg-[#2563eb]", ring: "border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20" },
    { border: "bg-[#10b981]", text: "text-[#10b981]", dot: "bg-[#10b981]", ring: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20" },
    { border: "bg-[#f59e0b]", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]", ring: "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20" },
    { border: "bg-[#8b5cf6]", text: "text-[#8b5cf6]", dot: "bg-[#8b5cf6]", ring: "border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20" },
  ];
  const totalScenarios = selectedSuite?.scenarios?.length ?? reliability?.total_scenarios ?? 5;

  // Suite accent colors
  const suiteAccentColors = [
    { border: "bg-[#2563eb]", text: "text-[#2563eb]", dot: "bg-[#2563eb]", ring: "border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20" },
    { border: "bg-[#10b981]", text: "text-[#10b981]", dot: "bg-[#10b981]", ring: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20" },
    { border: "bg-[#f59e0b]", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]", ring: "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20" },
    { border: "bg-[#8b5cf6]", text: "text-[#8b5cf6]", dot: "bg-[#8b5cf6]", ring: "border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20" },
  ];

  if (loading) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/25 animate-pulse">
            <Layers size={24} />
          </div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading benchmark suites...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-5 md:p-7 lg:p-8 space-y-6">
      {/* =====================================================
          1. HEADER ROW (Scenarios Title + Action Controls)
      ===================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight">
              Scenarios
            </h1>
            <span className="rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2563eb] dark:text-blue-400 px-2.5 py-0.5 text-xs font-semibold">
              {suites.length} Suites
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Automated Benchmark Suites &amp; Reliability Scenarios · {totalScenarios} Active Scenarios
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Agent Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => handleSelectAgent(Number(e.target.value))}
              className="appearance-none rounded-xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3.5 py-2 pr-8 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-2xs outline-none hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  Agent #{a.id}: {a.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>


          {/* Prompt Doctor Action */}
          <button
            type="button"
            onClick={handleOpenPromptDoctor}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-3.5 py-2 text-xs font-semibold shadow-2xs hover:bg-amber-100 transition"
          >
            <Sparkles size={14} />
            <span>Prompt Doctor</span>
          </button>

          {/* AI Generator Action */}
          <button
            type="button"
            onClick={() => handleGenerate(5)}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151d2e] px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Zap size={14} className="text-[#2563eb]" />
            <span>{generating ? "Generating..." : "+ Generate (5)"}</span>
          </button>

          {/* Run Suite Primary Action */}
          <button
            type="button"
            onClick={handleRunSuite}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            {running ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span>{running ? "Running Suite..." : "Run Test Suite"}</span>
          </button>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* =====================================================
          2. TOP 4 METRIC CARDS STRIP (Matching Image 3)
      ===================================================== */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Suite Reliability */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Suite Reliability
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <Eye size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {reliabilityScore.toFixed(1)}%
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                ▲ +2.4%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Overall reliability benchmark score
            </p>
          </div>
        </div>

        {/* Card 2: Pass Rate */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Pass Rate
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {passRate.toFixed(1)}%
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                ▲ 8.4%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              {passed} of {totalScenarios} passed
            </p>
          </div>
        </div>

        {/* Card 3: Test Cases */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Test Cases
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {totalScenarios}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-semibold text-[#2563eb] dark:text-blue-400">
                Active Suite
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Automated behavioral checks
            </p>
          </div>
        </div>

        {/* Card 4: Violations / Flagged Failures */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Violations
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {failed}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                Flagged
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Forbidden actions &amp; errors
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          3. MAIN CONTENT (Suite Overview + Suite Selector Strip + Table)
      ===================================================== */}
      <div className="space-y-6">
          {/* Target Agent Selector Strip */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Target Enterprise Agent
              </span>
              <span className="text-xs text-gray-400 font-medium">
                {agents.length} Agents Configured
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {agents.map((item, idx) => {
                const isSelected = selectedAgentId === item.id;
                const colors = agentAccentColors[idx % agentAccentColors.length];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectAgent(item.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? colors.ring
                        : "border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          #{item.id}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-gray-400">{item.model}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 mt-1 truncate">
                      {item.name}
                    </div>
                    <div className={`h-1 w-full ${colors.border} rounded-full mt-2.5`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card A: Selected Suite Overview & Controls */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2563eb]">
                  <span className="rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    SUITE #{selectedSuite?.id || 1}
                  </span>
                  <span className="text-gray-400 font-mono text-[11px]">
                    Agent #{selectedSuite?.agent_id || selectedAgentId} · {selectedAgent?.name || "Agent"}
                  </span>
                  <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-1.5">
                  <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {selectedSuite?.name || `${selectedAgent?.name || "Agent"} Benchmark Suite`}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl">
                  {selectedSuite?.description || `High-frequency evaluation scenarios for ${selectedAgent?.name || "agent"}.`}
                </p>
              </div>

              {/* Run CTA Button */}
              <button
                type="button"
                onClick={handleRunSuite}
                disabled={running}
                className="flex items-center gap-2 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/25 transition shrink-0 disabled:opacity-50"
              >
                <Play size={14} fill="currentColor" />
                <span>{running ? "Running Suite..." : "Run Test Suite"}</span>
              </button>
            </div>

            {/* Horizontal Suite Selector Strip (Matches Image 3) */}
            <div className="mt-8 pt-5 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Benchmark Suites ({suites.length})
                  </span>
                </div>
                <button
                  type="button"
                  title="More options"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {suites.map((suite, idx) => {
                  const isSelected = selectedSuite?.id === suite.id;
                  const colors = suiteAccentColors[idx % suiteAccentColors.length];

                  return (
                    <button
                      key={suite.id}
                      type="button"
                      onClick={() => {
                        setSelectedSuite(suite);
                        setResult(null);
                      }}
                      className={`text-left p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? colors.ring
                          : "border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            #{suite.id}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-gray-400">
                          {suite.scenarios?.length || 5} Scenarios
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 mt-1 truncate">
                        {suite.name}
                      </div>
                      <div className={`h-1 w-full ${colors.border} rounded-full mt-2.5`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card B: Multi-Tab Table (Scenarios / Execution Results) */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 dark:border-gray-800 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {activeTab === "scenarios"
                    ? `Scenario Test Cases (${selectedSuite?.scenarios?.length || 0})`
                    : `Suite Execution Results (${result?.results?.length || 0})`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {activeTab === "scenarios"
                    ? "Behavioral requirements, expected tool invocations, and guardrails"
                    : "Real-time evaluation status and policy violation checks"}
                </p>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("scenarios")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    activeTab === "scenarios"
                      ? "bg-white dark:bg-[#151d2e] text-[#2563eb] shadow-2xs"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Scenarios ({selectedSuite?.scenarios?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("results")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    activeTab === "results"
                      ? "bg-white dark:bg-[#151d2e] text-[#2563eb] shadow-2xs"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Results {result ? `(${result.passed}/${result.total_scenarios})` : "(0)"}
                </button>
              </div>
            </div>

            {/* Tab 1: Scenarios List */}
            {activeTab === "scenarios" && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800/60 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-2">Severity</th>
                      <th className="py-3 px-3">Scenario Name</th>
                      <th className="py-3 px-3">Expected Behavior</th>
                      <th className="py-3 px-3">Forbidden Actions</th>
                      <th className="py-3 px-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
                    {(!selectedSuite?.scenarios || selectedSuite.scenarios.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                          No scenarios in this suite. Click "+ Generate" to create test cases.
                        </td>
                      </tr>
                    ) : (
                      selectedSuite.scenarios.map((scenario, index) => {
                        const isExpanded = expandedScenario === index;
                        const isHigh = scenario.severity === "HIGH";

                        return (
                          <tr
                            key={index}
                            onClick={() => setExpandedScenario(isExpanded ? null : index)}
                            className="group hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition cursor-pointer"
                          >
                            <td className="py-3.5 px-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  isHigh
                                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                                }`}
                              >
                                {scenario.severity || "MEDIUM"}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-2">
                                <ShieldAlert size={14} className={isHigh ? "text-rose-500" : "text-amber-500"} />
                                <span className="truncate max-w-[160px] sm:max-w-xs">{scenario.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {scenario.expected_behavior}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-mono text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md">
                                {scenario.forbidden_actions || "None specified"}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                {isExpanded ? "Hide" : "Inspect"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Execution Results */}
            {activeTab === "results" && (
              <div className="space-y-3 mt-3">
                {!result ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No active suite execution results yet. Click &quot;Run Test Suite&quot; above.
                  </div>
                ) : (
                  result.results.map((res, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl border p-4 transition-all ${
                        res.success
                          ? "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                          : "border-rose-200/80 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              res.success ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                            }`}
                          >
                            {res.success ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                          </div>
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">
                            {res.user_input}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            res.success
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>
                      <div className="mt-2.5 text-[11px] text-gray-600 dark:text-gray-300 font-mono bg-white dark:bg-[#121926] p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                        {res.evaluation_reason}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
{/* =====================================================
          4. PROMPT DOCTOR MODAL (Interactive Failure Diagnosis)
      ===================================================== */}
      {doctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Prompt Doctor: Diagnostic &amp; Auto-Patching
                </h3>
              </div>
              <button
                onClick={() => setDoctorModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {diagnosing ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-[#2563eb]" />
                <p className="text-xs text-gray-400">Analyzing failure traces and synthesizing prompt patches...</p>
              </div>
            ) : doctorDiagnosis ? (
              <div className="space-y-4 text-xs">
                {/* Root cause analysis */}
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
                  <div className="font-semibold text-amber-900 dark:text-amber-300">
                    Failure Analysis &amp; Root Cause
                  </div>
                  <p className="mt-1 text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed">
                    {doctorDiagnosis.diff_summary || doctorDiagnosis.vulnerabilities?.join(", ") || "Forbidden tool calls detected during multi-turn order validation."}
                  </p>
                </div>

                {/* Patched Prompt Preview */}
                <div>
                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Synthesized Prompt Guardrail
                  </div>
                  <pre className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-[11px] font-mono text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {doctorDiagnosis.patched_prompt}
                  </pre>
                </div>

                {/* Apply Patch Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setDoctorModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPatch}
                    disabled={applyingPatch}
                    className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-[#2563eb] dark:text-blue-400 px-4 py-2 text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-50"
                  >
                    {applyingPatch ? "Deploying..." : "Apply Prompt Patch"}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPonytailPatch}
                    disabled={applyingPatch}
                    className="rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-4 py-2 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {applyingPatch ? "Deploying..." : "Apply with Ponytail Defense"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                No active diagnosis. Click &quot;Diagnose&quot; to inspect failure traces.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
