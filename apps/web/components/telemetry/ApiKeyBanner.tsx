"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

export default function ApiKeyBanner({
  apiKey,
  onSave,
}: {
  apiKey: string;
  onSave: (key: string) => void;
}) {
  const [draft, setDraft] = useState(apiKey);
  const [open, setOpen] = useState(!apiKey);

  if (!open && apiKey) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151d2e] px-4 py-2.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Project API key <span className="font-mono">…{apiKey.slice(-4)}</span> connected
        </span>
        <button
          type="button"
          onClick={() => { setDraft(apiKey); setOpen(true); }}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <KeyRound size={15} />
        Connect a project API key to view production telemetry
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/80">
        The API prints a dev key once at startup (<span className="font-mono">DEV API KEY</span> in the backend log).
        Keys are project-scoped — you only ever see your own project&apos;s data.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="rvn_…"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => { onSave(draft); setOpen(false); }}
          disabled={!draft.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
