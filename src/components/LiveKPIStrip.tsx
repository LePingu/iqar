import { KPICard } from './KPICard';
import { formatCurrency, formatPercentage } from '../utils/trading';
import type { LiveSnapshot } from '../types/api';

interface LiveKPIStripProps {
  snapshot: LiveSnapshot | null;
  greyed?: boolean;
}

export function LiveKPIStrip({ snapshot, greyed = false }: LiveKPIStripProps) {
  const opacity = greyed ? 'opacity-40' : '';

  if (!snapshot) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${opacity}`}>
        <KPICard label="Portfolio Value" value="--" neutral />
        <KPICard label="P&L" value="--" neutral />
        <KPICard label="Max Drawdown" value="--" neutral />
        <KPICard label="Open Positions" value="--" neutral />
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${opacity}`}>
      <KPICard
        label="Portfolio Value"
        value={formatCurrency(snapshot.portfolio_value)}
        neutral
      />
      <KPICard
        label="P&L"
        value={`${snapshot.pnl >= 0 ? '+' : ''}${formatCurrency(snapshot.pnl)} (${formatPercentage(snapshot.pnl_pct)})`}
        isPositive={snapshot.pnl >= 0}
      />
      <KPICard
        label="Max Drawdown"
        value={formatPercentage(snapshot.drawdown_pct)}
        isPositive={false}
      />
      <KPICard
        label="Open Positions"
        value={snapshot.open_positions_count}
        neutral
      />
    </div>
  );
}
