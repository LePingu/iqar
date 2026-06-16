import { useEffect, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { createChart, AreaSeries } from 'lightweight-charts';
import { api } from '../services/api';
import { formatCurrency, formatPercentage } from '../utils/trading';
import { CandlestickExplorer } from './CandlestickExplorer';
import { useState } from 'react';

export function RunDetail() {
  const { runId } = useParams({ strict: false });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['backtest', runId],
    queryFn: () => api.getBacktestResult(runId as string),
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
      }
    });

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

      areaSeries.setData(
        Array.from(uniqueHistory.values()).map(point => ({
          time: point.time as import('lightweight-charts').Time,
          value: point.capital,
        }))
      );
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

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'ROI', value: formatPercentage(m.roi), isPositive: m.roi >= 0 },
          { label: 'Capture Ratio', value: m.capture_ratio?.toFixed(2) || '-', isPositive: (m.capture_ratio || 0) >= 1 },
          { label: 'Sharpe', value: m.sharpe_ratio.toFixed(2), isPositive: m.sharpe_ratio >= 1 },
          { label: 'Max DD', value: formatPercentage(m.max_drawdown), isPositive: false },
          { label: 'Win Rate', value: formatPercentage(m.win_rate), isPositive: m.win_rate >= 50 },
          { label: 'Trades', value: m.total_trades, isPositive: true, neutral: true },
        ].map((kpi, i) => (
          <div key={i} className="glass-panel p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</span>
            <span className={`text-xl font-bold ${kpi.neutral ? 'text-white' : kpi.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-panel">
        <h2 className="text-gold text-2xl mb-6">Equity Curve</h2>
        <div ref={chartContainerRef} className="w-full h-[350px]" />
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="glass-panel col-span-1 max-h-[600px] overflow-y-auto">
          <h3 className="text-gold text-xl mb-4">Assets Traded</h3>
          <div className="flex flex-col gap-2">
            {Object.values(result.asset_results || {}).sort((a, b) => b.metrics.total_pnl - a.metrics.total_pnl).map(asset => (
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
                  <div className="text-xs text-gray-500">{asset.trades} trades</div>
                </div>
                <div className={`font-mono text-sm ${asset.metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {asset.metrics.total_pnl >= 0 ? '+' : ''}{formatCurrency(asset.metrics.total_pnl)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel col-span-2 flex items-center justify-center">
          {selectedAsset && runId ? (
            <div className="w-full h-full">
              <CandlestickExplorer runId={runId} symbol={selectedAsset} />
            </div>
          ) : (
            <p className="text-gray-500 italic">Select an asset from the sidebar to view candlestick chart and trade markers.</p>
          )}
        </div>
      </div>
    </div>
  );
}
