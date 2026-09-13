"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Layers,
  Play,
  RefreshCw,
  Repeat,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAgents,
  getMultiTurnScenarios,
  runMultiTurnTest,
  type Agent,
  type MultiTurnResult,
  type MultiTurnScenario,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function MultiTurnPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(DEFAULT_AGENT_ID);
  const [scenarios, setScenarios] = useState<MultiTurnScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("order_cancellation_flow");

  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MultiTurnResult | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const [agentsRes, scenariosRes] = await Promise.all([
          getAgents(),
          getMultiTurnScenarios(),
        ]);
        setAgents(agentsRes.agents || []);
        setScenarios(scenariosRes.scenarios || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load multi-turn benchmarks.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleRunTest() {
    try {
      setRunning(true);
      setError(null);
      const res = await runMultiTurnTest(selectedAgentId, selectedScenarioId);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to execute multi-turn benchmark.");
    } finally {
      setRunning(false);
    }
  }

  const getRecommendedScenario = (agentId: number): string => {
    if (agentId === 5) return "banking_fraud_flow";
    if (agentId === 6) return "clinical_triage_flow";
    if (agentId === 7) return "devops_incident_flow";
    return "order_cancellation_flow";
  };

  const handleAgentChange = (newAgentId: number) => {
    setSelectedAgentId(newAgentId);
    setSelectedScenarioId(getRecommendedScenario(newAgentId));
    setResult(null);
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId);

  // Derived metric values
  const loopDetected = result?.anomalies?.tool_loop?.loop_detected ?? false;
  const goalDriftScore = result?.anomalies?.goal_drift?.score ?? 94;
  const totalTransitions = result?.state_machine?.transitions?.length ?? 0;

  if (loading) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-lg shadow-blue-500/25 animate-pulse">
            <Repeat size={24} />
          </div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading multi-turn benchmarks...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-5 md:p-7 lg:p-8 space-y-6">
      {/* =====================================================
          1. HEADER ROW (Title + Action Controls)
      ===================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight">
              Multi-Turn &amp; Loops
            </h1>
            <span className="rounded-full bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 px-2.5 py-0.5 text-xs font-semibold">
              Loop &amp; Drift Analyzer
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Test stateful conversational trajectories, detect infinite tool loops, and monitor semantic drift.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Agent Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => handleAgentChange(Number(e.target.value))}
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

          {/* Run Multi-Turn Flow CTA Button */}
          <button
            type="button"
            onClick={handleRunTest}
            disabled={running || loading}
            className="flex items-center gap-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            {running ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            <span>{running ? "Evaluating Dialogue Flow..." : "Run Multi-Turn Flow"}</span>
          </button>
        </div>
      </div>

      {/* Error alert banner if any */}
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
          2. TOP 4 METRIC CARDS STRIP
      ===================================================== */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tool-Call Loop Status */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Tool Loop Status
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                loopDetected
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
              }`}
            >
              {loopDetected ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xl lg:text-[22px] font-bold tracking-tight text-gray-900 dark:text-white">
                {loopDetected ? "LOOP DETECTED" : "NO LOOPS"}
              </span>
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  loopDetected
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                }`}
              >
                {loopDetected ? "Alert" : "Resilient"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Tool cycle recursion monitor
            </p>
          </div>
        </div>

        {/* Card 2: Goal Retention */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Goal Retention
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <Target size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {goalDriftScore}%
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                {goalDriftScore >= 80 ? "Optimal" : "Drift Alert"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Semantic alignment score
            </p>
          </div>
        </div>

        {/* Card 3: Active Scenarios */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Active Scenarios
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {scenarios.length}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-semibold text-[#2563eb] dark:text-blue-400">
                Multi-Turn
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Dialogue evaluation trees
            </p>
          </div>
        </div>

        {/* Card 4: State Mutations */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              State Mutations
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Database size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {totalTransitions}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                Transitions
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              State machine transitions executed
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          3. SCENARIO SELECTION SECTION
      ===================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Select Multi-Step Benchmark Scenario
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Agent Target: {selectedAgent?.name || `Agent #${selectedAgentId}`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {scenarios.map((sc) => {
            const isSelected = selectedScenarioId === sc.id;
            const isRecommended = sc.id === getRecommendedScenario(selectedAgentId);
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`rounded-3xl border p-5 text-left transition-all relative ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/40 dark:border-blue-600 dark:bg-blue-950/20 shadow-xs"
                    : "border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] hover:border-gray-200 dark:hover:border-gray-700 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isSelected
                          ? "bg-blue-100 text-[#2563eb] dark:bg-blue-900/60 dark:text-blue-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {sc.category}
                    </span>
                    {isRecommended && (
                      <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        Matched Agent
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono font-medium">
                    {sc.steps.length} turns
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                  {sc.title}
                </h3>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {sc.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          4. RESULTS & RUNTIME ANOMALY INSPECTOR
      ===================================================== */}
      {running && !result && (
        <div className="flex min-h-[350px] flex-col items-center justify-center rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#2563eb] dark:text-blue-400 animate-pulse">
            <Repeat size={28} className="animate-spin" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Simulating Conversational Trajectory...
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-gray-500 dark:text-gray-400">
            Agent is navigating multi-turn state transitions while RAVEN monitors tool loop cycles and checks for silent goal drift.
          </p>
        </div>
      )}

      {!running && !result && (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400">
            <Layers size={22} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            No Multi-Turn Run Active
          </h3>
          <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
            Select a benchmark scenario above and click &quot;Run Multi-Turn Flow&quot; to inspect stateful tool progression and loop detection.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Anomaly & Metric Banners (3 Cards) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Tool Loop Card */}
            <div
              className={`rounded-3xl border p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
                result.anomalies.tool_loop.loop_detected
                  ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20"
                  : "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.anomalies.tool_loop.loop_detected ? (
                    <XCircle size={18} className="text-rose-500" />
                  ) : (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Tool-Call Loop Detector
                  </span>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    result.anomalies.tool_loop.loop_detected
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  }`}
                >
                  {result.anomalies.tool_loop.loop_detected ? "LOOP DETECTED" : "PASS (NO LOOPS)"}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.anomalies.tool_loop.reason}
              </p>
            </div>

            {/* Goal Drift Card */}
            <div
              className={`rounded-3xl border p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
                result.anomalies.goal_drift.drift_detected
                  ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-cyan-200 bg-cyan-50/40 dark:border-cyan-900/40 dark:bg-cyan-950/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Silent Goal Drift
                  </span>
                </div>
                <span className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400">
                  {result.anomalies.goal_drift.score}% Retained
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.anomalies.goal_drift.score >= 80
                      ? "bg-cyan-500"
                      : result.anomalies.goal_drift.score >= 60
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${result.anomalies.goal_drift.score}%` }}
                />
              </div>
              <p className="mt-2.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.anomalies.goal_drift.reason}
              </p>
            </div>

            {/* State Machine Inspector Card */}
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Stateful Mock Tool Engine
                  </span>
                </div>
                <span className="rounded-md bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                  {result.state_machine.transitions.length} Transitions
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                {result.state_machine.transitions.length > 0 ? (
                  result.state_machine.transitions.map((tr, i) => (
                    <div key={i} className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-gray-900 dark:text-white font-semibold">
                        {tr.order_id ? `${tr.order_id}:` : tr.tool ? `${tr.tool}:` : `Step ${i + 1}:`}
                      </span>
                      {tr.from && (
                        <>
                          <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400 uppercase font-mono">
                            {tr.from}
                          </span>
                          <ArrowRight size={12} className="text-purple-500 shrink-0" />
                        </>
                      )}
                      <span className="rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase font-mono">
                        {tr.to || "Executed"}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-gray-400">
                    Query-only session (no mutating transitions triggered).
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Conversational Multi-Step Trajectory Timeline */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
                  <Terminal size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Multi-Turn Trajectory Transcript ({result.total_turns} Turns)
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Sequential user dialogues, tool invocations, and agent replies
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Goal: <strong className="text-gray-900 dark:text-white">{result.initial_goal}</strong>
              </span>
            </div>

            <div className="space-y-4">
              {result.transcript.map((step) => (
                <div
                  key={step.turn}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800/90 bg-gray-50/50 dark:bg-[#121926]/60 p-5 space-y-3.5 transition hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-[11px] font-bold text-[#2563eb] dark:text-blue-400">
                        {step.turn}
                      </span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        Turn {step.turn}
                      </span>
                    </div>
                    {step.tool_used ? (
                      <span className="rounded-md border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-300">
                        ⚡ Invoked: {step.tool_used}
                      </span>
                    ) : (
                      <span className="rounded-md bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        No Tool Required
                      </span>
                    )}
                  </div>

                  {/* Customer Input */}
                  <div className="rounded-xl bg-white dark:bg-[#182234] border border-gray-100 dark:border-gray-800/60 p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      <User size={12} />
                      <span>Customer Input</span>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {step.user_input}
                    </p>
                  </div>

                  {/* Tool Execution Details (if any) */}
                  {step.tool_used && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-[#0f1522] p-3.5 text-[11px] font-mono space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Tool Arguments &amp; Output
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        Args: {JSON.stringify(step.tool_arguments)}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400">
                        State: {JSON.stringify(step.tool_result)}
                      </div>
                    </div>
                  )}

                  {/* Agent Conversational Response */}
                  <div className="rounded-xl bg-white dark:bg-[#182234] border border-gray-100 dark:border-gray-800/60 p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2563eb] dark:text-blue-400">
                      <Bot size={12} />
                      <span>{result.agent_name}</span>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {step.agent_response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
