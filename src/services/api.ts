import type {
  SystemStatus,
  BacktestConfig,
  BacktestSummary,
  BacktestJobStatus,
  BacktestResult,
  PaginatedResponse,
  Trade,
  AssetSummary,
  ChartData,
  LiveBacktestDetail,
} from '../types/api';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  // System
  getSystemStatus: () => fetchJson<SystemStatus>('/system/status'),
  getSystemConfig: () => fetchJson<BacktestConfig>('/system/config'),

  // Backtests
  getBacktests: (limit = 20, offset = 0) =>
    fetchJson<BacktestSummary[]>(`/backtests?limit=${limit}&offset=${offset}`),

  launchBacktest: (config: BacktestConfig) =>
    fetchJson<{ job_id: string; status: string }>('/backtests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  getJobStatus: (jobId: string) =>
    fetchJson<BacktestJobStatus>(`/backtests/jobs/${jobId}`),

  getBacktestResult: (runId: string) =>
    fetchJson<BacktestResult>(`/backtests/${runId}`),

  getBacktestTrades: (runId: string, limit = 100, offset = 0, symbol?: string) => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (symbol) params.append('symbol', symbol);
    return fetchJson<PaginatedResponse<Trade>>(`/backtests/${runId}/trades?${params}`);
  },

  getBacktestAssets: (runId: string) =>
    fetchJson<AssetSummary[]>(`/backtests/${runId}/assets`),

  getChartData: (runId: string, symbol: string, window: number = 60) => 
    fetchJson<ChartData>(`/backtests/${runId}/charts/${symbol}?window=${window}`),

  // SSE Stream helper
  createJobStream: (jobId: string) => {
    return new EventSource(`${API_BASE}/backtests/jobs/${jobId}/stream`);
  },

  // Live (Placeholders for now)
  getLivePositions: () => fetchJson<unknown>('/live/positions'),
  getLiveMetrics: () => fetchJson<unknown>('/live/metrics'),

  getLiveBacktestActive: () => fetchJson<LiveBacktestDetail>('/backtests/live'),
  getLiveBacktest: (runId: string) => fetchJson<LiveBacktestDetail>(`/backtests/live/${runId}`),
};
