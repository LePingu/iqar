import { Fragment } from 'react';
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
      title="P&L is measured from adoption (the mark at adopted_at), not lifetime return. Beside reconstructed lots of the same symbol, an adopted lot is the quantity no buy explains — a staking accrual or an airdrop, priced at the mark."
    >
      adopted · since {since}
    </span>
  );
}

function LotCells({ pos }: { pos: OpenPosition }) {
  return (
    <>
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
    </>
  );
}

interface SymbolGroup {
  symbol: string;
  lots: OpenPosition[];
}

function groupBySymbol(positions: OpenPosition[]): SymbolGroup[] {
  const groups: SymbolGroup[] = [];
  const bySymbol = new Map<string, SymbolGroup>();
  for (const pos of positions) {
    let group = bySymbol.get(pos.symbol);
    if (!group) {
      group = { symbol: pos.symbol, lots: [] };
      bySymbol.set(pos.symbol, group);
      groups.push(group);
    }
    group.lots.push(pos);
  }
  return groups;
}

export function OpenPositionsTable({ positions }: OpenPositionsTableProps) {
  if (positions.length === 0) {
    return <p className="text-[var(--color-text-muted)] text-sm italic">No open positions</p>;
  }

  const groups = groupBySymbol(positions);

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
          {groups.map((group) => {
            // One lot per symbol renders exactly as it always did.
            if (group.lots.length === 1) {
              const pos = group.lots[0];
              return (
                <tr key={`${group.symbol}-0`} className="table-row">
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
                  <LotCells pos={pos} />
                </tr>
              );
            }

            // Several lots of one symbol: a group header, then the individual
            // FIFO lots underneath — each kept at the price and date it was
            // actually bought at.
            const totalQty = group.lots.reduce((sum, lot) => sum + lot.quantity, 0);
            const venueMarket = group.lots.find((lot) => lot.venue_market)?.venue_market;
            return (
              <Fragment key={group.symbol}>
                <tr className="table-row bg-[var(--color-bg-hover)]">
                  <td className="table-cell text-[var(--color-text-primary)] font-medium">
                    <div className="flex items-center gap-2">
                      {group.symbol}
                      <span
                        className="badge bg-[var(--color-gold-muted)] text-[var(--color-gold-accent)] text-[10px] px-1.5 py-0"
                        title="One holding rebuilt as its individual FIFO lots — a stop applies per lot, not to a blend of buys"
                      >
                        {group.lots.length} lots
                      </span>
                    </div>
                    {venueMarket && (
                      <div
                        className="text-[10px] text-[var(--color-text-muted)] font-normal"
                        title="The venue pair this asset actually traded on — the reference that ties this position back to the exchange statement"
                      >
                        {venueMarket}
                      </div>
                    )}
                  </td>
                  <td className="table-cell" />
                  <td
                    className="table-cell text-right text-[var(--color-text-secondary)]"
                    title="Economic size — all lots of this symbol combined"
                  >
                    {fmtPrice(totalQty)}
                  </td>
                  <td className="table-cell" colSpan={4} />
                </tr>
                {group.lots.map((pos, lotIdx) => (
                  <tr key={`${group.symbol}-${lotIdx}`} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <span className="text-xs text-[var(--color-text-muted)] font-mono">lot {lotIdx + 1}</span>
                        {pos.basis_source === 'adopted' && <AdoptedBadge adoptedAt={pos.adopted_at ?? null} />}
                      </div>
                    </td>
                    <LotCells pos={pos} />
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
