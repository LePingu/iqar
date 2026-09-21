import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, SeriesMarker, MouseEventParams } from 'lightweight-charts';
import { api } from '../services/api';
import type { EquityPoint, FillMarker, EngineMode } from '../types/api';
import { GlassCard } from './GlassCard';
import { useDecisions } from './DecisionExplorer';
import { curvePoints, ledgerCurve, rows, isStale } from '../utils/monitoring';
import type { PerformancePoint } from '../utils/monitoring';
import { formatDate, formatMoney, formatPercentage } from '../utils/trading';

const lines = [['equity', 'Portfolio', '#d4af56'], ['btc', 'BTC', '#9ca8b9'], ['equal_weight', 'Equal weight', '#a48c60'], ['exposure_matched', 'Exposure matched', '#bfb073']] as const;
const timestamp = (value: string) => Math.floor(Date.parse(value) / 1000);

export function EvaluationCurve({ sessionId, mode, currency, ledger, ledgerAsOf }: { sessionId: string; mode: EngineMode; currency: string; ledger?: EquityPoint[] | null; ledgerAsOf?: string | null }) {
  const context = useDecisions();
  const contextRef = useRef(context);
  contextRef.current = context;
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Line'>[]>([]);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markerData = useRef<FillMarker[]>([]);
  const plotted = useRef<PerformancePoint[][]>([]);
  const fitted = useRef(false);
  const [windowDays, setWindowDays] = useState(30);
  const [visible, setVisible] = useState([true, true, false, false]);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [hover, setHover] = useState<{ time: number; values: { label: string; color: string; value: number; returnPct: number }[] } | null>(null);
  const query = useQuery({ queryKey: ['evaluationCurves', sessionId, windowDays], queryFn: () => api.getEvaluationCurves(sessionId, { windowDays }), refetchInterval: 60_000, retry: false });
  const wrongBook = query.data?.mode && query.data.mode !== mode;
  const data = wrongBook ? null : query.data;
  const evaluated = useMemo(() => curvePoints(data?.equity), [data]);
  const fallback = useMemo(() => ledgerCurve(ledger, windowDays), [ledger, windowDays]);
  const usingLedger = !evaluated.length && fallback.length > 0;
  const book = usingLedger ? fallback : evaluated;
  const selectedDecision = context?.selection?.kind === 'decision' ? context.selection.decisionId : context?.selection?.kind === 'fill' ? context.selection.fill.decision_id : null;
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, { autoSize: true, height: 340, layout: { background: { color: 'transparent' }, textColor: '#89929e', fontFamily: 'Inter, sans-serif', fontSize: 11 }, grid: { vertLines: { color: '#ffffff05' }, horzLines: { color: '#ffffff09' } }, rightPriceScale: { borderVisible: false }, timeScale: { timeVisible: true, borderVisible: false, lockVisibleTimeRangeOnResize: true }, crosshair: { vertLine: { color: '#d4af5655' }, horzLine: { color: '#d4af5655' } } });
    chartRef.current = chart;
    series.current = lines.map(([, title, color], i) => chart.addSeries(LineSeries, { title, color, lineWidth: 2, lineStyle: i === 3 ? 2 : 0, priceFormat: { type: 'custom', minMove: 0.01, formatter: (value: number) => formatMoney(value, currency) } }));
    markers.current = createSeriesMarkers(series.current[0], []);
    const markerFor = (event: MouseEventParams) => typeof event.hoveredObjectId === 'string' ? markerData.current[Number(event.hoveredObjectId)] : undefined;
    chart.subscribeCrosshairMove(event => {
      contextRef.current?.highlight(markerFor(event)?.decision_id ?? null);
      if (typeof event.time !== 'number') return setHover(null);
      const values = lines.flatMap(([, label, color], i) => {
        const point = plotted.current[i]?.find(candidate => candidate.time === event.time);
        return point && visibleRef.current[i] ? [{ label, color, value: point.value, returnPct: point.returnPct }] : [];
      });
      setHover(values.length ? { time: event.time, values } : null);
    });
    chart.subscribeClick(event => {
      const marker = markerFor(event);
      if (!marker) return;
      contextRef.current?.select(marker.order_id ? { kind: 'order', orderId: marker.order_id } : marker.decision_id ? { kind: 'decision', decisionId: marker.decision_id } : { kind: 'mechanical', positionId: marker.position_id, reason: marker.reason, symbol: marker.symbol });
    });
    return () => { chart.remove(); chartRef.current = null; series.current = []; markers.current = null; fitted.current = false; };
  }, [currency]);
  useEffect(() => {
    lines.forEach(([key], i) => {
      const points = i === 0 ? book : usingLedger ? [] : curvePoints(data?.[key]);
      plotted.current[i] = points;
      series.current[i]?.setData(points.map(p => ({ time: p.time as Time, value: p.value })));
      series.current[i]?.applyOptions({ visible: visible[i] });
    });
    if (!fitted.current && book.length) { chartRef.current?.timeScale().fitContent(); fitted.current = true; }
  }, [data, book, visible, usingLedger]);
  useEffect(() => {
    const bookValues = new Map(book.map(point => [point.time, point.value]));
    markerData.current = usingLedger ? [] : rows(data?.markers).filter(m => Number.isFinite(timestamp(m.timestamp)) && bookValues.has(timestamp(m.timestamp))).sort((a, b) => timestamp(a.timestamp) - timestamp(b.timestamp));
    const values: SeriesMarker<Time>[] = markerData.current.map((m, i) => {
      const highlighted = !!m.decision_id && (context?.highlighted === m.decision_id || selectedDecision === m.decision_id);
      return { id: String(i), time: timestamp(m.timestamp) as Time, price: bookValues.get(timestamp(m.timestamp))!, position: 'atPriceMiddle', shape: m.side?.toLowerCase() === 'buy' ? 'arrowUp' : 'arrowDown', color: highlighted ? '#fff4c9' : m.side?.toLowerCase() === 'buy' ? '#58d59a' : '#f28b7d', size: highlighted ? 2 : 1 };
    });
    markers.current?.setMarkers(visible[0] ? values : []);
  }, [data, book, context?.highlighted, selectedDecision, visible, usingLedger]);
  const latestValue = book.at(-1)?.value;
  const anchor = usingLedger ? book[0]?.time ? new Date(book[0].time * 1000).toISOString() : null : data?.anchor;
  return <GlassCard className="performance-panel">
    <div className="performance-heading"><div><h2>Portfolio value</h2><div className="performance-return"><strong>{formatMoney(latestValue, currency)}</strong></div></div><div className="chart-periods" role="group" aria-label="Chart period">{[7, 30, 90].map(days => <button key={days} aria-pressed={windowDays === days} onClick={() => { setWindowDays(days); fitted.current = false; }}>{days}D</button>)}</div></div>
    <div className="chart-legend" role="group" aria-label="Visible chart curves">{lines.map(([, label, color], i) => <label key={label} className={`curve-toggle ${visible[i] ? 'is-on' : ''}`} style={{ '--curve-color': color } as CSSProperties}><input type="checkbox" checked={visible[i]} onChange={() => setVisible(v => v.map((x, j) => j === i ? !x : x))} /><span className="curve-check" aria-hidden="true">{visible[i] && <svg viewBox="0 0 12 12"><path d="m2 6 2.5 2.5L10 3" /></svg>}</span>{label}</label>)}</div>
    {query.isPending && !book.length && <p className="chart-message">Loading performance…</p>}{query.error && <p className="chart-message" role="status">Comparison unavailable: {query.error.message}</p>}{wrongBook && <p className="chart-message" role="alert">Comparison returned a different book and is hidden.</p>}
    {!query.isPending && !book.length && <p className="chart-message">No measured portfolio curve for this period.</p>}
    {usingLedger && <p className="chart-message">Ledger values only. Return adjustments and comparable benchmarks are unavailable.</p>}
    <div ref={container} className="performance-canvas" style={{ height: 340 }} />
    {hover && <div className="chart-hover" role="status"><span>{formatDate(hover.time)}</span>{hover.values.map(item => <span key={item.label}><i style={{ backgroundColor: item.color }} />{item.label} {formatMoney(item.value, currency)} <b>{formatPercentage(item.returnPct)}</b></span>)}</div>}
    <div className="chart-caption"><span>{!usingLedger && data?.net_of_fees === true ? 'Net of fees' : !usingLedger && data?.net_of_fees === false ? 'Before fees' : 'Fee treatment unavailable'} · {!usingLedger && data?.cash_flow_adjusted === true ? 'Cash-flow adjusted' : 'Cash-flow adjustment unconfirmed'}</span><span>{isStale(data) ? 'Stale · ' : ''}As of {formatDate(usingLedger ? ledgerAsOf : data?.as_of ?? data?.end)}</span></div>
    <details className="chart-data-notes"><summary>Period & data coverage</summary><p>From {formatDate(anchor)}{data?.anchored_on_rebuild ? ' · since last rebuild' : ''}. ▲ Buy · ▼ Sell — select to inspect.</p>{rows(data?.notes).map((note, i) => <p key={i}>{note}</p>)}{lines.filter(([key], i) => i > 0 && (usingLedger || !data?.[key]?.length)).map(([key, label]) => <p key={key}>{label}: no comparable series available.</p>)}{!!data?.unavailable?.length && <p>Unpriced symbols: {data.unavailable.join(', ')}</p>}</details>
  </GlassCard>;
}
