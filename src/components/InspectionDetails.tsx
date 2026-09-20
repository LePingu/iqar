import { useQuery } from '@tanstack/react-query';
import type { DecisionSelection, DecisionSource, ExecutionQuality, LiveFill, OpenPosition } from '../types/api';
import { api } from '../services/api';
import { formatDate, formatMoney, fmtPrice, formatPercentage } from '../utils/trading';
import { humanize, measurement, rows } from '../utils/monitoring';

function Quality({ value }: { value?: ExecutionQuality | null }) {
  return <><div className="execution-metrics"><div><span>Slippage</span><strong>{measurement(value?.slippage_bps, ' bps')}</strong></div><div><span>Fees</span><strong>{value?.fee_currency ? formatMoney(value.fees, value.fee_currency) : '—'}</strong></div><div><span>Fill time</span><strong>{measurement(value?.fill_time_ms, ' ms', 0)}</strong></div></div><p className="widget-note">Reference: {humanize(value?.reference)}{value?.unavailable_reason ? ` · ${value.unavailable_reason}` : ''}</p></>;
}

function OrderDetails({ source, orderId, quality }: { source: DecisionSource; orderId?: string | null; quality?: ExecutionQuality | null }) {
  const query = useQuery({ queryKey: ['orderExecution', source, orderId], queryFn: () => api.getOrderExecution(source.kind === 'session' ? source.sessionId : '', orderId!), enabled: source.kind === 'session' && !!orderId, retry: false, refetchInterval: q => q.state.data && !['filled', 'cancelled', 'rejected', 'expired'].includes(q.state.data.status ?? '') ? 5000 : false });
  const order = query.data;
  return <>
    <Quality value={order?.quality ?? quality} />
    <h4>Execution timeline</h4>
    {query.isFetching && !order && <p className="widget-note">Loading execution…</p>}
    {query.error && <p className="monitor-error" role="alert">{query.error.message}</p>}
    {order?.events?.length ? <ol className="execution-timeline">{rows(order.events).map(event => <li key={event.id}><span className={`timeline-node ${event.stage === 'filled' ? 'filled' : ''}`} /><div><strong>{humanize(event.stage)}</strong><time title={formatDate(event.occurred_at)}>{event.occurred_at && Number.isFinite(Date.parse(event.occurred_at)) ? new Date(event.occurred_at).toLocaleTimeString() : 'Not recorded'}</time>{event.detail && <p>{event.detail}</p>}</div></li>)}</ol> : !query.isFetching && <p className="explorer-note">No execution timeline recorded yet. Older fills may not have a linked order.</p>}
    {order && <details><summary>Order quantities & status</summary><dl className="telemetry-stats"><div><dt>Status</dt><dd>{humanize(order.status)}</dd></div><div><dt>Requested</dt><dd>{fmtPrice(order.requested_quantity)}</dd></div><div><dt>Filled</dt><dd>{fmtPrice(order.filled_quantity)}</dd></div><div><dt>Average price</dt><dd>{order.currency ? formatMoney(order.average_fill_price, order.currency) : fmtPrice(order.average_fill_price)}</dd></div><div><dt>Trigger</dt><dd>{humanize(order.trigger_type)}</dd></div></dl></details>}
  </>;
}

function PositionDetails({ position, onSelect }: { position: OpenPosition; onSelect: (s: DecisionSelection) => void }) {
  const protection = position.protection;
  return <><h2>{position.symbol ?? 'Position'}</h2><p className="widget-note">{humanize(position.basis_source)} basis{position.basis_source === 'adopted' ? ` · observed since ${formatDate(position.adopted_at)}` : ''}</p>
    <dl className="telemetry-stats"><div><dt>Quantity</dt><dd>{fmtPrice(position.quantity)}</dd></div><div><dt>Entry / current</dt><dd>{fmtPrice(position.entry_price)} / {fmtPrice(position.current_price)}</dd></div><div><dt>{position.basis_source === 'adopted' ? 'P&L under management' : 'P&L'}</dt><dd>{formatPercentage(position.unrealized_pnl_pct)}</dd></div><div><dt>Allocation</dt><dd>{measurement(protection?.allocation_pct, '%')}</dd></div><div><dt>Effective stop</dt><dd>{fmtPrice(protection?.effective_stop_price)}</dd></div><div><dt>Distance to stop</dt><dd>{measurement(protection?.stop_distance_pct, '%')}</dd></div><div><dt>Free / bonded quantity</dt><dd>{fmtPrice(protection?.free_quantity)} / {fmtPrice(protection?.bonded_quantity)}</dd></div><div><dt>Stop mechanism</dt><dd>{humanize(protection?.mechanism)}</dd></div><div><dt>Executable protection</dt><dd>{protection?.executable == null ? 'Unavailable' : protection.executable ? 'Yes' : 'No'}</dd></div><div><dt>Trailing stop</dt><dd>{position.trailing_stop_active == null ? 'Unavailable' : position.trailing_stop_active ? 'Active' : 'Inactive'}</dd></div></dl>
    {protection?.reason && <p className="explorer-note">{protection.reason}</p>}{protection?.executable == null && <p className="widget-note">A configured stop alone does not confirm that the holding can be sold.</p>}
    {position.position_id != null && <button className="inspector-link" onClick={() => onSelect({ kind: 'mechanical', positionId: position.position_id, symbol: position.symbol, reason: 'Position lineage' })}>Open lot lineage ↗</button>}
  </>;
}

function FillDetails({ fill, currency, source, onSelect }: { fill: LiveFill; currency: string; source: DecisionSource; onSelect: (s: DecisionSelection) => void }) {
  const native = fill.settle_currency && fill.settle_currency !== currency && fill.settle_fx_rate == null;
  return <>
    <div className="selected-fill-heading"><h2>{fill.symbol ?? 'Fill'}</h2><span className="fill-status">Recorded fill</span></div>
    <p><span className={fill.side === 'BUY' ? 'text-positive' : 'text-negative'}>{fill.side ?? 'Unknown side'}</span> <span className="widget-note"> · {formatDate(fill.timestamp)}</span></p>
    <OrderDetails source={source} orderId={fill.order_id} quality={fill.execution_quality} />
    <details><summary>Fill details</summary><dl className="telemetry-stats"><div><dt>Quantity</dt><dd>{fmtPrice(fill.quantity)}</dd></div><div><dt>Price</dt><dd>{native ? `${fill.settle_currency} ${fmtPrice(fill.settle_price ?? fill.price)} (unconverted)` : formatMoney(fill.price, currency)}</dd></div><div><dt>Source</dt><dd>{fill.source ?? 'Not recorded'}</dd></div><div><dt>Reason</dt><dd>{humanize(fill.reason)}</dd></div><div><dt>Venue market</dt><dd>{fill.venue_market ?? 'Not recorded'}</dd></div>{fill.settle_currency && <div><dt>Native settlement</dt><dd>{fill.settle_currency} {fmtPrice(fill.settle_price)} · FX {fmtPrice(fill.settle_fx_rate)}</dd></div>}{fill.source !== 'exchange' && <div><dt>Realized P&L</dt><dd>{formatMoney(fill.realized_pnl, currency)} / {formatPercentage(fill.realized_pnl_pct)}</dd></div>}</dl></details>
    {fill.decision_id ? <button className="inspector-link" onClick={() => onSelect({ kind: 'decision', decisionId: fill.decision_id! })}>Decision reasoning ↗</button> : <p className="widget-note">No linked decision. Mechanical exits, exchange fills and older records may have none.</p>}
    {fill.position_id != null && <button className="inspector-link" onClick={() => onSelect({ kind: 'mechanical', positionId: fill.position_id, reason: fill.reason, symbol: fill.symbol })}>Linked lot & fills ↗</button>}
  </>;
}

export function InspectionDetails({ source, selection, onSelect, onClose }: { source: DecisionSource; selection: DecisionSelection; onSelect: (s: DecisionSelection) => void; onClose: () => void }) {
  return <div className="details-content"><button className="explorer-close" onClick={onClose} aria-label="Clear selection">×</button>
    {selection.kind === 'fill' && <FillDetails source={source} fill={selection.fill} currency={selection.currency} onSelect={onSelect} />}
    {selection.kind === 'position' && <PositionDetails position={selection.position} onSelect={onSelect} />}
    {selection.kind === 'order' && <><h2>Order execution</h2><OrderDetails source={source} orderId={selection.orderId} /></>}
    {selection.kind === 'event' && <><h2>{selection.event.title ?? 'Audit event'}</h2><p className="widget-note">{humanize(selection.event.severity)} · {formatDate(selection.event.occurred_at)}</p><p>{selection.event.detail ?? 'No additional detail recorded.'}</p><dl className="telemetry-stats"><div><dt>Actor</dt><dd>{selection.event.actor ?? 'Not recorded'}</dd></div><div><dt>Command state</dt><dd>{humanize(selection.event.command_state)}</dd></div><div><dt>Resolved</dt><dd>{selection.event.resolved_at ? formatDate(selection.event.resolved_at) : 'Not recorded'}</dd></div></dl>{selection.event.decision_id && <button className="inspector-link" onClick={() => onSelect({ kind: 'decision', decisionId: selection.event.decision_id! })}>Related decision ↗</button>}{selection.event.order_id && <button className="inspector-link" onClick={() => onSelect({ kind: 'order', orderId: selection.event.order_id! })}>Related order ↗</button>}{selection.event.position_id != null && <button className="inspector-link" onClick={() => onSelect({ kind: 'mechanical', positionId: selection.event.position_id })}>Related lot ↗</button>}<details><summary>Recorded changes</summary><pre>{JSON.stringify({ before: selection.event.before ?? null, after: selection.event.after ?? null }, null, 2)}</pre></details></>}
  </div>;
}
