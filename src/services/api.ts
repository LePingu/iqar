import type {
  EngineTelemetry, AuditEventsResponse, OrderExecution,
  PeerScorecardSummary, PeerScorecardResponse, PeerField,
  SystemStatus,
  BacktestConfig,
  BacktestSummary,
  BacktestJobStatus,
  BacktestLaunchRequest,
  BacktestLaunchAccepted,
  BacktestPresetInfo,
  BacktestComparison,
  BacktestResult,
  PaginatedResponse,
  Trade,
  AssetSummary,
  ChartData,
  LiveBacktestDetail,
  EngineStatus,
  EngineControls,
  LiquidateRequest,
  LiquidateAccepted,
  LiveEngineDetail,
  RealAccountStatus,
  EvaluationReportResponse,
  EvaluationSummary,
  EvaluationCurves,
  OracleSessionSummary,
  OracleLotsResponse,
  LotLineage,
  TraceFileInfo,
  OracleTraceRecordType,
  TraceRecordsResponse,
  LlmCallsResponse,
  ContinuityReport,
  LogTailResponse,
  PaginatedLiveFills,
  DecisionDetail,
  DecisionsResponse,
  DecisionSource,
  TradeSide,
} from '../types/api';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, options);
  if (!response.ok) {
    // Surface the backend's error detail (e.g. FastAPI's `detail`) — the
    // launch flow depends on it to show a 409 dataset error verbatim.
    let detail = '';
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'detail' in body) {
        const d = (body as { detail: unknown }).detail;
        detail = typeof d === 'string' ? d : JSON.stringify(d);
      }
    } catch {
      // No JSON body — the status line alone carries the error.
    }
    throw new ApiError(response.status, `API Error: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`);
  }
  if (response.status === 204) return null as T;
  return response.json();
}

// Only explicitly unsupported resources become unavailable; auth and service
// failures remain errors so a disconnected system cannot appear healthy.
async function fetchOptional<T>(url: string): Promise<T | null> {
  try { return await fetchJson<T | null>(url); }
  catch (error) {
    if (error instanceof ApiError && [404, 501].includes(error.status)) return null;
    throw error;
  }
}

function decisionBase(source: DecisionSource) {
  return source.kind === 'session'
    ? `/oracle/${encodeURIComponent(source.sessionId)}/decisions`
    : `/backtests/${encodeURIComponent(source.runId)}/decisions`;
}

export const api = {
  getEngineTelemetry: (sessionId: string) =>
    fetchOptional<EngineTelemetry>(`/engine/${encodeURIComponent(sessionId)}/telemetry`),
  getEngineEvents: (sessionId: string, options: { cursor?: string; category?: string; severity?: 'info' | 'warning' | 'critical'; active?: boolean } = {}) => {
    const params = new URLSearchParams({ limit: '50' });
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.category) params.set('category', options.category);
    if (options.severity) params.set('severity', options.severity);
    if (options.active != null) params.set('active', String(options.active));
    return fetchOptional<AuditEventsResponse>(`/engine/${encodeURIComponent(sessionId)}/events?${params}`);
  },
  getOrderExecution: (sessionId: string, orderId: string) =>
    fetchOptional<OrderExecution>(`/engine/${encodeURIComponent(sessionId)}/orders/${encodeURIComponent(orderId)}`),
  getPeers: () => fetchOptional<PeerScorecardSummary[]>('/peers'),
  getPeer: (peerName: string) => fetchOptional<PeerScorecardResponse>(`/peers/${encodeURIComponent(peerName)}`),
  getPeerField: (windowLabel: string, ourRunId?: string) => {
    const query = ourRunId ? `?our_run_id=${encodeURIComponent(ourRunId)}` : '';
    return fetchOptional<PeerField>(`/peers/field/${encodeURIComponent(windowLabel)}${query}`);
  },

  getDecisions: (source: DecisionSource, filters: {
    symbol?: string; action?: string; executed?: boolean; outcome?: string;
    since?: string; until?: string; limit?: number; offset?: number;
  } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== '') params.set(key, String(value));
    });
    return fetchJson<DecisionsResponse>(`${decisionBase(source)}?${params}`);
  },
  getDecision: (source: DecisionSource, decisionId: string) =>
    fetchJson<DecisionDetail>(`${decisionBase(source)}/${encodeURIComponent(decisionId)}`),

  // System
  getSystemStatus: () => fetchJson<SystemStatus>('/system/status'),
  getSystemConfig: () => fetchJson<BacktestConfig>('/system/config'),

  // Backtests
  getBacktests: (limit = 20, offset = 0) =>
    fetchJson<BacktestSummary[]>(`/backtests?limit=${limit}&offset=${offset}`),

  // Reviewed F2 conditions the launch form may present for confirmation.
  getBacktestPresets: () => fetchJson<BacktestPresetInfo[]>('/backtests/presets'),

  // Only {preset, variant} — raw config fields are rejected with 422.
  launchBacktest: (request: BacktestLaunchRequest) =>
    fetchJson<BacktestLaunchAccepted>('/backtests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),

  getJobStatus: (jobId: string) =>
    fetchJson<BacktestJobStatus>(`/backtests/jobs/${jobId}`),

  // Worker-recorded baseline/current evidence; 404 when the artifact is
  // unavailable, 409 while the job has not reached a terminal state.
  getJobComparison: (jobId: string) =>
    fetchJson<BacktestComparison>(`/backtests/jobs/${jobId}/comparison`),

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

  getEngineDetail: (sessionId: string) =>
    fetchJson<LiveEngineDetail>(`/engine/${sessionId}/detail`),

  // Fill history — the way back in time that /detail's recent_fills (last 20,
  // the live feed) is not. While new fills keep arriving at the top, page with
  // `before_id` (the smallest id on the page you have): it never shifts.
  getEngineFills: (
    sessionId: string,
    opts: {
      symbol?: string;
      side?: TradeSide;
      source?: 'engine' | 'exchange';
      since?: string;
      until?: string;
      before_id?: number;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.side) params.set('side', opts.side);
    if (opts.source) params.set('source', opts.source);
    if (opts.since) params.set('since', opts.since);
    if (opts.until) params.set('until', opts.until);
    if (opts.before_id != null) params.set('before_id', String(opts.before_id));
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return fetchJson<PaginatedLiveFills>(`/engine/${sessionId}/fills${qs ? `?${qs}` : ''}`);
  },

  haltEngine: (sessionId: string) =>
    fetchJson<{ queued: string; session_id: string }>(`/engine/${sessionId}/halt`, {
      method: 'POST',
    }),

  resumeEngine: (sessionId: string) =>
    fetchJson<{ queued: string; session_id: string }>(`/engine/${sessionId}/resume`, {
      method: 'POST',
    }),

  // Acceptance only: the final outcome is reported in the engine events feed.
  liquidateEngine: (sessionId: string, request: LiquidateRequest) =>
    fetchJson<LiquidateAccepted>(`/engine/${encodeURIComponent(sessionId)}/liquidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),

  updateEngineControls: (sessionId: string, controls: EngineControls) =>
    fetchJson<{ queued: string; session_id: string; payload: object }>(`/engine/${sessionId}/controls`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(controls),
    }),

  flushEngine: (sessionId: string) =>
    fetchJson<{ queued: string; session_id: string; by: string }>(`/engine/${sessionId}/flush`, {
      method: 'POST',
    }),

  // Real-money account (Route F)
  getRealAccount: (sessionId?: string) =>
    fetchJson<RealAccountStatus>(
      sessionId
        ? `/engine/real/account?session_id=${encodeURIComponent(sessionId)}`
        : '/engine/real/account',
    ),

  // Evaluation (Route G)
  // Slow on purpose — walks hourly exchange bars for every symbol the
  // session traded. Budget 20–60s; the caller must render a pending state.
  // `since`/`until` measure one explicit stretch (≤ 120 days) and override
  // `windowDays`; `until` defaults to now.
  runEvaluation: (
    sessionId: string,
    range?: { windowDays?: number; since?: string; until?: string },
  ) => {
    const params = new URLSearchParams();
    if (range?.windowDays != null) params.set('window_days', String(range.windowDays));
    if (range?.since) params.set('since', range.since);
    if (range?.until) params.set('until', range.until);
    const qs = params.toString();
    return fetchJson<EvaluationReportResponse>(
      `/evaluation/${sessionId}/run${qs ? `?${qs}` : ''}`,
      { method: 'POST' },
    );
  },

  getLatestEvaluation: (sessionId: string) =>
    fetchJson<EvaluationReportResponse>(`/evaluation/${sessionId}/latest`),

  getEvaluationHistory: (sessionId: string, limit = 30) =>
    fetchJson<EvaluationSummary[]>(`/evaluation/${sessionId}/history?limit=${limit}`),

  // The book's equity beside the market, as aligned indexed series with fill
  // markers. A cached read (benchmark prices cached 15 min) — poll it, do not
  // debounce it further. 502 = benchmark venue unreachable: render the reason.
  getEvaluationCurves: (
    sessionId: string,
    range?: { windowDays?: number; since?: string; until?: string },
  ) => {
    const params = new URLSearchParams();
    if (range?.windowDays != null) params.set('window_days', String(range.windowDays));
    if (range?.since) params.set('since', range.since);
    if (range?.until) params.set('until', range.until);
    const qs = params.toString();
    return fetchJson<EvaluationCurves>(`/evaluation/${sessionId}/curves${qs ? `?${qs}` : ''}`);
  },

  // Direct link only — the endpoint sets Content-Disposition itself.
  evaluationDownloadUrl: (reportId: number) =>
    `${API_BASE}/evaluation/reports/${reportId}/download`,

  // Oracle — read-only lineage for agents and service tokens. No oracle
  // route writes money state, queues a command, or reaches an exchange.
  getOracleSessions: () => fetchJson<OracleSessionSummary[]>('/oracle/sessions'),

  getOracleLots: (
    sessionId: string,
    opts: { symbol?: string; status?: 'open' | 'closed'; limit?: number; offset?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.status) params.set('status', opts.status);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return fetchJson<OracleLotsResponse>(`/oracle/${sessionId}/lots${qs ? `?${qs}` : ''}`);
  },

  getOracleLotLineage: (sessionId: string, lotId: number) =>
    fetchJson<LotLineage>(`/oracle/${sessionId}/lots/${lotId}/lineage`),

  getOracleTraces: (sessionId: string) =>
    fetchJson<TraceFileInfo[]>(`/oracle/${sessionId}/traces`),

  getOracleTraceRecords: (
    sessionId: string,
    opts: {
      symbol?: string;
      record_type?: OracleTraceRecordType;
      since?: string;
      until?: string;
      limit?: number;
      keep_prompts?: boolean;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.record_type) params.set('record_type', opts.record_type);
    if (opts.since) params.set('since', opts.since);
    if (opts.until) params.set('until', opts.until);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.keep_prompts != null) params.set('keep_prompts', String(opts.keep_prompts));
    const qs = params.toString();
    return fetchJson<TraceRecordsResponse>(`/oracle/${sessionId}/traces/records${qs ? `?${qs}` : ''}`);
  },

  // The call log is shared by every engine process — filtered by
  // symbol/agent only, never by session.
  getOracleLlmCalls: (
    sessionId: string,
    opts: { symbol?: string; agent?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.symbol) params.set('symbol', opts.symbol);
    if (opts.agent) params.set('agent', opts.agent);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return fetchJson<LlmCallsResponse>(`/oracle/${sessionId}/llm-calls${qs ? `?${qs}` : ''}`);
  },

  getOracleContinuity: (
    sessionId: string,
    opts: { gap_minutes?: number; days?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.gap_minutes != null) params.set('gap_minutes', String(opts.gap_minutes));
    if (opts.days != null) params.set('days', String(opts.days));
    const qs = params.toString();
    return fetchJson<ContinuityReport>(`/oracle/${sessionId}/continuity${qs ? `?${qs}` : ''}`);
  },

  getOracleLogTail: (sessionId: string, lines?: number) =>
    fetchJson<LogTailResponse>(
      `/oracle/${sessionId}/log${lines != null ? `?lines=${lines}` : ''}`,
    ),
};
