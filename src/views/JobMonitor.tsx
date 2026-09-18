import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { KPICard } from '../components/KPICard';
import type { BacktestComparison } from '../types/api';

const TERMINAL_STATUSES = ['completed', 'failed', 'interrupted'] as const;

function isTerminal(status: string | undefined): boolean {
  return status != null && (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatComparisonScalar(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}

// The comparison payload is free-form by contract — fields vary when a
// baseline artifact is unavailable, so render every entry and mark nulls
// as explicitly missing rather than hiding them.
function ComparisonEntries({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <div className={depth > 0 ? 'ml-3 border-l border-[var(--color-border)] pl-3 flex flex-col gap-2' : 'flex flex-col gap-2'}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <div className="text-xs font-mono text-[var(--color-text-muted)]">{key}</div>
          {value == null ? (
            <div className="text-sm italic text-[var(--color-text-muted)]">
              — unavailable (missing baseline artifact)
            </div>
          ) : typeof value === 'object' ? (
            Array.isArray(value) ? (
              <pre className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-root)] border border-[var(--color-border)] rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <ComparisonEntries data={value as Record<string, unknown>} depth={depth + 1} />
            )
          ) : (
            <div className="text-sm font-mono text-[var(--color-text-primary)]">
              {formatComparisonScalar(value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ComparisonCard({ jobId, enabled }: { jobId: string; enabled: boolean }) {
  const comparisonQuery = useQuery({
    queryKey: ['jobComparison', jobId],
    queryFn: async (): Promise<BacktestComparison | null> => {
      try {
        return await api.getJobComparison(jobId);
      } catch (e: unknown) {
        // 404 — the worker recorded no comparison artifact for this job.
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
      }
    },
    enabled,
  });

  if (!enabled) return null;

  return (
    <GlassCard>
      <h3 className="section-title">Baseline Comparison</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Worker-recorded baseline/current evidence: net equity return, costs, drawdown and validity.
      </p>
      {comparisonQuery.isLoading && (
        <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Loading comparison…</p>
      )}
      {comparisonQuery.error && (
        <p className="text-negative text-sm">
          Failed to load comparison:{' '}
          {comparisonQuery.error instanceof Error ? comparisonQuery.error.message : String(comparisonQuery.error)}
        </p>
      )}
      {comparisonQuery.data === null && (
        <p className="text-sm text-[var(--color-text-muted)]">
          No comparison artifact was recorded for this job — the baseline evidence is unavailable.
        </p>
      )}
      {comparisonQuery.data && <ComparisonEntries data={comparisonQuery.data} />}
    </GlassCard>
  );
}

export function JobMonitor() {
  const { jobId } = useParams({ strict: false });

  // Poll durable job state until it reaches a terminal state. An
  // interrupted job is never automatically retried — polling stops for good.
  const { data: jobStatus, error } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => api.getJobStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      return isTerminal(query.state.data?.status) ? false : 2500;
    },
  });

  // Queue status supplies run_id before execution — poll live data by
  // run_id, never by job_id, and never via auto-detect.
  const runId = jobStatus?.run_id ?? null;
  const { data: liveData } = useQuery({
    queryKey: ['liveBacktest', runId],
    queryFn: async () => {
      try {
        return await api.getLiveBacktest(runId as string);
      } catch {
        return null;
      }
    },
    enabled: !!runId && jobStatus?.status === 'running',
    refetchInterval: 3000,
  });

  const statusVariant = (() => {
    switch (jobStatus?.status) {
      case 'running': return 'running' as const;
      case 'completed': return 'completed' as const;
      case 'failed': return 'error' as const;
      case 'interrupted': return 'error' as const;
      case 'queued': return 'connecting' as const;
      default: return 'connecting' as const;
    }
  })();

  const progressPct = jobStatus?.progress_pct ?? 0;
  const snapshot = liveData?.snapshot;
  const terminal = isTerminal(jobStatus?.status);

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 card">
        <div>
          <h2 className="page-title">Job Monitor</h2>
          <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">{jobId}</div>
          {(jobStatus?.preset || jobStatus?.variant) && (
            <div className="flex gap-2 mt-2">
              <span className="badge bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)] font-mono">
                {jobStatus.preset}/{jobStatus.variant}
              </span>
              {jobStatus.dataset_id && (
                <span className="badge bg-white/5 text-[var(--color-text-muted)] font-mono">
                  dataset: {jobStatus.dataset_id}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)] text-sm">Status:</span>
          <StatusBadge variant={statusVariant} label={jobStatus?.status?.toUpperCase()} />
        </div>
      </div>

      {error && (
        <div className="card bg-[var(--color-red-muted)] border-red-500/20 text-negative text-sm">
          <span className="font-bold">Error:</span> Failed to fetch job status.
        </div>
      )}

      {jobStatus?.error && (
        <div className="card bg-[var(--color-red-muted)] border-red-500/20 text-negative text-sm">
          <span className="font-bold">Job Error:</span> {jobStatus.error}
        </div>
      )}

      {jobStatus?.status === 'queued' && (
        <div className="card bg-[var(--color-blue-muted)] border-blue-500/20 text-[var(--color-blue)] text-sm">
          <span className="font-bold">Queued.</span> Waiting for the worker to claim this job — a run
          ID appears here before execution starts.
        </div>
      )}

      {jobStatus?.status === 'interrupted' && (
        <div className="card bg-[var(--color-red-muted)] border-red-500/20 text-negative text-sm">
          <span className="font-bold">Interrupted.</span> The worker restarted while this job was in
          flight. Interrupted jobs are never automatically retried — approve a new launch from the
          Control Tower to run the condition again.
        </div>
      )}

      {jobStatus?.status === 'completed' && jobStatus.run_id && (
        <div className="card bg-[var(--color-green-muted)] border-green-500/20 text-positive text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            <span className="font-bold">Run Complete!</span> run_id:{' '}
            <span className="font-mono">{jobStatus.run_id}</span>
          </span>
          <Link
            to="/backtests/$runId"
            params={{ runId: jobStatus.run_id }}
            className="btn btn-success text-xs"
          >
            View completed run →
          </Link>
        </div>
      )}

      {/* Timestamps / exit code */}
      {jobStatus && (jobStatus.created_at || jobStatus.started_at || jobStatus.completed_at) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-text-muted)] font-mono px-1">
          <span>created {formatDateTime(jobStatus.created_at)}</span>
          <span>started {formatDateTime(jobStatus.started_at)}</span>
          {jobStatus.completed_at && <span>completed {formatDateTime(jobStatus.completed_at)}</span>}
          {jobStatus.exit_code != null && <span>exit code {jobStatus.exit_code}</span>}
        </div>
      )}

      {/* Progress Bar */}
      {jobStatus?.status === 'running' && (
        <div className="shrink-0">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
            <span>Progress</span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden border border-[var(--color-border)]">
            <div
              className="h-full bg-[var(--color-gold-accent)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Link to the full live monitor once a run exists */}
      {jobStatus?.status === 'running' && runId && (
        <div className="text-sm">
          <Link
            to="/backtests/live/$runId"
            params={{ runId }}
            className="text-[var(--color-gold-accent)] hover:underline"
          >
            Open the full live monitor for {runId} →
          </Link>
        </div>
      )}

      {/* Rolling Metrics from live data */}
      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Portfolio Value" value={formatCurrency(snapshot.portfolio_value)} neutral />
          <KPICard
            label="P&L"
            value={`${snapshot.pnl >= 0 ? '+' : ''}${formatCurrency(snapshot.pnl)} (${formatPercentage(snapshot.pnl_pct)})`}
            isPositive={snapshot.pnl >= 0}
          />
          <KPICard label="Open Positions" value={snapshot.open_positions_count} neutral />
          <KPICard label="Decisions" value={`${snapshot.decisions_done} / ${snapshot.decisions_target}`} neutral />
        </div>
      )}

      {!snapshot && jobStatus?.status === 'running' && (
        <GlassCard className="flex items-center justify-center py-12">
          <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Waiting for first decision…</p>
        </GlassCard>
      )}

      {!jobStatus && !error && (
        <GlassCard className="flex items-center justify-center py-12">
          <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Connecting to job…</p>
        </GlassCard>
      )}

      {/* Baseline/current evidence on terminal results */}
      {jobId && <ComparisonCard jobId={jobId} enabled={terminal} />}
    </div>
  );
}
