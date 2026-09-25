"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import ApiKeyBanner from "@/components/telemetry/ApiKeyBanner";
import { useTelemetryKey } from "@/lib/telemetry-key";
import { listTelemetryEvents } from "@/lib/api";

export default function EventsPage() {
  const { apiKey, setApiKey } = useTelemetryKey();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listTelemetryEvents>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiKey) return;
    setError(null);
    try {
      const res = await listTelemetryEvents(apiKey, { kind: kind || undefined, limit: 100 });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [apiKey, kind]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <Link href="/observe" className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ArrowLeft size={13} /> Observe
      </Link>
      <h1 className="text-xl font-bold">Events <span className="text-sm font-normal text-gray-400">({total})</span></h1>
      <ApiKeyBanner apiKey={apiKey} onSave={setApiKey} />
      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="flex gap-2">
        <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Filter by kind…"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400">
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Kind</th>
              <th className="px-4 py-3 font-semibold">Conversation</th>
              <th className="px-4 py-3 font-semibold">Payload</th>
              <th className="px-4 py-3 font-semibold">At</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 dark:border-gray-800/50">
                <td className="px-4 py-2.5 font-mono">{e.event_id}</td>
                <td className="px-4 py-2.5 font-mono text-violet-600">{e.kind}</td>
                <td className="px-4 py-2.5">
                  {e.conversation_id
                    ? <Link href={`/conversations/${e.conversation_id}`} className="text-blue-600 hover:underline">#{e.conversation_id}</Link>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="max-w-64 truncate px-4 py-2.5 font-mono text-gray-500">{JSON.stringify(e.payload)}</td>
                <td className="px-4 py-2.5 text-gray-400">{e.occurred_at?.slice(0, 16).replace("T", " ") || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No events match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
