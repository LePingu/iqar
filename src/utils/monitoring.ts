import type { CurvePoint, DataFreshness, EquityPoint } from '../types/api';

export const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const rows = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value.filter(item => item != null) : [];
export const humanize = (value: string | null | undefined) => value ? value.replaceAll('_', ' ') : 'Not recorded';
export function measurement(value: number | null | undefined, unit = '', digits = 1) {
  return measured(value) ? `${value.toFixed(digits)}${unit}` : '—';
}
export function isStale(data?: DataFreshness | null, now = Date.now()) {
  if (!data?.as_of || !measured(data.stale_after_seconds)) return null;
  const timestamp = Date.parse(data.as_of);
  return Number.isFinite(timestamp) ? now - timestamp > data.stale_after_seconds * 1000 : null;
}
export function curvePoints(data?: CurvePoint[] | null) {
  const unique = new Map<number, number>();
  for (const point of rows(data)) {
    const timestamp = Date.parse(point.timestamp);
    if (Number.isFinite(timestamp) && measured(point.index)) unique.set(Math.floor(timestamp / 1000), point.index - 100);
  }
  return [...unique].sort(([a], [b]) => a - b).map(([time, value]) => ({ time, value }));
}
// A clearly labelled fallback from measured ledger capital, never a synthetic
// benchmark. It is NOT advertised as cash-flow adjusted or net of fees.
export function ledgerCurve(data: EquityPoint[] | null | undefined, days: number, now = Date.now()) {
  const start = now / 1000 - days * 86400;
  const unique = new Map<number, number>();
  for (const point of rows(data)) if (measured(point.time) && point.time >= start && measured(point.capital)) unique.set(point.time, point.capital);
  const sorted = [...unique].sort(([a], [b]) => a - b);
  const anchor = sorted[0]?.[1];
  if (!measured(anchor) || anchor <= 0) return [];
  return sorted.map(([time, capital]) => ({ time, value: (capital / anchor - 1) * 100 }));
}
export function alignedComparison(equity?: CurvePoint[] | null, benchmark?: CurvePoint[] | null) {
  const book = curvePoints(equity), other = curvePoints(benchmark);
  // Comparing different latest times would present an invalid headline.
  if (!book.length || !other.length || book.at(-1)?.time !== other.at(-1)?.time) return null;
  return { benchmark: other.at(-1)!.value, difference: book.at(-1)!.value - other.at(-1)!.value };
}
