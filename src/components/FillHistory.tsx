import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { RecentFillsFeed } from './RecentFillsFeed';
import type { TradeSide } from '../types/api';

export function FillHistory({ sessionId, currency }: { sessionId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<TradeSide | ''>('');
  const [source, setSource] = useState<'engine' | 'exchange' | ''>('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const invalid = !!since && !!until && since >= until;
  const filters = { symbol, side: side || undefined, source: source || undefined, since: since ? new Date(since).toISOString() : undefined, until: until ? new Date(until).toISOString() : undefined, limit: 50 };
  const query = useInfiniteQuery({
    queryKey: ['fillHistory', sessionId, filters], initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => api.getEngineFills(sessionId, { ...filters, before_id: pageParam }),
    getNextPageParam: page => { const ids = page.fills.flatMap(f => f.id == null ? [] : [f.id]); return page.fills.length === 50 && ids.length ? Math.min(...ids) : undefined; },
    enabled: open && !invalid,
  });
  const seen = new Set<number>();
  const fills = query.data?.pages.flatMap(p => p.fills).filter(fill => { if (fill.id == null) return true; if (seen.has(fill.id)) return false; seen.add(fill.id); return true; }) ?? [];
  return <section><button className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide fill history' : 'Browse fill history'}</button>{open && <>
    <div className="decision-toolbar"><label>Symbol<input className="input" value={symbol} onChange={e => setSymbol(e.target.value)} /></label><label>Side<select className="input" value={side} onChange={e => setSide(e.target.value as TradeSide | '')}><option value="">All</option><option>BUY</option><option>SELL</option></select></label><label>Source<select className="input" value={source} onChange={e => setSource(e.target.value as typeof source)}><option value="">All</option><option>engine</option><option>exchange</option></select></label><label>Since<input className="input" type="datetime-local" value={since} onChange={e => setSince(e.target.value)} /></label><label>Until<input className="input" type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} /></label></div>
    {invalid ? <p role="alert">Since must be before until.</p> : <>{query.isPending && <p>Loading history…</p>}{query.error && <p role="alert">{query.error.message}</p>}{query.data && <RecentFillsFeed fills={fills} currency={currency} />}<button className="btn btn-ghost" disabled={!query.hasNextPage || query.isFetching} onClick={() => query.fetchNextPage()}>Load older fills</button></>}
  </>}</section>;
}
