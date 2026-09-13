// @ts-nocheck
"use client";

import {
  ShieldCheck,
  Bot,
  ChevronDown,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Gauge,
  Play,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getAgents,
  getReliability,
  getLatestReliability,
  getReliabilityHistory,
  compareReliabilityReports,
  type Agent,
  type ReliabilityReport,
  type ReliabilityComparison,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function ReliabilityDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(DEFAULT_AGENT_ID);
  
  const [report, setReport] = useState<ReliabilityReport | null>(null);
  const [history, setHistory] = useState<ReliabilityReport[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Comparison State
  const [baselineId, setBaselineId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string>("");
  const [comparison, setComparison] = useState<ReliabilityComparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);
        
        const agentsData = await getAgents();
        setAgents(agentsData.agents || []);
        
        await loadAgentData(DEFAULT_AGENT_ID);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reliability data.");
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
  }, []);

  async function loadAgentData(agentId: number) {
    const latest = await getLatestReliability(agentId);
    setReport(latest);
    
    const hist = await getReliabilityHistory(agentId);
    setHistory(hist);
    
    if (hist.length >= 2) {
      setBaselineId(hist[1].id);
      setCurrentId(hist[0].id);
    } else if (hist.length === 1) {
      setCurrentId(hist[0].id);
      setBaselineId(hist[0].id);
    }
  }

  async function handleAgentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = parseInt(e.target.value, 10);
    setSelectedAgentId(newId);
    try {
      setLoading(true);
      setComparison(null);
      await loadAgentData(newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data for agent.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateReport() {
    try {
      setGenerating(true);
      setError(null);
      const newReport = await getReliability(selectedAgentId);
      setReport(newReport);
      
      const hist = await getReliabilityHistory(selectedAgentId);
      setHistory(hist);
      
      if (hist.length >= 2) {
        setBaselineId(hist[1].id);
        setCurrentId(hist[0].id);
      }
      setComparison(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCompare() {
    if (!baselineId || !currentId) return;
    try {
      setComparing(true);
      setCompareError(null);
      const result = await compareReliabilityReports(baselineId, currentId);
      setComparison(result);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Failed to compare reports.");
    } finally {
      setComparing(false);
    }
  }

  if (loading && !report) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-screen history-center justify-center">
          <div className="flex history-center gap-3 text-sm text-[var(--muted)]">
            <RefreshCw size={16} className="animate-spin" />
            Loading...
          </div>
        </div>
      </main>
    );
  }

  const renderReliabilityColor = (score: number) => {
    if (score >= 80) return "text-[var(--green)]";
    if (score >= 50) return "text-[var(--yellow)]";
    return "text-[var(--red)]";
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "RELIABLE") return <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-[var(--green-bg)] text-[var(--green)]">RELIABLE</span>;
    if (s === "DEGRADED") return <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-[var(--yellow-bg)] text-[var(--yellow)]">DEGRADED</span>;
    if (s === "CRITICAL") return <span className="rounded-md px-2.5 py-1 text-xs font-semibold bg-[var(--red-bg)] text-[var(--red)]">CRITICAL</span>;
    return <span className="rounded-md bg-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">{s}</span>;
  };

  const totalSeverities = report ? 
    (report.severity_breakdown.LOW || 0) + 
    (report.severity_breakdown.MEDIUM || 0) + 
    (report.severity_breakdown.HIGH || 0) + 
    (report.severity_breakdown.CRITICAL || 0) : 0;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">
        <header className="mb-6 flex history-center justify-between">
          <div>
            <div className="mb-1 flex history-center gap-2">
              <ShieldCheck size={18} className="text-[var(--purple-bright)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Reliability
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reliability Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Monitor agent reliability scores, failure breakdowns, and historical trends.</p>
          </div>
          <div className="flex history-center gap-4">
            <div className="relative min-w-[200px]">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <Bot size={16} />
              </div>
              <select 
                className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] pl-10 pr-10 py-2.5 text-sm outline-none transition focus:border-[var(--purple)]"
                value={selectedAgentId}
                onChange={handleAgentChange}
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
            <button 
              onClick={handleGenerateReport} 
              disabled={generating}
              className="flex history-center gap-2 rounded-lg bg-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--purple-bright)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Generate Report
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex history-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--red)]">Error loading data</div>
              <div className="mt-1 text-sm text-[var(--foreground)]">{error}</div>
            </div>
          </div>
        )}

        {!report && !loading && !error ? (
          <div className="flex min-h-[180px] history-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)]">
            <div className="text-center">
              <Activity size={24} className="mx-auto mb-3 text-[var(--muted-dark)]" />
              <p className="text-sm text-[var(--muted)]">No reliability report available.</p>
              <p className="mt-1 text-xs text-[var(--muted-dark)]">Click Generate Report to create one.</p>
            </div>
          </div>
        ) : report ? (
          <div className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="mb-2 text-sm font-medium text-[var(--muted)]">Reliability Score</div>
                <div className={`text-4xl font-bold tracking-tight ${renderReliabilityColor(report.reliability_score)}`}>
                  {report.reliability_score.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="mb-2 text-sm font-medium text-[var(--muted)]">Pass Rate</div>
                <div className="text-4xl font-bold tracking-tight">
                  {report.pass_rate.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="mb-2 text-sm font-medium text-[var(--muted)]">Status</div>
                <div className="mt-1">
                  {getStatusBadge(report.status)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
              <ResultMetric label="Total Scenarios" value={report.total_scenarios?.toString() ?? "0"} />
              <ResultMetric label="Passed" value={report.passed?.toString() ?? "0"} valueClass="text-[var(--green)]" />
              <ResultMetric label="Failed" value={report.failed?.toString() ?? "0"} valueClass="text-[var(--red)]" />
              <ResultMetric label="Agent Version" value={report.id?.toString() ?? "—"} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <SectionHeader icon={<AlertTriangle size={16} />} title="Severity Breakdown" />
                {totalSeverities === 0 ? (
                  <div className="py-8 text-center text-sm text-[var(--muted)]">No severity data available</div>
                ) : (
                  <div className="mt-4 flex flex-col gap-3">
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => {
                      const count = (report.severity_breakdown as any)[level] || 0;
                      const percentage = (count / totalSeverities) * 100;
                      let color = "var(--green)";
                      if (level === "MEDIUM") color = "var(--yellow)";
                      if (level === "HIGH") color = "#f97316";
                      if (level === "CRITICAL") color = "var(--red)";
                      
                      return (
                        <div key={level} className="flex history-center gap-3">
                          <div className="w-20 text-xs font-semibold text-[var(--muted)]">{level}</div>
                          <div className="flex-1 h-3 overflow-hidden rounded-full bg-[var(--border-light)]">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: color }}
                            />
                          </div>
                          <div className="w-8 text-right text-sm font-medium">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <SectionHeader icon={<BarChart3 size={16} />} title="Failure Classification" />
                {Object.keys(report.failure_classification_breakdown).length === 0 ? (
                  <div className="py-8 text-center text-sm text-[var(--muted)]">No failure classification data available</div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {Object.entries(report.failure_classification_breakdown).map(([type, count]) => (
                      <div key={type} className="flex flex-col justify-center rounded-lg border border-[var(--border-light)] bg-[#111113] p-3">
                        <div className="truncate text-xs font-medium text-[var(--muted)]" title={type}>{type.replace(/_/g, ' ')}</div>
                        <div className="mt-1 text-xl font-semibold">{String(count)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<Activity size={16} />} title="Compare Reports" />
              <div className="mt-4 flex flex-wrap history-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-2 block text-xs font-medium text-[var(--muted)]">Baseline Report</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                      value={baselineId}
                      onChange={e => setBaselineId(e.target.value)}
                    >
                      {history.map(h => (
                        <option key={h.id} value={h.id}>
                          Report #{h.id} — {(h.reliability_score ?? 0).toFixed(1)}%
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  </div>
                </div>
                
                <div className="flex h-10 w-10 history-center justify-center shrink-0">
                  <ArrowRight size={18} className="text-[var(--muted)]" />
                </div>
                
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-2 block text-xs font-medium text-[var(--muted)]">Current Report</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                      value={currentId}
                      onChange={e => setCurrentId(e.target.value)}
                    >
                      {history.map(h => (
                        <option key={h.id} value={h.id}>
                          Report #{h.id} — {(h.reliability_score ?? 0).toFixed(1)}%
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  </div>
                </div>
                
                <button 
                  onClick={handleCompare}
                  disabled={comparing || !baselineId || !currentId}
                  className="flex history-center gap-2 rounded-lg border border-[var(--border)] bg-[#111113] px-5 py-2.5 text-sm font-medium transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
                >
                  {comparing ? <RefreshCw size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                  Compare
                </button>
              </div>

              {compareError && (
                <div className="mt-4 rounded-lg bg-[var(--red-bg)] px-4 py-2.5 text-sm text-[var(--red)]">
                  {compareError}
                </div>
              )}

              {comparison && (
                <div className="mt-6 rounded-lg border border-[var(--border-light)] p-4">
                  <h4 className="mb-4 text-sm font-semibold">Comparison Results</h4>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <ComparisonMetric 
                      label="Score Delta" 
                      value={comparison.comparison.reliability_change} 
                      suffix="%"
                      positiveIsGood={true}
                    />
                    <ComparisonMetric 
                      label="Pass Rate Delta" 
                      value={comparison.comparison.pass_rate_change} 
                      suffix="%"
                      positiveIsGood={true}
                    />
                    <ComparisonMetric 
                      label="Failed Scenarios" 
                      value={comparison.current.failed - comparison.baseline.failed} 
                      positiveIsGood={false}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<RefreshCw size={16} />} title="Report History" />
              {history.length === 0 ? (
                <div className="flex min-h-[100px] history-center justify-center">
                  <span className="text-sm text-[var(--muted)]">No history available</span>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {history.map((hist) => (
                    <details key={hist.id} className="group rounded-lg border border-[var(--border-light)] bg-[#111113]">
                      <summary className="flex cursor-pointer items-center justify-between p-4 focus:outline-none">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">Report #{hist.id}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-bold ${renderReliabilityColor(hist.reliability_score)}`}>{(hist.reliability_score ?? 0).toFixed(1)}%</span>
                          {getStatusBadge(hist.status)}
                          <ChevronDown size={16} className="text-[var(--muted)] transition-transform group-open:rotate-180" />
                        </div>
                      </summary>
                      <div className="border-t border-[var(--border-light)] p-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-[var(--muted)]">Pass Rate</div>
                            <div className="mt-1 text-sm font-medium">{hist.pass_rate.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-[var(--muted)]">Scenarios (P/F/T)</div>
                            <div className="mt-1 text-sm font-medium text-[var(--muted)]">
                              <span className="text-[var(--green)]">{hist.passed}</span> / <span className="text-[var(--red)]">{hist.failed}</span> / {hist.total_scenarios}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[var(--muted)]">Agent Version</div>
                            <div className="mt-1 text-sm font-medium">{hist.agent_version_id}</div>
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
            
          </div>
        ) : null}
      </div>
    </main>
  );
}

// Helpers
function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex history-center gap-2 border-b border-[var(--border-light)] pb-3">
      <span className="text-[var(--purple)]">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function ResultMetric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-[var(--panel)] p-4 transition hover:bg-[var(--panel-hover)]">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass || ""}`}>{value}</div>
    </div>
  );
}

function ComparisonMetric({ label, value, suffix = "", positiveIsGood = true }: { label: string; value: number; suffix?: string; positiveIsGood?: boolean }) {
  const isZero = value === 0;
  const isPositive = value > 0;
  
  let colorClass = "text-[var(--muted)]";
  let Icon = Minus;
  
  if (!isZero) {
    if ((isPositive && positiveIsGood) || (!isPositive && !positiveIsGood)) {
      colorClass = "text-[var(--green)]";
    } else {
      colorClass = "text-[var(--red)]";
    }
    Icon = isPositive ? TrendingUp : TrendingDown;
  }
  
  return (
    <div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`mt-1 flex history-center gap-1 text-lg font-semibold ${colorClass}`}>
        {!isZero && <Icon size={16} />}
        {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
      </div>
    </div>
  );
}
