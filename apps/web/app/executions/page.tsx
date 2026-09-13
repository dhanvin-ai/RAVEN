// @ts-nocheck
"use client";

import {
  Terminal,
  Bot,
  ChevronDown,
  RefreshCw,
  Search,
  Code2,
  Clock3,
  Filter,
  XCircle,
  CheckCircle2,
  Wrench,
  ChevronRight,
  GitFork,
  ArrowRight,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  FileCode,
  Sliders,
  Maximize2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getAgents,
  getExecutionHistory,
  getExecutionTrace,
  replayExecution,
  type Agent,
  type Execution,
  type ExecutionTrace,
  type TraceStep,
  type TraceReplayResult,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function ExecutionsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<string>("");

  // Trace Debugger State
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [activeTrace, setActiveTrace] = useState<ExecutionTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // Fork / Replay State
  const [forkStepIndex, setForkStepIndex] = useState<number | null>(null);
  const [forkPayloadText, setForkPayloadText] = useState<string>("");
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<TraceReplayResult | null>(null);

  const loadData = async (agentId: number) => {
    setLoading(true);
    setError(null);
    try {
      if (agents.length === 0) {
        const agentsData = await getAgents();
        setAgents(agentsData.agents || []);
      }

      const history = await getExecutionHistory(agentId);
      const list = history?.executions || [];
      setExecutions(list);

      // Auto-select latest execution for trace inspection
      if (list.length > 0 && !selectedExecutionId) {
        handleSelectExecution(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedAgentId);
  }, [selectedAgentId]);

  const handleSelectExecution = async (id: number) => {
    setSelectedExecutionId(id);
    setTraceLoading(true);
    setReplayResult(null);
    setForkStepIndex(null);
    try {
      const trace = await getExecutionTrace(id);
      setActiveTrace(trace);
    } catch (err) {
      console.error("Failed to load trace:", err);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleStartFork = (step: TraceStep) => {
    setForkStepIndex(step.index);
    let initialText = "";
    if (typeof step.data === "string") {
      initialText = step.data;
    } else {
      initialText = JSON.stringify(step.data, null, 2);
    }
    setForkPayloadText(initialText);
  };

  const handleExecuteReplay = async () => {
    if (!selectedExecutionId || forkStepIndex === null) return;
    setReplayLoading(true);
    setError(null);

    try {
      const overrides: Record<string, any> = {};
      let parsedData: any = forkPayloadText;
      try {
        parsedData = JSON.parse(forkPayloadText);
      } catch {
        parsedData = forkPayloadText;
      }

      if (forkStepIndex === 0) {
        overrides.user_input = typeof parsedData === "string" ? parsedData : String(parsedData);
      } else if (forkStepIndex === 1) {
        overrides.system_prompt = typeof parsedData === "string" ? parsedData : String(parsedData);
      } else if (forkStepIndex === 2) {
        if (typeof parsedData === "object" && parsedData.arguments) {
          overrides.tool_arguments = parsedData.arguments;
        } else if (typeof parsedData === "object") {
          overrides.tool_arguments = parsedData;
        }
      } else if (forkStepIndex === 3) {
        overrides.tool_response = typeof parsedData === "object" ? parsedData : { result: parsedData };
      }

      const result = await replayExecution(selectedExecutionId, forkStepIndex, overrides);
      setReplayResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setReplayLoading(false);
    }
  };

  const uniqueTools = useMemo(() => {
    const tools = new Set(executions.map((e) => e.tool_used).filter(Boolean) as string[]);
    return Array.from(tools).sort();
  }, [executions]);

  const stats = useMemo(() => {
    const toolsUsed = executions.map((e) => e.tool_used).filter(Boolean) as string[];
    const uniqueCount = new Set(toolsUsed).size;

    let mostCommon = "None";
    if (toolsUsed.length > 0) {
      const counts = toolsUsed.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      mostCommon = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    }

    return {
      total: executions.length,
      uniqueTools: uniqueCount,
      mostCommon,
    };
  }, [executions]);

  const filteredExecutions = useMemo(() => {
    return executions.filter((exe) => {
      const matchesSearch =
        !searchQuery ||
        (exe.user_input && exe.user_input.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTool = !selectedTool || exe.tool_used === selectedTool;
      return matchesSearch && matchesTool;
    });
  }, [executions, searchQuery, selectedTool]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Terminal size={18} className="text-[var(--purple-bright)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Trace Debugger
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Interactive &ldquo;Time-Travel&rdquo; Trace Debugger
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Inspect step-by-step execution trees, fork dialogues from any node, and test hypothesis replays deterministically.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <button
              onClick={() => loadData(selectedAgentId)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
            <div className="text-sm text-[var(--foreground)]">{error}</div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
          <ResultMetric label="Total Executions" value={String(stats.total)} />
          <ResultMetric label="Unique Tools Used" value={String(stats.uniqueTools)} />
          <ResultMetric label="Most Common Tool" value={stats.mostCommon} />
        </div>

        {/* Split Screen: Left (Execution Selector) | Right (Time-Travel Tree Canvas) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Executions List (4 Cols) */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 lg:col-span-4 flex flex-col h-[820px]">
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="text"
                  placeholder="Filter executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-light)] bg-[#101012] py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[var(--purple)]"
                />
              </div>

              <div className="relative">
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3 py-1.5 pr-8 text-xs outline-none transition focus:border-[var(--purple)]"
                >
                  <option value="">All Tools</option>
                  {uniqueTools.map((tool) => (
                    <option key={tool} value={tool}>
                      {tool}
                    </option>
                  ))}
                </select>
                <Filter
                  size={12}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredExecutions.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--muted)]">
                  No executions match criteria.
                </div>
              ) : (
                filteredExecutions.map((exe) => {
                  const isSelected = selectedExecutionId === exe.id;
                  return (
                    <div
                      key={exe.id}
                      onClick={() => handleSelectExecution(exe.id)}
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        isSelected
                          ? "border-[var(--purple-bright)] bg-[var(--purple)]/10 shadow-sm"
                          : "border-[var(--border)] bg-[#101012] hover:bg-[#151518]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[var(--muted)]">#{exe.id}</span>
                        {exe.tool_used ? (
                          <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--purple-bright)] flex items-center gap-1">
                            <Wrench size={10} />
                            {exe.tool_used}
                          </span>
                        ) : (
                          <span className="rounded border border-[var(--border)] bg-[#1c1c20] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                            no-tool
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--foreground)] line-clamp-2">
                        {exe.user_input || "Empty prompt"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-2 border-t border-[var(--border)] pt-2 text-right text-[11px] text-[var(--muted)]">
              Showing {filteredExecutions.length} of {executions.length} traces
            </div>
          </section>

          {/* Right Column: Interactive Time-Travel Trace Canvas (8 Cols) */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 lg:col-span-8 flex flex-col min-h-[820px]">
            <div className="mb-4 flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-[var(--purple-bright)]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]">
                  Execution Tree &amp; Time-Travel Canvas
                </h2>
                {selectedExecutionId && (
                  <span className="rounded bg-[#1c1c20] px-2 py-0.5 font-mono text-xs text-amber-400 border border-[var(--border)]">
                    Trace #{selectedExecutionId}
                  </span>
                )}
              </div>

              {replayResult && (
                <button
                  onClick={() => setReplayResult(null)}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:underline"
                >
                  <RotateCcw size={12} />
                  Reset to Original Trace
                </button>
              )}
            </div>

            {traceLoading && (
              <div className="flex flex-1 items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-[var(--purple-bright)]" />
              </div>
            )}

            {!traceLoading && !activeTrace && (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <Terminal size={32} className="text-[var(--muted-dark)] mb-2" />
                <p className="text-sm text-[var(--muted)]">Select an execution from the left list to inspect its trace tree.</p>
              </div>
            )}

            {!traceLoading && activeTrace && (
              <div className="flex-1 space-y-6">
                {/* Timeline Tree Visualization */}
                <div className="relative pl-6 border-l-2 border-[var(--purple)]/40 space-y-6 ml-3">
                  {(replayResult ? replayResult.forked_steps : activeTrace.steps).map(
                    (step, idx) => {
                      const isForkedTarget = forkStepIndex === step.index;
                      const isModified = step.modified;

                      return (
                        <div key={step.index} className="relative group">
                          {/* Timeline Node Bullet */}
                          <div
                            className={`absolute -left-[31px] top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition ${
                              isModified
                                ? "border-amber-400 bg-amber-500/20 text-amber-300 ring-4 ring-amber-500/10"
                                : "border-[var(--purple-bright)] bg-[#101012] text-white"
                            }`}
                          >
                            {step.index}
                          </div>

                          {/* Step Card */}
                          <div
                            className={`rounded-lg border p-4 transition ${
                              isModified
                                ? "border-amber-500/40 bg-amber-500/[0.04]"
                                : "border-[var(--border)] bg-[#101012] hover:border-[var(--border-light)]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
                                  {step.label}
                                </span>
                                {isModified && (
                                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/30 uppercase">
                                    Forked / Modified
                                  </span>
                                )}
                              </div>

                              {/* Fork Button */}
                              {step.editable && (
                                <button
                                  onClick={() => handleStartFork(step)}
                                  className="flex items-center gap-1 rounded bg-[#1c1c20] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-white hover:border-[var(--purple)] transition"
                                  title="Fork from this step with tweaks"
                                >
                                  <GitFork size={12} className="text-amber-400" />
                                  Fork &amp; Tweak
                                </button>
                              )}
                            </div>

                            {/* Node Content */}
                            {isForkedTarget ? (
                              <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-black/40 p-3">
                                <div className="text-xs font-medium text-amber-300 flex items-center gap-1">
                                  <Sliders size={12} />
                                  Edit input for Step {step.index} ({step.label}):
                                </div>
                                <textarea
                                  value={forkPayloadText}
                                  onChange={(e) => setForkPayloadText(e.target.value)}
                                  rows={4}
                                  className="w-full rounded border border-[var(--border-light)] bg-[#151518] p-2.5 font-mono text-xs text-[#e4e4e7] outline-none focus:border-amber-400"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setForkStepIndex(null)}
                                    className="rounded px-3 py-1 text-xs text-[var(--muted)] hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleExecuteReplay}
                                    disabled={replayLoading}
                                    className="flex items-center gap-1.5 rounded bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
                                  >
                                    <Play size={12} className={replayLoading ? "animate-spin" : "fill-current"} />
                                    {replayLoading ? "Replaying..." : "Re-run from this step"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <pre className="max-h-48 overflow-auto rounded bg-[#0b0b0d] p-3 font-mono text-xs leading-5 text-[#d4d4d8] border border-[var(--border)] whitespace-pre-wrap">
                                {typeof step.data === "string"
                                  ? step.data
                                  : JSON.stringify(step.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Side-by-Side Diff View when Replayed */}
                {replayResult && (
                  <div className="mt-8 rounded-xl border border-amber-500/40 bg-[#0d0d10] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
                          Deterministic Replay Comparison (Forked at Step {replayResult.fork_at_step})
                        </h3>
                      </div>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300 border border-amber-500/30">
                        Hypothesis Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold text-[var(--muted)] uppercase">
                          Original Output
                        </div>
                        <pre className="max-h-56 overflow-auto rounded-lg border border-[var(--border)] bg-[#101012] p-3 font-mono text-xs text-[#a1a1aa] whitespace-pre-wrap">
                          {JSON.stringify(replayResult.original_steps[4]?.data, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold text-amber-400 uppercase">
                          Forked Replay Output
                        </div>
                        <pre className="max-h-56 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 font-mono text-xs text-amber-200 whitespace-pre-wrap">
                          {JSON.stringify(replayResult.forked_steps[4]?.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--panel)] p-4 text-center">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}