import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../services/api';
import type { BacktestSummary } from '../types/api';
import { formatPercentage } from '../utils/trading';

const columnHelper = createColumnHelper<BacktestSummary>();

export function RunsBrowser() {
  const navigate = useNavigate();
  const { data: runs = [], isLoading, error } = useQuery({
    queryKey: ['backtests'],
    queryFn: () => api.getBacktests(50, 0),
  });

  const columns = [
    columnHelper.accessor('timestamp', {
      header: 'Date',
      cell: info => <span className="text-gray-400 font-mono text-sm">{new Date(info.getValue()).toLocaleString()}</span>
    }),
    columnHelper.accessor('metrics.roi', {
      header: 'ROI',
      cell: info => {
        const val = info.getValue() || 0;
        return <span className={`font-mono ${val >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatPercentage(val)}</span>;
      }
    }),
    columnHelper.accessor('metrics.capture_ratio', {
      header: 'Capture',
      cell: info => <span className="font-mono text-gray-300">{(info.getValue() || 0).toFixed(2)}</span>
    }),
    columnHelper.accessor('metrics.sharpe_ratio', {
      header: 'Sharpe',
      cell: info => <span className="font-mono text-gray-300">{(info.getValue() || 0).toFixed(2)}</span>
    }),
    columnHelper.accessor('metrics.win_rate', {
      header: 'WR',
      cell: info => <span className="font-mono text-gray-300">{formatPercentage(info.getValue() || 0, 1)}</span>
    }),
    columnHelper.accessor('metrics.max_drawdown', {
      header: 'Max DD',
      cell: info => <span className="font-mono text-rose-400">{formatPercentage(info.getValue() || 0, 1)}</span>
    }),
    columnHelper.accessor('metrics.total_trades', {
      header: 'Trades',
      cell: info => <span className="font-mono text-gray-300">{info.getValue() || 0}</span>
    }),
    columnHelper.display({
      id: 'flags',
      header: 'Configuration',
      cell: ({ row }) => {
        const cfg = row.original.config;
        const activeFlags = [
          { key: 'fixed_universe_enabled', label: 'Fixed' },
          { key: 'dual_portfolio_enabled', label: 'Dual' },
          { key: 'regime_continuous_enabled', label: 'Regime' },
          { key: 'position_rotation_enabled', label: 'Rotation' },
          { key: 'disable_ai_exits', label: 'No AI Exit' },
          { key: 'mock_critic', label: 'Mock' },
        ].filter(f => cfg[f.key as keyof typeof cfg]);
        
        return (
          <div className="flex gap-1 flex-wrap">
            {activeFlags.map(f => (
              <span key={f.key} className="px-1.5 py-0.5 bg-[var(--color-gold-accent)]/20 text-[var(--color-gold-accent)] border border-[var(--color-gold-accent)]/30 rounded text-[10px] uppercase whitespace-nowrap">
                {f.label}
              </span>
            ))}
          </div>
        );
      }
    })
  ];

  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <div className="glass-panel overflow-x-auto">
        <h2 className="text-gold text-2xl mb-6">Runs Browser</h2>
        
        {isLoading ? (
          <p className="text-gray-400">Loading backtests...</p>
        ) : error ? (
          <p className="text-rose-500">Failed to load backtests.</p>
        ) : runs.length === 0 ? (
          <p className="text-gray-400">No backtest runs found.</p>
        ) : (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-[var(--color-dark-border)]">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="py-3 px-2 text-xs text-gray-400 uppercase tracking-wider font-medium">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  className="border-b border-white/5 last:border-0 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => navigate({ to: '/backtests/$runId', params: { runId: row.original.run_id } })}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="py-3 px-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
