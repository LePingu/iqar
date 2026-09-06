import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { GlassCard } from '../components/GlassCard';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { LiveKPIStrip } from '../components/LiveKPIStrip';
import { LiveEquityCurve } from '../components/LiveEquityCurve';
import { OpenPositionsTable } from '../components/OpenPositionsTable';
import { RecentFillsFeed } from '../components/RecentFillsFeed';
import { formatMoney } from '../utils/trading';
import type { EngineStatus } from '../types/api';

const SESSION_ID = 'live-real';
const STALE_ACCOUNT_MS = 10 * 60 * 1000;

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

function isStale(isoString: string | null): boolean {
  if (!isoString) return true;
  return Date.now() - new Date(isoString).getTime() > STALE_ACCOUNT_MS;
}

export function LiveRealDashboard() {
  const queryClient = useQueryClient();

  const { data: engineStatus, isLoading: engineLoading, error: engineError } = useQuery({
    queryKey: ['engineStatus', SESSION_ID],
    queryFn: async () => {
      try {
        return await api.getEngineStatus(SESSION_ID);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
      }
    },
    refetchInterval: 15000,
  });

  const { data: liveData } = useQuery({
    queryKey: ['engineDetail', SESSION_ID],
    queryFn: async () => {
      try {
        return await api.getEngineDetail(SESSION_ID);
      } catch {
        return null;
      }
    },
    refetchInterval: 5000,
    enabled: !!engineStatus?.engine_alive,
  });

  // Real Kraken account snapshot — operator-only; 404 means never read (NOT $0).
  const { data: account, error: accountError } = useQuery({
    queryKey: ['realAccount', SESSION_ID],
    queryFn: async () => {
      try {
        return await api.getRealAccount(SESSION_ID);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
      }
    },
    refetchInterval: 30000,
  });

  const haltMutation = useMutation({
    mutationFn: () => api.haltEngine(SESSION_ID),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['engineStatus', SESSION_ID] });
      const prev = queryClient.getQueryData(['engineStatus', SESSION_ID]);
      queryClient.setQueryData(['engineStatus', SESSION_ID], (old: EngineStatus | undefined) =>
        old ? { ...old, trading_enabled: false } : old
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['engineStatus', SESSION_ID], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', SESSION_ID] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeEngine(SESSION_ID),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['engineStatus', SESSION_ID] });
      const prev = queryClient.getQueryData(['engineStatus', SESSION_ID]);
      queryClient.setQueryData(['engineStatus', SESSION_ID], (old: EngineStatus | undefined) =>
        old ? { ...old, trading_enabled: true } : old
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['engineStatus', SESSION_ID], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['engineStatus', SESSION_ID] });
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

  if (!engineStatus) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center h-64">
        <GlassCard className="text-center max-w-lg w-full">
          <h2 className="page-title mb-3">Real Engine Not Started</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            No engine session found for <span className="font-mono text-[var(--color-text-primary)]">{SESSION_ID}</span>.
            Start the engine with:
          </p>
          <div className="bg-[var(--color-bg-root)] border border-[var(--color-border)] rounded-lg p-3 font-mono text-sm text-[var(--color-text-secondary)] text-left">
            ./scripts/run/engine.sh --session={SESSION_ID} --capital=10000
          </div>
        </GlassCard>
      </div>
    );
  }

  // Hard error state: the real-money route must never render paper numbers.
  if (engineStatus.mode === 'paper' || liveData?.mode === 'paper') {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center h-64">
        <GlassCard className="text-center max-w-lg w-full">
          <h2 className="page-title text-negative mb-3">Wrong Book — Real Route Received Paper Data</h2>
          <p className="text-[var(--color-text-secondary)]">
            The engine served a <span className="font-mono">paper</span> payload for session{' '}
            <span className="font-mono text-[var(--color-text-primary)]">{SESSION_ID}</span>.
            Numbers are not rendered. This is a configuration error — do not act on any figure
            from this state.
          </p>
        </GlassCard>
      </div>
    );
  }

  const engineAlive = engineStatus.engine_alive;
  const tradingEnabled = engineStatus.trading_enabled;
  const badgeVariant = !engineAlive ? 'down' : tradingEnabled ? 'trading' : 'halted';

  const accountCurrency = account?.currency ?? 'USD';
  const bookCurrency = liveData?.currency ?? accountCurrency;
  const exchangeTotal = account?.total_value ?? null;
  const ledgerValue = liveData?.portfolio_value ?? null;
  const drift =
    exchangeTotal != null && ledgerValue != null ? exchangeTotal - ledgerValue : null;
  const driftOk =
    drift != null &&
    (Math.abs(drift) <= 1 ||
      (exchangeTotal != null && Math.abs(drift / exchangeTotal) <= 0.01));
  const observedFrom = liveData?.observed_from ?? null;

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* REAL MONEY marker */}
      <div className="flex items-center gap-2">
        <span className="badge bg-[var(--color-red-muted)] text-[var(--color-red)] border border-red-500/30 font-bold uppercase tracking-wider">
          ● Real Money
        </span>
        <span className="badge bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)] font-mono uppercase">
          mode: real
        </span>
        <span className="text-xs font-mono text-[var(--color-text-muted)]">session: {SESSION_ID}</span>
      </div>

      {/* Control panel */}
      <GlassCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <h2 className="page-title">Real Trading Engine</h2>
              <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">Session: {SESSION_ID}</div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <StatusBadge variant={badgeVariant} />
              <span className="text-xs text-[var(--color-text-muted)]">
                Last heartbeat: {formatRelativeTime(engineStatus.last_snapshot_ts)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            {tradingEnabled ? (
              <button
                onClick={() => haltMutation.mutate()}
                disabled={!engineAlive || haltMutation.isPending}
                className="btn btn-danger text-base px-6 py-3 font-bold"
              >
                {haltMutation.isPending ? 'Halting…' : '■ HALT TRADING'}
              </button>
            ) : (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={!engineAlive || resumeMutation.isPending}
                className="btn btn-ghost text-sm"
              >
                {resumeMutation.isPending ? 'Resuming…' : '▶ Resume Trading'}
              </button>
            )}
          </div>

          {/* Arming state — no data source exists yet; do not infer it */}
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="flex items-center gap-2">
              <span className="badge bg-[var(--color-blue-muted)] text-[var(--color-blue)] text-xs">
                Arming State Unavailable
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              LIVE_KRAKEN_ARMED, validate-only and the per-order cap are engine configuration that
              the tower does not yet serve. Their state is <span className="font-bold">not inferred</span> —
              do not assume the engine is disarmed or armed from their absence here.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Cash reconciliation — exchange balance vs ledger balance */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title !mb-0">Kraken Account (as last read by engine)</h3>
          {account && (
            <span className={`text-xs font-mono ${isStale(account.as_of) ? 'text-negative' : 'text-[var(--color-text-muted)]'}`}>
              {isStale(account.as_of) ? 'stale · ' : ''}read {formatRelativeTime(account.as_of)}
            </span>
          )}
        </div>

        {accountError ? (
          <p className="text-negative text-sm">Failed to load account status.</p>
        ) : !account ? (
          <p className="text-[var(--color-text-muted)] text-sm">
            The engine has never read this account. This is <span className="font-bold">not</span> an empty account.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label={`Quote Cash (${accountCurrency})`}
                value={account.quote_cash != null ? formatMoney(account.quote_cash, accountCurrency) : '—'}
                neutral
              />
              <KPICard
                label={`Positions Value (${accountCurrency})`}
                value={account.positions_value != null ? formatMoney(account.positions_value, accountCurrency) : '—'}
                neutral
              />
              <KPICard
                label={`Total Value (${accountCurrency})`}
                value={account.total_value != null ? formatMoney(account.total_value, accountCurrency) : '—'}
                neutral
              />
              <KPICard label="Holdings" value={account.num_holdings ?? '—'} neutral />
            </div>

            {/* Exchange vs ledger drift */}
            <div className="mt-3 border-t border-[var(--color-border)] pt-3 flex flex-wrap gap-6 items-center text-sm">
              <div>
                <span className="text-[var(--color-text-muted)]">Exchange balance:</span>{' '}
                <span className="font-mono text-[var(--color-text-primary)]">
                  {exchangeTotal != null ? formatMoney(exchangeTotal, accountCurrency) : '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Ledger balance:</span>{' '}
                <span className="font-mono text-[var(--color-text-primary)]">
                  {ledgerValue != null ? formatMoney(ledgerValue, bookCurrency) : '—'}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Drift:</span>{' '}
                <span
                  className={`font-mono font-bold ${
                    drift == null ? 'text-[var(--color-text-muted)]' : driftOk ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {drift == null ? '—' : `${drift >= 0 ? '+' : ''}${formatMoney(drift, accountCurrency)}`}
                </span>
                {drift != null && !driftOk && (
                  <span className="text-xs text-negative ml-1">beyond $1 / 1% — engine refuses to trade in this state</span>
                )}
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Last read:</span>{' '}
                <span className="font-mono text-[var(--color-text-secondary)]">{formatRelativeTime(account.as_of)}</span>
              </div>
            </div>
          </>
        )}
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
        currency={bookCurrency}
      />

      {/* Equity curve — starts at observed_from; no curve exists before observation began */}
      <div className="flex flex-col gap-1.5">
        <LiveEquityCurve equityCurve={liveData?.equity_curve ?? []} title="Real Engine Equity Curve" />
        {observedFrom && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Observation began {new Date(observedFrom).toLocaleString()} — this is when the engine
            started watching the account, not when the account started trading. No equity curve
            exists before this point.
          </p>
        )}
      </div>

      {/* Positions and fills */}
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
            <RecentFillsFeed fills={liveData?.recent_fills ?? []} currency={bookCurrency} />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
