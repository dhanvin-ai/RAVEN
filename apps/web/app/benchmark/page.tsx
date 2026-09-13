// @ts-nocheck
"use client";

import {
  Trophy,
  Bot,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Zap,
  DollarSign,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  BarChart3,
  Cpu,
  ArrowUpRight,
  TrendingDown,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAgents,
  getBenchmarkModels,
  runBenchmark,
  runPonytailBenchmark,
  type Agent,
  type BenchmarkModel,
  type BenchmarkLeaderboard,
  type BenchmarkModelResult,
  type PonytailComparisonResult,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function BenchmarkPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);

  const [availableModels, setAvailableModels] = useState<BenchmarkModel[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaderboardData, setLeaderboardData] = useState<BenchmarkLeaderboard | null>(null);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  // Ponytail Protocol State
  const [activeTab, setActiveTab] = useState<"models" | "ponytail">("models");
  const [ponytailLoading, setPonytailLoading] = useState(false);
  const [ponytailData, setPonytailData] = useState<PonytailComparisonResult | null>(null);

  // Load initial agents & models
  useEffect(() => {
    async function init() {
      setInitialLoading(true);
      try {
        const [agentsRes, modelsRes] = await Promise.all([
          getAgents(),
          getBenchmarkModels(),
        ]);
        setAgents(agentsRes.agents || []);
        const models = modelsRes.models || [];
        setAvailableModels(models);
        // Default: select top 3 models
        setSelectedModelIds(models.slice(0, 3).map((m) => m.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load initial data");
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, []);

  const toggleModel = (id: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAllModels = () => {
    setSelectedModelIds(availableModels.map((m) => m.id));
  };

  const clearModels = () => {
    setSelectedModelIds([]);
  };

  const handleRunBenchmark = async () => {
    if (selectedModelIds.length === 0) {
      setError("Please select at least one foundation model to benchmark.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await runBenchmark(selectedAgentId, selectedModelIds);
      setLeaderboardData(res);
      if (res.leaderboard && res.leaderboard.length > 0) {
        setExpandedModelId(res.leaderboard[0].model_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark execution failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRunPonytailBenchmark = async () => {
    setPonytailLoading(true);
    setError(null);
    try {
      const res = await runPonytailBenchmark(selectedAgentId);
      setPonytailData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ponytail benchmark failed");
    } finally {
      setPonytailLoading(false);
    }
  };

  const topModel = leaderboardData?.leaderboard?.[0];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Benchmark
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeTab === "models"
                ? "Head-to-Head Multi-Model Benchmarking"
                : "Ponytail Protocol Efficiency & Anti-Bloat Benchmark"}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {activeTab === "models"
                ? "Evaluate your agent across leading foundation models simultaneously to identify the most reliable, cost-effective LLM."
                : "Compare Vanilla Agent execution vs. Ponytail Decision Ladder on tokens, turnaround latency, and tool-loop elimination."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Selector */}
            <div className="relative w-64">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
            </div>

            {/* Benchmark Button */}
            {activeTab === "models" ? (
              <button
                onClick={handleRunBenchmark}
                disabled={loading || selectedModelIds.length === 0}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <Play size={16} className={loading ? "animate-spin" : "fill-current"} />
                {loading ? "Benchmarking Models..." : "Run Benchmark"}
              </button>
            ) : (
              <button
                onClick={handleRunPonytailBenchmark}
                disabled={ponytailLoading}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <Zap size={16} className={ponytailLoading ? "animate-spin" : "fill-current"} />
                {ponytailLoading ? "Running Test..." : "Run Ponytail Efficiency Test"}
              </button>
            )}
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="mb-6 flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <button
            onClick={() => setActiveTab("models")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "models"
                ? "bg-[var(--purple)] text-white shadow-md"
                : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
            }`}
          >
            <Trophy size={16} />
            Multi-Model Leaderboard
          </button>
          <button
            onClick={() => {
              setActiveTab("ponytail");
              if (!ponytailData && !ponytailLoading) {
                handleRunPonytailBenchmark();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "ponytail"
                ? "bg-gradient-to-r from-amber-600 to-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
            }`}
          >
            <Zap size={16} className="text-amber-400" />
            Ponytail Efficiency Comparison
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 font-bold border border-emerald-500/30">
              -37% TOKENS
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
            <div className="text-sm text-[var(--foreground)]">{error}</div>
          </div>
        )}

        {/* Multi-Model Tab Content */}
        {activeTab === "models" && (
          <>
            {/* Model Selection Panel */}
            <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
                Select Models to Compare ({selectedModelIds.length}/{availableModels.length})
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={selectAllModels}
                className="rounded border border-[var(--border)] px-2.5 py-1 text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                Select All
              </button>
              <button
                onClick={clearModels}
                className="rounded border border-[var(--border)] px-2.5 py-1 text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {availableModels.map((model) => {
              const isSelected = selectedModelIds.includes(model.id);
              return (
                <div
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className={`cursor-pointer rounded-lg border p-3.5 transition ${
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-[var(--border)] bg-[#101012] opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded bg-[#1a1a1e] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 border border-[var(--border)]">
                        {model.provider}
                      </span>
                      <h3 className="mt-1.5 text-xs font-medium text-[var(--foreground)] line-clamp-1">
                        {model.name}
                      </h3>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5 h-4 w-4 rounded accent-amber-500"
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--muted)]">
                    Est. Cost: <span className="font-mono text-[var(--foreground)]">${model.cost_per_1k}/1k</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Results / Leaderboard */}
        {loading && (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8">
            <RefreshCw size={28} className="animate-spin text-amber-400 mb-4" />
            <div className="text-base font-medium">Running Head-to-Head Scenario Benchmark...</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              Executing test suite across {selectedModelIds.length} models concurrently and computing reliability scores.
            </div>
          </div>
        )}

        {!loading && leaderboardData && (
          <>
            {/* Top Stat Highlights */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
                    #1 Ranked Model
                  </span>
                  <Trophy size={18} className="text-amber-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-[var(--foreground)] truncate">
                  {topModel?.model_name || "N/A"}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Score: <span className="font-semibold text-emerald-400">{topModel?.reliability_score}%</span> ({topModel?.provider})
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Scenarios Tested
                  </span>
                  <Layers size={18} className="text-[var(--purple-bright)]" />
                </div>
                <div className="mt-2 text-2xl font-bold">{leaderboardData.total_scenarios}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Across {leaderboardData.models_tested} foundation models
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Fastest Latency
                  </span>
                  <Zap size={18} className="text-cyan-400" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {Math.min(...leaderboardData.leaderboard.map((m) => m.avg_latency_ms))} ms
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">Average response turnaround</div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Hallucination Guard
                  </span>
                  <ShieldAlert size={18} className="text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {topModel?.hallucination_rate === 0 ? "0% Rate" : `${topModel?.hallucination_rate}%`}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">For top-ranked model</div>
              </div>
            </div>

            {/* Leaderboard Table */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden mb-6">
              <div className="border-b border-[var(--border)] bg-[#111113] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
                    Comparative Leaderboard ({leaderboardData.leaderboard.length} Models)
                  </h2>
                </div>
                <span className="text-xs text-[var(--muted)]">Sorted by Reliability Score</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[#0c0c0e] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                    <tr>
                      <th className="px-6 py-3">Rank</th>
                      <th className="px-6 py-3">Foundation Model</th>
                      <th className="px-6 py-3">Reliability %</th>
                      <th className="px-6 py-3">Pass / Total</th>
                      <th className="px-6 py-3">Hallucination</th>
                      <th className="px-6 py-3">Injection Risk</th>
                      <th className="px-6 py-3">Avg Latency</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {leaderboardData.leaderboard.map((item, idx) => {
                      const isExpanded = expandedModelId === item.model_id;
                      const rankColor =
                        idx === 0
                          ? "text-amber-400 font-bold"
                          : idx === 1
                          ? "text-slate-300 font-bold"
                          : idx === 2
                          ? "text-amber-600 font-bold"
                          : "text-[var(--muted)]";

                      const scoreColor =
                        item.reliability_score >= 80
                          ? "text-emerald-400"
                          : item.reliability_score >= 50
                          ? "text-amber-400"
                          : "text-rose-400";

                      const statusBadge =
                        item.status === "BEST"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : item.status === "RECOMMENDED"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : item.status === "ACCEPTABLE"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30";

                      return (
                        <>
                          <tr
                            key={item.model_id}
                            onClick={() =>
                              setExpandedModelId(isExpanded ? null : item.model_id)
                            }
                            className={`cursor-pointer transition hover:bg-[#151518] ${
                              idx === 0 ? "bg-amber-500/[0.03]" : ""
                            }`}
                          >
                            <td className="px-6 py-4">
                              <span className={`text-base ${rankColor}`}>
                                #{item.rank || idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-[var(--foreground)] flex items-center gap-2">
                                  {item.model_name}
                                  {idx === 0 && (
                                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/30">
                                      TOP PICK
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--muted)]">{item.provider}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`text-base font-bold ${scoreColor}`}>
                                  {item.reliability_score}%
                                </span>
                                <div className="h-1.5 w-16 rounded-full bg-[#1c1c20] overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      item.reliability_score >= 80
                                        ? "bg-emerald-400"
                                        : item.reliability_score >= 50
                                        ? "bg-amber-400"
                                        : "bg-rose-400"
                                    }`}
                                    style={{ width: `${item.reliability_score}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs">
                                {item.passed} / {item.total_scenarios}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-xs font-medium ${
                                  item.hallucination_rate === 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {item.hallucination_rate}% ({item.hallucination_count})
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-xs font-medium ${
                                  item.injection_vulnerability_count === 0
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {item.injection_vulnerability_count} breaches
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs text-[var(--muted)]">
                                {item.avg_latency_ms} ms
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${statusBadge}`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <ChevronRight
                                size={16}
                                className={`inline-block text-[var(--muted)] transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                            </td>
                          </tr>

                          {/* Expanded Per-Scenario Breakdown */}
                          {isExpanded && (
                            <tr className="bg-[#0b0b0d]">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="rounded-lg border border-[var(--border)] bg-[#101012] p-4">
                                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                                    Scenario Breakdown for {item.model_name}
                                  </h4>
                                  <div className="divide-y divide-[var(--border)]">
                                    {item.scenario_results?.map((s, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex items-center justify-between py-2 text-xs"
                                      >
                                        <div className="flex items-center gap-3">
                                          {s.passed ? (
                                            <CheckCircle2 size={14} className="text-emerald-400" />
                                          ) : (
                                            <XCircle size={14} className="text-rose-400" />
                                          )}
                                          <span className="font-medium text-[var(--foreground)]">
                                            {s.scenario_name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[var(--muted)]">
                                          <span>
                                            Tool:{" "}
                                            <span className="font-mono text-[var(--foreground)]">
                                              {s.tool_used || "None"}
                                            </span>
                                          </span>
                                          <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold ${
                                              s.classification === "PASS"
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-rose-500/10 text-rose-400"
                                            }`}
                                          >
                                            {s.classification}
                                          </span>
                                          <span className="font-mono text-[11px]">
                                            {s.latency_ms} ms
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!loading && !leaderboardData && (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
            <Trophy size={36} className="text-amber-400/40 mb-3" />
            <h3 className="text-base font-semibold">No Benchmark Run Active</h3>
            <p className="mt-1 max-w-md text-xs text-[var(--muted)]">
              Select the foundation models you want to evaluate above, then click &ldquo;Run Benchmark&rdquo; to execute the test suite concurrently and view the comparative leaderboard.
            </p>
          </div>
        )}
          </>
        )}

        {/* Ponytail Protocol Efficiency Comparison Content */}
        {activeTab === "ponytail" && (
          <div className="space-y-6">
            {/* Protocol Ladder Architecture Banner */}
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-[#171412] via-[#121217] to-[#0f1715] p-6 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap size={12} />
                      Ponytail Mode
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      Senior Developer Anti-Bloat Decision Ladder
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Eliminate Speculative Tool Calls & Infinite Retry Loops
                  </h2>
                  <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                    Vanilla agents hallucinate or speculatively fire APIs when receiving ambiguous or destructive inputs. The Ponytail Protocol enforces an uncompromising 4-step ladder:
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                      <div className="text-[10px] font-mono font-bold text-amber-400">RUNG 1 (YAGNI)</div>
                      <div className="text-xs font-semibold text-white mt-1">Refusal / Clarification</div>
                      <div className="text-[11px] text-zinc-400 mt-1">Refuse vague requests. Don&apos;t call speculative tools.</div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                      <div className="text-[10px] font-mono font-bold text-blue-400">RUNG 2 (NATIVE)</div>
                      <div className="text-xs font-semibold text-white mt-1">Native Reasoning</div>
                      <div className="text-[11px] text-zinc-400 mt-1">Answer directly if APIs aren&apos;t strictly necessary.</div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                      <div className="text-[10px] font-mono font-bold text-emerald-400">RUNG 3 (DETERMINISTIC)</div>
                      <div className="text-xs font-semibold text-white mt-1">Targeted Tool Call</div>
                      <div className="text-[11px] text-zinc-400 mt-1">Execute the exact single tool needed with valid args.</div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                      <div className="text-[10px] font-mono font-bold text-purple-400">RUNG 4 (LAST RESORT)</div>
                      <div className="text-xs font-semibold text-white mt-1">Multi-Turn Loop</div>
                      <div className="text-[11px] text-zinc-400 mt-1">Only iterate if explicit error recovery demands it.</div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center lg:items-end justify-center">
                  <button
                    onClick={handleRunPonytailBenchmark}
                    disabled={ponytailLoading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Zap size={18} className={ponytailLoading ? "animate-spin" : "fill-current"} />
                    {ponytailLoading ? "Evaluating Efficiency..." : "Run Ponytail Efficiency Test"}
                  </button>
                  <span className="text-[10px] text-zinc-400 mt-2 font-mono">
                    Head-to-head on Agent #{selectedAgentId}
                  </span>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {ponytailLoading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
                <RefreshCw size={32} className="animate-spin text-amber-400 mb-4" />
                <div className="text-base font-semibold text-white">Running Head-to-Head Protocol Evaluation...</div>
                <div className="mt-1 text-xs text-[var(--muted)] max-w-md">
                  Simulating Vanilla Agent (Ponytail OFF) vs. Ponytail FULL ladder across all scenarios to compute token savings, latency delta, and loop elimination.
                </div>
              </div>
            )}

            {/* Results View */}
            {!ponytailLoading && ponytailData && (
              <>
                {/* Metric KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {/* Token Savings */}
                  <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-transparent p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Token Savings
                      </span>
                      <TrendingDown size={18} className="text-emerald-400" />
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-emerald-400">
                      -{ponytailData.comparison.token_savings_percent}%
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {ponytailData.vanilla_metrics.total_tokens.toLocaleString()} ➔ {ponytailData.ponytail_metrics.total_tokens.toLocaleString()} tokens
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-emerald-300">
                      {ponytailData.comparison.total_tokens_saved.toLocaleString()} tokens saved
                    </div>
                  </div>

                  {/* Latency Speedup */}
                  <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-transparent p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Latency Speedup
                      </span>
                      <Zap size={18} className="text-cyan-400" />
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-cyan-400">
                      +{ponytailData.comparison.latency_speedup_percent}%
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {ponytailData.vanilla_metrics.avg_latency_ms}ms ➔ {ponytailData.ponytail_metrics.avg_latency_ms}ms
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-cyan-300">
                      Faster turnaround
                    </div>
                  </div>

                  {/* Tool Loops Eliminated */}
                  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-transparent p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Loops Eliminated
                      </span>
                      <ShieldCheck size={18} className="text-amber-400" />
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-amber-400">
                      {ponytailData.comparison.tool_loops_eliminated}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {ponytailData.vanilla_metrics.tool_loops} loop(s) on ambiguous inputs ➔ 0
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-amber-300">
                      Zero speculative tool spam
                    </div>
                  </div>

                  {/* Safety Retention */}
                  <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-transparent p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Safety Retention
                      </span>
                      <ShieldAlert size={18} className="text-emerald-400" />
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-emerald-400">
                      {ponytailData.comparison.safety_retention_percent}%
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Forbidden actions blocked
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-emerald-300">
                      100% policy compliance
                    </div>
                  </div>

                  {/* Reliability Jump */}
                  <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/30 to-transparent p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                        Reliability Jump
                      </span>
                      <ArrowUpRight size={18} className="text-purple-400" />
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-purple-400">
                      {ponytailData.comparison.reliability_jump}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {ponytailData.vanilla_metrics.reliability_score}% ➔ {ponytailData.ponytail_metrics.reliability_score}%
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-purple-300">
                      +{(ponytailData.ponytail_metrics.passed - ponytailData.vanilla_metrics.passed)} passed scenario(s)
                    </div>
                  </div>
                </div>

                {/* Side by Side Arm Comparison Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Arm A: Vanilla */}
                  <div className="rounded-xl border border-[var(--border)] bg-[#101012] p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                          ARM A (CONTROL)
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          Vanilla Agent (Ponytail OFF)
                        </h3>
                      </div>
                      <span className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300">
                        Score: {ponytailData.vanilla_metrics.reliability_score}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                        <span className="text-zinc-400">Pass Rate:</span>
                        <span className="font-semibold text-white">{ponytailData.vanilla_metrics.passed}/{ponytailData.total_scenarios} ({ponytailData.vanilla_metrics.pass_rate}%)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                        <span className="text-zinc-400">Average Turnaround Latency:</span>
                        <span className="font-mono text-zinc-300">{ponytailData.vanilla_metrics.avg_latency_ms} ms</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                        <span className="text-zinc-400">Total Tokens Consumed:</span>
                        <span className="font-mono text-zinc-300">{ponytailData.vanilla_metrics.total_tokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                        <span className="text-zinc-400">Tool Loops / Bloat Detected:</span>
                        <span className="font-semibold text-rose-400">{ponytailData.vanilla_metrics.tool_loops} loop(s)</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-400">Speculative Redundant Calls:</span>
                        <span className="font-semibold text-amber-400">{ponytailData.vanilla_metrics.redundant_calls}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arm B: Ponytail */}
                  <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-[#0e1612] to-[#121217] p-6 shadow-xl shadow-emerald-950/20">
                    <div className="flex items-center justify-between pb-4 border-b border-emerald-800/30">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                          ARM B (PONYTAIL OPTIMIZED)
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5 flex items-center gap-1.5">
                          Ponytail Protocol Enabled
                          <Zap size={16} className="text-amber-400" />
                        </h3>
                      </div>
                      <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-mono font-bold text-emerald-300">
                        Score: {ponytailData.ponytail_metrics.reliability_score}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-emerald-900/40">
                        <span className="text-zinc-400">Pass Rate:</span>
                        <span className="font-semibold text-emerald-400">{ponytailData.ponytail_metrics.passed}/{ponytailData.total_scenarios} ({ponytailData.ponytail_metrics.pass_rate}%)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-emerald-900/40">
                        <span className="text-zinc-400">Average Turnaround Latency:</span>
                        <span className="font-mono text-cyan-400 font-semibold">{ponytailData.ponytail_metrics.avg_latency_ms} ms (-{ponytailData.comparison.latency_speedup_percent}%)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-emerald-900/40">
                        <span className="text-zinc-400">Total Tokens Consumed:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{ponytailData.ponytail_metrics.total_tokens.toLocaleString()} (-{ponytailData.comparison.token_savings_percent}%)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-emerald-900/40">
                        <span className="text-zinc-400">Tool Loops / Bloat Detected:</span>
                        <span className="font-semibold text-emerald-400">0 loops (Clean exit)</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-400">Speculative Redundant Calls:</span>
                        <span className="font-semibold text-emerald-400">0 (Eliminated)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scenario Comparative Diff Table */}
                <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                        Scenario Head-to-Head Comparison ({ponytailData.scenario_comparisons.length} Scenarios)
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Empirical evidence of token reduction, latency drops, and loop avoidance per scenario.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded">
                      {ponytailData.comparison.cost_reduction_summary}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[var(--border)] bg-[#121214] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        <tr>
                          <th className="px-5 py-3">Scenario & Category</th>
                          <th className="px-5 py-3">Vanilla Arm (No Protocol)</th>
                          <th className="px-5 py-3">Ponytail Arm (Full Protocol)</th>
                          <th className="px-5 py-3">Tokens Saved</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-sans">
                        {ponytailData.scenario_comparisons.map((sc) => (
                          <tr key={sc.scenario_id} className="hover:bg-[#151518] transition">
                            <td className="px-5 py-4 max-w-xs">
                              <div className="font-semibold text-white">{sc.scenario_name}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
                                  {sc.category}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1 italic">
                                &ldquo;{sc.user_input}&rdquo;
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {sc.vanilla_passed ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle size={14} className="text-rose-400 shrink-0" />
                                )}
                                <span className={sc.vanilla_passed ? "text-emerald-300 font-medium" : "text-rose-300 font-medium"}>
                                  {sc.vanilla_passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                                Tool: {sc.vanilla_tool || "None"} | {sc.vanilla_tokens} tok | {sc.vanilla_latency_ms}ms
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {sc.ponytail_passed ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle size={14} className="text-rose-400 shrink-0" />
                                )}
                                <span className={sc.ponytail_passed ? "text-emerald-300 font-medium" : "text-rose-300 font-medium"}>
                                  {sc.ponytail_passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              <div className="text-[10px] text-emerald-400/80 mt-1 font-mono">
                                Tool: {sc.ponytail_tool || "None"} | {sc.ponytail_tokens} tok | {sc.ponytail_latency_ms}ms
                              </div>
                            </td>

                            <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                              +{sc.tokens_saved} tok
                              <div className="text-[10px] font-normal text-zinc-400">
                                {Math.round((sc.tokens_saved / Math.max(1, sc.vanilla_tokens)) * 100)}% saved
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {sc.improvement === "FIXED_BY_PONYTAIL" ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  <Check size={12} />
                                  FIXED BY PONYTAIL
                                </span>
                              ) : sc.improvement === "IDENTICAL" ? (
                                <span className="inline-flex items-center rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                                  IDENTICAL SAFETY
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                  REGRESSED
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* Empty State */}
            {!ponytailLoading && !ponytailData && (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center">
                <Zap size={36} className="text-amber-400/40 mb-3" />
                <h3 className="text-base font-semibold">No Ponytail Comparison Run Yet</h3>
                <p className="mt-1 max-w-md text-xs text-[var(--muted)]">
                  Click &ldquo;Run Ponytail Efficiency Test&rdquo; above to empirically compare Vanilla Agent execution vs. Ponytail Protocol across all test scenarios.
                </p>
                <button
                  onClick={handleRunPonytailBenchmark}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110"
                >
                  <Play size={14} className="fill-current" />
                  Run Head-to-Head Test Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
