"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import ApiKeyBanner from "@/components/telemetry/ApiKeyBanner";
import { useTelemetryKey } from "@/lib/telemetry-key";
import { getTelemetryConversation, type TelemetryConversation } from "@/lib/api";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[11px] text-blue-600 hover:underline">raw JSON</summary>
      <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-gray-900 p-3 font-mono text-[11px] text-gray-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { apiKey, setApiKey } = useTelemetryKey();
  const [conv, setConv] = useState<TelemetryConversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    getTelemetryConversation(apiKey, Number(id))
      .then(setConv)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [apiKey, id]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <Link href="/conversations" className="flex items-center gap-1 text-xs font-semibold text-blue-600">
        <ArrowLeft size={13} /> Conversations
      </Link>
      <ApiKeyBanner apiKey={apiKey} onSave={setApiKey} />
      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {conv && (
        <>
          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
            <div className="font-mono text-lg font-bold">{conv.external_id}</div>
            <div className="mt-1 text-xs text-gray-500">
              {conv.traces.length} traces · {conv.events.length} events · {conv.message_count} messages · {conv.status}
            </div>
          </div>

          {conv.traces.map((trace) => (
            <div key={trace.id} className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold">{trace.trace_id}</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${trace.status === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {trace.status}
                </span>
                {trace.provider && <span className="font-mono text-gray-500">{trace.provider}/{trace.model}</span>}
                {trace.latency_ms != null && <span className="text-gray-500">{trace.latency_ms} ms</span>}
                {(trace.input_tokens != null || trace.output_tokens != null) && (
                  <span className="text-gray-500">↑{trace.input_tokens ?? 0} ↓{trace.output_tokens ?? 0}</span>
                )}
                {trace.cost_usd != null && <span className="text-gray-500">${trace.cost_usd.toFixed(5)}</span>}
              </div>

              <div className="mt-3 space-y-1.5 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                {trace.spans.map((span) => (
                  <div key={span.id}
                    className={`rounded-xl px-3 py-2 text-xs ${span.status === "error" ? "bg-rose-50 dark:bg-rose-950/30" : "bg-gray-50 dark:bg-gray-800/40"}`}
                    style={{ marginLeft: span.parent_span_id ? 20 : 0 }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 font-mono text-[10px]">{span.kind}</span>
                      <span className="font-mono font-semibold">{span.name}</span>
                      {span.tool_name && <span className="font-mono text-blue-600">🔧 {span.tool_name}</span>}
                      {span.model && <span className="font-mono text-violet-600">🧠 {span.model}</span>}
                      {span.latency_ms != null && <span className="text-gray-400">{span.latency_ms} ms</span>}
                    </div>
                  </div>
                ))}
                {trace.spans.length === 0 && <span className="text-xs text-gray-400">No spans recorded</span>}
              </div>
            </div>
          ))}

          <div className="rounded-3xl border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#151d2e] p-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Events</div>
            {conv.events.map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-1 text-xs">
                <span className="font-mono text-gray-500">{e.occurred_at?.slice(11, 19)}</span>
                <span className="font-mono font-semibold">{e.kind}</span>
                <span className="text-gray-500">{e.name}</span>
              </div>
            ))}
            {conv.events.length === 0 && <span className="text-xs text-gray-400">No events</span>}
            <JsonBlock value={conv} />
          </div>
        </>
      )}
    </main>
  );
}
