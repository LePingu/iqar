import type { LiveFill } from '../types/api';
import { fmtPrice, formatMoney, formatPercentage, currencySymbol } from '../utils/trading';

interface RecentFillsFeedProps {
  fills: LiveFill[];
  frozen?: boolean;
  currency?: string;
}

export function RecentFillsFeed({ fills, frozen = false, currency = 'USD' }: RecentFillsFeedProps) {
  if (fills.length === 0) {
    return <p className="text-[var(--color-text-muted)] text-sm italic">No fills yet</p>;
  }

  return (
    <div className={`flex flex-col gap-1.5 font-mono text-sm ${frozen ? 'opacity-50' : ''}`}>
      {fills.map((fill, idx) => {
        const isExchange = fill.source === 'exchange';
        const unconverted =
          fill.settle_currency != null &&
          fill.settle_currency !== currency &&
          fill.settle_fx_rate == null;
        const showRealizedPnl =
          fill.side === 'SELL' && !isExchange && fill.realized_pnl != null;
        const showNativePrice =
          fill.settle_price != null &&
          fill.settle_currency != null &&
          fill.settle_currency !== currency;

        return (
          <div key={idx} className="flex flex-col gap-0.5 px-3 py-2 rounded-md bg-[var(--color-bg-hover)] border border-[var(--color-border)]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className={`w-10 font-medium text-xs ${fill.side === 'BUY' ? 'text-positive' : 'text-negative'}`}>
                  {fill.side}
                </span>
                <span className="text-[var(--color-text-primary)] font-medium">{fill.symbol}</span>
                <span className="text-[var(--color-text-muted)] text-xs">× {fmtPrice(fill.quantity)}</span>
                {isExchange && (
                  <span
                    className="badge bg-[var(--color-blue-muted)] text-[var(--color-blue)] text-[10px] px-1.5 py-0"
                    title="Read back from the exchange's own trade history — not placed by this engine"
                  >
                    exchange
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {showRealizedPnl && (
                  <span className={`font-mono text-xs ${(fill.realized_pnl ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {(fill.realized_pnl ?? 0) >= 0 ? '+' : ''}{formatMoney(fill.realized_pnl ?? 0, currency)} ({formatPercentage(fill.realized_pnl_pct ?? 0, 1)})
                  </span>
                )}
                <span className="text-[var(--color-text-primary)]">
                  {currencySymbol(currency)}{fmtPrice(fill.price)}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs w-18 text-right">
                  {new Date(fill.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
            {(showNativePrice || unconverted) && (
              <div className="flex items-center gap-2 text-[10px] flex-wrap">
                {showNativePrice && (
                  <span
                    className="text-[var(--color-text-muted)]"
                    title="Price as the venue reported it — the figure an operator can check against their exchange statement"
                  >
                    ({fill.settle_currency} {fmtPrice(fill.settle_price ?? 0)}
                    {fill.venue_market && ` on ${fill.venue_market}`}
                    {fill.settle_fx_rate != null && ` @ ${fill.settle_fx_rate}`})
                  </span>
                )}
                {unconverted && (
                  <span
                    className="badge bg-[var(--color-red-muted)] text-negative text-[10px] px-1.5 py-0"
                    title="No FX rate was available for this fill — the price shown is unconverted and not comparable with converted figures"
                  >
                    unconverted
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
