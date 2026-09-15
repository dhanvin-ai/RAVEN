"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  getAgentAnalyticsOverview,
  getAgents,
  type Agent,
  type UserIntentItem,
} from "@/lib/api";
import { LiveEventsTicker } from "@/components/agnost/LiveEventsTicker";

export default function IntentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [intents, setIntents] = useState<UserIntentItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeFilter, setTimeFilter] = useState("All time");

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
        if (ovRes.intents) {
          setIntents(ovRes.intents);
        }
      } catch (err) {
        console.warn("Intents load notice:", err);
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
      if (ovRes.intents) {
        setIntents(ovRes.intents);
      }
    } catch (err) {
      console.warn("Agent intents change error:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredIntents = intents.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  function copyIntentsMd() {
    const md = `# User Intents Discovery Report
**Agent ID**: #${selectedAgentId}
**Total Intents**: ${intents.length}
**Generated**: ${new Date().toISOString()}

| User Intent | # Messages | Trend | vs Prior Period | Last Seen | Suggested |
| :--- | :---: | :---: | :---: | :---: | :---: |
${intents.map((i) => `| ${i.name} | ${i.message_count} | ${i.trend} | ${i.trend} | ${i.last_seen} | ${i.suggested ? "Yes" : "No"} |`).join("\n")}
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
              Intents
            </h1>
            <div className="relative">
              <select
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(Number(e.target.value))}
                className="appearance-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-3 pr-8 py-1.5 text-xs font-semibold text-[#2563eb] dark:text-blue-400 shadow-2xs hover:bg-gray-50 focus:outline-none"
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
            Semantic discovery, conversation topic clustering &amp; user intent volume trends
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
            onClick={copyIntentsMd}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-2xs hover:bg-gray-50 transition"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
            <span>{copied ? "Copied!" : "Copy intents.md"}</span>
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
          TOP METRIC GRAPH: 30 Matches Timeline Chart (Agnost-style)
      ──────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-gray-900 dark:text-white">
            30 Matches
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            Intents cluster resolution: High
          </span>
        </div>

        {/* Line graph with coordinate dots */}
        <div className="relative h-48 w-full pt-2">
          <div className="absolute left-0 top-1 bottom-6 flex flex-col justify-between text-[10px] font-mono text-gray-400">
            <span>6</span>
            <span>4</span>
            <span>2</span>
            <span>0</span>
          </div>

          <div className="ml-8 h-full flex flex-col justify-between">
            <svg className="w-full h-36 overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 120">
              <line x1="0" y1="0" x2="700" y2="0" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="40" x2="700" y2="40" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="700" y2="80" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="700" y2="120" stroke="currentColor" className="text-gray-200 dark:text-gray-700" />

              {/* Purple timeline polyline */}
              <polyline
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                points="20,60 120,60 220,80 320,60 420,60 520,60 620,20 680,100"
              />

              {/* Data points */}
              <rect x="18" y="58" width="5" height="5" fill="#a855f7" />
              <rect x="118" y="58" width="5" height="5" fill="#a855f7" />
              <rect x="218" y="78" width="5" height="5" fill="#a855f7" />
              <rect x="318" y="58" width="5" height="5" fill="#a855f7" />
              <rect x="418" y="58" width="5" height="5" fill="#a855f7" />
              <rect x="518" y="58" width="5" height="5" fill="#a855f7" />
              <rect x="618" y="18" width="5" height="5" fill="#a855f7" />
              <rect x="678" y="98" width="5" height="5" fill="#a855f7" />
            </svg>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] font-mono text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span>23:50</span>
              <span>0:05</span>
              <span>0:20</span>
              <span>0:35</span>
              <span>0:50</span>
              <span>1:05</span>
              <span>1:20</span>
              <span>1:35</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          SEARCH & INTENT ACTIONS BAR
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search intents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-[#151d2e] pl-9 pr-4 py-2.5 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition shadow-2xs"
          >
            <Sliders size={13} className="text-gray-500" />
            <span>Custom Instructions</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition shadow-sm"
          >
            <Plus size={13} />
            <span>New User Intent</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          INTENTS TABLE (Identical to Agnost AI Intents Table)
      ──────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <th className="w-10 px-4 py-3 text-center">
                  <span className="h-3.5 w-3.5 rounded-full border border-gray-300 dark:border-gray-600 inline-block" />
                </th>
                <th className="px-4 py-3 font-semibold">User intent</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    # Messages <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="px-6 py-3 font-semibold">Trend</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    vs Prior 1 day <ArrowUpDown size={11} />
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
              {filteredIntents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No matching intents found.
                  </td>
                </tr>
              ) : (
                filteredIntents.map((intent) => {
                  const isPositive = intent.trend.startsWith("+");
                  const isNegative = intent.trend.startsWith("-");

                  return (
                    <tr
                      key={intent.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition"
                    >
                      <td className="px-4 py-3.5 text-center">
                        <span className="h-4 w-4 rounded-full border border-gray-300 dark:border-gray-600 inline-block hover:border-purple-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white underline decoration-dotted decoration-gray-300 dark:decoration-gray-700 underline-offset-4 cursor-pointer hover:text-[#2563eb]">
                            {intent.name}
                          </span>
                          {intent.suggested && (
                            <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50">
                              Suggested
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                        {intent.message_count}
                      </td>
                      <td className="px-6 py-3.5">
                        {/* Mini SVG Sparkline */}
                        <svg className="w-20 h-5" viewBox="0 0 80 20">
                          {isPositive ? (
                            <path
                              d="M 0 16 L 20 16 L 40 4 L 60 4 L 80 2"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          ) : isNegative ? (
                            <path
                              d="M 0 4 L 20 8 L 40 6 L 60 16 L 80 18"
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          ) : (
                            <path
                              d="M 0 10 L 20 10 L 40 10 L 60 10 L 80 10"
                              fill="none"
                              stroke="#9ca3af"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          )}
                        </svg>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        <span
                          className={
                            isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isNegative
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-gray-500 dark:text-gray-400"
                          }
                        >
                          {intent.trend}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                        {intent.last_seen}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Persistent Live Events Ticker */}
      <LiveEventsTicker agentId={selectedAgentId} />
    </main>
  );
}
