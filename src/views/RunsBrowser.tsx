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
    <div className="absolute z-50 left-0 top-full mt-1 bg-[#1A1A1A] border border-[var(--color-dark-border)] rounded-2xl p-4 shadow-2xl min-w-[320px] pointer-events-none">
      <h4 className="text-[var(--color-gold-accent)] text-sm font-bold mb-3">Full Metrics</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div className="flex justify-between"><span className="text-gray-400">ROI</span><span className={m.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPercentage(m.roi)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Total P&L</span><span className={m.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(m.total_pnl)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Sharpe</span><span className="text-gray-200">{m.sharpe_ratio.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Max DD</span><span className="text-rose-400">{formatPercentage(m.max_drawdown, 1)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Win Rate</span><span className="text-gray-200">{formatPercentage(m.win_rate, 1)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Capture</span><span className="text-gray-200">{(m.capture_ratio ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Trades</span><span className="text-gray-200">{m.total_trades}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Winning</span><span className="text-emerald-400">{m.winning_trades}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Losing</span><span className="text-rose-400">{m.losing_trades}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Avg Win</span><span className="text-emerald-400">{formatCurrency(m.avg_win)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Avg Loss</span><span className="text-rose-400">{formatCurrency(m.avg_loss)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Avg Trade</span><span className="text-gray-200">{formatCurrency(m.avg_trade_pnl)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Avg Hold</span><span className="text-gray-200">{m.avg_hold_duration_hours.toFixed(1)}h</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Final Cap</span><span className="text-gray-200">{formatCurrency(m.final_capital)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Peak Cap</span><span className="text-gray-200">{formatCurrency(m.peak_capital)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">B&H ROI</span><span className="text-gray-200">{formatPercentage(m.buy_and_hold_roi ?? 0)}</span></div>
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
      cell: info => <span className="text-gray-400 font-mono text-sm">{new Date(info.getValue()).toLocaleString()}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.roi', {
      header: 'ROI',
      cell: info => {
        const val = info.getValue() || 0;
        return <span className={`font-mono ${val >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatPercentage(val)}</span>;
      },
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.capture_ratio', {
      id: 'metrics_capture_ratio',
      header: 'Capture',
      cell: info => <span className="font-mono text-gray-300">{(info.getValue() || 0).toFixed(2)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.sharpe_ratio', {
      header: 'Sharpe',
      cell: info => <span className="font-mono text-gray-300">{(info.getValue() || 0).toFixed(2)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.win_rate', {
      header: 'WR',
      cell: info => <span className="font-mono text-gray-300">{formatPercentage(info.getValue() || 0, 1)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.max_drawdown', {
      header: 'Max DD',
      cell: info => <span className="font-mono text-rose-400">{formatPercentage(info.getValue() || 0, 1)}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor('metrics.total_trades', {
      header: 'Trades',
      cell: info => <span className="font-mono text-gray-300">{info.getValue() || 0}</span>,
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'flags',
      header: 'Configuration',
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
    estimateSize: () => 52,
    overscan: 10,
  });

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <GlassCard className="overflow-hidden">
        <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl mb-6">Runs Browser</h2>

        {isLoading ? (
          <p className="text-gray-400">Loading backtests...</p>
        ) : error ? (
          <p className="text-rose-500">Failed to load backtests.</p>
        ) : runs.length === 0 ? (
          <p className="text-gray-400">No backtest runs found.</p>
        ) : (
          <div
            ref={tableContainerRef}
            className="overflow-auto max-h-[calc(100vh-16rem)]"
          >
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-[var(--color-dark-panel)]">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-[var(--color-dark-border)]">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className={`py-3 px-2 text-xs text-gray-400 uppercase tracking-wider font-medium ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-[var(--color-gold-accent)] transition-colors' : ''}`}
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
                      className="border-b border-white/5 last:border-0 hover:bg-white/10 transition-colors cursor-pointer"
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
                        <td key={cell.id} className="py-3 px-2 relative">
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
