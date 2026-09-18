import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../services/api';
import type { BacktestLaunchRequest, BacktestPresetInfo } from '../types/api';
import { GlassCard } from '../components/GlassCard';

function presetKey(p: { preset: string; variant: string }): string {
  return `${p.preset}/${p.variant}`;
}

export function ControlTower() {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: api.getSystemStatus,
    refetchInterval: 30000,
  });

  const presetsQuery = useQuery({
    queryKey: ['backtestPresets'],
    queryFn: api.getBacktestPresets,
  });

  const launchMutation = useMutation({
    mutationFn: (request: BacktestLaunchRequest) => api.launchBacktest(request),
    onSuccess: (accepted) => {
      // Queue status supplies run_id before execution — the job page owns
      // the handoff to /backtests/live/:runId. Never auto-detect another
      // active run for a queued request.
      navigate({ to: '/backtests/jobs/$jobId', params: { jobId: accepted.job_id } });
    },
  });

  const presets = presetsQuery.data ?? [];
  const selected: BacktestPresetInfo | null =
    presets.find((p) => presetKey(p) === selectedKey) ?? null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    launchMutation.mutate({ preset: selected.preset, variant: selected.variant });
  };

  return (
    <div className="animate-fade-in grid gap-4 lg:grid-cols-2">
      <GlassCard>
        <h2 className="page-title mb-5">System Status</h2>
        <div className="flex flex-col gap-3">
          {[
            {
              label: 'Rust Core',
              content: statusLoading ? (
                <span className="badge bg-white/5 text-[var(--color-text-muted)]">Checking</span>
              ) : status ? (
                <span className="badge bg-[var(--color-green-muted)] text-positive">v{status.rust_core_version}</span>
              ) : (
                <span className="badge bg-[var(--color-red-muted)] text-negative">Offline</span>
              ),
            },
            {
              label: 'SIMD Enabled',
              content: (
                <span className={`badge ${status?.rust_simd_enabled ? 'bg-[var(--color-green-muted)] text-positive' : 'bg-white/5 text-[var(--color-text-muted)]'}`}>
                  {status?.rust_simd_enabled ? 'True' : 'False'}
                </span>
              ),
            },
            { label: 'Active Agents', content: <span className="font-mono text-[var(--color-gold-accent)] font-bold">{status?.active_agents || 0}</span> },
            { label: 'LLM Latency', content: <span className="font-mono text-[var(--color-blue)]">{status?.llm_api_latency_ms || 0} ms</span> },
            { label: 'DB Size', content: <span className="font-mono text-[var(--color-blue)]">{status?.database_size_mb || 0} MB</span> },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] last:border-0">
              <span className="text-[var(--color-text-secondary)] text-sm">{row.label}</span>
              {row.content}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="page-title mb-2">Launch Backtest</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          Approve one reviewed F2 condition and queue it through Tower's durable
          queue. Raw config fields, CLI arguments, paths and provider settings
          are not accepted here.
        </p>

        {presetsQuery.isLoading && (
          <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Loading conditions…</p>
        )}

        {presetsQuery.error && (
          <div className="rounded-lg border border-red-500/30 bg-[var(--color-red-muted)] px-4 py-3 text-negative text-sm">
            <span className="font-bold">Failed to load conditions:</span>{' '}
            {presetsQuery.error instanceof Error ? presetsQuery.error.message : String(presetsQuery.error)}
          </div>
        )}

        {!presetsQuery.isLoading && !presetsQuery.error && presets.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            No reviewed conditions are available from the server right now.
          </p>
        )}

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {presets.map((p) => {
              const key = presetKey(p);
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(isSelected ? null : key)}
                  className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                    isSelected
                      ? 'border-[var(--color-gold-accent)] bg-[var(--color-gold-muted)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-hover)] hover:border-[var(--color-gold-accent)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-[var(--color-text-primary)]">{key}</span>
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">
                      ~{p.estimated_minutes_min}–{p.estimated_minutes_max} min
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{p.description}</p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] p-4 flex flex-col gap-3">
              <div>
                <span className="section-title">Resolved Parameters</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(selected.parameters).map(([key, value]) => (
                    <span key={key} className="badge bg-white/5 text-[var(--color-text-secondary)] font-mono">
                      {key}={value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
                <span>
                  Baseline run:{' '}
                  <span className="font-mono text-[var(--color-text-secondary)]">{selected.historical_baseline_run_id}</span>
                </span>
                <span>
                  Estimated runtime:{' '}
                  <span className="font-mono text-[var(--color-text-secondary)]">
                    {selected.estimated_minutes_min}–{selected.estimated_minutes_max} min
                  </span>
                </span>
                <span>
                  Host concurrency limit:{' '}
                  <span className="font-mono text-[var(--color-text-secondary)]">{selected.max_parallel}</span>
                  {' '}— one queued request claims a single worker slot.
                </span>
              </div>
            </div>
          )}

          {launchMutation.isError && (
            <div className="rounded-lg border border-red-500/30 bg-[var(--color-red-muted)] px-4 py-3 text-negative text-sm">
              <span className="font-bold">Launch rejected:</span>{' '}
              {launchMutation.error instanceof Error ? launchMutation.error.message : String(launchMutation.error)}
            </div>
          )}

          <button
            type="submit"
            disabled={!selected || launchMutation.isPending}
            className="btn btn-primary mt-2"
          >
            {launchMutation.isPending
              ? 'Queueing…'
              : selected
                ? `Approve & launch ${presetKey(selected)}`
                : 'Select a condition to launch'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
