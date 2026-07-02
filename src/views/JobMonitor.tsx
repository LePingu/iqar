import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { KPICard } from '../components/KPICard';

export function JobMonitor() {
  const { jobId } = useParams({ strict: false });
  const navigate = useNavigate();

  // Poll job status every 2.5 seconds
  const { data: jobStatus, error } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => api.getJobStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2500;
    },
  });

  // Also poll live backtest data for richer metrics while running
  const { data: liveData } = useQuery({
    queryKey: ['liveBacktest', jobId],
    queryFn: async () => {
      try {
        return await api.getLiveBacktest(jobId as string);
      } catch {
        return null;
      }
    },
    enabled: !!jobId && jobStatus?.status === 'running',
    refetchInterval: 3000,
  });

  // Auto-redirect on completion
  if (jobStatus?.status === 'completed' && jobStatus.run_id) {
    setTimeout(() => {
      navigate({ to: '/backtests/$runId', params: { runId: jobStatus.run_id! } });
    }, 1500);
  }

  const statusVariant = (() => {
    switch (jobStatus?.status) {
      case 'running': return 'running' as const;
      case 'completed': return 'completed' as const;
      case 'failed': return 'error' as const;
      case 'queued': return 'connecting' as const;
      default: return 'connecting' as const;
    }
  })();

  const progressPct = jobStatus?.progress_pct ?? 0;
  const snapshot = liveData?.snapshot;

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 card">
        <div>
          <h2 className="page-title">Job Monitor</h2>
          <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">{jobId}</div>
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

      {jobStatus?.status === 'completed' && (
        <div className="card bg-[var(--color-green-muted)] border-green-500/20 text-positive text-center text-sm">
          <span className="font-bold">Run Complete!</span> Redirecting to results…
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
    </div>
  );
}
