"use client";

import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Cpu,
  HardDrive,
  Network,
  Terminal,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Box,
  XOctagon
} from "lucide-react";
import { useState, type ReactNode } from "react";

// Types
type TestResult = {
  allowed: boolean;
  category?: string;
  reason?: string;
  severity?: string;
};

// Client-side guardrail logic
const BLOCKED_COMMANDS = new Set([
  'rm', 'rmdir', 'mkfs', 'mount', 'umount', 'fdisk', 'shutdown', 'reboot', 'poweroff'
]);

const BLOCKED_PATTERNS: Record<string, string> = {
  'docker': 'CONTAINER_ESCAPE',
  'kubectl': 'CONTAINER_ESCAPE',
  'sudo': 'PRIVILEGE_ESCALATION',
  'su ': 'PRIVILEGE_ESCALATION',
  'chmod 777': 'PERMISSION_ABUSE',
  'chown root': 'PRIVILEGE_ESCALATION',
  '/dev/': 'DEVICE_ACCESS',
  '/proc/': 'SYSTEM_ACCESS',
  '/sys/': 'SYSTEM_ACCESS',
};

function testCommand(cmd: string): TestResult {
  const trimmed = cmd.trim();
  if (!trimmed) {
    return { allowed: true };
  }

  // Check blocked commands (first word)
  const firstWord = trimmed.split(/\s+/)[0];
  if (BLOCKED_COMMANDS.has(firstWord)) {
    return {
      allowed: false,
      category: 'BLOCKED_COMMAND',
      reason: `Command '${firstWord}' is strictly forbidden.`,
      severity: 'HIGH',
    };
  }

  // Check patterns
  for (const [pattern, category] of Object.entries(BLOCKED_PATTERNS)) {
    if (trimmed.includes(pattern)) {
      return {
        allowed: false,
        category,
        reason: `Command matches forbidden pattern '${pattern}'.`,
        severity: category === 'CONTAINER_ESCAPE' || category === 'PRIVILEGE_ESCALATION' ? 'CRITICAL' : 'HIGH',
      };
    }
  }

  return { allowed: true };
}

export default function SecurityPage() {
  const [testCmd, setTestCmd] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(testCommand(testCmd));
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Shield size={18} className="text-[var(--purple-bright)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Security
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Security & Sandbox</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Inspect sandbox configuration, guardrail rules, and test command safety.</p>
          </div>
          <button className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--panel-hover)]">
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Status Cards */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)]">
                <SectionHeader icon={<Lock size={18} />} title="Sandbox configuration" />
              </div>
              <div className="grid grid-cols-1 gap-px bg-[var(--border)] md:grid-cols-2">
                <ResultMetric icon={<Network size={16} />} label="Network Isolation" value="ON" active desc="Docker --network none" />
                <ResultMetric icon={<HardDrive size={16} />} label="Read-only Filesystem" value="ON" active desc="Docker --read-only" />
                <ResultMetric icon={<ShieldCheck size={16} />} label="Non-root Execution" value="ON" active desc="User 1000:1000" />
                <ResultMetric icon={<Cpu size={16} />} label="Memory Limit" value="256MB" desc="Docker --memory 256m" />
                <ResultMetric icon={<Cpu size={16} />} label="CPU Limit" value="0.5 cores" desc="Docker --cpus 0.5" />
                <ResultMetric icon={<Box size={16} />} label="PID Limit" value="64" desc="Docker --pids-limit 64" />
              </div>
            </section>

            {/* Docker template */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<Terminal size={18} />} title="Sandbox Configuration Template" />
              <div className="mt-4">
                <CodePanel
                  title="Docker Command Template"
                  icon={<Terminal size={14} />}
                  value={`docker run --rm --network none --memory 256m --cpus 0.5 --pids-limit 64 --read-only --security-opt no-new-privileges --user 1000:1000 --tmpfs /tmp:rw,noexec,nosuid,size=64m python:3.12-slim sh -c "<command>"`}
                />
              </div>
            </section>
            
            {/* Guardrail Tester */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<ShieldAlert size={18} />} title="Guardrail Tester" />
              <form onSubmit={handleTest} className="mt-4 flex gap-3">
                <input
                  type="text"
                  value={testCmd}
                  onChange={(e) => setTestCmd(e.target.value)}
                  placeholder="Enter a command to test (e.g. ls -la, rm -rf /)"
                  className="flex-1 rounded-lg border border-[var(--border-light)] bg-[#101012] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--purple)]"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--purple-bright)] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!testCmd.trim()}
                >
                  <Play size={16} fill="currentColor" />
                  Test Command
                </button>
              </form>

              {testResult && (
                <div className="mt-4">
                  {testResult.allowed ? (
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--green)]/30 bg-[var(--green-bg)] px-4 py-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--green)]" />
                      <div>
                        <div className="text-sm font-semibold text-[var(--green)]">ALLOWED</div>
                        <div className="mt-1 text-sm text-[var(--foreground)]">Command passes all guardrail checks and is safe to run.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
                      <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--red)]">BLOCKED</span>
                          <span className="rounded bg-[var(--red)]/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--red)]">
                            {testResult.severity}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-[var(--foreground)]">{testResult.reason}</div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                          <AlertTriangle size={14} />
                          Category: {testResult.category}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<XOctagon size={18} />} title="Blocked Commands" />
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[#111113]">
                <div className="grid grid-cols-2 gap-4 border-b border-[var(--border)] p-4 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  <div>Command</div>
                  <div>Status</div>
                </div>
                <div className="max-h-[250px] divide-y divide-[var(--border)] overflow-auto">
                  {Array.from(BLOCKED_COMMANDS).map((cmd) => (
                    <div key={cmd} className="grid grid-cols-2 items-center gap-4 p-4 text-sm hover:bg-[#1a1a1c]">
                      <div className="font-mono text-[var(--foreground)]">{cmd}</div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--red-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--red)]">
                          <XCircle size={14} />
                          BLOCKED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<AlertTriangle size={18} />} title="Blocked Patterns" />
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[#111113]">
                <div className="grid grid-cols-2 gap-4 border-b border-[var(--border)] p-4 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  <div>Pattern</div>
                  <div>Category</div>
                </div>
                <div className="max-h-[350px] divide-y divide-[var(--border)] overflow-auto">
                  {Object.entries(BLOCKED_PATTERNS).map(([pattern, category]) => {
                    const isCritical = category === 'CONTAINER_ESCAPE' || category === 'PRIVILEGE_ESCALATION';
                    return (
                      <div key={pattern} className="grid grid-cols-2 items-center gap-4 p-4 text-sm hover:bg-[#1a1a1c]">
                        <div className="font-mono text-[#d4d4d8]">"{pattern}"</div>
                        <div>
                          <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            isCritical ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--yellow-bg)] text-[var(--yellow)]'
                          }`}>
                            {category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

// Helpers
function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1d] text-[var(--muted)]">
        {icon}
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function ResultMetric({ icon, label, value, active, desc }: { icon: ReactNode; label: string; value: string; active?: boolean; desc?: string }) {
  return (
    <div className="bg-[var(--panel)] p-4">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="text-lg font-semibold">{value}</div>
        {active && (
          <span className="rounded-md bg-[var(--green-bg)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--green)]">
            ON
          </span>
        )}
      </div>
      {desc && <div className="mt-1.5 text-xs font-mono text-[var(--muted-dark)]">{desc}</div>}
    </div>
  );
}

function CodePanel({ title, icon, value }: { title: string; icon: ReactNode; value: unknown }) {
  let formatted = "";
  try {
    formatted = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    formatted = String(value);
  }
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[#111113] px-4 py-3">
        <span className="text-[var(--muted)]">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</span>
      </div>
      <pre className="whitespace-pre-wrap break-all bg-[#0b0b0d] p-4 text-sm leading-relaxed text-[#d4d4d8]">
        {formatted || "{}"}
      </pre>
    </div>
  );
}
