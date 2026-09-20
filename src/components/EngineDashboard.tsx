import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiSettings, FiSquare } from 'react-icons/fi';
import { api, ApiError } from '../services/api';
import { useRole } from '../contexts/RoleContext';
import type { EngineControls, EngineMode, EngineStatus, LiveEngineDetail } from '../types/api';
import { formatDate, formatMoney, formatPercentage } from '../utils/trading';
import { measured, measurement } from '../utils/monitoring';
import { DecisionProvider } from './DecisionExplorer';
import { LiveTradingWorkspace } from './LiveTradingWorkspace';

async function optionalSession<T>(read: () => Promise<T>) {
  try { return await read(); } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function RiskSettings({ sessionId, status, mode }: { sessionId: string; status?: EngineStatus | null; mode: EngineMode }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const controls = useMutation({ mutationFn: (values: EngineControls) => api.updateEngineControls(sessionId, values), onSuccess: () => client.invalidateQueries({ queryKey: ['engineStatus', sessionId] }) });
  const reset = useMutation({ mutationFn: () => api.flushEngine(sessionId), onSuccess: () => { setConfirm(false); client.invalidateQueries({ queryKey: ['engineStatus', sessionId] }); client.invalidateQueries({ queryKey: ['engineDetail', sessionId] }); } });
  return <>
    <form className="risk-settings" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      controls.mutate({ max_position_size_pct: Number(form.get('position')) / 100, max_daily_loss_pct: Number(form.get('loss')) / 100, max_open_positions: Number(form.get('slots')) });
    }}>
      <label>Maximum position (%)<input className="input" name="position" type="number" min="0" max="100" step="0.1" required defaultValue={measured(status?.max_position_size_pct) ? status.max_position_size_pct * 100 : ''} /></label>
      <label>Daily loss limit (%)<input className="input" name="loss" type="number" min="0" max="100" step="0.1" required defaultValue={measured(status?.max_daily_loss_pct) ? status.max_daily_loss_pct * 100 : ''} /></label>
      <label>Maximum positions<input className="input" name="slots" type="number" min="1" step="1" required defaultValue={status?.max_open_positions ?? ''} /></label>
      <button className="btn btn-primary" disabled={!status || controls.isPending}>{controls.isPending ? 'Submitting…' : 'Save limits'}</button>
      {controls.error && <p role="alert">{controls.error.message}</p>}{controls.isSuccess && <p role="status">Limits queued for the engine.</p>}
    </form>
    {mode === 'paper' && <div className="reset-controls">{confirm ? <><p>Reset paper positions and capital?</p><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-danger" disabled={reset.isPending} onClick={() => reset.mutate()}>Confirm reset</button></> : <button className="btn btn-ghost" disabled={!status?.engine_alive} onClick={() => setConfirm(true)}>Reset paper portfolio</button>}{reset.error && <p role="alert">{reset.error.message}</p>}</div>}
  </>;
}

function AccountDetails({ sessionId, data }: { sessionId: string; data?: LiveEngineDetail | null }) {
  const query = useQuery({ queryKey: ['realAccount', sessionId], queryFn: () => optionalSession(() => api.getRealAccount(sessionId)), refetchInterval: 30_000 });
  const account = query.data;
  const currency = account?.currency;
  const comparable = currency && currency === data?.currency && measured(account?.total_value) && measured(data?.portfolio_value);
  const drift = comparable ? account!.total_value! - data!.portfolio_value : null;
  const stale = account?.as_of && Date.now() - Date.parse(account.as_of) > 600_000;
  return <details className="workspace-controls"><summary>Exchange account & reconciliation</summary>
    {query.isPending && <p>Loading account…</p>}{query.error && <p role="alert">{query.error.message}</p>}
    {!query.isPending && !query.error && !account && <p>Account snapshot unavailable. This does not mean the account is empty.</p>}
    {account && <><dl className="telemetry-stats"><div><dt>Quote cash</dt><dd>{formatMoney(account.quote_cash, currency)}</dd></div><div><dt>Holdings value</dt><dd>{formatMoney(account.positions_value, currency)}</dd></div><div><dt>Exchange total</dt><dd>{formatMoney(account.total_value, currency)}</dd></div><div><dt>Ledger total</dt><dd>{formatMoney(data?.portfolio_value, data?.currency)}</dd></div><div><dt>Balance difference</dt><dd>{formatMoney(drift, currency)}</dd></div><div><dt>Exchange holdings</dt><dd>{account.num_holdings ?? '—'}</dd></div></dl><p className="widget-note">{stale ? 'Stale · ' : ''}Last read: {formatDate(account.as_of)}</p><p className="widget-note">Holdings can include dust and bonded balances outside managed lots. Balance difference compares independently sampled totals; it is not an engine reconciliation verdict.</p></>}
  </details>;
}

function Dashboard({ sessionId, mode }: { sessionId: string; mode: EngineMode }) {
  const client = useQueryClient();
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const settings = useRef<HTMLDetailsElement>(null);
  const statusQuery = useQuery({ queryKey: ['engineStatus', sessionId], queryFn: () => optionalSession(() => api.getEngineStatus(sessionId)), refetchInterval: 15_000 });
  const detailQuery = useQuery({ queryKey: ['engineDetail', sessionId], queryFn: () => optionalSession(() => api.getEngineDetail(sessionId)), refetchInterval: 5_000 });
  const status = statusQuery.data;
  const data = detailQuery.data;
  const command = useMutation({ mutationFn: (action: 'halt' | 'resume') => action === 'halt' ? api.haltEngine(sessionId) : api.resumeEngine(sessionId), onSuccess: () => client.invalidateQueries({ queryKey: ['engineStatus', sessionId] }) });
  // Never mix real and paper books, even during a partial rollout.
  if ((status?.mode && status.mode !== mode) || (data?.mode && data.mode !== mode)) return <div className="monitor-error" role="alert">Wrong book received for {sessionId}. Trading data and controls are hidden.</div>;
  const currency = data?.currency ?? 'USD';
  const metrics = [
    ['Portfolio value', formatMoney(data?.portfolio_value, currency)],
    ['P&L return', formatPercentage(data?.pnl_pct)],
    ['Max drawdown', formatPercentage(data?.drawdown_pct)],
    ['Exposure', measured(data?.exposure_pct) ? `${measurement(data.exposure_pct)}%` : '—'],
    ['Open positions', measured(data?.open_positions_count) ? String(data.open_positions_count) : '—'],
  ];
  return <div className="live-dashboard">
    <header className="trading-header"><div className="trading-heading"><h1>Live trading</h1><span className={`mode-label ${mode}`}>{mode === 'real' ? 'Real money' : 'Paper'}</span><span className="session-label"><i className={`engine-dot ${!statusQuery.error && status?.engine_alive ? 'is-alive' : ''}`} />{sessionId}</span></div>
      <div className="header-actions">{isAdmin && <><button className="btn btn-ghost" onClick={() => { if (settings.current) { settings.current.open = !settings.current.open; if (settings.current.open) settings.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }}><FiSettings />Settings</button>
        <button className={`btn ${status?.trading_enabled === false ? 'btn-ghost' : 'halt-button'}`} disabled={!status || !!statusQuery.error || command.isPending || (status.trading_enabled === false && !status.engine_alive)} onClick={() => command.mutate(status?.trading_enabled === false ? 'resume' : 'halt')}><FiSquare />{command.isPending ? 'Submitting…' : status?.trading_enabled === false ? 'Resume trading' : 'Halt trading'}</button></>}{!isAdmin && <span className="widget-note">Read only</span>}</div>
    </header>
    {command.error && <p className="monitor-error" role="alert">{command.error.message}</p>}{command.isSuccess && <p className="widget-note" role="status">{command.variables === 'halt' ? 'Halt' : 'Resume'} requested. Awaiting engine status confirmation.</p>}
    {(statusQuery.error || detailQuery.error) && <p className="monitor-error" role="alert">{statusQuery.error?.message ?? detailQuery.error?.message} · Previously loaded data may be stale.</p>}
    {!status && !statusQuery.isPending && !statusQuery.error && <p className="widget-note">No engine status available yet. The workspace will update when the session reports data.</p>}
    <div className="portfolio-strip" aria-label="Portfolio summary">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === 'P&L return' && measured(data?.pnl_pct) ? data.pnl_pct >= 0 ? 'text-positive' : 'text-negative' : ''}>{value}</strong></div>)}</div>
    <LiveTradingWorkspace sessionId={sessionId} mode={mode} status={statusQuery.error ? null : status} data={data} dataError={detailQuery.error?.message} currency={currency} settings={<details ref={settings} className="workspace-controls"><summary><FiSettings />Engine settings</summary>{isAdmin ? <RiskSettings key={`${sessionId}-${status?.max_position_size_pct}-${status?.max_daily_loss_pct}-${status?.max_open_positions}`} sessionId={sessionId} status={status} mode={mode} /> : <p className="widget-note">Engine settings are available to operators.</p>}</details>} account={mode === 'real' && isAdmin ? <AccountDetails sessionId={sessionId} data={data} /> : undefined} />
  </div>;
}

export function EngineDashboard({ sessionId, mode }: { sessionId: string; mode: EngineMode }) {
  return <DecisionProvider key={sessionId} inline source={{ kind: 'session', sessionId }}><Dashboard sessionId={sessionId} mode={mode} /></DecisionProvider>;
}
