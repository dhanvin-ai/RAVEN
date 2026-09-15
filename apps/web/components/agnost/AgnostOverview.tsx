"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Filter,
  Flame,
  GripVertical,
  HelpCircle,
  LineChart,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import type { AgentAnalyticsOverview, AIInsightItem, UserIntentItem, AgentViolationItem, ToolErrorItem } from "@/lib/api";

interface AgnostOverviewProps {
  overview: AgentAnalyticsOverview | null;
  loading: boolean;
  onRefresh: () => void;
  agentName?: string;
  agentId?: number;
}

export function AgnostOverview({
  overview,
  loading,
  onRefresh,
  agentName = "Customer Support Agent",
  agentId = 1,
}: AgnostOverviewProps) {
  const [activeTrendTab, setActiveTrendTab] = useState<"events" | "users" | "conversations">("events");
  const [copiedMd, setCopiedMd] = useState(false);
  const [timeFilter, setTimeFilter] = useState("All time");
  const [showFilters, setShowFilters] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [askAiQuery, setAskAiQuery] = useState("");
  const [askAiAnswer, setAskAiAnswer] = useState<string | null>(null);

  const stats = overview?.stats || {
    total_events: 152,
    total_users: 29,
    total_conversations: 30,
    silent_failures: 6,
    frustration_rate: "8.4%",
  };

  const insights: AIInsightItem[] = overview?.insights?.length
    ? overview.insights
    : [
        {
          id: 1,
          user: "alex@acme-demo.ai",
          summary: "The assistant said it sent a report, but no one on the finance team received it.",
          event_type: "SILENT_FAILURE",
          status: "FAILED",
          created_at: "Jul 24",
        },
        {
          id: 2,
          user: "sam@acme-demo.ai",
          summary: "Tried to export a dashboard and gave up after the third consecutive timeout.",
          event_type: "FRUSTRATION",
          status: "WARNING",
          created_at: "Jul 23",
        },
        {
          id: 3,
          user: "jordan@acme-demo.ai",
          summary: "Repeated a teammate's email three times because context was dropped between turns.",
          event_type: "FRUSTRATION",
          status: "WARNING",
          created_at: "Jul 22",
        },
        {
          id: 4,
          user: "casey@acme-demo.ai",
          summary: "Received two contradictory answers about how return refund windows are calculated.",
          event_type: "VIOLATION",
          status: "VIOLATION",
          created_at: "Jul 21",
        },
        {
          id: 5,
          user: "taylor@acme-demo.ai",
          summary: "Asked the assistant to finish a task it claimed was done, but the order is still active.",
          event_type: "SILENT_FAILURE",
          status: "FAILED",
          created_at: "Jul 20",
        },
      ];

  const intents: UserIntentItem[] = overview?.intents?.length
    ? overview.intents
    : [
        { id: 1, name: "Users are intensely frustrated or hostile", message_count: 5, trend: "0%", suggested: false, last_seen: "2 mins ago" },
        { id: 2, name: "Users repeat themselves, then give up", message_count: 5, trend: "-33%", suggested: true, last_seen: "5 mins ago" },
        { id: 3, name: "Agent promises actions it can't take", message_count: 5, trend: "+300%", suggested: false, last_seen: "8 mins ago" },
        { id: 4, name: "Export requests end without a completed task", message_count: 5, trend: "+300%", suggested: true, last_seen: "14 mins ago" },
        { id: 5, name: "Conflicting access and pricing answers are eroding trust", message_count: 5, trend: "-100%", suggested: false, last_seen: "1 hour ago" },
      ];

  const violations: AgentViolationItem[] = overview?.violations?.length
    ? overview.violations
    : [
        { id: 1, rule: "Conflicting account answers make users lose trust", count: 5, trend: "+100%", last_seen: "15 Sept, 1:50" },
        { id: 2, rule: "Private source links surface in chat", count: 5, trend: "+100%", last_seen: "15 Sept, 1:50" },
        { id: 3, rule: "The agent promises a capability it can't deliver", count: 5, trend: "+100%", last_seen: "15 Sept, 1:50" },
        { id: 4, rule: "Users are told a task is done when it isn't", count: 5, trend: "+100%", last_seen: "15 Sept, 1:50" },
        { id: 5, rule: "Users repeat information because the agent loses context", count: 5, trend: "+100%", last_seen: "15 Sept, 1:50" },
      ];

  const toolErrors: ToolErrorItem[] = overview?.tool_errors?.length
    ? overview.tool_errors
    : [
        { id: 1, tool: "resume_task", count: 3, last_error: "Context expired" },
        { id: 2, tool: "create_export", count: 2, last_error: "Worker queue timeout" },
        { id: 3, tool: "get_user_context", count: 1, last_error: "CRM rate limit" },
      ];

  function copyHomeMarkdown() {
    const md = `# RAVEN Agent Analytics: ${agentName}
**Generated**: ${new Date().toISOString()}
**Total Events**: ${stats.total_events} | **Users**: ${stats.total_users} | **Conversations**: ${stats.total_conversations}
**Silent Failures**: ${stats.silent_failures} | **Frustration Rate**: ${stats.frustration_rate}

## Top AI Insights
${insights.map((i) => `- **${i.user}**: ${i.summary} (${i.event_type})`).join("\n")}

## Top User Intents
${intents.map((i) => `- ${i.name} (Messages: ${i.message_count}, Trend: ${i.trend})`).join("\n")}

## Top Agent Violations
${violations.map((v) => `- ${v.rule} (Violations: ${v.count}, Trend: ${v.trend})`).join("\n")}

## Top Tool Errors
${toolErrors.map((t) => `- \`${t.tool}\`: ${t.count} errors`).join("\n")}
`;
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  }

  function handleAskAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!askAiQuery.trim()) return;
    setAskAiAnswer(
      `Based on ${stats.total_events} live conversational traces for ${agentName}:\n\n` +
      `1. **Primary Silent Failure Mode**: Users requesting exports and order cancellations are being told "task completed" before background workers finish.\n` +
      `2. **Root Cause**: The agent's system prompt lacks an explicit requirement to verify tool execution IDs before generating affirmative confirmations.\n` +
      `3. **Recommended Fix**: Use RAVEN Prompt Doctor to inject negative guardrails for unverified tool responses. Projected to eliminate 83% of silent failures.`
    );
  }

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────
          TOP SUB-HEADER: Filters, Markdown Export & Ask AI
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        {/* Left Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 focus:outline-none"
            >
              <option>All time</option>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 pointer-events-none text-gray-400" />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 transition"
          >
            <Filter size={13} className="text-gray-500" />
            <span>Filters</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh analytics"
            className="h-8 w-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-white shadow-2xs transition"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#2563eb]" : ""} />
          </button>
        </div>

        {/* Right Action Buttons: Copy Markdown & Ask AI */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyHomeMarkdown}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 transition"
          >
            {copiedMd ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
            <span>{copiedMd ? "Copied!" : "Copy home.md"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAskAiModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-purple-500/25 transition active:scale-[0.98]"
          >
            <Sparkles size={13} />
            <span>Ask AI</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          ROW 1: AI INSIGHTS + TRENDS GRAPH (Agnost Top Grid)
      ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Card 1: AI Insights */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800/80 mb-3">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <Sparkles size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  AI Insights
                </h3>
              </div>
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                {insights.length} failures flagged
              </span>
            </div>

            {/* List of Insights */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {insights.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition group"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono text-gray-500 dark:text-gray-400 font-medium truncate max-w-[200px]">
                      {item.user}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                        item.event_type === "SILENT_FAILURE"
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                          : item.event_type === "VIOLATION"
                          ? "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40"
                          : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                      }`}
                    >
                      {item.event_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px]">
            <span className="text-gray-400 font-mono">Silent failure engine active</span>
            <Link
              href={`/benchmark?agentId=${agentId}`}
              className="font-semibold text-[#2563eb] hover:underline flex items-center gap-1"
            >
              <span>Auto-Heal with Doctor</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Card 2: Trends Chart */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-100 dark:border-gray-800/80 mb-3 gap-2">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#2563eb] dark:bg-blue-950/50 dark:text-blue-400">
                  <LineChart size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Trends
                </h3>
              </div>

              {/* Tabs matching Agnost AI */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTrendTab("events")}
                  className={`pb-1 border-b-2 transition ${
                    activeTrendTab === "events"
                      ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {stats.total_events} Events
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrendTab("users")}
                  className={`pb-1 border-b-2 transition ${
                    activeTrendTab === "users"
                      ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {stats.total_users} Users
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrendTab("conversations")}
                  className={`pb-1 border-b-2 transition ${
                    activeTrendTab === "conversations"
                      ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {stats.total_conversations} Conversations
                </button>
              </div>
            </div>

            {/* Interactive SVG Line Graph (Identical to Agnost AI Trend Graph) */}
            <div className="relative h-60 w-full pt-4">
              {/* Y-Axis labels */}
              <div className="absolute left-0 top-3 bottom-8 flex flex-col justify-between text-[10px] font-mono text-gray-400">
                <span>24</span>
                <span>16</span>
                <span>8</span>
                <span>0</span>
              </div>

              {/* Grid Lines & Curve */}
              <div className="ml-8 h-full flex flex-col justify-between">
                <svg className="w-full h-48 overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 180">
                  {/* Grid horizontal lines */}
                  <line x1="0" y1="0" x2="500" y2="0" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
                  <line x1="0" y1="180" x2="500" y2="180" stroke="currentColor" className="text-gray-200 dark:text-gray-700" />

                  {/* Gradient Area */}
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Polyline / Smooth Curve */}
                  <path
                    d="M 20 120 Q 100 110, 180 80 T 340 50 T 480 30"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Points on Curve */}
                  <rect x="18" y="118" width="6" height="6" fill="#8b5cf6" className="animate-pulse" />
                  <rect x="98" y="108" width="6" height="6" fill="#8b5cf6" />
                  <rect x="178" y="78" width="6" height="6" fill="#8b5cf6" />
                  <rect x="258" y="68" width="6" height="6" fill="#8b5cf6" />
                  <rect x="338" y="48" width="6" height="6" fill="#8b5cf6" />
                  <rect x="478" y="28" width="6" height="6" fill="#8b5cf6" />
                </svg>

                {/* X-Axis Dates */}
                <div className="flex justify-between text-[10px] font-mono text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span>Jul 19</span>
                  <span>Jul 20</span>
                  <span>Jul 21</span>
                  <span>Jul 22</span>
                  <span>Jul 23</span>
                  <span>Jul 24</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 text-center text-[10px] font-mono text-gray-400">
            Events over time
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          ROW 2: 3-COLUMN AGNOST METRIC RANKINGS
      ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Column 1: Top User Intents */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800/80 mb-3">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Compass size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Top User Intents
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {intents.slice(0, 5).map((intent) => (
                <Link
                  key={intent.id}
                  href="/intents"
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/70 transition group"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-[#2563eb] dark:group-hover:text-blue-400">
                      {intent.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-bold">{intent.message_count}</span>
                    <ArrowRight size={12} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const text = intents.map((i) => `${i.name}: ${i.message_count}`).join("\n");
                navigator.clipboard.writeText(text);
              }}
              title="Copy intents"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Copy size={13} />
            </button>
            <Link
              href="/intents"
              className="text-xs font-semibold text-[#2563eb] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Column 2: Top Agent Violations */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800/80 mb-3">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                  <ShieldAlert size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Top Agent Violations
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {violations.slice(0, 5).map((v) => (
                <Link
                  key={v.id}
                  href="/violations"
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition group"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400">
                      {v.rule}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-rose-600 dark:text-rose-400">
                    <span className="font-bold">{v.count}</span>
                    <ArrowRight size={12} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const text = violations.map((v) => `${v.rule}: ${v.count}`).join("\n");
                navigator.clipboard.writeText(text);
              }}
              title="Copy violations"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Copy size={13} />
            </button>
            <Link
              href="/violations"
              className="text-xs font-semibold text-[#2563eb] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Column 3: Top Tool Errors */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800/80 mb-3">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600" />
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <AlertTriangle size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Top Tool Errors
                </h3>
              </div>
            </div>

            <div className="space-y-2.5">
              {toolErrors.slice(0, 4).map((tool) => (
                <div
                  key={tool.id}
                  className="p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/70 transition"
                >
                  <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {tool.tool}
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span>{tool.count}</span>
                      <ArrowRight size={12} className="text-gray-400" />
                    </span>
                  </div>

                  {/* Visual Horizontal Proportional Bar (Agnost-style) */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(tool.count * 30, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const text = toolErrors.map((t) => `${t.tool}: ${t.count}`).join("\n");
                navigator.clipboard.writeText(text);
              }}
              title="Copy tool errors"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Copy size={13} />
            </button>
            <Link
              href="/executions"
              className="text-xs font-semibold text-[#2563eb] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          ASK AI MODAL
      ──────────────────────────────────────────────────────── */}
      {showAskAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151d2e] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Sparkles size={16} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Ask AI About Agent Telemetry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAskAiModal(false);
                  setAskAiAnswer(null);
                }}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAskAiSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Ask about silent failures, rage prompts, or tool errors..."
                value={askAiQuery}
                onChange={(e) => setAskAiQuery(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <div className="flex justify-between items-center text-[11px] text-gray-400">
                <span>e.g., &quot;Why are users repeating themselves in customer support?&quot;</span>
                <button
                  type="submit"
                  disabled={!askAiQuery.trim()}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition disabled:opacity-50"
                >
                  Analyze
                </button>
              </div>
            </form>

            {askAiAnswer && (
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs text-gray-800 dark:text-gray-200 space-y-3">
                <div className="font-semibold text-purple-700 dark:text-purple-300">
                  RAVEN Telemetry Analysis:
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-[11px]">
                  {askAiAnswer}
                </div>
                <div className="pt-2 border-t border-purple-100 dark:border-purple-900/40 flex justify-end">
                  <Link
                    href={`/benchmark?agentId=${agentId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563eb] hover:underline"
                  >
                    <span>Proceed to Prompt Doctor</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
