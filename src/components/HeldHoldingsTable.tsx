import type { HeldHolding } from '../types/api';
import { fmtPrice, formatMoney, formatTradePrice } from '../utils/trading';
import { humanize, rows } from '../utils/monitoring';

export function HeldHoldingsTable({ holdings, currency }: { holdings?: HeldHolding[] | null; currency: string }) {
  if (holdings == null) return <p className="activity-empty">Staked / blocked holdings data is unavailable.</p>;
  const items = rows(holdings);
  if (!items.length) return <p className="activity-empty">No staked or blocked holdings.</p>;
  return <div className="activity-table-scroll" tabIndex={0} aria-label="Staked and blocked holdings; scroll horizontally for all columns">
    <table className="activity-table held-holdings-table">
      <thead><tr><th>Asset</th><th>Reason</th><th>Quantity</th><th>Current price ({currency})</th><th>Value ({currency})</th><th>Lot IDs</th></tr></thead>
      <tbody>{items.map(holding => <tr key={`${holding.symbol}-${holding.reason}`}>
        <td>{holding.symbol}</td>
        <td><span className="source-chip">{holding.reason === 'staked' ? 'Staked' : holding.reason === 'below_minimum' ? 'Below minimum' : humanize(holding.reason)}</span>
          <small>{holding.reason === 'staked' ? 'Unstake on the exchange to make sellable.' : holding.reason === 'below_minimum' ? 'Adopted balance below the minimum order size.' : 'Held outside managed positions.'}</small></td>
        <td>{fmtPrice(holding.quantity)}</td>
        <td>{formatTradePrice(holding.current_price, currency)}</td>
        <td>{formatMoney(holding.value, currency)}</td>
        <td>{holding.position_ids?.join(', ') || '—'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
