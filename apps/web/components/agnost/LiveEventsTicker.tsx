"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  User,
  Wrench,
  X,
} from "lucide-react";
import {
  getLiveAnalyticsEvents,
  type AnalyticsEventItem,
} from "@/lib/api";

interface LiveEventsTickerProps {
  agentId?: number;
  onSendToPromptDoctor?: (event: AnalyticsEventItem) => void;
}

export function LiveEventsTicker({
  agentId,
  onSendToPromptDoctor,
}: LiveEventsTickerProps) {
  const [events, setEvents] = useState<AnalyticsEventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AnalyticsEventItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      try {
        setLoading(true);
        const res = await getLiveAnalyticsEvents(agentId, 30);
        if (mounted && res.events) {
          setEvents(res.events);
        }
      } catch (err) {
        console.warn("Live events ticker fetch notice:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [agentId]);

  function handleDotClick(ev: AnalyticsEventItem) {
    setSelectedEvent(ev);
    setDrawerOpen(true);
  }

  return (
    <>
      {/* ────────────────────────────────────────────────────────
          PERSISTENT LIVE EVENTS TICKER BAR (Agnost AI Bottom Bar)
      ──────────────────────────────────────────────────────── */}
      <aside aria-label="Live Events Monitor" className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 text-xs">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-gray-900 dark:text-white tracking-tight">
                Live events
              </span>
            </div>
            <span className="hidden sm:inline text-[11px] text-gray-400 font-mono">
              ({events.length} pulses)
            </span>
          </div>

          {/* Center Stream of Pulse Blocks (Agnost-style) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-2 scrollbar-none max-w-2xl flex-1 justify-center">
            {events.length === 0 ? (
              <span className="text-[11px] text-gray-400 font-mono">Listening for live agent events...</span>
            ) : (
              events.map((ev) => {
                let color = "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400";
                if (ev.status === "FAILED" || ev.event_type === "SILENT_FAILURE") {
                  color = "bg-rose-500 hover:bg-rose-600 shadow-xs shadow-rose-500/40 animate-pulse";
                } else if (ev.status === "VIOLATION" || ev.event_type === "VIOLATION") {
                  color = "bg-rose-600 hover:bg-rose-700 shadow-xs shadow-rose-600/40";
                } else if (ev.event_type === "FRUSTRATION" || ev.status === "WARNING") {
                  color = "bg-amber-400 hover:bg-amber-500";
                } else if (ev.event_type === "TOOL_ERROR") {
                  color = "bg-rose-400 hover:bg-rose-500";
                } else if (ev.status === "SUCCESS") {
                  color = "bg-gray-300 dark:bg-gray-600 hover:bg-emerald-500";
                }

                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handleDotClick(ev)}
                    title={`${ev.event_type} - ${ev.user_identifier}: ${ev.user_message.slice(0, 40)}...`}
                    className={`h-3 w-1.5 rounded-xs transition-all transform hover:scale-125 shrink-0 ${color}`}
                  />
                );
              })
            )}
          </div>

          {/* Right Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (events.length > 0) {
                  setSelectedEvent(events[0]);
                  setDrawerOpen(true);
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-[#2563eb] dark:hover:text-blue-400 transition"
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ────────────────────────────────────────────────────────
          SLIDE-OVER TRACE INSPECTOR DRAWER
      ──────────────────────────────────────────────────────── */}
      {drawerOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-lg h-full bg-white dark:bg-[#111827] shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    selectedEvent.status === "FAILED" || selectedEvent.event_type === "SILENT_FAILURE"
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                      : selectedEvent.status === "VIOLATION"
                      ? "bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                  }`}
                >
                  {selectedEvent.status === "FAILED" ? (
                    <AlertOctagon size={18} />
                  ) : selectedEvent.status === "VIOLATION" ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      {selectedEvent.event_type.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                        selectedEvent.status === "FAILED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
                          : selectedEvent.status === "VIOLATION"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                      }`}
                    >
                      {selectedEvent.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Trace ID #{selectedEvent.id} · {selectedEvent.created_at}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* User Identity Card */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3.5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1.5">
                  <User size={12} />
                  <span>User Identifier</span>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {selectedEvent.user_identifier}
                </div>
              </div>

              {/* User Message */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-gray-400">User Input</div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/80 text-gray-800 dark:text-gray-200 leading-relaxed">
                  {selectedEvent.user_message}
                </div>
              </div>

              {/* Agent Output / Response */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1.5">
                  <Bot size={12} />
                  <span>Agent Stated Output</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-blue-950 dark:text-blue-200 leading-relaxed">
                  {selectedEvent.agent_response || "No text output returned."}
                </div>
              </div>

              {/* Detection Rationale */}
              {selectedEvent.details?.reason && (
                <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                    <AlertOctagon size={14} />
                    <span>Silent Failure / Frustration Root Cause</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-[11px]">
                    {selectedEvent.details.reason}
                  </p>
                </div>
              )}

              {/* Tool Execution Details if any */}
              {selectedEvent.tool_name && (
                <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-gray-400 flex items-center gap-1.5">
                      <Wrench size={12} />
                      Target Tool
                    </span>
                    <span className="font-mono font-bold text-[#2563eb] dark:text-blue-400">
                      {selectedEvent.tool_name}
                    </span>
                  </div>
                  {selectedEvent.details?.error && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-[10px] font-mono text-rose-700 dark:text-rose-300">
                      Error: {selectedEvent.details.error}
                    </div>
                  )}
                </div>
              )}

              {/* RAVEN Superpower: One-Click Prompt Doctor Healing */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 border border-blue-500/20 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#2563eb] dark:text-blue-400" />
                    <span className="font-bold text-gray-900 dark:text-white text-xs">
                      RAVEN Prompt Doctor Auto-Healer
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300">
                    Agnost AI only flags this failure. RAVEN can automatically generate a prompt constraint patch and run zero-regression benchmarks.
                  </p>
                  <Link
                    href={`/benchmark?agentId=${selectedEvent.agent_id}&autoFix=${selectedEvent.id}`}
                    onClick={() => setDrawerOpen(false)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs shadow-sm shadow-blue-500/25 transition"
                  >
                    <span>Auto-Patch Prompt with Doctor</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
              <span>Event logged via RAVEN Ingestion SDK</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="font-semibold text-gray-700 dark:text-gray-300 hover:underline"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
