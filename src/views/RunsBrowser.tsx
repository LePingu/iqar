import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { api } from '../services/api';
import type { BacktestSummary } from '../types/api';
import { formatPercentage, formatCurrency } from '../utils/trading';
import { FlagChip } from '../components/FlagChip';
import { GlassCard } from '../components/GlassCard';

const columnHelper = createColumnHelper<BacktestSummary>();

function MetricSummaryPopover({ summary }: { summary: BacktestSummary }) {
  const m = summary.metrics;
  return (
    <div className="absolute z-50 left-0 top-full mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg p-4 shadow-[var(--shadow-dropdown)] min-w-[300px] pointer-events-none">
      <h4 className="text-[var(--color-gold-accent)] text-xs font-bold mb-3 uppercase tracking-wider">Full Metrics</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono">
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">ROI</span><span className={m.roi >= 0 ? 'text-positive' : 'text-negative'}>{formatPercentage(m.roi)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Total P&L</span><span className={m.total_pnl >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(m.total_pnl)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Sharpe</span><span className="text-[var(--color-text-secondary)]">{m.sharpe_ratio.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Max DD</span><span className="text-negative">{formatPercentage(m.max_drawdown, 1)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Win Rate</span><span className="text-[var(--color-text-secondary)]">{formatPercentage(m.win_rate, 1)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Capture</span><span className="text-[var(--color-text-secondary)]">{(m.capture_ratio ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Trades</span><span className="text-[var(--color-text-secondary)]">{m.total_trades}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Winning</span><span className="text-positive">{m.winning_trades}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Losing</span><span className="text-negative">{m.losing_trades}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Avg Win</span><span className="text-positive">{formatCurrency(m.avg_win)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Avg Loss</span><span className="text-negative">{formatCurrency(m.avg_loss)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Avg Trade</span><span className="text-[var(--color-text-secondary)]">{formatCurrency(m.avg_trade_pnl)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Avg Hold</span><span className="text-[var(--color-text-secondary)]">{m.avg_hold_duration_hours.toFixed(1)}h</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Final Cap</span><span className="text-[var(--color-text-secondary)]">{formatCurrency(m.final_capital)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Peak Cap</span><span className="text-[var(--color-text-secondary)]">{formatCurrency(m.peak_capital)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">B&H ROI</span><span className="text-[var(--color-text-secondary)]">{formatPercentage(m.buy_and_hold_roi ?? 0)}</span></div>
      </div>
    </div>
  );
}

export function RunsBrowser() {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'metrics_capture_ratio', desc: true },
  ]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const { data: runs = [], isLoading, error } = useQuery({
    queryKey: ['backtests'],
    queryFn: () => api.getBacktests(50, 0),
  });

  const columns = [
    columnHelper.accessor('timestamp', {
      header: 'Date',
      cell: info => <span className="text-[var(--color-text-muted)] font-mono text-xs">{new Date(info.getValue()).toLocaleString()}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.roi', {
      header: 'ROI',
      cell: info => {
        const val = info.getValue() || 0;
        return <span className={`font-mono ${val >= 0 ? 'text-positive' : 'text-negative'}`}>{formatPercentage(val)}</span>;
      },
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.capture_ratio', {
      id: 'metrics_capture_ratio',
      header: 'Capture',
      cell: info => <span className="font-mono text-[var(--color-text-secondary)]">{(info.getValue() || 0).toFixed(2)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.sharpe_ratio', {
      header: 'Sharpe',
      cell: info => <span className="font-mono text-[var(--color-text-secondary)]">{(info.getValue() || 0).toFixed(2)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.win_rate', {
      header: 'WR',
      cell: info => <span className="font-mono text-[var(--color-text-secondary)]">{formatPercentage(info.getValue() || 0, 1)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.max_drawdown', {
      header: 'Max DD',
      cell: info => <span className="font-mono text-negative">{formatPercentage(info.getValue() || 0, 1)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.total_trades', {
      header: 'Trades',
      cell: info => <span className="font-mono text-[var(--color-text-secondary)]">{info.getValue() || 0}</span>,
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'flags',
      header: 'Config',
      cell: ({ row }) => {
        const cfg = row.original.config;
        const flags = [
          { key: 'fixed_universe_enabled' as const, label: 'Fixed' },
          { key: 'dual_portfolio_enabled' as const, label: 'Dual' },
          { key: 'regime_continuous_enabled' as const, label: 'Regime' },
          { key: 'position_rotation_enabled' as const, label: 'Rotation' },
          { key: 'disable_ai_exits' as const, label: 'No AI Exit' },
          { key: 'mock_critic' as const, label: 'Mock' },
        ];

        return (
          <div className="flex gap-1 flex-wrap">
            {flags.map(f => (
              <FlagChip key={f.key} label={f.label} active={!!cfg[f.key]} readOnly />
            ))}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: runs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <GlassCard className="overflow-hidden">
        <h2 className="page-title mb-5">Runs Browser</h2>

        {isLoading ? (
          <p className="text-[var(--color-text-muted)] text-sm">Loading backtests…</p>
        ) : error ? (
          <p className="text-negative text-sm">Failed to load backtests.</p>
        ) : runs.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-sm">No backtest runs found.</p>
        ) : (
          <div
            ref={tableContainerRef}
            className="overflow-auto max-h-[calc(100vh-14rem)]"
          >
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-surface)]">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-[var(--color-border)]">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className={`table-header ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-[var(--color-gold-accent)] transition-colors' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className="table-row cursor-pointer"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => navigate({ to: '/backtests/$runId', params: { runId: row.original.run_id } })}
                      onMouseEnter={() => setHoveredRow(row.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => (
                        <td key={cell.id} className="table-cell relative">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          {cellIndex === 0 && hoveredRow === row.id && (
                            <MetricSummaryPopover summary={row.original} />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
