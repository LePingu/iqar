import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';

export function JobMonitor() {
  const { jobId } = useParams({ strict: false });
  const navigate = useNavigate();

  // Poll job status every 2.5 seconds
  const { data: jobStatus, error } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => api.getJobStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Stop polling once completed or failed
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
    <div className="animate-fade-in flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div>
          <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl font-light">Job Monitor</h2>
          <div className="text-sm font-mono text-gray-500 mt-1">{jobId}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">Status:</span>
          <StatusBadge variant={statusVariant} label={jobStatus?.status?.toUpperCase()} />
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
          <span className="font-bold">Error:</span> Failed to fetch job status.
        </div>
      )}

      {jobStatus?.error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
          <span className="font-bold">Job Error:</span> {jobStatus.error}
        </div>
      )}

      {jobStatus?.status === 'completed' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-center">
          <span className="font-bold">Run Complete!</span> Redirecting to results...
        </div>
      )}

      {/* Progress Bar */}
      {jobStatus?.status === 'running' && (
        <div className="shrink-0">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progress</span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-gold-dim)] to-[var(--color-gold-accent)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Rolling Metrics from live data */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Portfolio Value</span>
            <span className="text-xl font-bold font-mono text-white">
              {formatCurrency(snapshot.portfolio_value)}
            </span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">P&L</span>
            <span className={`text-xl font-bold font-mono ${snapshot.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {snapshot.pnl >= 0 ? '+' : ''}{formatCurrency(snapshot.pnl)} ({formatPercentage(snapshot.pnl_pct)})
            </span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Open Positions</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {snapshot.open_positions_count}
            </span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Decisions</span>
            <span className="text-xl font-bold font-mono text-white">
              {snapshot.decisions_done} / {snapshot.decisions_target}
            </span>
          </GlassCard>
        </div>
      )}

      {!snapshot && jobStatus?.status === 'running' && (
        <GlassCard className="flex items-center justify-center py-12">
          <p className="text-gray-500 animate-pulse">Waiting for first decision...</p>
        </GlassCard>
      )}

      {!jobStatus && !error && (
        <GlassCard className="flex items-center justify-center py-12">
          <p className="text-gray-400 animate-pulse">Connecting to job...</p>
        </GlassCard>
      )}
    </div>
  );
}
