import { useEffect, useRef, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { createChart, AreaSeries, LineSeries } from 'lightweight-charts';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';
import { CandlestickExplorer } from './CandlestickExplorer';
import { GlassCard } from '../components/GlassCard';
import { KPICard } from '../components/KPICard';
import type { AssetSummary, Trade } from '../types/api';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';

const tradeColumnHelper = createColumnHelper<Trade>();

function TradesGrid({ runId }: { runId: string }) {
  const [offset, setOffset] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState('');
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['trades', runId, limit, offset, symbolFilter],
    queryFn: () => api.getBacktestTrades(runId, limit, offset, symbolFilter || undefined),
    enabled: !!runId,
  });

  const trades = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns = [
    tradeColumnHelper.accessor('timestamp', {
      header: 'Time',
      cell: info => <span className="text-gray-400 font-mono text-xs">{new Date(info.getValue()).toLocaleString()}</span>,
    }),
    tradeColumnHelper.accessor('symbol', {
      header: 'Symbol',
      cell: info => <span className="text-gray-200 font-bold text-sm">{info.getValue()}</span>,
    }),
    tradeColumnHelper.accessor('side', {
      header: 'Side',
      cell: info => (
        <span className={`font-bold text-sm ${info.getValue() === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    tradeColumnHelper.accessor('price', {
      header: 'Price',
      cell: info => <span className="font-mono text-gray-300 text-sm">{formatCurrency(info.getValue())}</span>,
    }),
    tradeColumnHelper.accessor('size', {
      header: 'Size',
      cell: info => <span className="font-mono text-gray-300 text-sm">{info.getValue().toFixed(4)}</span>,
    }),
    tradeColumnHelper.accessor('pnl', {
      header: 'P&L',
      cell: info => {
        const val = info.getValue();
        return <span className={`font-mono text-sm ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{val >= 0 ? '+' : ''}{formatCurrency(val)}</span>;
      },
    }),
    tradeColumnHelper.accessor('pnl_pct', {
      header: 'P&L %',
      cell: info => {
        const val = info.getValue();
        return <span className={`font-mono text-sm ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatPercentage(val, 1)}</span>;
      },
    }),
    tradeColumnHelper.accessor('hold_duration_hours', {
      header: 'Hold',
      cell: info => <span className="font-mono text-gray-400 text-sm">{info.getValue().toFixed(1)}h</span>,
    }),
    tradeColumnHelper.accessor('reason', {
      header: 'Reason',
      cell: info => <span className="text-gray-500 text-xs">{info.getValue()}</span>,
    }),
  ];

  const table = useReactTable({
    data: trades,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <GlassCard>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-xl">Trades</h3>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Filter by symbol..."
            value={symbolFilter}
            onChange={e => { setSymbolFilter(e.target.value); setOffset(0); }}
            className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white px-3 py-1.5 rounded-lg text-sm focus:border-[var(--color-gold-accent)] outline-none transition-all w-40"
          />
          <span className="text-xs text-gray-400">{total} trades</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-gray-500 italic text-sm">No trades found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b border-[var(--color-dark-border)]">
                    {hg.headers.map(h => (
                      <th key={h.id} className="py-2 px-2 text-xs text-gray-400 uppercase tracking-wider font-medium">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-2 px-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 text-sm rounded bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 text-sm rounded bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

export function RunDetail() {
  const { runId } = useParams({ strict: false });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['backtest', runId],
    queryFn: () => api.getBacktestResult(runId as string),
    enabled: !!runId,
  });

  // Lightweight asset list from dedicated endpoint
  const { data: assets = [] } = useQuery({
    queryKey: ['backtestAssets', runId],
    queryFn: () => api.getBacktestAssets(runId as string),
    enabled: !!runId,
  });

  useEffect(() => {
    if (!result || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 350,
      timeScale: {
        timeVisible: true,
      },
    });

    // Primary equity curve
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#FFD700',
      topColor: 'rgba(255, 215, 0, 0.4)',
      bottomColor: 'rgba(255, 215, 0, 0)',
      lineWidth: 2,
    });

    if (result.portfolio_history && result.portfolio_history.length > 0) {
      const sortedHistory = [...result.portfolio_history].sort((a, b) => a.time - b.time);

      // Remove duplicate timestamps (lightweight-charts requires strictly increasing time)
      const uniqueHistory = new Map<number, typeof sortedHistory[0]>();
      sortedHistory.forEach(point => {
        uniqueHistory.set(point.time, point);
      });

      const equityData = Array.from(uniqueHistory.values());

      areaSeries.setData(
        equityData.map(point => ({
          time: point.time as import('lightweight-charts').Time,
          value: point.capital,
        }))
      );

      // Buy-and-hold secondary line — derive from initial capital and buy_and_hold_roi
      if (result.portfolio_metrics.buy_and_hold_roi != null && equityData.length >= 2) {
        const bhLine = chart.addSeries(LineSeries, {
          color: 'rgba(156, 163, 175, 0.5)',
          lineWidth: 1,
          lineStyle: 2, // dashed
        });

        const initialCapital = result.portfolio_metrics.final_capital / (1 + result.portfolio_metrics.roi / 100);
        const bhFinalCapital = initialCapital * (1 + result.portfolio_metrics.buy_and_hold_roi / 100);
        const firstTime = equityData[0].time;
        const lastTime = equityData[equityData.length - 1].time;

        // Simple linear interpolation between start and end for buy-and-hold line
        bhLine.setData(
          equityData.map(point => {
            const progress = (point.time - firstTime) / (lastTime - firstTime || 1);
            return {
              time: point.time as import('lightweight-charts').Time,
              value: initialCapital + (bhFinalCapital - initialCapital) * progress,
            };
          })
        );
      }

      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [result]);

  if (isLoading) return <div className="p-8 text-gray-400">Loading Run Details...</div>;
  if (error || !result) return <div className="p-8 text-rose-500">Failed to load run details.</div>;

  const m = result.portfolio_metrics;

  // Use API asset list if available, fall back to inline asset_results
  const assetList: AssetSummary[] = assets.length > 0
    ? assets
    : Object.values(result.asset_results || {}).map(ar => ({
        symbol: ar.symbol,
        trades: ar.trades,
        pnl: ar.metrics.total_pnl,
        win_rate: ar.metrics.win_rate,
        roi: ar.metrics.roi,
        regime_coverage: { trend_up: 0, sideways: 0, trend_down: 0 },
      }));

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KPICard label="ROI" value={formatPercentage(m.roi)} isPositive={m.roi >= 0} />
        <KPICard label="Capture Ratio" value={m.capture_ratio?.toFixed(2) || '-'} isPositive={(m.capture_ratio || 0) >= 1} />
        <KPICard label="Sharpe" value={m.sharpe_ratio.toFixed(2)} isPositive={m.sharpe_ratio >= 1} />
        <KPICard label="Max DD" value={formatPercentage(m.max_drawdown)} isPositive={false} />
        <KPICard label="Win Rate" value={formatPercentage(m.win_rate)} isPositive={m.win_rate >= 50} />
        <KPICard label="Trades" value={m.total_trades} neutral />
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[var(--color-gold-accent)] font-display font-semibold text-2xl">Equity Curve</h2>
          {m.buy_and_hold_roi != null && (
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#FFD700] inline-block"></span> Strategy</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-gray-500 inline-block" style={{ borderTop: '1px dashed' }}></span> Buy & Hold</span>
            </div>
          )}
        </div>
        <div ref={chartContainerRef} className="w-full h-[350px]" />
      </GlassCard>

      <div className="grid md:grid-cols-3 gap-8">
        <GlassCard className="col-span-1 max-h-[600px] overflow-y-auto">
          <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-xl mb-4">Assets Traded</h3>
          <div className="flex flex-col gap-2">
            {assetList.sort((a, b) => b.pnl - a.pnl).map(asset => (
              <div
                key={asset.symbol}
                onClick={() => setSelectedAsset(asset.symbol)}
                className={`flex justify-between items-center p-3 rounded-lg cursor-pointer border transition-all ${
                  selectedAsset === asset.symbol
                    ? 'bg-white/10 border-[var(--color-gold-accent)]'
                    : 'bg-white/5 border-transparent hover:border-[var(--color-gold-accent)]/30 hover:bg-white/10'
                }`}
              >
                <div>
                  <div className="font-bold text-gray-200">{asset.symbol}</div>
                  <div className="text-xs text-gray-500">{asset.trades} trades · WR {formatPercentage(asset.win_rate, 0)}</div>
                </div>
                <div className={`font-mono text-sm ${asset.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {asset.pnl >= 0 ? '+' : ''}{formatCurrency(asset.pnl)}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="col-span-2 flex items-center justify-center">
          {selectedAsset && runId ? (
            <div className="w-full h-full">
              <CandlestickExplorer runId={runId} symbol={selectedAsset} />
            </div>
          ) : (
            <p className="text-gray-500 italic">Select an asset from the sidebar to view candlestick chart and trade markers.</p>
          )}
        </GlassCard>
      </div>

      {/* Trades Grid */}
      {runId && <TradesGrid runId={runId} />}
    </div>
  );
}
