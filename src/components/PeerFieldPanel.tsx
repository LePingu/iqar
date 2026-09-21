import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PeerFieldEntry, PeerScorecardSummary } from '../types/api';
import { formatDate, formatPercentage } from '../utils/trading';
import { GlassCard } from './GlassCard';

const dash = (value: number | null | undefined, digits = 2) => value == null ? '—' : value.toFixed(digits);
const rank = (value: number | null | undefined, count: number) => value == null ? '—' : `#${value} of ${count}`;

function ScoreRow({ row, ours, onSelect }: { row: PeerFieldEntry | PeerScorecardSummary; ours?: boolean; onSelect?: () => void }) {
  return <tr className={ours ? 'peer-ours' : undefined} onClick={onSelect}>
    <td><strong>{ours ? 'Book (you)' : row.peer_name}</strong><small>{row.bot} · {row.strategy}</small></td>
    <td>{formatPercentage(row.return_pct)}</td><td>{formatPercentage(row.benchmark_pct)}</td><td>{dash(row.alpha_pp)} pp</td>
    <td>{dash(row.capture_ratio)}</td><td>{dash(row.sharpe_ratio)}</td><td>{formatPercentage(row.max_drawdown_pct)}</td><td>{row.total_trades ?? '—'}</td>
  </tr>;
}

export function PeerFieldPanel({ runId }: { runId: string }) {
  const [windowLabel, setWindowLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const peers = useQuery({ queryKey: ['peers'], queryFn: api.getPeers, staleTime: 300_000, retry: false });
  const labels = useMemo(() => [...new Set((peers.data ?? []).filter(peer => peer.mode === 'replay').map(peer => peer.window_label))], [peers.data]);
  const chosen = windowLabel || labels[0] || '';
  const field = useQuery({ queryKey: ['peerField', chosen, runId], queryFn: () => api.getPeerField(chosen, runId), enabled: !!chosen, retry: false });
  const detail = useQuery({ queryKey: ['peerDetail', selected], queryFn: () => api.getPeer(selected!), enabled: !!selected, retry: false });
  if (peers.isPending) return null;
  if (peers.error || peers.data == null) return <GlassCard className="peer-field"><h3>Peer comparison</h3><p className="widget-note">Peer comparison is unavailable on this Tower.</p></GlassCard>;
  if (!peers.data.length) return <GlassCard className="peer-field"><h3>Peer comparison</h3><p className="widget-note">No peer scorecards have been stored yet.</p></GlassCard>;
  const count = field.data?.peer_count ?? 0;
  return <GlassCard className="peer-field"><div className="peer-field-heading"><div><h3>Peer field</h3><p>Same scorer, window and fee model. Null is not zero.</p></div><label>Window <select className="input" value={chosen} onChange={event => setWindowLabel(event.target.value)}>{labels.map(label => <option key={label}>{label}</option>)}</select></label></div>
    {field.isPending ? <p className="widget-note">Loading peer field…</p> : field.error || !field.data ? <p className="widget-note">Peer field is unavailable for this run.</p> : <>
      <div className="peer-ranks"><span>Capture {rank(field.data.peers[0]?.rank_capture_ratio, count)}</span><span>Return {rank(field.data.peers[0]?.rank_return_pct, count)}</span><span>Drawdown {rank(field.data.peers[0]?.rank_max_drawdown_pct, count)}</span></div>
      <div className="activity-table-scroll"><table className="activity-table peer-table"><thead><tr><th>Strategy</th><th>Return</th><th>Benchmark</th><th>Alpha</th><th>Capture</th><th>Sharpe</th><th>Max DD</th><th>Trades</th></tr></thead><tbody>{field.data.our_scorecard && <ScoreRow row={field.data.our_scorecard} ours />}{field.data.peers.map(peer => <ScoreRow key={peer.id} row={peer} onSelect={() => setSelected(peer.peer_name)} />)}</tbody></table></div>
    </>}
    {selected && <details open className="peer-detail"><summary>{selected} detail</summary>{detail.isPending ? <p>Loading scorecard…</p> : detail.error || !detail.data ? <p>Peer detail is unavailable.</p> : <><p>{detail.data.bars_hash?.slice(0, 8) ?? '—'} bars · {detail.data.strategy_hash?.slice(0, 8) ?? '—'} strategy · {formatDate(detail.data.generated_at)}</p><pre>{detail.data.digest}</pre></>}</details>}
  </GlassCard>;
}
