import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { api } from '../services/api';

interface Props {
  runId: string;
  symbol: string;
}

export function CandlestickExplorer({ runId, symbol }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [windowSize, setWindowSize] = useState<number>(240);

  const { data, isLoading, error } = useQuery({
    queryKey: ['chart', runId, symbol, windowSize],
    queryFn: () => api.getChartData(runId, symbol, windowSize),
    enabled: !!runId && !!symbol,
  });

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;

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
      height: 600,
      timeScale: {
        timeVisible: true,
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    if (data.candles && data.candles.length > 0) {
      // Sort candles chronologically
      const sortedCandles = [...data.candles].sort((a, b) => a.time - b.time);
      candleSeries.setData(
        sortedCandles.map(c => ({
          time: c.time as import('lightweight-charts').Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      if (data.markers && data.markers.length > 0) {
        const sortedMarkers = [...data.markers].sort((a, b) => a.time - b.time);
        
        // Group markers by time since lightweight-charts doesn't support multiple markers on the same time
        const markersByTime = new Map<number, any[]>();
        sortedMarkers.forEach(m => {
          if (!markersByTime.has(m.time)) markersByTime.set(m.time, []);
          markersByTime.get(m.time)!.push(m);
        });

        const finalMarkers: import('lightweight-charts').SeriesMarker<import('lightweight-charts').Time>[] = [];
        markersByTime.forEach((group, time) => {
          // If there are multiple, just pick the most important one (e.g. SELL over BUY, or just the last one)
          // Or we can create a combined text
          const primary = group[group.length - 1]; // pick last for shape/color
          const combinedText = group.map(m => 
            `${m.side} (${m.pnl !== null && m.pnl !== undefined ? (m.pnl >= 0 ? '+' : '') + m.pnl.toFixed(2) : 'entry'})`
          ).join(' & ');

          finalMarkers.push({
            time: time as import('lightweight-charts').Time,
            position: primary.side === 'BUY' ? 'belowBar' : 'aboveBar',
            color: primary.side === 'BUY' ? '#10B981' : '#F43F5E',
            shape: primary.side === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: combinedText,
          });
        });

        createSeriesMarkers(candleSeries, finalMarkers);
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
  }, [data]);

  if (isLoading) return <div className="h-full flex items-center justify-center text-gray-400">Loading chart data for {symbol}...</div>;
  if (error || !data) return <div className="h-full flex items-center justify-center text-rose-500">Failed to load chart data.</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gold text-xl">{symbol} Candlestick Explorer</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Timeframe:</span>
          <select 
            value={windowSize} 
            onChange={e => setWindowSize(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm text-gray-200 outline-none focus:border-[var(--color-gold-accent)]"
          >
            {[1, 5, 15, 30, 60, 240, 720, 1440].map(w => (
              <option key={w} value={w}>{w < 60 ? `${w}m` : w < 1440 ? `${w/60}h` : `${w/1440}d`}</option>
            ))}
          </select>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full flex-1 min-h-[600px]" />
    </div>
  );
}
