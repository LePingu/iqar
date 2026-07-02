import type { OpenPosition } from '../types/api';
import { formatCurrency, formatPercentage } from '../utils/trading';

interface OpenPositionsTableProps {
  positions: OpenPosition[];
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
              <td className="table-cell text-[var(--color-text-primary)] font-medium">{pos.symbol}</td>
              <td className={`table-cell font-medium ${pos.side === 'BUY' ? 'text-positive' : 'text-negative'}`}>{pos.side}</td>
              <td className="table-cell text-right text-[var(--color-text-secondary)]">{pos.quantity.toFixed(4)}</td>
              <td className="table-cell text-right text-[var(--color-text-secondary)]">{formatCurrency(pos.entry_price)}</td>
              <td className="table-cell text-right text-[var(--color-text-primary)]">{formatCurrency(pos.current_price)}</td>
              <td className={`table-cell text-right ${pos.unrealized_pnl_pct >= 0 ? 'text-positive' : 'text-negative'}`}>
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
