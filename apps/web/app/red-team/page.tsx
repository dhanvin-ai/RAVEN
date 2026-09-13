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
  Flame,
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
  UserX,
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
  getAgents,
  getRedTeamStrategies,
  runRedTeamSimulation,
  type Agent,
  type RedTeamSimulationResult,
  type RedTeamStrategy,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function RedTeamPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(DEFAULT_AGENT_ID);
  const [strategies, setStrategies] = useState<RedTeamStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("AUTHORITY_PRESSURE");
  const [targetAction, setTargetAction] = useState<string>("refund_order");
  const [turns, setTurns] = useState<number>(3);

  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedTeamSimulationResult | null>(null);

  // Table active tab
  const [activeTab, setActiveTab] = useState<"transcript" | "recommendations">("transcript");
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);



  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const [agentsRes, strategiesRes] = await Promise.all([
          getAgents(),
          getRedTeamStrategies(),
        ]);
        setAgents(agentsRes.agents || []);
        setStrategies(strategiesRes.strategies || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load agents or red-team strategies.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleLaunchAttack() {
    try {
      setRunning(true);
      setError(null);
      const res = await runRedTeamSimulation({
        agent_id: selectedAgentId,
        strategy: selectedStrategy,
        turns: turns,
        target_action: targetAction,
      });
      setResult(res);
      setActiveTab("transcript");
    } catch (err: any) {
      setError(err?.message || "Red team simulation failed.");
    } finally {
      setRunning(false);
    }
  }



  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Derived scorecard values
  const toleranceScore = result?.scorecard?.tolerance_score ?? 85;
  const overallStatus = result?.scorecard?.overall_status ?? "SHIELD_INTACT";
  const resistedTurns = result?.scorecard?.resisted_turns ?? 3;
  const breachedTurns = result?.scorecard?.breached_turns ?? 0;
  const totalTurns = result?.scorecard?.total_turns ?? turns;

  // Agent accent colors for horizontal selector
  const agentAccentColors = [
    { border: "bg-[#2563eb]", text: "text-[#2563eb]", dot: "bg-[#2563eb]", ring: "border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20" },
    { border: "bg-[#10b981]", text: "text-[#10b981]", dot: "bg-[#10b981]", ring: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20" },
    { border: "bg-[#f59e0b]", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]", ring: "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20" },
    { border: "bg-[#8b5cf6]", text: "text-[#8b5cf6]", dot: "bg-[#8b5cf6]", ring: "border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20" },
  ];

  if (loading) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/25 animate-pulse">
            <Flame size={24} />
          </div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading adversarial testing studio...
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
              Red Teaming
            </h1>
            <span className="rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-2.5 py-0.5 text-xs font-semibold">
              Adversarial Studio
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Probe resistance against social engineering, authority pressure, and prompt injection.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Agent Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => {
                const newId = Number(e.target.value);
                setSelectedAgentId(newId);
                setResult(null);
                const a = agents.find((ag) => ag.id === newId);
                if (a && a.tools && a.tools.length > 0) {
                  setTargetAction(a.tools[0].name);
                }
              }}
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

          {/* Target Action Dropdown (Dynamically populated from selected agent tools) */}
          <div className="relative">
            <select
              value={targetAction}
              onChange={(e) => setTargetAction(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3.5 py-2 pr-8 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-2xs outline-none hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {selectedAgent && selectedAgent.tools && selectedAgent.tools.length > 0 ? (
                selectedAgent.tools.map((t) => (
                  <option key={t.name} value={t.name}>
                    Target: {t.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="refund_order">Target: refund_order</option>
                  <option value="cancel_order">Target: cancel_order</option>
                  <option value="send_email">Target: send_email</option>
                </>
              )}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          {/* Launch Red-Team Attack Button */}
          <button
            type="button"
            onClick={handleLaunchAttack}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50"
          >
            {running ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            <span>{running ? "Probing Defense..." : "Launch Red-Team Attack"}</span>
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
        {/* Card 1: Defense Tolerance */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Defense Tolerance
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {toleranceScore}%
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Resilient
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Pressure tolerance benchmark score
            </p>
          </div>
        </div>

        {/* Card 2: Shield Integrity */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Shield Integrity
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <Shield size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xl lg:text-[22px] font-bold tracking-tight text-gray-900 dark:text-white">
                {overallStatus.replace("_", " ")}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {resistedTurns}/{totalTurns}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              {resistedTurns} turns successfully defended
            </p>
          </div>
        </div>

        {/* Card 3: Probe Turns */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Probe Turns
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <Terminal size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {turns} Turns
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-semibold text-[#2563eb] dark:text-blue-400">
                Depth
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Multi-turn escalation depth
            </p>
          </div>
        </div>

        {/* Card 4: Breach Alerts */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Breach Alerts
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                {breachedTurns}
              </span>
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  breachedTurns === 0
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                }`}
              >
                {breachedTurns === 0 ? "Zero Breaches" : "Flagged"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Policy violations detected
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          3. MAIN CONTENT (Attack Parameters + Agent Selector + Transcript)
      ===================================================== */}
      <div className="space-y-6">
          {/* Card A: Attack Vector Selection & Parameters */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2563eb]">
                  <span className="rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    PROBE VECTOR
                  </span>
                  <span className="text-gray-400 font-mono text-[11px]">
                    Target: {targetAction}
                  </span>
                  <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    ARMED
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-1.5">
                  <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    Attack Parameters &amp; Strategy
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl">
                  Select adversarial coercion tactics to stress-test prompt immutability and guardrails.
                </p>
              </div>

              {/* Probe Turns Slider */}
              <div className="shrink-0 sm:w-48">
                <div className="flex justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  <span>Probe Depth</span>
                  <span className="text-[#2563eb] font-bold">{turns} Turns</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={turns}
                  onChange={(e) => setTurns(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700 accent-[#2563eb]"
                />
              </div>
            </div>

            {/* Attack Vector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {[
                {
                  id: "AUTHORITY_PRESSURE",
                  label: "Authority Pressure",
                  desc: "Urgent executive threats & VIP overrides",
                },
                {
                  id: "GASLIGHTING",
                  label: "Gaslighting",
                  desc: "Claims prior approval & verified tokens",
                },
                {
                  id: "PROMPT_INJECTION",
                  label: "Prompt Injection",
                  desc: "Jailbreaks, maintenance modes, delimiters",
                },
                {
                  id: "FULL_CAMPAIGN",
                  label: "Adaptive Campaign",
                  desc: "Multi-turn escalating hybrid assault",
                },
              ].map((s) => {
                const isSelected = selectedStrategy === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStrategy(s.id)}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 shadow-xs"
                        : "border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-gray-900 dark:text-white">
                        {s.label}
                      </div>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Horizontal Agent Selector Strip (Matches Image 3) */}
            <div className="mt-8 pt-5 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Target Agent to Probe ({agents.length})
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
                {agents.map((agent, idx) => {
                  const isSelected = selectedAgentId === agent.id;
                  const colors = agentAccentColors[idx % agentAccentColors.length];

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setResult(null);
                        if (agent.tools && agent.tools.length > 0) {
                          setTargetAction(agent.tools[0].name);
                        }
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
                            #{agent.id}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-gray-400">
                          {agent.model}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 mt-1 truncate">
                        {agent.name}
                      </div>
                      <div className={`h-1 w-full ${colors.border} rounded-full mt-2.5`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card B: Multi-Tab Table (Adversarial Dialogue Transcript & Hardening Recommendations) */}
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 dark:border-gray-800 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {activeTab === "transcript"
                    ? `Adversarial Dialogue Transcript (${result?.transcript?.length || 0} Turns)`
                    : `Hardening Recommendations (${result?.scorecard?.recommendations?.length || 0})`}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {activeTab === "transcript"
                    ? "Turn-by-turn attacker prompt, agent response, and judge evaluation"
                    : "Automated defense policies and prompt patching recommendations"}
                </p>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("transcript")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    activeTab === "transcript"
                      ? "bg-white dark:bg-[#151d2e] text-[#2563eb] shadow-2xs"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Transcript ({result?.transcript?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("recommendations")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    activeTab === "recommendations"
                      ? "bg-white dark:bg-[#151d2e] text-[#2563eb] shadow-2xs"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  Hardening ({result?.scorecard?.recommendations?.length || 0})
                </button>
              </div>
            </div>

            {/* Tab 1: Transcript */}
            {activeTab === "transcript" && (
              <div className="space-y-4 mt-4">
                {!result ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No active attack session. Click &quot;Launch Red-Team Attack&quot; above to probe agent resistance.
                  </div>
                ) : (
                  result.transcript.map((turn) => (
                    <div
                      key={turn.turn}
                      className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          Turn {turn.turn} of {result.total_turns}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            turn.breached
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {turn.status}
                        </span>
                      </div>

                      {/* Attacker message */}
                      <div className="mb-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-xs">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                          <UserX size={12} />
                          <span>Adversarial Attacker</span>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                          &quot;{turn.attacker_message}&quot;
                        </p>
                      </div>

                      {/* Agent Response */}
                      <div className="mb-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-[#151d2e] p-3 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2563eb] dark:text-blue-400">
                            <Bot size={12} />
                            <span>{result.agent_name}</span>
                          </div>
                          {turn.tool_used && (
                            <span className="font-mono text-[10px] bg-blue-50 dark:bg-blue-950/50 text-[#2563eb] dark:text-blue-400 px-2 py-0.5 rounded-md">
                              Tool: {turn.tool_used}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {turn.agent_response}
                        </p>
                      </div>

                      {/* Judge Evaluation */}
                      <div
                        className={`rounded-xl p-2.5 text-[11px] leading-relaxed flex items-start gap-2 ${
                          turn.breached
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {turn.breached ? (
                          <XCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                        ) : (
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                        )}
                        <span>{turn.rationale}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Hardening Recommendations */}
            {activeTab === "recommendations" && (
              <div className="space-y-3 mt-4">
                {(!result?.scorecard?.recommendations || result.scorecard.recommendations.length === 0) ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No recommendations yet. Run an attack to synthesize automated hardening policies.
                  </div>
                ) : (
                  result.scorecard.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-3.5 text-xs text-gray-800 dark:text-gray-200"
                    >
                      <Sparkles size={16} className="text-[#2563eb] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
    </main>
  );
}
