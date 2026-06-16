import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createChart, AreaSeries } from 'lightweight-charts';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';

export function LiveMonitor() {
  const navigate = useNavigate();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import('lightweight-charts').IChartApi | null>(null);
  const seriesRef = useRef<import('lightweight-charts').ISeriesApi<"Area"> | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['liveBacktest'],
    queryFn: async () => {
      try {
        return await api.getLiveBacktestActive();
      } catch (e: any) {
        if (e.message?.includes('404')) return null;
        throw e;
      }
    },
    refetchInterval: 2500, // Poll every 2.5 seconds
  });

  // Auto-navigate to completed run
  useEffect(() => {
    if (data && !data.is_active && data.portfolio_metrics) {
      navigate({ to: '/backtests/$runId', params: { runId: data.run_id } });
    }
  }, [data, navigate]);

  // Chart Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });
    
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#D4AF37', // var(--color-gold-accent)
      topColor: 'rgba(212, 175, 55, 0.4)',
      bottomColor: 'rgba(212, 175, 55, 0.0)',
      lineWidth: 2,
    });
    
    chartRef.current = chart;
    seriesRef.current = areaSeries;
    
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
  }, [data !== null && data !== undefined]); // Re-init when data becomes available

  // Update Chart Data
  useEffect(() => {
    if (data?.equity_curve && seriesRef.current && data.equity_curve.length > 0) {
      const sortedHistory = [...data.equity_curve].sort((a, b) => a.time - b.time);
      const uniqueHistory = new Map<number, typeof sortedHistory[0]>();
      sortedHistory.forEach(point => uniqueHistory.set(point.time, point));
      
      const chartData = Array.from(uniqueHistory.values()).map(point => ({
        time: point.time as import('lightweight-charts').Time,
        value: point.capital,
      }));
      
      seriesRef.current.setData(chartData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data?.equity_curve]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 animate-pulse">Detecting active run...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl max-w-md">
          <span className="font-bold">Error:</span> Failed to connect to live backtest service.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="glass-panel text-center max-w-md w-full">
          <h2 className="text-gold text-2xl mb-4">No Active Backtests</h2>
          <p className="text-gray-400">
            Waiting for a new backtest to launch...
          </p>
        </div>
      </div>
    );
  }

  const { snapshot, open_positions, recent_fills } = data;
  const progressPct = snapshot && snapshot.decisions_target > 0 
    ? (snapshot.decisions_done / snapshot.decisions_target) * 100 
    : 0;

  return (
    <div className="animate-fade-in flex flex-col gap-6 h-[calc(100vh-8rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 shrink-0">
        <div>
          <h2 className="text-gold text-2xl font-light">Live Run Monitor</h2>
          <div className="text-sm font-mono text-gray-500 mt-1">{data.run_id}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">Status:</span>
            {data.is_active ? (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm animate-pulse border border-emerald-500/30">
                Running
              </span>
            ) : (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm border border-blue-500/30">
                Finishing...
              </span>
            )}
          </div>
          {snapshot && (
            <div className="text-xs text-gray-400 font-mono">
              Progress: {snapshot.decisions_done} / {snapshot.decisions_target} ({progressPct.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* Rolling Metrics */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <div className="glass-panel p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Portfolio Value</span>
            <span className="text-xl font-bold font-mono text-white">
              {formatCurrency(snapshot.portfolio_value)}
            </span>
          </div>
          <div className="glass-panel p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Unrealised P&L</span>
            <span className={`text-xl font-bold font-mono ${snapshot.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {snapshot.pnl >= 0 ? '+' : ''}{formatCurrency(snapshot.pnl)} ({formatPercentage(snapshot.pnl_pct)})
            </span>
          </div>
          <div className="glass-panel p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Max Drawdown</span>
            <span className="text-xl font-bold font-mono text-rose-400">
              {formatPercentage(snapshot.drawdown_pct)}
            </span>
          </div>
          <div className="glass-panel p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Open Positions</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {snapshot.open_positions_count}
            </span>
          </div>
        </div>
      )}

      {/* Equity Curve */}
      <div className="glass-panel shrink-0 h-[300px] flex flex-col">
        <h3 className="text-gold text-sm uppercase tracking-wider mb-4">Live Equity Curve</h3>
        <div ref={chartContainerRef} className="flex-1 w-full" />
      </div>

      {/* Bottom Row: Positions and Fills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
        {/* Open Positions */}
        <div className="glass-panel flex flex-col">
          <h3 className="text-gold text-sm uppercase tracking-wider mb-4">Open Positions</h3>
          <div className="flex-1 overflow-y-auto">
            {open_positions.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No open positions</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 font-medium text-right">Entry</th>
                    <th className="pb-2 font-medium text-right">Current</th>
                    <th className="pb-2 font-medium text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {open_positions.map((pos, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                      <td className="py-2 text-gray-200">{pos.symbol}</td>
                      <td className={`py-2 ${pos.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.side}</td>
                      <td className="py-2 text-right text-gray-300">{formatCurrency(pos.entry_price)}</td>
                      <td className="py-2 text-right text-white">{formatCurrency(pos.current_price)}</td>
                      <td className={`py-2 text-right ${pos.unrealized_pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercentage(pos.unrealized_pnl_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Fills */}
        <div className="glass-panel flex flex-col">
          <h3 className="text-gold text-sm uppercase tracking-wider mb-4">Recent Fills</h3>
          <div className="flex-1 overflow-y-auto">
            {recent_fills.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No fills yet</p>
            ) : (
              <div className="flex flex-col gap-2 font-mono text-sm">
                {recent_fills.map((fill, idx) => (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
