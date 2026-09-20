import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, SeriesMarker, MouseEventParams } from 'lightweight-charts';
import { api } from '../services/api';
import type { CurvePoint, FillMarker } from '../types/api';
import { GlassCard } from './GlassCard';
import { useDecisions } from './DecisionExplorer';

const lines = [ ['equity', 'Book', '#D4A843'], ['equal_weight', 'Equal weight', '#a58e54'], ['btc', 'BTC', '#9298a0'], ['exposure_matched', 'Exposure matched', '#e2bd63'] ] as const;
const time = (timestamp: string) => Math.floor(Date.parse(timestamp) / 1000);
function points(data: CurvePoint[] = []) {
  const unique = new Map<number, number>();
  for (const p of data) if (Number.isFinite(time(p.timestamp)) && Number.isFinite(p.index)) unique.set(time(p.timestamp), p.index);
  return [...unique].sort(([a], [b]) => a - b).map(([t, value]) => ({ time: t as Time, value }));
}

export function EvaluationCurve({ sessionId }: { sessionId: string }) {
  const context = useDecisions();
  const contextRef = useRef(context);
  contextRef.current = context;
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Line'>[]>([]);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markerData = useRef<FillMarker[]>([]);
  const fitted = useRef(false);
  const [windowDays, setWindowDays] = useState(30);
  const [visible, setVisible] = useState([true, true, true, true]);
  const query = useQuery({ queryKey: ['evaluationCurves', sessionId, windowDays], queryFn: () => api.getEvaluationCurves(sessionId, { windowDays }), refetchInterval: 60_000 });
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, { autoSize: true, height: 300, layout: { background: { color: 'transparent' }, textColor: '#9298a0' }, grid: { vertLines: { color: '#ffffff08' }, horzLines: { color: '#ffffff08' } }, timeScale: { timeVisible: true } });
    chartRef.current = chart;
    series.current = lines.map(([, title, color], i) => chart.addSeries(LineSeries, { title, color, lineWidth: 2, lineStyle: i === 3 ? 2 : 0 }));
    markers.current = createSeriesMarkers(series.current[0], []);
    const markerFor = (event: MouseEventParams) => typeof event.hoveredObjectId === 'string' ? markerData.current[Number(event.hoveredObjectId)] : undefined;
    chart.subscribeCrosshairMove(event => contextRef.current?.highlight(markerFor(event)?.decision_id ?? null));
    chart.subscribeClick(event => {
      const marker = markerFor(event);
      if (marker) contextRef.current?.select(marker.decision_id ? { kind: 'decision', decisionId: marker.decision_id } : { kind: 'mechanical', positionId: marker.position_id, reason: marker.reason, symbol: marker.symbol });
    });
    return () => { chart.remove(); chartRef.current = null; series.current = []; markers.current = null; fitted.current = false; };
  }, []);
  useEffect(() => {
    lines.forEach(([key], i) => { series.current[i]?.setData(points(query.data?.[key])); series.current[i]?.applyOptions({ visible: visible[i] }); });
    if (!fitted.current && query.data?.equity?.length) { chartRef.current?.timeScale().fitContent(); fitted.current = true; }
  }, [query.data, visible]);
  useEffect(() => {
    markerData.current = (query.data?.markers ?? []).filter(m => m.book_index != null && Number.isFinite(m.book_index) && Number.isFinite(time(m.timestamp))).sort((a, b) => time(a.timestamp) - time(b.timestamp));
    const values: SeriesMarker<Time>[] = markerData.current.map((m, i) => ({ id: String(i), time: time(m.timestamp) as Time, price: m.book_index!, position: 'atPriceMiddle', shape: m.side.toLowerCase() === 'buy' ? 'arrowUp' : 'arrowDown', color: m.decision_id && context?.highlighted === m.decision_id ? '#ffffff' : m.side.toLowerCase() === 'buy' ? '#10b981' : '#f43f5e', size: m.decision_id && context?.highlighted === m.decision_id ? 2 : 1, text: m.symbol }));
    markers.current?.setMarkers(visible[0] ? values : []);
  }, [query.data, context?.highlighted, visible]);
  return <GlassCard><h3 className="section-title">Book and market · indexed to 100</h3>
    <div className="decision-toolbar"><label>Window<select className="input" value={windowDays} onChange={e => { setWindowDays(Number(e.target.value)); fitted.current = false; }}>{[7, 30, 90, 120].map(days => <option key={days} value={days}>{days} days</option>)}</select></label>{lines.map(([, label, color], i) => <label key={label} style={{ color }}><input type="checkbox" checked={visible[i]} onChange={() => setVisible(v => v.map((x, j) => j === i ? !x : x))} /> {label}</label>)}</div>
    {query.isPending && <p>Loading market comparison…</p>}{query.error && <p role="alert">{query.error.message}</p>}
    {query.data && <><p>Anchor: {query.data.anchor ? new Date(query.data.anchor).toLocaleString() : 'Unavailable'}{query.data.anchored_on_rebuild ? ' · since last rebuild' : ''}</p>{query.data.notes?.map((note, i) => <p key={i}>{note}</p>)}{lines.filter(([key]) => !query.data?.[key]?.length).map(([key, label]) => <p key={key}>{label}: no measured series available.</p>)}{!!query.data.unavailable?.length && <p>Unpriced symbols: {query.data.unavailable.join(', ')}</p>}</>}
    <div ref={container} style={{ height: 300 }} />
    <p>▲ Buy · ▼ Sell · select a marker to inspect its decision or lot lineage.</p>
  </GlassCard>;
}
