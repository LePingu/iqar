import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { LiveFill } from '../types/api';
import { formatDate, fmtPrice, formatMoney, formatPercentage, formatTradePrice, formatSignedMoney } from '../utils/trading';
import { measurement, rows, humanize, fillReturns, measured } from '../utils/monitoring';
import { useDecisions } from './DecisionExplorer';

export function FillsTable({ fills, currency }: { fills: LiveFill[] | null; currency: string }) {
  const context = useDecisions();
  if (fills == null) return <p className="activity-empty">Recent fills are unavailable.</p>;
  if (!fills.length) return <p className="activity-empty">No fills recorded yet.</p>;
  return <div className="activity-table-scroll" tabIndex={0} aria-label="Fill metrics; scroll horizontally for all columns"><table className="activity-table fills-table"><thead><tr><th>Time</th><th>Asset</th><th>Side</th><th>Realized P&L</th><th>ROI %</th><th>Quantity</th><th>Fill price</th><th title="Reported commission; legacy payload does not specify its currency">Commission</th><th>Execution</th><th>Source / reason</th></tr></thead><tbody>{rows(fills).map((fill, i) => {
    const selected = context?.selection?.kind === 'fill' && (fill.id != null ? context.selection.fill.id === fill.id : context.selection.fill === fill);
    const returns = fillReturns(fill);
    const native = fill.settle_currency && fill.settle_currency !== currency && fill.settle_fx_rate == null;
    return <tr key={fill.id ?? `${fill.timestamp}-${i}`} className={selected ? 'is-selected' : ''} onMouseEnter={() => context?.highlight(fill.decision_id ?? null)} onMouseLeave={() => context?.highlight(null)} onClick={() => context?.select({ kind: 'fill', fill, currency })}>
      <td title={formatDate(fill.timestamp)}>{fill.timestamp && Number.isFinite(Date.parse(fill.timestamp)) ? new Date(fill.timestamp).toLocaleTimeString() : '—'}<small className="fill-date">{fill.timestamp && Number.isFinite(Date.parse(fill.timestamp)) ? new Date(fill.timestamp).toLocaleDateString() : ''}</small></td>
      <td><button className="table-select" onClick={event => { event.stopPropagation(); context?.select({ kind: 'fill', fill, currency }); }} onFocus={() => context?.highlight(fill.decision_id ?? null)} onBlur={() => context?.highlight(null)}>{fill.symbol ?? 'Unknown asset'}<span className="sr-only"> — inspect fill</span></button></td>
      <td className={fill.side === 'BUY' ? 'text-positive' : 'text-negative'}>{fill.side ?? '—'}</td>
      <td data-metric="realized-pnl" className={returns.pnl == null ? 'metric-unknown' : returns.pnl >= 0 ? 'text-positive' : 'text-negative'}>{formatSignedMoney(returns.pnl, currency)}</td>
      <td data-metric="roi" className={returns.roi == null ? 'metric-unknown' : returns.roi >= 0 ? 'text-positive' : 'text-negative'}>{formatPercentage(returns.roi)}</td>
      <td data-metric="quantity">{fmtPrice(fill.quantity)}</td>
      <td data-metric="price">{native ? `${fill.settle_currency} ${fmtPrice(fill.settle_price ?? fill.price)}` : formatTradePrice(fill.price, currency)}{native && <small>unconverted</small>}{fill.settle_currency && <small className="fill-settlement">{fill.settle_currency} {fmtPrice(fill.settle_price)}{fill.settle_fx_rate != null ? ` · FX ${fmtPrice(fill.settle_fx_rate)}` : ''}</small>}{fill.venue_market && <small className="fill-settlement">{fill.venue_market}</small>}</td>
      <td data-metric="commission" title="Reported commission; currency is not specified by the legacy field">{fmtPrice(fill.commission)}</td>
      <td>{measurement(fill.execution_quality?.slippage_bps, ' bps')}<small className="fill-settlement">Fees {fill.execution_quality?.fee_currency ? formatMoney(fill.execution_quality.fees, fill.execution_quality.fee_currency) : '—'}</small>{measured(fill.execution_quality?.fill_time_ms) && <small className="fill-settlement">{measurement(fill.execution_quality.fill_time_ms, ' ms', 0)}</small>}</td><td><span className="source-chip">{fill.source ?? 'Not recorded'}</span><small className="fill-settlement">{humanize(fill.reason)}</small></td>
    </tr>;
  })}</tbody></table><p className="table-hint">Select a fill to inspect its execution.</p></div>;
}

export function AuditEvents({ sessionId }: { sessionId: string }) {
  const context = useDecisions();
  const [severity, setSeverity] = useState('all');
  const query = useInfiniteQuery({ queryKey: ['engineEvents', sessionId], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => api.getEngineEvents(sessionId, pageParam), getNextPageParam: (page, _pages, cursor) => page?.next_cursor && page.next_cursor !== cursor ? page.next_cursor : undefined, refetchInterval: 30_000 });
  const seen = new Set<string>();
  const events = query.data?.pages.flatMap(page => rows(page?.events)).filter(event => { if (seen.has(event.id)) return false; seen.add(event.id); return true; }) ?? [];
  const unavailable = query.data?.pages[0] == null || query.data.pages[0].events == null;
  return <div className="audit-events"><div className="activity-filter"><label>Severity <select className="input" value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All events</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label><button className="btn btn-ghost" onClick={() => query.refetch()} disabled={query.isFetching}>Refresh</button></div>
    {query.isPending ? <p className="activity-empty">Loading audit events…</p> : query.error ? <p className="monitor-error" role="alert">{query.error.message}</p> : unavailable ? <p className="activity-empty">Structured audit events are not available from this backend yet.</p> : <>
      {!events.filter(event => severity === 'all' || event.severity === severity).length && <p className="activity-empty">No matching events.</p>}
      {events.filter(event => severity === 'all' || event.severity === severity).map(event => <button key={event.id} className={`audit-event ${context?.selection?.kind === 'event' && context.selection.event.id === event.id ? 'is-selected' : ''}`} onClick={() => context?.select({ kind: 'event', event })}><span className={`health-dot ${event.resolved_at ? 'healthy' : event.severity === 'critical' ? 'offline' : event.severity === 'warning' ? 'degraded' : 'unknown'}`} /><span><strong>{event.title ?? humanize(event.category)}</strong><small>{formatDate(event.occurred_at)} · {event.resolved_at ? 'Resolved' : 'Unresolved'}</small></span><span>↗</span></button>)}
      <button className="btn btn-ghost" disabled={!query.hasNextPage || query.isFetching} onClick={() => query.fetchNextPage()}>Load older events</button>
    </>}
  </div>;
}
