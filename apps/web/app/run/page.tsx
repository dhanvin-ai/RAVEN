"use client";

import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  History,
  Play,
  RefreshCw,
  Terminal,
  User,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getAgentVersions,
  getAgents,
  getExecutionHistory,
  runAgent,
  type Agent,
  type AgentVersion,
  type Execution,
} from "@/lib/api";

// ============================================================
// CONFIG
// ============================================================

const DEFAULT_AGENT_ID = 3;

// ============================================================
// TYPES
// ============================================================

interface RuntimeResult {
  success?: boolean;
  user_input?: string;
  tool?: string | null;
  arguments?: Record<string, unknown>;
  result?: unknown;
  version?: number;
  agent_version_id?: number;
  message?: string;
}

// ============================================================
// PAGE
// ============================================================

export default function RunAgentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [history, setHistory] = useState<Execution[]>([]);

  const [selectedAgentId, setSelectedAgentId] =
    useState<number>(DEFAULT_AGENT_ID);

  const [selectedVersionId, setSelectedVersionId] =
    useState<number | undefined>(undefined);

  const [userInput, setUserInput] = useState("");

  const [result, setResult] =
    useState<RuntimeResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [expandedExecution, setExpandedExecution] =
    useState<number | null>(null);

  // ============================================================
  // LOAD DATA
  // ============================================================

  async function loadData(
    agentId: number = selectedAgentId
  ) {
    try {
      setError(null);

      const [
        agentsResponse,
        versionsResponse,
        historyResponse,
      ] = await Promise.all([
        getAgents(),
        getAgentVersions(agentId),
        getExecutionHistory(agentId),
      ]);

      setAgents(agentsResponse.agents || []);
      setVersions(versionsResponse);
      setHistory(historyResponse.executions || []);

      if (
        versionsResponse.length > 0 &&
        selectedVersionId === undefined
      ) {
        const latest =
          [...versionsResponse].sort(
            (a, b) => b.version - a.version
          )[0];

        setSelectedVersionId(latest.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load agent runtime data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(DEFAULT_AGENT_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // SELECTED AGENT
  // ============================================================

  const selectedAgent = useMemo(() => {
    return agents.find(
      (agent) => agent.id === selectedAgentId
    );
  }, [agents, selectedAgentId]);

  // ============================================================
  // AGENT CHANGE
  // ============================================================

  async function handleAgentChange(
    agentId: number
  ) {
    setSelectedAgentId(agentId);
    setSelectedVersionId(undefined);
    setResult(null);

    setLoading(true);

    await loadData(agentId);
  }

  // ============================================================
  // REFRESH
  // ============================================================

  async function handleRefresh() {
    setRefreshing(true);
    await loadData(selectedAgentId);
  }

  // ============================================================
  // RUN AGENT
  // ============================================================

  async function handleRunAgent() {
    const input = userInput.trim();

    if (!input) {
      setError("Enter a user request before running the agent.");
      return;
    }

    try {
      setRunning(true);
      setError(null);
      setResult(null);

      const response = await runAgent(
        selectedAgentId,
        input,
        selectedVersionId
      );

      // The backend wraps the runtime result inside a `response` property.
      // Unwrap it so the UI can read tool, version, arguments, etc. directly.
      const runtimeResult = response.response ?? response;

      setResult({
        success: runtimeResult.result
          ? (runtimeResult.result as Record<string, unknown>).success !== false
          : response.success,
        tool: runtimeResult.tool ?? null,
        arguments: runtimeResult.arguments ?? {},
        result: runtimeResult.result ?? null,
        version: runtimeResult.version,
        agent_version_id: runtimeResult.agent_version_id,
        message: runtimeResult.message,
      });

      // Refresh execution history after running.
      const historyResponse =
        await getExecutionHistory(
          selectedAgentId
        );

      setHistory(
        historyResponse.executions || []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Agent execution failed."
      );
    } finally {
      setRunning(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <RefreshCw
              size={16}
              className="animate-spin"
            />
            Loading agent runtime...
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <header className="mb-6 flex items-center justify-between">

          <div>
            <div className="mb-1 flex items-center gap-2">
              <Terminal
                size={18}
                className="text-[var(--purple-bright)]"
              />

              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Runtime
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">
              Run Agent
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Execute an agent manually and inspect its runtime behavior.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

        </header>

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">

            <XCircle
              size={18}
              className="mt-0.5 shrink-0 text-[var(--red)]"
            />

            <div>
              <div className="text-sm font-semibold text-[var(--red)]">
                Runtime Error
              </div>

              <div className="mt-1 text-sm text-[var(--foreground)]">
                {error}
              </div>
            </div>

          </div>
        )}

        {/* ================================================== */}
        {/* TOP CONTROL GRID */}
        {/* ================================================== */}

        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">

          {/* AGENT CONFIGURATION */}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">

            <SectionHeader
              icon={<Bot size={17} />}
              title="Agent Configuration"
            />

            {/* Agent */}

            <label className="mt-5 block">

              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                Agent
              </span>

              <div className="relative">

                <select
                  value={selectedAgentId}
                  onChange={(event) =>
                    handleAgentChange(
                      Number(event.target.value)
                    )
                  }
                  className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-3 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                >
                  {agents.map((agent) => (
                    <option
                      key={agent.id}
                      value={agent.id}
                    >
                      {agent.name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />

              </div>

            </label>

            {/* Version */}

            <label className="mt-4 block">

              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                Agent Version
              </span>

              <div className="relative">

                <select
                  value={
                    selectedVersionId ?? ""
                  }
                  onChange={(event) =>
                    setSelectedVersionId(
                      event.target.value
                        ? Number(event.target.value)
                        : undefined
                    )
                  }
                  className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-3 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                >
                  {versions.length === 0 ? (
                    <option value="">
                      Latest version
                    </option>
                  ) : (
                    versions
                      .slice()
                      .sort(
                        (a, b) =>
                          b.version - a.version
                      )
                      .map((version) => (
                        <option
                          key={version.id}
                          value={version.id}
                        >
                          Version {version.version}
                        </option>
                      ))
                  )}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />

              </div>

            </label>

            {/* Agent information */}

            {selectedAgent && (
              <div className="mt-5 rounded-lg border border-[var(--border)] bg-[#101012] p-4">

                <div className="text-sm font-semibold">
                  {selectedAgent.name}
                </div>

                {selectedAgent.description && (
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    {selectedAgent.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">

                  <span className="text-xs text-[var(--muted)]">
                    Model
                  </span>

                  <span className="mono text-xs text-[var(--foreground)]">
                    {selectedAgent.model}
                  </span>

                </div>

              </div>
            )}

          </div>

          {/* USER INPUT */}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">

            <SectionHeader
              icon={<User size={17} />}
              title="User Request"
            />

            <p className="mt-1 text-xs text-[var(--muted)]">
              Send a request directly to the selected agent.
            </p>

            <textarea
              value={userInput}
              onChange={(event) =>
                setUserInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  (event.metaKey ||
                    event.ctrlKey) &&
                  event.key === "Enter"
                ) {
                  event.preventDefault();
                  handleRunAgent();
                }
              }}
              placeholder="Example: Check my order 1234"
              className="mt-4 min-h-[180px] w-full resize-none rounded-lg border border-[var(--border-light)] bg-[#101012] p-4 text-sm leading-6 outline-none transition placeholder:text-[var(--muted-dark)] focus:border-[var(--purple)]"
            />

            <div className="mt-3 flex items-center justify-between">

              <span className="text-xs text-[var(--muted)]">
                ⌘ + Enter to run
              </span>

              <button
                type="button"
                onClick={handleRunAgent}
                disabled={
                  running ||
                  !userInput.trim()
                }
                className="flex items-center gap-2 rounded-lg bg-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--purple-bright)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? (
                  <>
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                    Running...
                  </>
                ) : (
                  <>
                    <Play
                      size={15}
                      fill="currentColor"
                    />
                    Run Agent
                  </>
                )}
              </button>

            </div>

          </div>

        </section>

        {/* ================================================== */}
        {/* EXECUTION RESULT */}
        {/* ================================================== */}

        {result && (
          <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--panel)]">

            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">

              <div className="flex items-center gap-3">

                {result.success === false ? (
                  <XCircle
                    size={19}
                    className="text-[var(--red)]"
                  />
                ) : (
                  <CheckCircle2
                    size={19}
                    className="text-[var(--green)]"
                  />
                )}

                <div>
                  <h2 className="text-sm font-semibold">
                    Execution Result
                  </h2>

                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    Agent runtime response
                  </p>
                </div>

              </div>

              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  result.success === false
                    ? "bg-[var(--red-bg)] text-[var(--red)]"
                    : "bg-[var(--green-bg)] text-[var(--green)]"
                }`}
              >
                {result.success === false
                  ? "FAILED"
                  : "SUCCESS"}
              </span>

            </div>

            <div className="grid grid-cols-1 gap-px bg-[var(--border)] md:grid-cols-3">

              <ResultMetric
                label="Tool Selected"
                value={
                  result.tool ||
                  "No tool"
                }
              />

              <ResultMetric
                label="Version"
                value={
                  result.version !== undefined
                    ? `v${result.version}`
                    : "Latest"
                }
              />

              <ResultMetric
                label="Agent Version ID"
                value={
                  result.agent_version_id !==
                  undefined
                    ? String(
                        result.agent_version_id
                      )
                    : "—"
                }
              />

            </div>

            <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">

              {/* ARGUMENTS */}

              <CodePanel
                title="Tool Arguments"
                icon={<Code2 size={15} />}
                value={
                  result.arguments ?? {}
                }
              />

              {/* RESULT */}

              <CodePanel
                title="Tool Result"
                icon={<Terminal size={15} />}
                value={
                  result.result ??
                  result.message ??
                  {}
                }
              />

            </div>

          </section>
        )}

        {/* ================================================== */}
        {/* EXECUTION HISTORY */}
        {/* ================================================== */}

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">

          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">

            <div className="flex items-center gap-3">

              <History
                size={18}
                className="text-[var(--purple-bright)]"
              />

              <div>
                <h2 className="text-sm font-semibold">
                  Execution History
                </h2>

                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Previous agent runtime executions
                </p>
              </div>

            </div>

            <span className="mono text-xs text-[var(--muted)]">
              {history.length} executions
            </span>

          </div>

          {history.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center">

              <div className="text-center">

                <Clock3
                  size={24}
                  className="mx-auto mb-3 text-[var(--muted-dark)]"
                />

                <p className="text-sm text-[var(--muted)]">
                  No executions yet.
                </p>

                <p className="mt-1 text-xs text-[var(--muted-dark)]">
                  Run the agent to create an execution record.
                </p>

              </div>

            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">

              {history.map((execution) => {

                const expanded =
                  expandedExecution ===
                  execution.id;

                return (
                  <div
                    key={execution.id}
                    className="transition hover:bg-[var(--panel-hover)]"
                  >

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedExecution(
                          expanded
                            ? null
                            : execution.id
                        )
                      }
                      className="flex w-full items-center gap-4 px-5 py-4 text-left"
                    >

                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#101012]">

                        <Bot
                          size={15}
                          className="text-[var(--purple-bright)]"
                        />

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="truncate text-sm font-medium">
                          {execution.user_input}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">

                          <span>
                            Tool:{" "}
                            <span className="text-[var(--foreground)]">
                              {execution.tool_used ||
                                "None"}
                            </span>
                          </span>

                          {execution.result?.version !==
                            undefined && (
                            <span>
                              Version:{" "}
                              <span className="text-[var(--foreground)]">
                                v
                                {
                                  execution.result
                                    .version
                                }
                              </span>
                            </span>
                          )}

                        </div>

                      </div>

                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-[var(--muted)] transition-transform ${
                          expanded
                            ? "rotate-180"
                            : ""
                        }`}
                      />

                    </button>

                    {expanded && (
                      <div className="border-t border-[var(--border)] bg-[#101012] px-5 py-5">

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                          <CodePanel
                            title="Arguments"
                            icon={
                              <Code2
                                size={15}
                              />
                            }
                            value={
                              execution.tool_arguments
                            }
                          />

                          <CodePanel
                            title="Result"
                            icon={
                              <Terminal
                                size={15}
                              />
                            }
                            value={
                              execution.result
                            }
                          />

                        </div>

                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}

        </section>

      </div>
    </main>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function SectionHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">

      <span className="text-[var(--purple-bright)]">
        {icon}
      </span>

      <h2 className="text-sm font-semibold">
        {title}
      </h2>

    </div>
  );
}

// ============================================================

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--panel)] px-5 py-4">

      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>

      <div className="mono mt-2 text-sm font-medium">
        {value}
      </div>

    </div>
  );
}

// ============================================================

function CodePanel({
  title,
  icon,
  value,
}: {
  title: string;
  icon: ReactNode;
  value: unknown;
}) {
  let formatted = "";

  try {
    formatted =
      typeof value === "string"
        ? value
        : JSON.stringify(
            value,
            null,
            2
          );
  } catch {
    formatted = String(value);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">

      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[#111113] px-4 py-3">

        <span className="text-[var(--muted)]">
          {icon}
        </span>

        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </span>

      </div>

      <pre className="max-h-[320px] overflow-auto bg-[#0b0b0d] p-4 text-xs leading-6 text-[#d4d4d8]">
        {formatted || "{}"}
      </pre>

    </div>
  );
}