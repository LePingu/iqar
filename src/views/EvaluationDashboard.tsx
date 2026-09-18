import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useRole } from '../contexts/RoleContext';
import { GlassCard } from '../components/GlassCard';
import { KPICard } from '../components/KPICard';
import { formatPercentage } from '../utils/trading';
import type { EvaluationCheck, EvaluationReportResponse, EvaluationSummary } from '../types/api';

const SESSION_ID = 'live-paper';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// Null is not zero — a null measurement renders as an em-dash plus the reason.
function nullReason(report: EvaluationReportResponse | null): string {
  if (report?.error) return report.error;
  return 'no benchmark coverage, or the hold was below +1% — a ratio to a flat hold is meaningless';
}

function formatNullablePct(value: number | null): string {
  return value != null ? formatPercentage(value) : '—';
}

// alpha_pp — return_pct − benchmark_pct in percentage points. Always defined
// when a benchmark is, whatever its sign; the headline when the ratio is null.
function formatPp(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} pp`;
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function PayloadTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return (
    <div>
      <h4 className="section-title">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[400px]">
          <thead>
            <tr>
              {keys.map((key) => (
                <th key={key} className="table-header">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono text-sm">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="table-row">
                {keys.map((key) => (
                  <td key={key} className="table-cell text-[var(--color-text-secondary)]">
                    {formatCell(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChecksTable({ checks }: { checks: EvaluationCheck[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[400px]">
        <thead>
          <tr>
            <th className="table-header">Check</th>
            <th className="table-header">Status</th>
            <th className="table-header">Detail</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {checks.map((check, idx) => (
            <tr key={idx} className="table-row">
              <td className="table-cell text-[var(--color-text-primary)]">{check.name}</td>
              <td className={`table-cell font-bold ${check.passed ? 'text-positive' : 'text-negative'}`}>
                {check.passed ? '✓ passed' : '✗ FAILED'}
              </td>
              <td className="table-cell text-[var(--color-text-secondary)]">{check.detail ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SparklineLegend({ lo, hi }: { lo: number; hi: number }) {
  const items: ReactNode[] = [];
  if (0.5 >= lo && 0.5 <= hi) items.push(<span key="gate">dashed grey = bull gate 0.50</span>);
  if (1 >= lo && 1 <= hi) items.push(<span key="alpha">dashed gold = 1.00 (positive alpha)</span>);
  items.push(<span key="gap">gaps = not measured, never zero</span>);
  return (
    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {item}
        </span>
      ))}
    </p>
  );
}

// Sparkline of capture_ratio over time. Null readings leave gaps — a missing
// measurement must not be plotted as zero.
function CaptureSparkline({ history }: { history: EvaluationSummary[] }) {
  const points = [...history]
    .reverse()
    .map((entry) => ({ ts: entry.generated_at, value: entry.capture_ratio }));
  const measured = points.filter((p) => p.value != null) as { ts: string; value: number }[];

  if (measured.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No measured capture ratios yet — an absent reading here means "not measured", never zero.
      </p>
    );
  }

  const W = 100;
  const H = 36;
  const values = measured.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.max(0.1, Math.abs(max) * 0.2);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);

  const segments: string[][] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push(`${x(i).toFixed(2)},${y(p.value).toFixed(2)}`);
  });
  if (current.length > 0) segments.push(current);

  const gateY = 0.5 >= lo && 0.5 <= hi ? y(0.5) : null;
  const alphaY = 1 >= lo && 1 <= hi ? y(1) : null;
  const latest = measured[measured.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm text-[var(--color-text-primary)]">
          latest {latest.value.toFixed(2)}
          <span className="text-xs text-[var(--color-text-muted)]"> · {formatDateTime(latest.ts)}</span>
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {measured.length} measured of {points.length} stored
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12 mt-1"
        role="img"
        aria-label="Capture ratio over time"
      >
        {gateY != null && (
          <line x1="0" x2={W} y1={gateY} y2={gateY} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        )}
        {alphaY != null && (
          <line x1="0" x2={W} y1={alphaY} y2={alphaY} stroke="var(--color-gold-accent)" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        )}
        {segments.map((segment, i) => (
          <polyline
            key={i}
            points={segment.join(' ')}
            fill="none"
            stroke="var(--color-gold-accent)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <SparklineLegend lo={lo} hi={hi} />
    </div>
  );
}

export function EvaluationDashboard() {
  const { role } = useRole();
  const isController = role === 'admin';
  const queryClient = useQueryClient();

  // Latest stored report. 404 means nothing has been run yet — never zeros.
  const latestQuery = useQuery({
    queryKey: ['evaluationLatest', SESSION_ID],
    queryFn: async () => {
      try {
        return await api.getLatestEvaluation(SESSION_ID);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
      }
    },
  });

  const historyQuery = useQuery({
    queryKey: ['evaluationHistory', SESSION_ID],
    queryFn: () => api.getEvaluationHistory(SESSION_ID),
  });

  // Elapsed-time pending state — the run is slow on purpose (20–60s), so the
  // operator sees it counting rather than a spinner that looks hung.
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const runMutation = useMutation({
    mutationFn: () => api.runEvaluation(SESSION_ID),
    onSuccess: (report) => {
      queryClient.setQueryData(['evaluationLatest', SESSION_ID], report);
      queryClient.invalidateQueries({ queryKey: ['evaluationHistory', SESSION_ID] });
    },
  });

  useEffect(() => {
    if (!runMutation.isPending) {
      setElapsedSeconds(null);
      return;
    }
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [runMutation.isPending]);

  const [digestCopied, setDigestCopied] = useState(false);
  const copyDigest = async (digest: string) => {
    try {
      await navigator.clipboard.writeText(digest);
      setDigestCopied(true);
      setTimeout(() => setDigestCopied(false), 2000);
    } catch {
      setDigestCopied(false);
    }
  };

  if (latestQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)] text-sm animate-pulse">Loading latest evaluation…</p>
      </div>
    );
  }

  if (latestQuery.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="max-w-md text-center">
          <p className="text-negative font-medium">Failed to load evaluation.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{String(latestQuery.error)}</p>
        </GlassCard>
      </div>
    );
  }

  const report = latestQuery.data ?? null;
  const history = historyQuery.data ?? [];

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {/* Header */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h2 className="page-title">Daily Evaluation</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Is this book beating an equal-weight hold of the symbols it actually trades?
            </p>
            <div className="text-sm font-mono text-[var(--color-text-muted)] mt-1">Session: {SESSION_ID}</div>
          </div>
          {report && (
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <div className="flex gap-2">
                <span
                  className={`badge ${
                    report.mode === 'real'
                      ? 'bg-[var(--color-red-muted)] text-[var(--color-red)]'
                      : 'bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)]'
                  } font-mono uppercase`}
                >
                  mode: {report.mode}
                </span>
                <span className="badge bg-white/5 text-[var(--color-text-muted)] font-mono">
                  {report.trigger}
                </span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                Generated {formatDateTime(report.generated_at)} · window{' '}
                {formatDateTime(report.window_start)} → {formatDateTime(report.window_end)}
              </span>
            </div>
          )}
        </div>

        {/* The button — a control action, same bar as halting the engine.
            Hidden (not disabled) for read-only viewers. */}
        {isController && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending}
                className="btn btn-primary"
              >
                {runMutation.isPending ? 'Running evaluation…' : 'Run evaluation now'}
              </button>
              {runMutation.isPending ? (
                <span className="text-sm font-mono text-[var(--color-gold-accent)]">
                  {elapsedSeconds != null ? `${elapsedSeconds}s elapsed` : 'starting…'}
                </span>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">
                  Walks hourly exchange bars for every symbol traded — budget 20–60s.
                </span>
              )}
            </div>
            {runMutation.isPending && (
              <div className="h-1 w-full max-w-md rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
                <div className="h-full w-1/3 bg-[var(--color-gold-accent)] animate-pulse" />
              </div>
            )}
            {runMutation.isError && (
              <p className="text-negative text-sm">
                Run failed: {runMutation.error instanceof Error ? runMutation.error.message : String(runMutation.error)}
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Empty state — 404 from /latest, never zeros */}
      {!report ? (
        <GlassCard className="text-center max-w-lg w-full self-center">
          <h3 className="page-title mb-2">No Evaluation Yet</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No evaluation has been run for session{' '}
            <span className="font-mono text-[var(--color-text-primary)]">{SESSION_ID}</span>. Nothing is
            rendered as zero — {!isController ? 'ask an operator to ' : ''}run one to measure the book
            against an equal-weight hold of the symbols it actually traded.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Recorded failure — 200 does not mean success */}
          {report.error && (
            <div className="rounded-lg border border-red-500/30 bg-[var(--color-red-muted)] px-4 py-3">
              <p className="text-negative text-sm font-medium">
                This run could not measure: {report.error}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                The report is stored as a recorded failure — its figures render as em-dashes, never as zero.
              </p>
            </div>
          )}

          {/* Headline figures — capture ratio leads when present; alpha_pp is
              always defined when a benchmark is and leads when the ratio is
              null (flat or falling hold below +1%). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="Capture Ratio"
              value={report.capture_ratio != null ? report.capture_ratio.toFixed(2) : '—'}
              isPositive={report.capture_ratio != null ? report.capture_ratio >= 0.5 : false}
              className={report.capture_ratio == null ? 'opacity-80' : ''}
            />
            <KPICard
              label="Alpha vs Hold"
              value={formatPp(report.alpha_pp)}
              isPositive={report.alpha_pp != null ? report.alpha_pp >= 0 : false}
              neutral={report.alpha_pp == null}
            />
            <KPICard
              label="Book Return (window)"
              value={formatNullablePct(report.return_pct)}
              isPositive={report.return_pct != null ? report.return_pct >= 0 : false}
              neutral={report.return_pct == null}
            />
            <KPICard
              label="Equal-Weight Hold (benchmark)"
              value={formatNullablePct(report.benchmark_pct)}
              isPositive={report.benchmark_pct != null ? report.benchmark_pct >= 0 : false}
              neutral={report.benchmark_pct == null}
            />
          </div>
          {report.capture_ratio == null && (
            <p className="text-xs text-[var(--color-text-muted)] -mt-1">
              Capture ratio: <span className="font-mono">—</span> — {nullReason(report)}. Above 1.0 is
              positive alpha; 0.50 is the project's bull gate.
              {report.alpha_pp != null && (
                <> Lead with alpha instead: <span className="font-mono">{formatPp(report.alpha_pp)}</span> vs the hold.</>
              )}
            </p>
          )}
          {report.capture_ratio != null && (
            <p className="text-xs text-[var(--color-text-muted)] -mt-1">
              System return ÷ equal-weight hold of the symbols actually traded · bull gate 0.50 · above
              1.0 is positive alpha.
              {report.alpha_pp != null && Math.abs(report.benchmark_pct ?? 1) < 1 && (
                <> The hold is near flat, so read the ratio beside alpha: <span className="font-mono">{formatPp(report.alpha_pp)}</span>.</>
              )}
            </p>
          )}

          {/* Findings */}
          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title !mb-0">Findings</h3>
              {report.checks_failed > 0 ? (
                <span className="badge bg-[var(--color-red-muted)] text-[var(--color-red)] font-bold">
                  {report.checks_failed} invariant check{report.checks_failed === 1 ? '' : 's'} failed
                </span>
              ) : (
                <span className="badge bg-[var(--color-green-muted)] text-[var(--color-green)]">
                  all invariant checks passed
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Discontinuities — measurement starts after the last one */}
              {report.payload.discontinuities != null && report.payload.discontinuities.length > 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span className="badge bg-[var(--color-blue-muted)] text-[var(--color-blue)] mr-2">
                    {report.payload.discontinuities.length} discontinuit{report.payload.discontinuities.length === 1 ? 'y' : 'ies'}
                  </span>
                  Book rebuild{report.payload.discontinuities.length === 1 ? '' : 's'} inside the window —
                  cash moved with no fill behind it. A return read across a rebuild is meaningless;
                  measurement starts <span className="font-bold">after the last one</span>.
                </p>
              )}

              {/* Exposure ceiling — warning chip when the engine cannot deploy its cash */}
              {(() => {
                const ceiling = report.payload.exposure_ceiling_pct;
                if (typeof ceiling !== 'number' || !Number.isFinite(ceiling)) return null;
                // Served as a share of the book; sibling *_pct fields in this
                // payload are in percent, so a value ≤ 1 is a fraction.
                const pct = ceiling <= 1 ? ceiling * 100 : ceiling;
                const low = pct < 100;
                return (
                  <p className="text-sm flex items-center gap-2 flex-wrap">
                    <span
                      className={`badge ${
                        low
                          ? 'bg-[var(--color-red-muted)] text-[var(--color-red)]'
                          : 'bg-[var(--color-green-muted)] text-[var(--color-green)]'
                      }`}
                    >
                      exposure ceiling {pct.toFixed(1)}%
                    </span>
                    <span className="text-[var(--color-text-secondary)]">
                      max slots × typical lot, as a share of the book.
                      {low && ' Below 100% the engine physically cannot deploy its cash.'}
                    </span>
                  </p>
                );
              })()}

              {/* Invariant checks */}
              {report.payload.checks != null && report.payload.checks.length > 0 && (
                <ChecksTable checks={report.payload.checks} />
              )}

              {/* Exit paths and per-symbol participation */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {report.payload.exit_paths != null && (
                  <PayloadTable title="Exit Paths" rows={report.payload.exit_paths} />
                )}
                {report.payload.symbols != null && (
                  <PayloadTable title="Symbols" rows={report.payload.symbols} />
                )}
              </div>
            </div>
          </GlassCard>

          {/* Digest — pasteable markdown */}
          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title !mb-0">Digest</h3>
              <div className="flex gap-2">
                <button onClick={() => copyDigest(report.digest)} className="btn btn-ghost text-xs">
                  {digestCopied ? '✓ Copied' : 'Copy to clipboard'}
                </button>
                <a
                  href={api.evaluationDownloadUrl(report.id)}
                  download
                  className="btn btn-ghost text-xs"
                >
                  Download .md
                </a>
              </div>
            </div>
            <pre className="bg-[var(--color-bg-root)] border border-[var(--color-border)] rounded-lg p-3 text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap max-h-96 overflow-y-auto">
              {report.digest}
            </pre>
          </GlassCard>
        </>
      )}

      {/* History — one reading is a number, a month of them is a trend */}
      {history.length > 0 && (
        <GlassCard>
          <h3 className="section-title">Capture Ratio Over Time</h3>
          <CaptureSparkline history={history} />
        </GlassCard>
      )}
    </div>
  );
}
