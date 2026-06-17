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
      layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#D4AF37',
      topColor: 'rgba(212, 175, 55, 0.4)',
      bottomColor: 'rgba(212, 175, 55, 0.0)',
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

  // Update chart data — use update() for appending, setData() only on first load
  useEffect(() => {
    if (!seriesRef.current || !equityCurve || equityCurve.length === 0) return;

    const sortedHistory = [...equityCurve].sort((a, b) => a.time - b.time);
    const uniqueHistory = new Map<number, EquityPoint>();
    sortedHistory.forEach(point => uniqueHistory.set(point.time, point));
    const chartData = Array.from(uniqueHistory.values());

    if (lastPointCountRef.current === 0) {
      // First load — setData
      seriesRef.current.setData(
        chartData.map(point => ({
          time: point.time as import('lightweight-charts').Time,
          value: point.capital,
        }))
      );
      chartRef.current?.timeScale().fitContent();
    } else if (chartData.length > lastPointCountRef.current) {
      // Append new points via update()
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
    <GlassCard className="shrink-0 h-[300px] flex flex-col">
      <h3 className="text-[var(--color-gold-accent)] font-display font-semibold text-sm uppercase tracking-wider mb-4">{title}</h3>
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </GlassCard>
  );
}
