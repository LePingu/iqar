import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { api } from '../services/api';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { LiveKPIStrip } from '../components/LiveKPIStrip';
import { LiveEquityCurve } from '../components/LiveEquityCurve';
import { OpenPositionsTable } from '../components/OpenPositionsTable';
import { RecentFillsFeed } from '../components/RecentFillsFeed';

export function LiveRunMonitor() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { runId?: string };
  const runId = params.runId;
  const [completeBanner, setCompleteBanner] = useState(false);

  // If we have a runId, poll the specific run; otherwise auto-detect the active run
  const { data, isLoading, error } = useQuery({
    queryKey: runId ? ['liveBacktest', runId] : ['liveBacktestActive'],
    queryFn: async () => {
      try {
        return runId
          ? await api.getLiveBacktest(runId)
          : await api.getLiveBacktestActive();
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
      }
    },
    refetchInterval: 2500,
  });

  // Auto-resolve: redirect from /backtests/live to /backtests/live/:runId
  useEffect(() => {
    if (data && !runId && data.run_id) {
      navigate({ to: '/backtests/live/$runId', params: { runId: data.run_id } });
    }
  }, [data, runId, navigate]);

  // Completion flow: show banner, then redirect after 3 seconds
  useEffect(() => {
    if (data && !data.is_active && data.portfolio_metrics) {
      setCompleteBanner(true);
      const timer = setTimeout(() => {
        navigate({ to: '/backtests/$runId', params: { runId: data.run_id } });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [data, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Detecting active run…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="max-w-md text-center">
          <p className="text-negative font-medium">Failed to connect to live backtest service.</p>
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="text-center max-w-md w-full">
          <h2 className="page-title mb-3">No Active Backtests</h2>
          <p className="text-[var(--color-text-secondary)]">
            Waiting for a new backtest to launch…
          </p>
        </GlassCard>
      </div>
    );
  }

  const { snapshot, open_positions, recent_fills } = data;
  const progressPct = snapshot && snapshot.decisions_target > 0
    ? (snapshot.decisions_done / snapshot.decisions_target) * 100
    : 0;

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Completion Banner */}
      {completeBanner && (
        <div className="card bg-[var(--color-green-muted)] border-green-500/20 text-positive text-center text-sm shrink-0">
          <span className="font-bold">Run Complete!</span> Redirecting to results in a few seconds…
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 card shrink-0">
        <div>
          <h2 className="page-title">Live Run Monitor</h2>
          <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">{data.run_id}</div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)] text-sm">Status:</span>
            {data.is_active ? (
              <StatusBadge variant="running" />
            ) : data.portfolio_metrics ? (
              <StatusBadge variant="completed" />
            ) : (
              <StatusBadge variant="connecting" label="Finishing…" />
            )}
          </div>
          {snapshot && (
            <div className="text-xs text-[var(--color-text-muted)] font-mono">
              Progress: {snapshot.decisions_done} / {snapshot.decisions_target} ({progressPct.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {snapshot && snapshot.decisions_target > 0 && (
        <div className="shrink-0 h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden border border-[var(--color-border)]">
          <div
            className="h-full bg-[var(--color-gold-accent)] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      )}

      {/* Rolling Metrics */}
      <div className="shrink-0">
        <LiveKPIStrip snapshot={snapshot} />
      </div>

      {/* Equity Curve */}
      <LiveEquityCurve equityCurve={data.equity_curve} />

      {/* Bottom Row: Positions and Fills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[300px]">
        <GlassCard className="flex flex-col">
          <h3 className="section-title">Open Positions</h3>
          <div className="flex-1 overflow-y-auto">
            <OpenPositionsTable positions={open_positions} />
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col">
          <h3 className="section-title">Recent Fills</h3>
          <div className="flex-1 overflow-y-auto">
            <RecentFillsFeed fills={recent_fills} frozen={completeBanner} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
