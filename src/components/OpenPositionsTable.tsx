import type { OpenPosition } from '../types/api';
import { fmtPrice, formatPercentage } from '../utils/trading';

interface OpenPositionsTableProps {
  positions: OpenPosition[];
}

function AdoptedBadge({ adoptedAt }: { adoptedAt: string | null }) {
  const since = adoptedAt ? new Date(adoptedAt).toLocaleDateString() : 'adoption';
  return (
    <span
      className="badge bg-[var(--color-blue-muted)] text-[var(--color-blue)] text-[10px] px-1.5 py-0 ml-1.5"
      title="P&L is measured from adoption (the mark at adopted_at), not lifetime return"
    >
      adopted · since {since}
    </span>
  );
}

export function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
  if (positions.length === 0) {
    return <p className="text-[var(--color-text-muted)] text-sm italic">No open positions</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="table-header">Asset</th>
            <th className="table-header">Side</th>
            <th className="table-header text-right">Qty</th>
            <th className="table-header text-right">Entry</th>
            <th className="table-header text-right">Current</th>
            <th className="table-header text-right">P&L %</th>
            <th className="table-header text-center">Trail</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {positions.map((pos, idx) => (
            <tr key={idx} className="table-row">
              <td className="table-cell text-[var(--color-text-primary)] font-medium">
                <div className="flex items-center">
                  {pos.symbol}
                  {pos.basis_source === 'adopted' && <AdoptedBadge adoptedAt={pos.adopted_at ?? null} />}
                </div>
                {pos.venue_market && (
                  <div
                    className="text-[10px] text-[var(--color-text-muted)] font-normal"
                    title="The venue pair this asset actually traded on — the reference that ties this position back to the exchange statement"
                  >
                    {pos.venue_market}
                  </div>
                )}
              </td>
              <td className={`table-cell font-medium ${pos.side === 'BUY' ? 'text-positive' : 'text-negative'}`}>{pos.side}</td>
              <td className="table-cell text-right text-[var(--color-text-secondary)]">{fmtPrice(pos.quantity)}</td>
              <td className="table-cell text-right text-[var(--color-text-secondary)]">{fmtPrice(pos.entry_price)}</td>
              <td className="table-cell text-right text-[var(--color-text-primary)]">{fmtPrice(pos.current_price)}</td>
              <td
                className={`table-cell text-right ${pos.unrealized_pnl_pct >= 0 ? 'text-positive' : 'text-negative'}`}
                title={pos.basis_source === 'adopted' ? 'P&L under management — measured from adoption (the mark at adopted_at), not lifetime return. 0.00% at adoption is correct, not a loading state.' : undefined}
              >
                {formatPercentage(pos.unrealized_pnl_pct)}
              </td>
              <td className="table-cell text-center text-[var(--color-text-muted)]">
                {pos.trailing_stop_active ? '✓' : '·'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
