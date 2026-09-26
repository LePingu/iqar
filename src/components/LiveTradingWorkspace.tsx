import { useId, useState } from 'react';
import type { ReactNode, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiActivity, FiLayers, FiList, FiAlertCircle, FiLock } from 'react-icons/fi';
import { api } from '../services/api';
import type { EngineStatus, LiveEngineDetail, EngineMode, ComponentHealth } from '../types/api';
import { EvaluationCurve } from './EvaluationCurve';
import { DecisionBook, DetailsExplorer, useDecisions } from './DecisionExplorer';
import { OpenPositionsTable } from './OpenPositionsTable';
import { HeldHoldingsTable } from './HeldHoldingsTable';
import { FillHistory } from './FillHistory';
import { FillsTable, AuditEvents } from './LiveActivity';
import { formatDate } from '../utils/trading';
import { isStale, measurement, rows } from '../utils/monitoring';

function Health({ label, value, failed }: { label: string; value?: ComponentHealth | null; failed: boolean }) {
  const stale = isStale(value);
  const state = failed || stale ? 'unknown' : value?.state ?? 'unknown';
  const text = failed ? 'Unavailable' : stale ? 'Stale' : value?.label ?? (state === 'healthy' ? 'Healthy' : state === 'degraded' ? 'Degraded' : state === 'offline' ? 'Offline' : 'Unavailable');
  return <div title={value?.reason ?? undefined}><span className={`health-dot ${state}`} /><div><span>{label}</span><strong>{text}</strong></div></div>;
}

function TelemetryWidget({ sessionId, status, mode }: { sessionId: string; status?: EngineStatus | null; mode: EngineMode }) {
  const context = useDecisions();
  const [activityOpen, setActivityOpen] = useState(false);
  const telemetry = useQuery({ queryKey: ['engineTelemetry', sessionId], queryFn: () => api.getEngineTelemetry(sessionId), refetchInterval: 15_000, retry: false });
  const mismatch = !!telemetry.data?.mode && telemetry.data.mode !== mode;
  const data = mismatch ? null : telemetry.data;
  const failed = !!telemetry.error || mismatch || isStale(data) === true;
  const components = data?.components;
  const engine: ComponentHealth | null = components?.engine ?? (status?.engine_alive != null ? { state: status.engine_alive ? 'healthy' : 'offline', label: status.engine_alive ? status.trading_enabled === false ? 'Halted' : 'Online' : 'Offline', as_of: status.last_snapshot_ts, stale_after_seconds: 60 } : null);
  return <section className="telemetry-widget" aria-label="System health">
    <div className="widget-heading"><h3>System health</h3></div>
    <div className="component-health"><Health label="Engine" value={engine} failed={failed} /><Health label="Market data" value={components?.market_data} failed={failed} /><Health label="Exchange" value={components?.exchange} failed={failed} /><Health label="Critic" value={components?.critic} failed={failed} /></div>
    <p className="widget-note">Last heartbeat: {formatDate(status?.last_snapshot_ts)}</p>
    <p className="widget-note">Last cycle: {formatDate(data?.last_cycle_at)} · {measurement(data?.cycle_duration_ms, ' ms', 0)}</p>
    {telemetry.error && <p className="monitor-error" role="alert">{telemetry.error.message}</p>}{mismatch && <p role="alert">Telemetry belongs to a different book.</p>}{isStale(data) && <p className="widget-note">Telemetry is stale.</p>}
    {rows(data?.incidents).slice(0, 2).map(event => <button key={event.id} className={`incident-strip ${event.severity === 'critical' ? 'critical' : ''}`} onClick={() => context?.select({ kind: 'event', event })}><FiAlertCircle /><span>{event.title ?? event.detail ?? 'Event details unavailable'}</span><span>›</span></button>)}
    <div className="telemetry-footer"><span>{data?.active_event_count == null ? 'Event count unavailable' : `${data.active_event_count} active ${data.active_event_count === 1 ? 'event' : 'events'}`}</span></div>
    <details className="system-activity" onToggle={event => setActivityOpen(event.currentTarget.open)}><summary>System activity</summary><p className="activity-description">Engine controls, connection issues, order events, and reconciliation records.</p>{activityOpen && <AuditEvents sessionId={sessionId} />}</details>
    {mode === 'real' && <details className="telemetry-extra"><summary>Arming & reconciliation</summary><dl className="telemetry-stats">{[
      ['Mode', data?.arming?.live_mode ?? 'Unavailable'], ['Armed', data?.arming?.armed == null ? 'Unavailable' : data.arming.armed ? 'Yes' : 'No'], ['Validate only', data?.arming?.validate_only == null ? 'Unavailable' : data.arming.validate_only ? 'Yes — no orders placed' : 'No'], ['Order cap (USD)', measurement(data?.arming?.max_order_usd, '', 2)], ['Reconciliation', data?.reconciliation?.state ?? 'Unavailable'], ['Last reconciled', formatDate(data?.reconciliation?.as_of)], ['Matched / adopted', `${data?.reconciliation?.matched ?? '—'} / ${data?.reconciliation?.adopted ?? '—'}`], ['Unpriceable / missing', `${data?.reconciliation?.unpriceable ?? '—'} / ${data?.reconciliation?.missing_on_exchange ?? '—'}`],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{data?.reconciliation?.reason && <p>{data.reconciliation.reason}</p>}</details>}
  </section>;
}

export function LiveTradingWorkspace({ sessionId, status, data, dataError, currency, settings, account, mode }: {
  sessionId: string; status?: EngineStatus | null; data?: LiveEngineDetail | null; dataError?: string; currency: string;
  settings: ReactNode; account?: ReactNode; mode: EngineMode;
}) {
  const [tab, setTab] = useState('positions');
  const id = useId();
  const tabs = [{ id: 'positions', label: 'Positions', icon: FiLayers, count: data?.open_positions_count }, { id: 'fills', label: 'Executions', icon: FiList, count: data?.recent_fills?.length }, { id: 'decisions', label: 'Strategy decisions', icon: FiActivity }];
  if (mode === 'real') tabs.push({ id: 'held', label: 'Staked / blocked', icon: FiLock, count: data?.held_positions == null ? undefined : rows(data.held_positions).length });
  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next].id);
    document.getElementById(`${id}-${tabs[next].id}`)?.focus();
  };
  return <div className="trading-workspace">
    <div className="trading-main">
      <EvaluationCurve sessionId={sessionId} mode={mode} currency={currency} ledger={data?.equity_curve} ledgerAsOf={data?.last_snapshot_ts} />
      {data?.observed_from && <p className="observation-note">Account observed since {formatDate(data.observed_from)}. Earlier account history is unavailable.</p>}
      <section className="activity-panel">
        <div className="activity-tabs" role="tablist" aria-label="Trading activity">{tabs.map((item, index) => <button key={item.id} id={`${id}-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`${id}-${item.id}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => navigateTabs(event, index)}><item.icon size={14} />{item.label}{item.count != null && <span>{item.count}</span>}</button>)}</div>
        <div className="activity-content">
          <p className="activity-description">{tab === 'held' ? 'Held coins are included in portfolio value. They take no position slots and receive no engine exits.' : tab === 'positions' ? 'Tradeable lots and their performance. Select a position for details.' : tab === 'decisions' ? 'Strategy choices to buy, sell, or hold, including choices that did not execute.' : 'Recorded executions. Select one to see fees, execution quality, and decision reasoning.'}</p>
          {dataError && (tab === 'positions' || tab === 'fills' || tab === 'held') && <p className="monitor-error">Refresh failed. Displayed activity may be stale.</p>}
          <div role="tabpanel" id={`${id}-positions-panel`} aria-labelledby={`${id}-positions`} hidden={tab !== 'positions'} tabIndex={0}>{tab === 'positions' && (data?.open_positions == null ? <p className="activity-empty">Position data is unavailable.</p> : <OpenPositionsTable positions={rows(data.open_positions)} />)}</div>
          <div role="tabpanel" id={`${id}-decisions-panel`} aria-labelledby={`${id}-decisions`} hidden={tab !== 'decisions'} tabIndex={0}>{tab === 'decisions' && <DecisionBook />}</div>
          <div role="tabpanel" id={`${id}-fills-panel`} aria-labelledby={`${id}-fills`} hidden={tab !== 'fills'} tabIndex={0}>{tab === 'fills' && <><FillsTable fills={data?.recent_fills ?? null} currency={currency} /><FillHistory sessionId={sessionId} currency={currency} /></>}</div>
          {mode === 'real' && <div role="tabpanel" id={`${id}-held-panel`} aria-labelledby={`${id}-held`} hidden={tab !== 'held'} tabIndex={0}>{tab === 'held' && <HeldHoldingsTable holdings={data?.held_positions} currency={currency} />}</div>}
        </div>
      </section>
    </div>
    <aside className="trading-inspector" aria-label="System health and settings">
      <TelemetryWidget sessionId={sessionId} mode={mode} status={status} />
      {settings}{account}
    </aside>
    <DetailsExplorer />
  </div>;
}
