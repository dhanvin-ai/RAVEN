// @ts-nocheck
"use client";

import {
  GitBranch,
  Bot,
  ChevronDown,
  Plus,
  RefreshCw,
  Code2,
  Terminal,
  XCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  getAgents,
  getAgentVersions,
  createAgentVersion,
  type Agent,
  type AgentVersion,
} from "@/lib/api";

const DEFAULT_AGENT_ID = 3;

export default function VersionsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(DEFAULT_AGENT_ID);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Create form state
  const [newModel, setNewModel] = useState("nemotron 3 ultra");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Compare state
  const [compareV1, setCompareV1] = useState<string>("");
  const [compareV2, setCompareV2] = useState<string>("");

  // Expand state
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedVersions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setError(null);
      
      const agentsData = await getAgents();
      setAgents(agentsData.agents || []);

      if (agentsData.agents && agentsData.agents.length > 0 && !agentsData.agents.find(a => a.id === selectedAgentId)) {
        setSelectedAgentId(agentsData.agents[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load agents.");
    } finally {
      if (showRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  const loadVersions = async (agentId: number) => {
    try {
      setRefreshing(true);
      const data = await getAgentVersions(agentId);
      // Sort by version descending
      const sorted = [...data].sort((a, b) => b.version - a.version);
      setVersions(sorted);
      if (sorted.length > 0) {
        if (!newPrompt) setNewPrompt(sorted[0].system_prompt);
        if (!newModel) setNewModel(sorted[0].model);
        
        // Default compare
        if (sorted.length >= 2) {
          setCompareV1(sorted[0].id);
          setCompareV2(sorted[1].id);
        } else if (sorted.length === 1) {
          setCompareV1(sorted[0].id);
          setCompareV2(sorted[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load versions.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      loadVersions(selectedAgentId);
    }
  }, [selectedAgentId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModel || !newPrompt) return;
    
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      await createAgentVersion(selectedAgentId, {
        model: newModel,
        system_prompt: newPrompt
      });
      setCreateSuccess(true);
      setNewPrompt("");
      loadVersions(selectedAgentId);
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create version.");
    } finally {
      setCreating(false);
    }
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

  const selectedV1 = versions.find(v => v.id.toString() === compareV1);
  const selectedV2 = versions.find(v => v.id.toString() === compareV2);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1500px] px-6 py-6">
        <header className="mb-6 flex history-center justify-between">
          <div>
            <div className="mb-1 flex history-center gap-2">
              <GitBranch size={18} className="text-[var(--purple-bright)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                RAVEN / Versions
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Version Management</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Compare and manage agent versions across deployments.</p>
          </div>
          <div className="flex history-center gap-4">
            <div className="relative w-64">
              <select 
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3.5 py-3 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
            <button
              onClick={() => loadVersions(selectedAgentId)}
              disabled={refreshing}
              className="flex history-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex history-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--red)]">Error loading versions</div>
              <div className="mt-1 text-sm text-[var(--foreground)]">{error}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<Plus size={18} />} title="Create New Version" />
              
              {createError && (
                <div className="mb-4 flex history-start gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-bg)] px-4 py-3">
                  <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--red)]" />
                  <div className="text-xs text-[var(--foreground)]">{createError}</div>
                </div>
              )}
              
              {createSuccess && (
                <div className="mb-4 flex history-start gap-3 rounded-xl border border-[var(--green)]/30 bg-[var(--green-bg)] px-4 py-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--green)]" />
                  <div className="text-xs text-[var(--green)]">Version created successfully.</div>
                </div>
              )}
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Model
                  </label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={e => setNewModel(e.target.value)}
                    placeholder="e.g. nemotron 3 ultra"
                    required
                    className="w-full rounded-lg border border-[var(--border-light)] bg-[#101012] px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--purple)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    System Prompt
                  </label>
                  <textarea
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                    placeholder="You are an AI assistant..."
                    required
                    className="min-h-[200px] w-full rounded-lg border border-[var(--border-light)] bg-[#101012] px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--purple)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating || !newModel || !newPrompt}
                  className="flex w-full history-center justify-center gap-2 rounded-lg bg-[var(--purple)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--purple-bright)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                  Create Version
                </button>
              </form>
            </section>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <SectionHeader icon={<Bot size={18} />} title="Version List" />
              
              {versions.length === 0 ? (
                <div className="flex min-h-[180px] history-center justify-center">
                  <div className="text-center">
                    <GitBranch size={24} className="mx-auto mb-3 text-[var(--muted-dark)]" />
                    <p className="text-sm text-[var(--muted)]">No versions yet.</p>
                    <p className="mt-1 text-xs text-[var(--muted-dark)]">Create a new version to get started.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map(version => (
                    <div key={version.id} className="rounded-lg border border-[var(--border)] bg-[#111113] overflow-hidden">
                      <div 
                        className="flex cursor-pointer history-center justify-between p-4 transition hover:bg-[#151517]"
                        onClick={() => toggleExpand(version.id)}
                      >
                        <div className="flex history-center gap-4">
                          <span className="rounded-md bg-[var(--purple)]/20 px-2 py-1 text-xs font-bold text-[var(--purple-bright)]">
                            v{version.version}
                          </span>
                          <div className="flex history-center gap-2 text-sm">
                            <Terminal size={14} className="text-[var(--muted)]" />
                            <span className="font-medium text-[var(--foreground)]">{version.model_name}</span>
                          </div>
                        </div>
                        <div className="flex history-center gap-3">
                          <div className="hidden max-w-md truncate text-xs text-[var(--muted)] md:block">
                            {version.system_prompt.length > 120 ? version.system_prompt.substring(0, 120) + "..." : version.system_prompt}
                          </div>
                          <Eye size={16} className="text-[var(--muted)]" />
                        </div>
                      </div>
                      {expandedVersions[version.id] && (
                        <div className="border-t border-[var(--border)] p-4 bg-[#0b0b0d]">
                          <CodePanel 
                            title={`System Prompt (v${version.version})`} 
                            icon={<Code2 size={16} />} 
                            value={version.system_prompt} 
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {versions.length > 0 && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <SectionHeader icon={<GitBranch size={18} />} title="Version Comparison" />
                
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Version A</label>
                    <div className="relative">
                      <select 
                        value={compareV1}
                        onChange={(e) => setCompareV1(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                      >
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>v{v.version} ({v.model})</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Version B</label>
                    <div className="relative">
                      <select 
                        value={compareV2}
                        onChange={(e) => setCompareV2(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-[var(--border-light)] bg-[#101012] px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--purple)]"
                      >
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>v{v.version} ({v.model})</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    {selectedV1 ? (
                      <CodePanel 
                        title={`v${selectedV1.version} Prompt`}
                        icon={<Code2 size={16} />} 
                        value={selectedV1.system_prompt} 
                      />
                    ) : (
                      <div className="flex h-32 history-center justify-center rounded-lg border border-[var(--border)] bg-[#0b0b0d]">
                        <span className="text-sm text-[var(--muted)]">Select Version A</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedV2 ? (
                      <CodePanel 
                        title={`v${selectedV2.version} Prompt`}
                        icon={<Code2 size={16} />} 
                        value={selectedV2.system_prompt} 
                      />
                    ) : (
                      <div className="flex h-32 history-center justify-center rounded-lg border border-[var(--border)] bg-[#0b0b0d]">
                        <span className="text-sm text-[var(--muted)]">Select Version B</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Helper components
function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-4 flex history-center gap-2 border-b border-[var(--border)] pb-3">
      <span className="text-[var(--purple)]">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
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
      <div className="flex history-center gap-2 border-b border-[var(--border)] bg-[#111113] px-4 py-3">
        <span className="text-[var(--muted)]">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</span>
      </div>
      <pre className="max-h-[320px] overflow-auto bg-[#0b0b0d] p-4 text-xs leading-6 text-[#d4d4d8] whitespace-pre-wrap break-words">
        {formatted || "{}"}
      </pre>
    </div>
  );
}
