"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Copy,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  getAgentAnalyticsOverview,
  getAgents,
  type Agent,
  type AgentViolationItem,
} from "@/lib/api";
import { LiveEventsTicker } from "@/components/agnost/LiveEventsTicker";

export default function ViolationsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [violations, setViolations] = useState<AgentViolationItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeFilter, setTimeFilter] = useState("All time");
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("Quality");

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const agRes = await getAgents();
        const loadedAgents = agRes.agents || [];
        setAgents(loadedAgents);
        const cs = loadedAgents.find((a) => a.name.toLowerCase().includes("customer support")) || loadedAgents[0];
        const aId = cs ? cs.id : 1;
        setSelectedAgentId(aId);

        const ovRes = await getAgentAnalyticsOverview(aId);
        if (ovRes.violations) {
          setViolations(ovRes.violations);
        }
      } catch (err) {
        console.warn("Violations load notice:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleAgentChange(id: number) {
    setSelectedAgentId(id);
    setLoading(true);
    try {
      const ovRes = await getAgentAnalyticsOverview(id);
      if (ovRes.violations) {
        setViolations(ovRes.violations);
      }
    } catch (err) {
      console.warn("Agent violations change error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const newV: AgentViolationItem = {
      id: Date.now(),
      rule: newRuleName.trim(),
      count: 1,
      trend: "+100%",
      last_seen: "Just now",
    };
    setViolations([newV, ...violations]);
    setNewRuleName("");
    setShowNewRuleModal(false);
  }

  const filteredViolations = violations.filter((v) =>
    v.rule.toLowerCase().includes(search.toLowerCase())
  );

  function copyViolationsMd() {
    const md = `# Agent Policy Violations & Guardrails Audit
**Agent ID**: #${selectedAgentId}
**Total Violations**: ${violations.reduce((acc, v) => acc + v.count, 0)}
**Generated**: ${new Date().toISOString()}

| Rule | # Violations | Trend | vs Prior ALL | Last Seen |
| :--- | :---: | :---: | :---: | :---: |
${violations.map((v) => `| ${v.rule} | ${v.count} | ${v.trend} | ${v.trend} | ${v.last_seen} |`).join("\n")}
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* ────────────────────────────────────────────────────────
          TOP HEADER: Title, Timeframe, Filters, Copy & Ask AI
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">
              Violations
            </h1>
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(Number(e.target.value))}
                className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-3 pr-8 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-2xs hover:bg-gray-50 focus:outline-none"
              >
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-2.5 pointer-events-none text-gray-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time policy guardrails, silent failure tracking &amp; conversational drift compliance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-3 pr-8 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 focus:outline-none"
            >
              <option>All time</option>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none text-gray-400" />
          </div>

          <button
            type="button"
            onClick={copyViolationsMd}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 transition"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
            <span>{copied ? "Copied!" : "Copy violations.md"}</span>
          </button>

          <Link
            href="/benchmark"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-500/25 transition active:scale-[0.98]"
          >
            <Sparkles size={13} />
            <span>Ask AI</span>
          </Link>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          TOP METRIC GRAPH: 25 Violations Spike Chart (Agnost-style)
      ──────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>25 Violations</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              Spike Flagged
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Resolution: Real-time telemetry pulse
          </span>
        </div>

        {/* Line graph with red spike */}
        <div className="relative h-48 w-full pt-2">
          <div className="absolute left-0 top-1 bottom-6 flex flex-col justify-between text-[10px] font-mono text-gray-400">
            <span>27</span>
            <span>18</span>
            <span>9</span>
            <span>0</span>
          </div>

          <div className="ml-8 h-full flex flex-col justify-between">
            <svg className="w-full h-36 overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 120">
              <line x1="0" y1="0" x2="700" y2="0" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="700" y2="40" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="700" y2="80" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="700" y2="120" stroke="currentColor" className="text-gray-200 dark:text-gray-700" />

              {/* Red spike line (flat at 0 then surges at 1:35 -> 1:50) */}
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.2"
                points="20,120 120,120 220,120 320,120 420,120 520,120 620,40 680,20"
              />

              {/* Red square markers */}
              <rect x="18" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="118" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="218" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="318" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="418" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="518" y="118" width="5" height="5" fill="#f43f5e" />
              <rect x="618" y="38" width="5" height="5" fill="#f43f5e" />
              <rect x="678" y="18" width="5" height="5" fill="#f43f5e" className="animate-pulse" />
            </svg>

            {/* Time labels matching Agnost */}
            <div className="flex justify-between text-[10px] font-mono text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span>0:20</span>
              <span>0:35</span>
              <span>0:50</span>
              <span>1:05</span>
              <span>1:20</span>
              <span>1:35</span>
              <span>1:50</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          SEARCH & NEW RULE ACTION BAR
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-9 pr-4 py-2.5 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 shadow-2xs"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowNewRuleModal(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-4 py-2.5 text-xs font-semibold shadow-sm shadow-blue-500/25 transition"
        >
          <Plus size={13} />
          <span>New rule</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────
          VIOLATIONS TABLE (Identical to Agnost AI Violations Table)
      ──────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <th className="w-10 px-4 py-3 text-center">
                  <span className="h-3.5 w-3.5 rounded-full border border-gray-300 dark:border-gray-600 inline-block" />
                </th>
                <th className="px-4 py-3 font-semibold">Rule</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    # Violations <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="px-6 py-3 font-semibold">Trend</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    vs Prior ALL <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Last seen <ArrowUpDown size={11} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No matching violations found.
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-rose-50/40 dark:hover:bg-rose-950/10 transition group"
                  >
                    <td className="px-4 py-3.5 text-center">
                      <span className="h-4 w-4 rounded-full border border-gray-300 dark:border-gray-600 inline-block hover:border-rose-500 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-gray-900 dark:text-white underline decoration-dotted decoration-gray-300 dark:decoration-gray-700 underline-offset-4 cursor-pointer hover:text-rose-600">
                        {v.rule}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                      {v.count}
                    </td>
                    <td className="px-6 py-3.5">
                      {/* Red Surge Sparkline (Agnost-style) */}
                      <svg className="w-20 h-5" viewBox="0 0 80 20">
                        <path
                          d="M 0 16 L 20 16 L 40 16 L 55 16 L 80 4"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {v.trend}
                    </td>
                    <td className="px-4 py-3.5 text-right text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {v.last_seen}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          NEW RULE MODAL
      ──────────────────────────────────────────────────────── */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151d2e] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-600" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Add New Policy &amp; Guardrail Rule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRuleModal(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Rule Description / Behavioral Guardrail
                </label>
                <input
                  type="text"
                  placeholder="e.g., Never confirm order cancellation without verifying refund status"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={newRuleCategory}
                    onChange={(e) => setNewRuleCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs"
                  >
                    <option>Quality &amp; Truthfulness</option>
                    <option>Compliance &amp; Privacy</option>
                    <option>Safety &amp; Authorization</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Severity
                  </label>
                  <select className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs">
                    <option>HIGH (Immediate Alert)</option>
                    <option>MEDIUM (Flag in Report)</option>
                    <option>LOW (Telemetry Only)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newRuleName.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Live Events Ticker */}
      <LiveEventsTicker agentId={selectedAgentId} />
    </main>
  );
}
