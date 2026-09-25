"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, MessagesSquare, Radio, Table2, Wrench } from "lucide-react";

import ApiKeyBanner from "@/components/telemetry/ApiKeyBanner";
import { BarRow, StatCard, TimeseriesChart } from "@/components/telemetry/charts";
import { useTelemetryKey } from "@/lib/telemetry-key";
import {
  getTelemetryActivity,
  getTelemetryOverview,
  type TelemetryActivityItem,
  type TelemetryOverview,
} from "@/lib/api";

const TABS = [
  { href: "/conversations", icon: MessagesSquare, label: "Conversations" },
  { href: "/events", icon: Table2, label: "Events" },
  { href: "/tool-calls", icon: Wrench, label: "Tool calls" },
];

export default function ObservePage() {
  const { apiKey, setApiKey } = useTelemetryKey();
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<TelemetryOverview | null>(null);
  const [activity, setActivity] = useState<TelemetryActivityItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: string, d: number) => {
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, act] = await Promise.all([
        getTelemetryOverview(key, d),
        getTelemetryActivity(key, 0),
      ]);
      setOverview(ov);
      setActivity(act.items);
      setCursor(act.max_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(apiKey, days); }, [apiKey, days, load]);

  useEffect(() => {
    if (!apiKey) return;
    const timer = setInterval(async () => {
      try {
        const act = await getTelemetryActivity(apiKey, cursor);
        if (act.items.length) {
          setActivity((prev) => [...act.items, ...prev].slice(0, 50));
          setCursor(act.max_id);
        }
      } catch {
        /* live tail is best-effort; overview stays */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [apiKey, cursor]);

  const t = overview?.totals;
  const maxToolCalls = Math.max(1, ...(overview?.tools.map((x) => x.calls) || [1]));

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Activity size={20} className="text-blue-600" /> Observe
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Production telemetry — every metric below is computed from real ingested traces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${days === d
                ? "bg-blue-600 text-white"
                : "border border-gray-200 dark:border-gray-700 text-gray-500"}`}
            >
              {d}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => load(apiKey, days)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-bold"
          >
            Refresh
          </button>
        </div>
      </div>

      <ApiKeyBanner apiKey={apiKey} onSave={setApiKey} />

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error} — check the API key and that the backend is running.
        </div>
      )}

      {apiKey && !error && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Conversations" value={String(t?.conversations ?? "—")} />
            <StatCard label="Traces" value={String(t?.traces ?? "—")} />
            <StatCard label="Error rate" value={`${((t?.error_rate ?? 0) * 100).toFixed(1)}%`}
              accent={(t?.error_rate ?? 0) > 0.1 ? "text-rose-600" : "text-emerald-600"} />
            <StatCard label="p95 latency" value={overview?.latency_ms.p95 != null ? `${Math.round(overview.latency_ms.p95)} ms` : "—"} />
            <StatCard label="Tokens" value={(overview?.tokens.total ?? 0).toLocaleString()} />
            <StatCard label="Cost" value={`$${(overview?.cost_usd ?? 0).toFixed(4)}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 lg:col-span-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Conversations per day <span className="text-rose-500">● error days</span>
                <span className="ml-2 text-amber-600">- - p95 latency</span>
              </div>
              {overview && <TimeseriesChart points={overview.timeseries.map((p) => ({
                day: p.day, conversations: p.conversations, errors: p.errors, p95: p.p95_latency_ms,
              }))} />}
            </div>
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <Radio size={12} /> Live activity
              </div>
              <div className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
                {activity.length === 0 && <span className="text-gray-400">Waiting for events…</span>}
                {activity.map((a, i) => (
                  <div key={`${a.kind}-${a.id}-${i}`} className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${a.status === "error" ? "bg-rose-500" : "bg-emerald-500"}`} />
                    <span className="font-mono text-gray-600 dark:text-gray-300">
                      {a.kind === "trace" ? a.trace_id : a.event_id || a.name}
                    </span>
                    {a.conversation_id && (
                      <Link href={`/conversations/${a.conversation_id}`} className="text-blue-600 hover:underline">
                        #{a.conversation_id}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Tool reliability</div>
              {(overview?.tools || []).slice(0, 6).map((tool) => (
                <BarRow key={tool.tool} label={tool.tool} value={tool.calls} max={maxToolCalls}
                  color={tool.error_rate > 0 ? "#dc2626" : "#2563eb"}
                  right={`${tool.calls} · ${(tool.error_rate * 100).toFixed(1)}% err`} />
              ))}
              {(overview?.tools.length || 0) === 0 && <span className="text-xs text-gray-400">No tool calls yet</span>}
            </div>
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Models</div>
              {(overview?.models || []).map((m) => (
                <div key={`${m.provider}/${m.model}`} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="font-mono">{m.provider}/{m.model}</span>
                  <span className="text-gray-500">{m.traces} traces · ${m.cost_usd.toFixed(4)}</span>
                </div>
              ))}
              {(overview?.models.length || 0) === 0 && <span className="text-xs text-gray-400">No model calls yet</span>}
            </div>
            <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Top errors</div>
              {(overview?.top_errors || []).map((e) => (
                <div key={e.error_type} className="py-1.5 text-xs">
                  <div className="font-mono text-rose-600">{e.error_type} × {e.count}</div>
                  {e.sample && <div className="truncate text-gray-500">{e.sample}</div>}
                </div>
              ))}
              {(overview?.top_errors.length || 0) === 0 && <span className="text-xs text-gray-400">No errors — clean run</span>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {TABS.map((tab) => (
              <Link key={tab.href} href={tab.href}
                className="flex items-center gap-3 rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5 hover:shadow-md">
                <tab.icon size={18} className="text-blue-600" />
                <span className="text-sm font-bold">{tab.label}</span>
                <span className="ml-auto text-gray-300">→</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {loading && !overview && <p className="text-sm text-gray-400">Loading telemetry…</p>}
    </main>
  );
}
