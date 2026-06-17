import type { LiveFill } from '../types/api';
import { formatCurrency } from '../utils/trading';

interface RecentFillsFeedProps {
  fills: LiveFill[];
  frozen?: boolean;
}

export function RecentFillsFeed({ fills, frozen = false }: RecentFillsFeedProps) {
  if (fills.length === 0) {
    return <p className="text-gray-500 italic text-sm">No fills yet</p>;
  }

  return (
    <div className={`flex flex-col gap-2 font-mono text-sm ${frozen ? 'opacity-60' : ''}`}>
      {fills.map((fill, idx) => (
        <div key={idx} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <span className={`w-12 font-bold ${fill.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fill.side}
            </span>
            <span className="text-gray-200 font-bold">{fill.symbol}</span>
            <span className="text-gray-400 text-xs">x {fill.quantity.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white">{formatCurrency(fill.price)}</span>
            <span className="text-gray-500 text-xs w-20 text-right">
              {new Date(fill.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
