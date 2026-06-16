import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AIDecision, Metrics } from '../types/api';
import { formatCurrency, formatPercentage } from '../utils/trading';

export function JobMonitor() {
  const { jobId } = useParams({ strict: false });
  const navigate = useNavigate();
  const streamRef = useRef<HTMLDivElement>(null);

  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fallback polling for job status
  useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => api.getJobStatus(jobId as string),
    enabled: !!jobId && status !== 'connected',
    refetchInterval: status === 'error' ? 3000 : false,
  });

  useEffect(() => {
    if (!jobId) return;

    let eventSource: EventSource;
    let retryCount = 0;
    const maxRetries = 3;

    const connect = () => {
      setStatus('connecting');
      eventSource = api.createJobStream(jobId as string);

      eventSource.onopen = () => {
        setStatus('connected');
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'decision') {
            setDecisions(prev => [...prev, data.payload].slice(-50)); // Keep last 50
          } else if (data.type === 'metrics') {
            setMetrics(data.payload);
          } else if (data.type === 'done') {
            eventSource.close();
            navigate({ to: '/backtests/$runId', params: { runId: data.payload.run_id } });
          } else if (data.type === 'error') {
            setErrorMsg(data.payload.message || 'Unknown error occurred in backtest');
            setStatus('error');
            eventSource.close();
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(connect, 2000); // 2s backoff
        } else {
          setStatus('error');
          setErrorMsg('Failed to connect to live stream. Falling back to polling.');
        }
      };
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [jobId, navigate]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [decisions]);

  return (
    <div className="animate-fade-in flex flex-col gap-8 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div>
          <h2 className="text-gold text-2xl font-light">Job Monitor</h2>
          <div className="text-sm font-mono text-gray-500 mt-1">{jobId}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">Status:</span>
          {status === 'connecting' && <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm animate-pulse border border-blue-500/30">Connecting</span>}
          {status === 'connected' && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm animate-pulse border border-emerald-500/30">Running</span>}
          {status === 'error' && <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-sm border border-rose-500/30">Error</span>}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
          <span className="font-bold">Error:</span> {errorMsg}
        </div>
      )}

      {/* Rolling Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rolling ROI</span>
          <span className={`text-xl font-bold font-mono ${!metrics ? 'text-gray-500' : metrics.roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {metrics ? formatPercentage(metrics.roi) : '--'}
          </span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Win Rate</span>
          <span className="text-xl font-bold font-mono text-blue-400">
            {metrics ? formatPercentage(metrics.win_rate) : '--'}
          </span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Open Positions</span>
          <span className="text-xl font-bold font-mono text-white">
            {metrics ? metrics.max_concurrent_positions : '--'} {/* Placeholder, using max */}
          </span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-center">
          <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Capital</span>
          <span className="text-xl font-bold font-mono text-white">
            {metrics ? formatCurrency(metrics.final_capital) : '--'}
          </span>
        </div>
      </div>

      {/* Decision Feed */}
      <div className="glass-panel flex-1 flex flex-col min-h-[300px] overflow-hidden">
        <h3 className="text-gold text-lg mb-4">Decision Feed</h3>
        <div 
          ref={streamRef}
          className="flex-1 overflow-y-auto bg-[var(--color-dark-bg)] p-4 rounded-xl font-mono text-sm flex flex-col gap-2 border border-[var(--color-dark-border)]"
        >
          {decisions.length === 0 && status === 'connected' && (
            <div className="text-gray-500 italic">Waiting for decisions...</div>
          )}
          {decisions.map((d, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 p-1 rounded transition-colors">
              <span className="text-gray-500 text-xs w-32 shrink-0">{new Date(d.timestamp).toLocaleTimeString()}</span>
              <span className="text-gray-200 font-bold w-20 shrink-0">{d.symbol}</span>
              <span className={`w-24 shrink-0 font-bold ${d.signal.includes('buy') ? 'text-emerald-400' : d.signal.includes('sell') ? 'text-rose-400' : 'text-gray-400'}`}>
                {d.signal.toUpperCase()}
              </span>
              <span className="text-blue-400 w-24 shrink-0">Conf: {(d.confidence * 100).toFixed(0)}%</span>
              <span className="text-gray-400 text-right ml-auto">{formatCurrency(d.price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
