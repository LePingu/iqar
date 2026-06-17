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
      } catch (e: any) {
        if (e.message?.includes('404')) return null;
        throw e;
      }
    },
    refetchInterval: 2500, // Poll every 2.5 seconds
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
  }, [data?.is_active, data?.portfolio_metrics, data?.run_id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 animate-pulse">Detecting active run...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl max-w-md">
          <span className="font-bold">Error:</span> Failed to connect to live backtest service.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <GlassCard className="text-center max-w-md w-full">
          <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl mb-4">No Active Backtests</h2>
          <p className="text-gray-400">
            Waiting for a new backtest to launch...
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
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Completion Banner */}
      {completeBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-center shrink-0">
          <span className="font-bold">Run Complete!</span> Redirecting to results in a few seconds...
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 shrink-0">
        <div>
          <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl font-light">Live Run Monitor</h2>
          <div className="text-sm font-mono text-gray-500 mt-1">{data.run_id}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Status:</span>
            {data.is_active ? (
              <StatusBadge variant="running" />
            ) : data.portfolio_metrics ? (
              <StatusBadge variant="completed" />
            ) : (
              <StatusBadge variant="connecting" label="Finishing..." />
            )}
          </div>
          {snapshot && (
            <div className="text-xs text-gray-400 font-mono">
              Progress: {snapshot.decisions_done} / {snapshot.decisions_target} ({progressPct.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {snapshot && snapshot.decisions_target > 0 && (
        <div className="shrink-0 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-gold-dim)] to-[var(--color-gold-accent)] rounded-full transition-all duration-500"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        {/* Open Positions */}
        <GlassCard className="flex flex-col">
          <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-sm uppercase tracking-wider mb-4">Open Positions</h3>
          <div className="flex-1 overflow-y-auto">
            <OpenPositionsTable positions={open_positions} />
          </div>
        </GlassCard>

        {/* Recent Fills */}
        <GlassCard className="flex flex-col">
          <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-sm uppercase tracking-wider mb-4">Recent Fills</h3>
          <div className="flex-1 overflow-y-auto">
            <RecentFillsFeed fills={recent_fills} frozen={completeBanner} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
