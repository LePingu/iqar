import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { DecisionSelection, DecisionSource, DecisionSummary } from '../types/api';
import { GlassCard } from './GlassCard';

const DecisionContext = createContext<{
  source: DecisionSource; highlighted: string | null;
  highlight: (id: string | null) => void; select: (selection: DecisionSelection) => void;
} | null>(null);
// Shared by cards and chart markers within a single run or session.
// eslint-disable-next-line react-refresh/only-export-components
export const useDecisions = () => useContext(DecisionContext);
const display = (value: unknown): string => value == null ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

function Fields({ value }: { value: unknown }) {
  if (value == null) return <p>Not recorded</p>;
  if (typeof value !== 'object') return <p>{display(value)}</p>;
  return <dl className="decision-fields">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{display(item)}</dd></div>)}</dl>;
}

export function DecisionProvider({ source, children }: { source: DecisionSource; children: ReactNode }) {
  const [highlighted, highlight] = useState<string | null>(null);
  const [selection, select] = useState<DecisionSelection | null>(null);
  return <DecisionContext.Provider value={{ source, highlighted, highlight, select }}>
    {children}
    {selection && <DecisionPathDrawer source={source} selection={selection} onClose={() => select(null)} onSelect={select} />}
  </DecisionContext.Provider>;
}

function DecisionPathDrawer({ source, selection, onClose, onSelect }: {
  source: DecisionSource; selection: DecisionSelection; onClose: () => void; onSelect: (s: DecisionSelection) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useQuery({
    queryKey: ['decision', source, selection.kind === 'decision' ? selection.decisionId : null],
    queryFn: () => api.getDecision(source, selection.kind === 'decision' ? selection.decisionId : ''),
    enabled: selection.kind === 'decision',
  });
  const lineage = useQuery({
    queryKey: ['lotLineage', source, selection.kind === 'mechanical' ? selection.positionId : null],
    queryFn: () => api.getOracleLotLineage(source.kind === 'session' ? source.sessionId : '', selection.kind === 'mechanical' ? selection.positionId! : 0),
    enabled: source.kind === 'session' && selection.kind === 'mechanical' && selection.positionId != null,
  });
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const data = detail.data;
  return <dialog ref={dialog} className="decision-drawer" onCancel={onClose} aria-labelledby="decision-title">
    <button className="btn btn-ghost" onClick={onClose} autoFocus>Close ×</button>
    <h2 id="decision-title">{selection.kind === 'mechanical' ? selection.reason ?? 'No linked decision' : 'Decision path'}</h2>
    {selection.kind === 'decision' ? <>
      {detail.isPending && <p>Loading decision…</p>}
      {detail.error && <p role="alert">{detail.error.message}</p>}
      {data && <>
        <h3>{data.decision.symbol} · {data.decision.action} · {data.decision.outcome}</h3>
        <p>{new Date(data.decision.decided_at).toLocaleString()} · engine decision time</p>
        <p>{data.decision.reasoning}</p>
        {!data.context ? <p>No path recorded</p> : <ol className="decision-timeline">
          {['regime', 'signals', 'mtf', 'critic', 'position_manager'].map(key => <li key={key}><h3>{key.replaceAll('_', ' ')}</h3><Fields value={data.context?.[key]} /></li>)}
          <li><h3>Adjustments</h3>{data.context.adjustments?.length ? data.context.adjustments.map((step, i) => <Fields key={i} value={step} />) : <p>No adjustments recorded</p>}</li>
        </ol>}
        <h3>Engine outcome</h3><Fields value={{ outcome: data.decision.outcome, detail: data.decision.outcome_detail, requested_size: data.decision.position_size, resolved_size: data.decision.resolved_size }} />
        <h3>Linked lots</h3>{[...(data.opened_lots ?? []), ...(data.closed_lots ?? [])].map(lot => <section key={lot.id}><Fields value={lot} />{source.kind === 'session' && <button className="btn btn-ghost" onClick={() => onSelect({ kind: 'mechanical', positionId: lot.id, reason: lot.exit_reason })}>Open lot lineage</button>}</section>)}
        <h3>Fills</h3>{(data.fills ?? []).map(fill => <Fields key={fill.id} value={fill} />)}
        <details><summary>Features and traces</summary><Fields value={data.features} /><Fields value={data.trace_files} /></details>
      </>}
    </> : <>
      {lineage.isFetching && <p>Loading lot lineage…</p>}
      {lineage.error && <p role="alert">{lineage.error.message}</p>}
      {lineage.data ? <><h3>{lineage.data.lot.exit_reason ?? selection.reason ?? 'Lot lineage'}</h3><Fields value={lineage.data.lot} />{lineage.data.fills.map(fill => <section key={fill.id}><Fields value={fill} />{fill.decision_id && <button className="btn btn-ghost" onClick={() => onSelect({ kind: 'decision', decisionId: fill.decision_id! })}>Open decision</button>}</section>)}<Fields value={lineage.data.trace_files} /></> : !lineage.isFetching && !lineage.error && <p>No linked decision or available lot lineage. Earlier fills, mechanical exits and exchange fills may have no decision record.</p>}
    </>}
  </dialog>;
}

export function DecisionCard({ decision, decisionId, reason, positionId, symbol, children }: {
  decision?: DecisionSummary; decisionId?: string | null; reason?: string | null;
  positionId?: number | null; symbol?: string; children?: ReactNode;
}) {
  const context = useDecisions();
  const [hover, setHover] = useState(false);
  const id = decision?.decision_id ?? decisionId;
  const query = useQuery({ queryKey: ['decision', context?.source, id],
    queryFn: () => api.getDecision(context!.source, id!), enabled: !!context && !!id && hover && !decision, staleTime: 60_000 });
  const summary = decision ?? query.data?.decision;
  const family = summary?.executed ? 'executed' : summary?.outcome === 'hold' ? 'hold' : /gate|blocked|refused|zero|cap/.test(summary?.outcome ?? '') ? 'declined' : 'unfilled';
  if (!context) return <>{children}</>;
  const enter = () => { setHover(true); context.highlight(id ?? null); };
  const leave = () => { setHover(false); context.highlight(null); };
  return <div className={`decision-card ${id && context.highlighted === id ? 'is-highlighted' : ''}`} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
    {children}
    <button className="decision-open" onClick={() => context.select(id ? { kind: 'decision', decisionId: id, summary } : { kind: 'mechanical', positionId, reason, symbol })}>
      {summary ? <><strong>{summary.symbol} · {summary.action.toUpperCase()}</strong><span>Price {display(summary.price)} · confidence {display(summary.confidence)}</span><span className={`outcome-${family}`}>{summary.outcome.replaceAll('_', ' ')}</span></> : <span>{id ? 'View decision' : reason ?? 'View fill lineage'}</span>}
    </button>
    {hover && id && <div className="decision-popover" role="tooltip">
      {query.isFetching && !summary && <p>Loading summary…</p>}{query.error && <p>{query.error.message}</p>}
      {summary && <Fields value={{ regime: summary.regime_label, regime_weight: summary.regime_weight === null ? 'Legacy hard gate' : summary.regime_weight, critic_agree: summary.critic_agree, critic_reason: summary.critic_reason_code, ml_p_profit: summary.ml_p_profit, pm_signal: summary.pm_signal, mtf_choppy: summary.mtf_is_choppy, requested_size: summary.position_size, resolved_size: summary.resolved_size }} />}
    </div>}
  </div>;
}

export function DecisionBook() {
  const context = useDecisions();
  const [tab, setTab] = useState('all');
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [offset, setOffset] = useState(0);
  const invalidRange = !!since && !!until && since >= until;
  const filters = { symbol, action, outcome, since: since ? new Date(since).toISOString() : undefined, until: until ? new Date(until).toISOString() : undefined, executed: tab === 'declined' ? false : undefined, limit: 50, offset };
  const query = useQuery({ queryKey: ['decisions', context?.source, filters], queryFn: () => api.getDecisions(context!.source, filters), enabled: !!context && !invalidRange, refetchInterval: context?.source.kind === 'session' && offset === 0 ? 15_000 : false });
  const groups = new Map<string, DecisionSummary[]>();
  for (const decision of query.data?.decisions ?? []) {
    const key = tab === 'declined' ? decision.outcome : 'All decisions';
    groups.set(key, [...(groups.get(key) ?? []), decision]);
  }
  return <GlassCard><h3 className="section-title">Decision explorer</h3>
    <div className="decision-toolbar" role="tablist" aria-label="Decision book">{['all', 'declined'].map(value => <button key={value} role="tab" aria-selected={tab === value} className="btn btn-ghost" onClick={() => { setTab(value); setOffset(0); }}>{value === 'all' ? 'All decisions' : 'Declined book'}</button>)}</div>
    <div className="decision-toolbar">
      <label>Symbol<input className="input" value={symbol} onChange={e => { setSymbol(e.target.value); setOffset(0); }} /></label>
      <label>Action<select className="input" value={action} onChange={e => { setAction(e.target.value); setOffset(0); }}><option value="">All</option>{['buy', 'sell', 'hold'].map(a => <option key={a}>{a}</option>)}</select></label>
      <label>Outcome<input className="input" value={outcome} onChange={e => { setOutcome(e.target.value); setOffset(0); }} /></label>
      <label>Since<input className="input" type="datetime-local" value={since} onChange={e => { setSince(e.target.value); setOffset(0); }} /></label>
      <label>Until<input className="input" type="datetime-local" value={until} onChange={e => { setUntil(e.target.value); setOffset(0); }} /></label>
    </div>
    {invalidRange ? <p role="alert">Since must be before until.</p> : query.isPending ? <p>Loading decisions…</p> : query.error ? <p role="alert">{query.error.message}</p> : <>
      {!query.data?.decisions.length && <p>{symbol || action || outcome || since || until || tab === 'declined' ? 'No matching decisions.' : 'No decisions recorded yet.'}</p>}
      {[...groups].map(([key, decisions]) => <section key={key}><h4>{key.replaceAll('_', ' ')}{tab === 'declined' && ' · this page'}</h4>{decisions.map(d => <DecisionCard key={d.decision_id} decision={d}><time>{new Date(d.decided_at).toLocaleString()}</time></DecisionCard>)}</section>)}
      <div className="decision-toolbar"><button className="btn btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{query.data?.total_matching ?? 0} decisions · page {offset / 50 + 1}</span><button className="btn btn-ghost" disabled={!query.data || offset + 50 >= query.data.total_matching} onClick={() => setOffset(offset + 50)}>Next</button></div>
    </>}
  </GlassCard>;
}
