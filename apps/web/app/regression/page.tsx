// @ts-nocheck
"use client";

import {
  GitBranch,
  Bot,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Save,
  Clock3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  getAgents,
  getRegressionSummary,
  detectRegression,
  getRegressionDecision,
  saveRegressionDecision,
  getRegressionDecisionHistory,
  getReliabilityVersions,
  type Agent,
  type RegressionSummary,
  type RegressionDetection,
  type RegressionDecision,
  type RegressionDecisionHistoryResponse,
  type RegressionDecisionHistoryItem,
  type VersionPerformance,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function RegressionDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<number>(DEFAULT_AGENT_ID);
  
  const [summary, setSummary] = useState<RegressionSummary | null>(null);
  const [detection, setDetection] = useState<RegressionDetection | null>(null);
  const [decision, setDecision] = useState<RegressionDecision | null>(null);
  const [history, setHistory] = useState<RegressionDecisionHistoryItem[]>([]);
  const [versions, setVersions] = useState<VersionPerformance[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  const loadData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      if (agents.length === 0) {
        const agentsData = await getAgents();
        setAgents(agentsData.agents || []);
      }
      const [sumRes, detRes, decRes, histRes, versRes] = await Promise.allSettled([
        getRegressionSummary(id),
        detectRegression(id),
        getRegressionDecision(id),
        getRegressionDecisionHistory(id),
        getReliabilityVersions(id)
      ]);
      
      setSummary(sumRes.status === "fulfilled" ? sumRes.value : null);
      setDetection(detRes.status === "fulfilled" ? detRes.value : null);
      setDecision(decRes.status === "fulfilled" ? decRes.value : null);
      setHistory(histRes.status === "fulfilled" ? (histRes.value?.history || []) : []);
      setVersions(versRes.status === "fulfilled" ? (versRes.value || []) : []);
    } catch (err: any) {
      setError(err.message || "Failed to load regression data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(agentId);
  }, [agentId]);

  const handleSaveDecision = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      await saveRegressionDecision(agentId);
      const hist = await getRegressionDecisionHistory(agentId);
      setHistory(hist.history || []);
    } catch (err: any) {
      setError(err.message || "Failed to save decision");
    } finally {
      setSaving(false);
    }
  };

  const toggleHistoryItem = (id: string) => {
    setExpandedHistory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
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

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">
        <header className="mb-6 flex history-center justify-between">
          <div>
            <div className="mb-1 flex history-center gap-2">
              <GitBranch size={18} className="text-[var(--purple-bright)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Regression
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Regression Analysis</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Detect regressions, review CI gate decisions, and track version performance.
            </p>
          </div>
          <div className="flex history-center gap-4">
            <div className="relative w-64">
              <select 
                value={agentId}
                onChange={(e) => setAgentId(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-3 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
            <button 
              onClick={() => loadData(agentId)}
              className="flex h-11 w-11 history-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] transition hover:bg-[var(--panel-hover)]"
            >
              <RefreshCw size={18} className="text-[var(--muted)]" />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex history-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--red)]">Error</div>
              <div className="mt-1 text-sm text-[var(--foreground)]">{error}</div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-[var(--border)] md:grid-cols-4">
            <ResultMetric label="Total Versions" value={summary.total_versions.toString()} />
            <ResultMetric 
              label="Total Regressions" 
              value={summary.total_regressions.toString()} 
              valueColor={summary.total_regressions > 0 ? 'text-[var(--red)]' : undefined} 
            />
            <ResultMetric 
              label="Total Improvements" 
              value={summary.total_improvements.toString()} 
              valueColor={summary.total_improvements > 0 ? 'text-[var(--green)]' : undefined} 
            />
            <div className="bg-[var(--panel)] p-5">
              <div className="text-sm text-[var(--muted)]">Overall Trend</div>
              <div className="mt-2 flex history-center gap-2">
                {summary.overall_trend === 'IMPROVING' && <TrendingUp size={20} className="text-[var(--green)]" />}
                {summary.overall_trend === 'REGRESSING' && <TrendingDown size={20} className="text-[var(--red)]" />}
                {summary.overall_trend === 'STABLE' && <Minus size={20} className="text-[var(--yellow)]" />}
                <div className="text-xl font-semibold tracking-tight">{summary.overall_trend}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Latest Regression Detection */}
          <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex history-center gap-2">
              <Activity size={18} className="text-[var(--purple)]" />
              <h2 className="text-base font-semibold">Latest Regression Detection</h2>
            </div>
            
            {detection?.status === 'NO_DATA' ? (
              <EmptyState icon={<AlertTriangle size={24} className="text-[var(--muted-dark)]" />} message="No Data" description="Insufficient data to detect regressions." />
            ) : detection?.status === 'INSUFFICIENT_HISTORY' || (!detection?.success && detection?.message) ? (
              <div className="flex-1 space-y-4">
                <div className="flex history-center justify-between rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="text-sm font-medium text-[var(--muted)]">Regression Detected</span>
                  <span className="rounded-md bg-[var(--green-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--green)]">NO</span>
                </div>
                <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="block text-sm font-medium text-[var(--muted)]">Status</span>
                  <span className="mt-1 block text-base font-semibold text-[var(--green)]">Single Version Baseline Established</span>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Baseline v{decision?.current_version || 1} active. Run evaluations on a new version to detect score changes and regressions.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Current Version</span>
                    <span className="mt-1 block text-base font-semibold">v{decision?.current_version || 1}</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">Score: {decision?.current_reliability_score?.toFixed(2) ?? '100.00'}</span>
                  </div>
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Direction</span>
                    <span className="mt-1 block text-base font-semibold text-[var(--yellow)]">BASELINE</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">Change: 0.00</span>
                  </div>
                </div>
              </div>
            ) : detection ? (
              <div className="flex-1 space-y-4">
                <div className="flex history-center justify-between rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="text-sm font-medium text-[var(--muted)]">Regression Detected</span>
                  {detection.regression_detected ? (
                    <span className="rounded-md bg-[var(--red-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--red)]">YES</span>
                  ) : (
                    <span className="rounded-md bg-[var(--green-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--green)]">NO</span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Direction</span>
                    <span className={`mt-1 block text-lg font-semibold ${
                      detection.direction === 'IMPROVED' ? 'text-[var(--green)]' :
                      detection.direction === 'REGRESSED' ? 'text-[var(--red)]' : 'text-[var(--yellow)]'
                    }`}>{detection.direction}</span>
                  </div>
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Score Change</span>
                    <span className={`mt-1 flex items-center gap-1 text-lg font-semibold ${
                      (detection.score_change ?? 0) > 0 ? 'text-[var(--green)]' :
                      (detection.score_change ?? 0) < 0 ? 'text-[var(--red)]' : 'text-[var(--yellow)]'
                    }`}>
                      {(detection.score_change ?? 0) > 0 ? <ArrowUpRight size={18} /> : 
                       (detection.score_change ?? 0) < 0 ? <ArrowDownRight size={18} /> : <Minus size={18} />}
                      {(detection.score_change ?? 0) > 0 ? '+' : ''}{(detection.score_change ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Baseline Version</span>
                    <span className="mt-1 block text-base font-semibold">{detection.baseline_version_id || 'N/A'}</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">Score: {detection.baseline_score?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Current Version</span>
                    <span className="mt-1 block text-base font-semibold">{detection.current_version_id || 'N/A'}</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">Score: {detection.current_score?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={<AlertTriangle size={24} className="text-[var(--muted-dark)]" />} message="No Data" description="Could not load detection data." />
            )}
          </section>

          {/* CI Gate Status */}
          <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex history-center gap-2">
              <ShieldCheck size={18} className="text-[var(--purple)]" />
              <h2 className="text-base font-semibold">CI Gate Status</h2>
            </div>

            {decision ? (
              <div className="flex-1 space-y-4">
                <div className="flex history-center justify-between rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="text-sm font-medium text-[var(--muted)]">Decision</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    (decision.decision === 'APPROVE' || decision.decision === 'PASS') ? 'bg-[var(--green-bg)] text-[var(--green)]' :
                    (decision.decision === 'REJECT' || decision.decision === 'FAIL') ? 'bg-[var(--red-bg)] text-[var(--red)]' :
                    'bg-[var(--yellow-bg)] text-[var(--yellow)]'
                  }`}>{decision.decision}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">CI Gate Status</span>
                    <span className={`mt-1 inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                      decision.ci_gate.status === 'PASS' ? 'bg-[var(--green-bg)] text-[var(--green)]' : 'bg-[var(--red-bg)] text-[var(--red)]'
                    }`}>{decision.ci_gate.status}</span>
                  </div>
                  <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <span className="block text-sm font-medium text-[var(--muted)]">Allowed</span>
                    <span className={`mt-1 inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                      decision.ci_gate.allowed ? 'bg-[var(--green-bg)] text-[var(--green)]' : 'bg-[var(--red-bg)] text-[var(--red)]'
                    }`}>{decision.ci_gate.allowed ? 'TRUE' : 'FALSE'}</span>
                  </div>
                </div>
                
                <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="block text-sm font-medium text-[var(--muted)]">Severity Level</span>
                  <span className="mt-1 block text-base font-semibold text-[var(--foreground)]">{decision.severity}</span>
                </div>

                <div className="rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                  <span className="block text-sm font-medium text-[var(--muted)]">Reason</span>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--foreground)]">{decision.reason || 'No specific reason provided.'}</p>
                </div>

                <button 
                  onClick={handleSaveDecision}
                  disabled={saving}
                  className="mt-2 flex w-full history-center justify-center gap-2 rounded-lg bg-[var(--purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--purple-bright)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            ) : (
               <EmptyState icon={<AlertTriangle size={24} className="text-[var(--muted-dark)]" />} message="No Data" description="Could not load decision data." />
            )}
          </section>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Decision History */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex history-center gap-2">
              <Clock3 size={18} className="text-[var(--purple)]" />
              <h2 className="text-base font-semibold">Decision History</h2>
            </div>
            
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.decision_id} className="overflow-hidden rounded-lg border border-[var(--border-light)] bg-[#101012]">
                    <div 
                      className="flex cursor-pointer history-center justify-between p-4 hover:bg-[#151518]"
                      onClick={() => toggleHistoryItem(item.decision_id)}
                    >
                      <div className="flex history-center gap-3">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          item.decision === 'APPROVE' ? 'bg-[var(--green-bg)] text-[var(--green)]' :
                          item.decision === 'REJECT' ? 'bg-[var(--red-bg)] text-[var(--red)]' :
                          'bg-[var(--yellow-bg)] text-[var(--yellow)]'
                        }`}>{item.decision}</span>
                        <span className="text-sm font-medium">V: {item.current_version_id}</span>
                      </div>
                      <div className="flex history-center gap-3 text-sm text-[var(--muted)]">
                        <span>{new Date(item.decision_id).toLocaleString()}</span>
                        {expandedHistory[item.decision_id] ? <ChevronUp size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                    {expandedHistory[item.decision_id] && (
                      <div className="border-t border-[var(--border-light)] bg-[#0b0b0d] p-4 text-xs text-[#d4d4d8]">
                        <div className="grid grid-cols-2 gap-y-2">
                          <div className="text-[var(--muted)]">Baseline Version:</div><div>{item.baseline_version_id || 'N/A'}</div>
                          <div className="text-[var(--muted)]">Baseline Score:</div><div>{item.baseline_reliability_score?.toFixed(2) ?? 'N/A'}</div>
                          <div className="text-[var(--muted)]">Current Score:</div><div>{item.current_reliability_score?.toFixed(2) ?? 'N/A'}</div>
                          <div className="text-[var(--muted)]">Score Change:</div><div>{item.reliability_change?.toFixed(2) ?? 'N/A'}</div>
                          <div className="text-[var(--muted)]">Regression Count:</div><div>{item.new_failure_count}</div>
                          <div className="text-[var(--muted)]">Improvement Count:</div><div>{item.new_pass_count}</div>
                          <div className="text-[var(--muted)]">Direction:</div><div>{item.direction}</div>
                          <div className="text-[var(--muted)]">Severity Level:</div><div>{item.severity}</div>
                          <div className="text-[var(--muted)]">CI Gate Status:</div><div>{item.ci_gate.status}</div>
                          <div className="col-span-2 mt-2 pt-2 border-t border-[var(--border-light)]">
                            <span className="text-[var(--muted)] block mb-1">Reason:</span>
                            {item.reason || 'None'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Clock3 size={24} className="text-[var(--muted-dark)]" />} message="No History" description="No regression decisions recorded." />
            )}
          </section>

          {/* Version Performance Timeline */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex history-center gap-2">
              <Bot size={18} className="text-[var(--purple)]" />
              <h2 className="text-base font-semibold">Version Performance</h2>
            </div>
            
            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.version} className="flex history-center justify-between rounded-lg border border-[var(--border-light)] bg-[#101012] p-4">
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{version.version}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">Reliability Score</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-[var(--foreground)]">{version.reliability_score.toFixed(2)}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">Pass Rate: {(version.pass_rate * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Bot size={24} className="text-[var(--muted-dark)]" />} message="No Versions" description="No version performance data available." />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// Helpers
function ResultMetric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-[var(--panel)] p-5">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className={`mt-2 text-xl font-semibold tracking-tight ${valueColor || 'text-[var(--foreground)]'}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ icon, message, description }: { icon: ReactNode; message: string; description: string }) {
  return (
    <div className="flex min-h-[180px] history-center justify-center rounded-lg border border-dashed border-[var(--border-light)] bg-[#101012]/50">
      <div className="text-center">
        <div className="mx-auto flex justify-center mb-3 text-[var(--muted-dark)]">{icon}</div>
        <p className="text-sm text-[var(--muted)]">{message}</p>
        <p className="mt-1 text-xs text-[var(--muted-dark)]">{description}</p>
      </div>
    </div>
  );
}
