"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import ApiKeyBanner from "@/components/telemetry/ApiKeyBanner";
import { BarRow } from "@/components/telemetry/charts";
import { useTelemetryKey } from "@/lib/telemetry-key";
import { listTelemetryToolCalls } from "@/lib/api";

export default function ToolCallsPage() {
  const { apiKey, setApiKey } = useTelemetryKey();
  const [data, setData] = useState<Awaited<ReturnType<typeof listTelemetryToolCalls>> | null>(null);
  const [outcome, setOutcome] = useState("");
  const [tool, setTool] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiKey) return;
    setError(null);
    try {
      setData(await listTelemetryToolCalls(apiKey, {
        outcome: outcome || undefined, tool: tool || undefined, limit: 100,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [apiKey, outcome, tool]);

  useEffect(() => { load(); }, [load]);

  const maxCalls = Math.max(1, ...(data?.summary.map((s) => s.calls) || [1]));

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <Link href="/observe" className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ArrowLeft size={13} /> Observe
      </Link>
      <h1 className="text-xl font-bold">Tool calls <span className="text-sm font-normal text-gray-400">({data?.total ?? 0})</span></h1>
      <ApiKeyBanner apiKey={apiKey} onSave={setApiKey} />
      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Reliability by tool</div>
        {(data?.summary || []).map((s) => (
          <BarRow key={s.tool} label={s.tool} value={s.calls} max={maxCalls}
            color={s.error_rate > 0 ? "#dc2626" : "#2563eb"}
            right={`${s.calls} calls · ${(s.error_rate * 100).toFixed(1)}% err`} />
        ))}
        {(data?.summary.length || 0) === 0 && <span className="text-xs text-gray-400">No tool calls yet</span>}
      </div>

      <div className="flex gap-2">
        <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="Tool name…"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs" />
        <button type="button" onClick={() => setOutcome(outcome === "error" ? "" : "error")}
          className={`rounded-xl px-3 py-2 text-xs font-bold ${outcome === "error" ? "bg-rose-600 text-white" : "border border-gray-200 dark:border-gray-700"}`}>
          Errors only
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
              <th className="px-4 py-3 font-semibold">Tool</th>
              <th className="px-4 py-3 font-semibold">Outcome</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Trace</th>
              <th className="px-4 py-3 font-semibold">Result</th>
              <th className="px-4 py-3 font-semibold">At</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((t) => (
              <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800/50">
                <td className="px-4 py-2.5 font-mono font-semibold">{t.tool}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${t.outcome === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {t.outcome}
                  </span>
                </td>
                <td className="px-4 py-2.5">{t.latency_ms != null ? `${t.latency_ms} ms` : "—"}</td>
                <td className="px-4 py-2.5 font-mono text-gray-500">{t.trace_id.slice(0, 18)}</td>
                <td className="max-w-64 truncate px-4 py-2.5 font-mono text-gray-500">{JSON.stringify(t.result)}</td>
                <td className="px-4 py-2.5 text-gray-400">{t.started_at?.slice(0, 16).replace("T", " ") || "—"}</td>
              </tr>
            ))}
            {(data?.items.length || 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No tool calls match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
