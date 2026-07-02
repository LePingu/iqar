import { useEffect, useRef } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';
import type { EquityPoint } from '../types/api';
import { GlassCard } from './GlassCard';

interface LiveEquityCurveProps {
  equityCurve: EquityPoint[];
  title?: string;
}

export function LiveEquityCurve({ equityCurve, title = 'Live Equity Curve' }: LiveEquityCurveProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import('lightweight-charts').IChartApi | null>(null);
  const seriesRef = useRef<import('lightweight-charts').ISeriesApi<"Area"> | null>(null);
  const lastPointCountRef = useRef(0);

  // Chart initialization — only once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#6B7280',
        fontFamily: "'Roboto Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: {
        vertLine: { color: 'rgba(212, 168, 67, 0.3)', labelBackgroundColor: '#1A1E26' },
        horzLine: { color: 'rgba(212, 168, 67, 0.3)', labelBackgroundColor: '#1A1E26' },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#D4A843',
      topColor: 'rgba(212, 168, 67, 0.15)',
      bottomColor: 'rgba(212, 168, 67, 0.0)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;
    lastPointCountRef.current = 0;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !equityCurve || equityCurve.length === 0) return;

    const sortedHistory = [...equityCurve].sort((a, b) => a.time - b.time);
    const uniqueHistory = new Map<number, EquityPoint>();
    sortedHistory.forEach(point => uniqueHistory.set(point.time, point));
    const chartData = Array.from(uniqueHistory.values());

    if (lastPointCountRef.current === 0) {
      seriesRef.current.setData(
        chartData.map(point => ({
          time: point.time as import('lightweight-charts').Time,
          value: point.capital,
        }))
      );
      chartRef.current?.timeScale().fitContent();
    } else if (chartData.length > lastPointCountRef.current) {
      const newPoints = chartData.slice(lastPointCountRef.current);
      for (const point of newPoints) {
        seriesRef.current.update({
          time: point.time as import('lightweight-charts').Time,
          value: point.capital,
        });
      }
    }

    lastPointCountRef.current = chartData.length;
  }, [equityCurve]);

  return (
    <GlassCard className="shrink-0 h-[280px] flex flex-col">
      <h3 className="section-title">{title}</h3>
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </GlassCard>
  );
}
