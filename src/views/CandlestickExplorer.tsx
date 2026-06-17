import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { api } from '../services/api';
import type { RegimeBand } from '../types/api';

interface Props {
  runId: string;
  symbol: string;
}

// Regime band colors (semi-transparent for background overlay)
const REGIME_COLORS: Record<string, string> = {
  trend_up: 'rgba(212, 175, 55, 0.08)',    // muted gold
  sideways: 'rgba(156, 163, 175, 0.08)',    // muted grey
  trend_down: 'rgba(244, 63, 94, 0.08)',    // muted red
  unknown: 'rgba(100, 100, 100, 0.05)',
};

const REGIME_BORDER_COLORS: Record<string, string> = {
  trend_up: 'rgba(212, 175, 55, 0.3)',
  sideways: 'rgba(156, 163, 175, 0.2)',
  trend_down: 'rgba(244, 63, 94, 0.3)',
  unknown: 'rgba(100, 100, 100, 0.15)',
};

function drawRegimeBands(
  chart: import('lightweight-charts').IChartApi,
  bands: RegimeBand[],
  container: HTMLDivElement
) {
  // Create an overlay canvas for regime bands
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';

  const chartElement = container.querySelector('.tv-lightweight-charts') || container.firstElementChild;
  if (chartElement) {
    (chartElement as HTMLElement).style.position = 'relative';
    chartElement.appendChild(canvas);
  }

  const updateBands = () => {
    const timeScale = chart.timeScale();
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    for (const band of bands) {
      const startCoord = timeScale.timeToCoordinate(band.start_time as import('lightweight-charts').Time);
      const endCoord = timeScale.timeToCoordinate(band.end_time as import('lightweight-charts').Time);

      if (startCoord === null || endCoord === null) continue;

      const x = Math.min(startCoord, endCoord);
      const w = Math.abs(endCoord - startCoord);

      ctx.fillStyle = REGIME_COLORS[band.regime] || REGIME_COLORS.unknown;
      ctx.fillRect(x, 0, w, height);

      // Subtle left border
      ctx.strokeStyle = REGIME_BORDER_COLORS[band.regime] || REGIME_BORDER_COLORS.unknown;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  };

  // Update on time scale changes
  chart.timeScale().subscribeVisibleTimeRangeChange(updateBands);
  // Initial draw after a short delay for chart to render
  setTimeout(updateBands, 100);

  return () => {
    canvas.remove();
  };
}

export function CandlestickExplorer({ runId, symbol }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['chart', runId, symbol],
    queryFn: () => api.getChartData(runId, symbol),
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
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    let cleanupBands: (() => void) | undefined;

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

      // Render trade markers
      if (data.markers && data.markers.length > 0) {
        const sortedMarkers = [...data.markers].sort((a, b) => a.time - b.time);

        // Group markers by time since lightweight-charts doesn't support multiple markers on the same time
        const markersByTime = new Map<number, typeof sortedMarkers>();
        sortedMarkers.forEach(m => {
          if (!markersByTime.has(m.time)) markersByTime.set(m.time, []);
          markersByTime.get(m.time)!.push(m);
        });

        const finalMarkers: import('lightweight-charts').SeriesMarker<import('lightweight-charts').Time>[] = [];
        markersByTime.forEach((group, time) => {
          const primary = group[group.length - 1];
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

      // Render regime bands as coloured background overlays
      if (data.regime_bands && data.regime_bands.length > 0 && chartContainerRef.current) {
        cleanupBands = drawRegimeBands(chart, data.regime_bands, chartContainerRef.current);
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
      cleanupBands?.();
      chart.remove();
    };
  }, [data]);

  if (isLoading) return <div className="h-full flex items-center justify-center text-gray-400">Loading chart data for {symbol}...</div>;
  if (error || !data) return <div className="h-full flex items-center justify-center text-rose-500">Failed to load chart data.</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-xl">{symbol} Candlestick Explorer</h3>
        {/* Regime band legend */}
        {data.regime_bands && data.regime_bands.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'rgba(212, 175, 55, 0.3)' }}></span> Trend Up</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'rgba(156, 163, 175, 0.3)' }}></span> Sideways</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'rgba(244, 63, 94, 0.3)' }}></span> Trend Down</span>
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="w-full flex-1 min-h-[600px]" />
    </div>
  );
}
