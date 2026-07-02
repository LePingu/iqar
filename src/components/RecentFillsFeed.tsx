import type { LiveFill } from '../types/api';
import { formatCurrency } from '../utils/trading';

interface RecentFillsFeedProps {
  fills: LiveFill[];
  frozen?: boolean;
}

export function RecentFillsFeed({ fills, frozen = false }: RecentFillsFeedProps) {
  if (fills.length === 0) {
    return <p className="text-[var(--color-text-muted)] text-sm italic">No fills yet</p>;
  }

  return (
    <div className={`flex flex-col gap-1.5 font-mono text-sm ${frozen ? 'opacity-50' : ''}`}>
      {fills.map((fill, idx) => (
        <div key={idx} className="flex justify-between items-center px-3 py-2 rounded-md bg-[var(--color-bg-hover)] border border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <span className={`w-10 font-medium text-xs ${fill.side === 'BUY' ? 'text-positive' : 'text-negative'}`}>
              {fill.side}
            </span>
            <span className="text-[var(--color-text-primary)] font-medium">{fill.symbol}</span>
            <span className="text-[var(--color-text-muted)] text-xs">× {fill.quantity.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[var(--color-text-primary)]">{formatCurrency(fill.price)}</span>
            <span className="text-[var(--color-text-muted)] text-xs w-18 text-right">
              {new Date(fill.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
