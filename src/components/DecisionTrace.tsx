import type { DecisionContext, DecisionSummary, EvaluationGateEvent } from '../types/api';
import { formatDate } from '../utils/trading';
import { humanize, rows } from '../utils/monitoring';

const display = (value: unknown): string => value == null ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

export function RecordedFields({ value }: { value: unknown }) {
  if (value == null) return <p>Not recorded</p>;
  if (typeof value !== 'object') return <p>{display(value)}</p>;
  if (!Object.keys(value).length) return <p>No fields recorded</p>;
  return <dl className="decision-fields">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{humanize(key)}</dt><dd>{display(item)}</dd></div>)}</dl>;
}

export function GateDetails({ evaluation }: { evaluation?: EvaluationGateEvent | null }) {
  return <section className="gate-details"><h3>Evaluator gate</h3>{evaluation ? <>
    <p className="widget-note">{formatDate(evaluation.occurred_at)} · stored cycle verdict · event {evaluation.event_id}</p>
    <span className="fill-status">{evaluation.should_decide == null ? 'Verdict unavailable' : evaluation.should_decide ? 'Decision requested' : 'Quiet checkpoint'}</span>
    <h4>Selected trigger</h4><p className="gate-reason">{evaluation.selected_reason ?? 'Not recorded'}</p>
    <h4>Stored detector state & concurrent triggers</h4><RecordedFields value={evaluation.state} />
    <p className="widget-note">Readiness, progress and elapsed time are shown only when recorded. Quiet checkpoints are sampled hourly; intervening ticks are not sampled.</p>
  </> : <p>Gate history unavailable</p>}</section>;
}

function signalFields(context: DecisionContext, family: string) {
  const signals = context.signals;
  const fields = signals ? Object.fromEntries(Object.entries(signals).filter(([key]) => key === family || key.startsWith(`${family}_`))) : {};
  return context[family] ?? (Object.keys(fields).length ? fields : null);
}

export function RecordedPath({ context, decision }: { context?: DecisionContext | null; decision: DecisionSummary }) {
  if (!context) return <p>Path unavailable</p>;
  return <><p className="widget-note">Recorded inputs and adjustments, in graph order. Precompute and node status: unknown. This snapshot does not establish per-node timing or source health.</p>
    <ol className="decision-timeline">
      <li><details open><summary>Portfolio regime</summary><RecordedFields value={context.regime} /></details></li>
      <li><details open><summary>Pattern analysis</summary><RecordedFields value={signalFields(context, 'pattern')} /><h4>Multi-timeframe inputs</h4><RecordedFields value={context.mtf} /><RecordedFields value={{ ml_p_profit: decision.ml_p_profit }} /><h4>Early critic</h4><RecordedFields value={context.critic} /><p className="widget-note">The critic runs inside pattern analysis, before sentiment, correlation and risk.</p></details></li>
      {['sentiment', 'correlation', 'risk'].map(key => <li key={key}><details><summary>{key.charAt(0).toUpperCase() + key.slice(1)}</summary><RecordedFields value={signalFields(context, key)} /></details></li>)}
      <li><details><summary>Position manager proposal</summary><RecordedFields value={context.position_manager} /></details></li>
      <li><details open><summary>Execution decision</summary><h4>Consumed signals, consensus & weights</h4><RecordedFields value={context.signals} /><h4>Adjustments</h4>{rows(context.adjustments).length ? <ol className="adjustment-list">{rows(context.adjustments).map((step, i) => <li key={i}><RecordedFields value={step} /></li>)}</ol> : <p>No adjustments recorded</p>}</details></li>
    </ol>
  </>;
}
