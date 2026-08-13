import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useRole } from '../contexts/RoleContext';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { LiveKPIStrip } from '../components/LiveKPIStrip';
import { LiveEquityCurve } from '../components/LiveEquityCurve';
import { OpenPositionsTable } from '../components/OpenPositionsTable';
import { RecentFillsFeed } from '../components/RecentFillsFeed';
import type { EngineControls, EngineStatus } from '../types/api';

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
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Max Pos Size %
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={values.maxPositionSizePct}
          onChange={e => setValues({ ...values, maxPositionSizePct: Number(e.target.value) })}
          className="input w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Daily Loss %
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={values.maxDailyLossPct}
          onChange={e => setValues({ ...values, maxDailyLossPct: Number(e.target.value) })}
          className="input w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Max Positions
        <input
          type="number"
          step="1"
          min="1"
          value={values.maxOpenPositions}
          onChange={e => setValues({ ...values, maxOpenPositions: Number(e.target.value) })}
          className="input w-24"
        />
      </label>
      <button type="submit" disabled={mutation.isPending} className="btn btn-ghost text-xs">
        {mutation.isPending ? 'Saving…' : 'Update Limits'}
      </button>
      {mutation.isSuccess && <span className="text-positive text-xs">✓ Queued</span>}
    </form>
  );
}

export function LiveTradingDashboard() {
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const sessionId = DEFAULT_SESSION_ID;
  const queryClient = useQueryClient();

  // Engine status — poll every 15s
  const { data: engineStatus, isLoading: engineLoading, error: engineError } = useQuery({
    queryKey: ['engineStatus', sessionId],
    queryFn: async () => {
      try {
        return await api.getEngineStatus(sessionId);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('404')) return null;
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
        return await api.getEngineDetail(sessionId);
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
      await queryClient.cancelQueries({ queryKey: ['engineStatus', sessionId] });
      const prev = queryClient.getQueryData(['engineStatus', sessionId]);
      queryClient.setQueryData(['engineStatus', sessionId], (old: EngineStatus | undefined) =>
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

  const [showFlushConfirm, setShowFlushConfirm] = useState(false);

  // Flush mutation
  const flushMutation = useMutation({
    mutationFn: () => api.flushEngine(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['liveBacktest', sessionId] });
      setShowFlushConfirm(false);
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: () => api.resumeEngine(sessionId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['engineStatus', sessionId] });
      const prev = queryClient.getQueryData(['engineStatus', sessionId]);
      queryClient.setQueryData(['engineStatus', sessionId], (old: EngineStatus | undefined) =>
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
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)] text-sm animate-pulse">Connecting to engine…</p>
      </div>
    );
  }

  if (engineError && !engineStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="max-w-md text-center">
          <p className="text-negative font-medium">Failed to connect to engine status endpoint.</p>
        </GlassCard>
      </div>
    );
  }

  // Engine never started
  if (!engineStatus) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center h-64">
        <GlassCard className="text-center max-w-lg w-full">
          <h2 className="page-title mb-3">Engine Not Started</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            No engine session found for <span className="font-mono text-[var(--color-text-primary)]">{sessionId}</span>.
            {isAdmin && ' Start the engine with:'}
          </p>
          {isAdmin && (
            <div className="bg-[var(--color-bg-root)] border border-[var(--color-border)] rounded-lg p-3 font-mono text-sm text-[var(--color-text-secondary)] text-left">
              ./scripts/launch-engine.sh --session={sessionId} --capital=10000
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  const engineAlive = engineStatus.engine_alive;
  const tradingEnabled = engineStatus.trading_enabled;
  const badgeVariant = !engineAlive ? 'down' : tradingEnabled ? 'trading' : 'halted';

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Read-only indicator for readers */}
      {!isAdmin && (
        <div className="badge bg-[var(--color-blue-muted)] text-[var(--color-blue)] self-start">
          Read-Only Mode
        </div>
      )}

      {/* Engine Control Panel */}
      <GlassCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <h2 className="page-title">Live Trading Engine</h2>
              <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">Session: {sessionId}</div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <StatusBadge variant={badgeVariant} />
              <span className="text-xs text-[var(--color-text-muted)]">
                Last heartbeat: {formatRelativeTime(engineStatus.last_snapshot_ts)}
              </span>
            </div>
          </div>

          {/* Controls — admin only */}
          {isAdmin && (
            <div className="flex gap-3 items-center flex-wrap">
              {tradingEnabled ? (
                <button
                  onClick={() => haltMutation.mutate()}
                  disabled={!engineAlive || haltMutation.isPending}
                  className="btn btn-danger"
                >
                  {haltMutation.isPending ? 'Halting…' : '⏸ Halt Trading'}
                </button>
              ) : (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={!engineAlive || resumeMutation.isPending}
                  className="btn btn-success"
                >
                  {resumeMutation.isPending ? 'Resuming…' : '▶ Resume Trading'}
                </button>
              )}
              
              <div className="hidden sm:block h-6 w-px bg-[var(--color-border)] mx-1"></div>
              
              {showFlushConfirm ? (
                <div className="flex items-center gap-2 bg-[var(--color-red-muted)] px-3 py-1.5 rounded-lg border border-red-500/30">
                  <span className="text-xs text-negative font-medium mr-1">Wipe portfolio?</span>
                  <button 
                    onClick={() => setShowFlushConfirm(false)}
                    className="btn btn-ghost text-xs py-1 px-2 h-auto"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => flushMutation.mutate()}
                    disabled={flushMutation.isPending}
                    className="btn btn-danger text-xs py-1 px-2 h-auto"
                  >
                    {flushMutation.isPending ? 'Flushing…' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowFlushConfirm(true)}
                  disabled={!engineAlive || flushMutation.isPending}
                  className="btn btn-ghost text-negative hover:bg-red-500/10 hover:border-red-500/30"
                  title="Wipe positions and reset to starting capital"
                >
                  ↻ Reset Portfolio
                </button>
              )}
            </div>
          )}

          {/* Risk Limits — admin only */}
          {isAdmin && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <h4 className="section-title">Risk Limits</h4>
              <RiskLimitsForm
                initialValues={{
                  maxPositionSizePct: engineStatus.max_position_size_pct,
                  maxDailyLossPct: engineStatus.max_daily_loss_pct,
                  maxOpenPositions: engineStatus.max_open_positions,
                }}
                sessionId={sessionId}
              />
            </div>
          )}

          {/* Risk limits display — reader */}
          {!isAdmin && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <h4 className="section-title">Risk Limits</h4>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-[var(--color-text-muted)]">Max Pos Size:</span>{' '}
                  <span className="font-mono text-[var(--color-text-primary)]">{(engineStatus.max_position_size_pct * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Daily Loss:</span>{' '}
                  <span className="font-mono text-[var(--color-text-primary)]">{(engineStatus.max_daily_loss_pct * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Max Positions:</span>{' '}
                  <span className="font-mono text-[var(--color-text-primary)]">{engineStatus.max_open_positions}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Live KPIs */}
      <LiveKPIStrip 
        snapshot={liveData ? {
          portfolio_value: liveData.portfolio_value,
          pnl: liveData.pnl,
          pnl_pct: liveData.pnl_pct,
          drawdown_pct: liveData.drawdown_pct,
          open_positions_count: liveData.open_positions_count,
          last_snapshot_ts: liveData.last_snapshot_ts || '',
          decisions_done: 0,
          decisions_target: 0,
        } : null} 
        greyed={!engineAlive} 
      />

      {/* Equity Curve */}
      <LiveEquityCurve equityCurve={liveData?.equity_curve ?? []} title="Engine Equity Curve" />

      {/* Positions and Fills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[300px]">
        <GlassCard className={`flex flex-col ${!engineAlive ? 'opacity-40' : ''}`}>
          <h3 className="section-title">Open Positions</h3>
          <div className="flex-1 overflow-y-auto">
            <OpenPositionsTable positions={liveData?.open_positions ?? []} />
          </div>
        </GlassCard>

        <GlassCard className={`flex flex-col ${!engineAlive ? 'opacity-40' : ''}`}>
          <h3 className="section-title">Recent Fills</h3>
          <div className="flex-1 overflow-y-auto">
            <RecentFillsFeed fills={liveData?.recent_fills ?? []} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
