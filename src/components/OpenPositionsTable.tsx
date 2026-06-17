import type { OpenPosition } from '../types/api';
import { formatCurrency, formatPercentage } from '../utils/trading';

interface OpenPositionsTableProps {
  positions: OpenPosition[];
}

export function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
  if (positions.length === 0) {
    return <p className="text-gray-500 italic text-sm">No open positions</p>;
  }

  return (
    <table className="w-full text-left border-collapse text-sm">
      <thead>
        <tr className="border-b border-white/10 text-gray-400">
          <th className="pb-2 font-medium">Asset</th>
          <th className="pb-2 font-medium">Side</th>
          <th className="pb-2 font-medium text-right">Qty</th>
          <th className="pb-2 font-medium text-right">Entry</th>
          <th className="pb-2 font-medium text-right">Current</th>
          <th className="pb-2 font-medium text-right">P&L %</th>
          <th className="pb-2 font-medium text-center">Trail</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {positions.map((pos, idx) => (
          <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5">
            <td className="py-2 text-gray-200">{pos.symbol}</td>
            <td className={`py-2 ${pos.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.side}</td>
            <td className="py-2 text-right text-gray-300">{pos.quantity.toFixed(4)}</td>
            <td className="py-2 text-right text-gray-300">{formatCurrency(pos.entry_price)}</td>
            <td className="py-2 text-right text-white">{formatCurrency(pos.current_price)}</td>
            <td className={`py-2 text-right ${pos.unrealized_pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercentage(pos.unrealized_pnl_pct)}
            </td>
            <td className="py-2 text-center text-gray-400">
              {pos.trailing_stop_active ? '✓' : '·'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
