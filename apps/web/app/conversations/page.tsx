"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import ApiKeyBanner from "@/components/telemetry/ApiKeyBanner";
import { useTelemetryKey } from "@/lib/telemetry-key";
import { listTelemetryConversations, type TelemetryConversationItem } from "@/lib/api";

export default function ConversationsPage() {
  const { apiKey, setApiKey } = useTelemetryKey();
  const [items, setItems] = useState<TelemetryConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [errorOnly, setErrorOnly] = useState(false);
  const [tool, setTool] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiKey) return;
    setError(null);
    try {
      const res = await listTelemetryConversations(apiKey, {
        q: q || undefined, error: errorOnly ? true : undefined,
        tool: tool || undefined, model: model || undefined, limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [apiKey, q, errorOnly, tool, model]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <Link href="/observe" className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ArrowLeft size={13} /> Observe
      </Link>
      <h1 className="text-xl font-bold">Conversations <span className="text-sm font-normal text-gray-400">({total})</span></h1>
      <ApiKeyBanner apiKey={apiKey} onSave={setApiKey} />
      {error && <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search session id…"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs" />
        <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="Tool name…"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs" />
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model…"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs" />
        <button type="button" onClick={() => setErrorOnly(!errorOnly)}
          className={`rounded-xl px-3 py-2 text-xs font-bold ${errorOnly ? "bg-rose-600 text-white" : "border border-gray-200 dark:border-gray-700"}`}>
          Errors only
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
              <th className="px-4 py-3 font-semibold">Session</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Traces</th>
              <th className="px-4 py-3 font-semibold">Errors</th>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Started</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-2.5">
                  <Link href={`/conversations/${c.id}`} className="font-mono font-semibold text-blue-600 hover:underline">
                    {c.external_id}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${c.errors > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                    {c.errors > 0 ? "error" : c.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">{c.traces}</td>
                <td className="px-4 py-2.5">{c.errors}</td>
                <td className="px-4 py-2.5 font-mono">{c.user || "—"}</td>
                <td className="px-4 py-2.5 font-mono">{c.agent_version || "—"}</td>
                <td className="px-4 py-2.5 text-gray-400">{c.started_at?.slice(0, 16).replace("T", " ") || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No conversations match — ingest traffic to see it here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
