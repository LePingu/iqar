import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { LiveKPIStrip } from '../components/LiveKPIStrip';
import { LiveEquityCurve } from '../components/LiveEquityCurve';
import { OpenPositionsTable } from '../components/OpenPositionsTable';
import { RecentFillsFeed } from '../components/RecentFillsFeed';
import type { EngineControls } from '../types/api';

const DEFAULT_SESSION_ID = 'live-paper';

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function RiskLimitsForm({
  initialValues,
  sessionId,
}: {
  initialValues: { maxPositionSizePct: number; maxDailyLossPct: number; maxOpenPositions: number };
  sessionId: string;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(initialValues);

  const mutation = useMutation({
    mutationFn: (controls: EngineControls) => api.updateEngineControls(sessionId, controls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', sessionId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      max_position_size_pct: values.maxPositionSizePct,
      max_daily_loss_pct: values.maxDailyLossPct,
      max_open_positions: values.maxOpenPositions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-4 flex-wrap">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Max Pos Size %
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={values.maxPositionSizePct}
          onChange={e => setValues({ ...values, maxPositionSizePct: Number(e.target.value) })}
          className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white px-3 py-1.5 rounded-lg text-sm focus:border-[var(--color-gold-accent)] outline-none transition-all w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Daily Loss %
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={values.maxDailyLossPct}
          onChange={e => setValues({ ...values, maxDailyLossPct: Number(e.target.value) })}
          className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white px-3 py-1.5 rounded-lg text-sm focus:border-[var(--color-gold-accent)] outline-none transition-all w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Max Positions
        <input
          type="number"
          step="1"
          min="1"
          value={values.maxOpenPositions}
          onChange={e => setValues({ ...values, maxOpenPositions: Number(e.target.value) })}
          className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white px-3 py-1.5 rounded-lg text-sm focus:border-[var(--color-gold-accent)] outline-none transition-all w-24"
        />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="px-4 py-1.5 text-sm rounded-lg bg-[var(--color-gold-accent)]/20 text-[var(--color-gold-accent)] border border-[var(--color-gold-accent)]/30 hover:bg-[var(--color-gold-accent)]/30 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving...' : 'Update Limits'}
      </button>
      {mutation.isSuccess && <span className="text-emerald-400 text-xs">✓ Queued</span>}
    </form>
  );
}

export function LiveTradingDashboard() {
  const sessionId = DEFAULT_SESSION_ID;
  const queryClient = useQueryClient();

  // Engine status — poll every 15s
  const { data: engineStatus, isLoading: engineLoading, error: engineError } = useQuery({
    queryKey: ['engineStatus', sessionId],
    queryFn: async () => {
      try {
        return await api.getEngineStatus(sessionId);
      } catch (e: any) {
        if (e.message?.includes('404')) return null; // Engine never started
        throw e;
      }
    },
    refetchInterval: 15000,
  });

  // Live data (positions, fills, equity) — poll every 5s, only when engine is alive
  const { data: liveData } = useQuery({
    queryKey: ['liveBacktest', sessionId],
    queryFn: async () => {
      try {
        return await api.getLiveBacktest(sessionId);
      } catch {
        return null;
      }
    },
    refetchInterval: 5000,
    enabled: !!engineStatus?.engine_alive,
  });

  // Halt mutation
  const haltMutation = useMutation({
    mutationFn: () => api.haltEngine(sessionId),
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['engineStatus', sessionId] });
      const prev = queryClient.getQueryData(['engineStatus', sessionId]);
      queryClient.setQueryData(['engineStatus', sessionId], (old: any) =>
        old ? { ...old, trading_enabled: false } : old
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['engineStatus', sessionId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', sessionId] });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: () => api.resumeEngine(sessionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['engineStatus', sessionId] });
      const prev = queryClient.getQueryData(['engineStatus', sessionId]);
      queryClient.setQueryData(['engineStatus', sessionId], (old: any) =>
        old ? { ...old, trading_enabled: true } : old
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['engineStatus', sessionId], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', sessionId] });
    },
  });

  if (engineLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 animate-pulse">Connecting to engine...</p>
      </div>
    );
  }

  if (engineError && !engineStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl max-w-md">
          <span className="font-bold">Error:</span> Failed to connect to engine status endpoint.
        </div>
      </div>
    );
  }

  // Engine never started
  if (!engineStatus) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center h-full py-20">
        <GlassCard className="text-center max-w-lg w-full">
          <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl mb-4">Engine Not Started</h2>
          <p className="text-gray-400 mb-6">
            No engine session found for <span className="font-mono text-white">{sessionId}</span>. Start the engine with:
          </p>
          <div className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded-xl p-4 font-mono text-sm text-gray-200 text-left">
            ./scripts/launch-engine.sh --session={sessionId} --capital=10000
          </div>
        </GlassCard>
      </div>
    );
  }

  const engineAlive = engineStatus.engine_alive;
  const tradingEnabled = engineStatus.trading_enabled;

  // Determine badge variant
  const badgeVariant = !engineAlive ? 'down' : tradingEnabled ? 'trading' : 'halted';

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Engine Control Panel */}
      <GlassCard>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl mb-1">Live Trading Engine</h2>
              <div className="text-sm font-mono text-gray-500">Session: {sessionId}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge variant={badgeVariant} />
              <span className="text-xs text-gray-500">
                Last heartbeat: {formatRelativeTime(engineStatus.last_snapshot_ts)}
              </span>
            </div>
          </div>

          {/* Halt / Resume buttons */}
          <div className="flex gap-3">
            {tradingEnabled ? (
              <button
                onClick={() => haltMutation.mutate()}
                disabled={!engineAlive || haltMutation.isPending}
                className="px-6 py-2 rounded-full text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {haltMutation.isPending ? 'Halting...' : '⏸ Halt Trading'}
              </button>
            ) : (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={!engineAlive || resumeMutation.isPending}
                className="px-6 py-2 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {resumeMutation.isPending ? 'Resuming...' : '▶ Resume Trading'}
              </button>
            )}
          </div>

          {/* Risk Limits */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Risk Limits</h4>
            <RiskLimitsForm
              initialValues={{
                maxPositionSizePct: engineStatus.max_position_size_pct,
                maxDailyLossPct: engineStatus.max_daily_loss_pct,
                maxOpenPositions: engineStatus.max_open_positions,
              }}
              sessionId={sessionId}
            />
          </div>
        </div>
      </GlassCard>

      {/* Live KPIs */}
      <LiveKPIStrip snapshot={liveData?.snapshot ?? null} greyed={!engineAlive} />

      {/* Equity Curve */}
      <LiveEquityCurve equityCurve={liveData?.equity_curve ?? []} title="Engine Equity Curve" />

      {/* Positions and Fills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <GlassCard className={`flex flex-col ${!engineAlive ? 'opacity-40' : ''}`}>
          <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-sm uppercase tracking-wider mb-4">Open Positions</h3>
          <div className="flex-1 overflow-y-auto">
            <OpenPositionsTable positions={liveData?.open_positions ?? []} />
          </div>
        </GlassCard>

        <GlassCard className={`flex flex-col ${!engineAlive ? 'opacity-40' : ''}`}>
          <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-sm uppercase tracking-wider mb-4">Recent Fills</h3>
          <div className="flex-1 overflow-y-auto">
            <RecentFillsFeed fills={liveData?.recent_fills ?? []} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
