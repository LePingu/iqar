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
  EngineStatus,
  EngineControls,
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

  getChartData: (runId: string, symbol: string) =>
    fetchJson<ChartData>(`/backtests/${runId}/charts/${symbol}`),

  // Live backtest monitoring
  getLiveBacktestActive: () => fetchJson<LiveBacktestDetail>('/backtests/live'),
  getLiveBacktest: (runId: string) => fetchJson<LiveBacktestDetail>(`/backtests/live/${runId}`),

  // Engine control (Route E)
  getEngineStatus: (sessionId: string) =>
    fetchJson<EngineStatus>(`/engine/${sessionId}/status`),

  haltEngine: (sessionId: string) =>
    fetchJson<{ queued: string; session_id: string }>(`/engine/${sessionId}/halt`, {
      method: 'POST',
    }),

  resumeEngine: (sessionId: string) =>
    fetchJson<{ queued: string; session_id: string }>(`/engine/${sessionId}/resume`, {
      method: 'POST',
    }),

  updateEngineControls: (sessionId: string, controls: EngineControls) =>
    fetchJson<{ queued: string; session_id: string; payload: object }>(`/engine/${sessionId}/controls`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(controls),
    }),
};
