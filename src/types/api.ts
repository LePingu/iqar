export interface SystemStatus {
  rust_core_version: string;
  rust_simd_enabled: boolean;
  database_size_mb: number;
  llm_api_latency_ms: number;
  active_agents: number;
}

export type SignalType = 
  | 'strong_buy' | 'buy' | 'weak_buy'
  | 'strong_sell' | 'sell' | 'weak_sell'
  | 'strong_short' | 'short' | 'hold' | 'close'
  | 'bullish_reversal' | 'bearish_reversal' | 'neutral';

export type TradeSide = 'BUY' | 'SELL';

export type MarketRegime = 'trend_up' | 'sideways' | 'trend_down' | 'unknown';

export interface BacktestConfig {
  initial_capital: number;
  transaction_fee: number;
  slippage_pct: number;
  max_positions: number;
  max_position_pct: number;
  target_decisions: number;
  start_date: string;
  end_date: string;
  enable_short_selling: boolean;
  enable_compounding: boolean;
  enable_trailing_stops: boolean;
  disable_ai_exits: boolean;
  pattern_analysis_enabled: boolean;
  risk_assessment_enabled: boolean;
  sentiment_analysis_enabled: boolean;
  correlation_analysis_enabled: boolean;
  fixed_universe_enabled: boolean;
  dual_portfolio_enabled: boolean;
  regime_continuous_enabled: boolean;
  position_rotation_enabled: boolean;
  mock_critic: boolean;
  anti_averaging_down_enabled: boolean;
  critic_sideways_asset_aware_enabled: boolean;
  vol_trail_enabled: boolean;
  vol_trail_multiplier: number;
  vol_trail_floor: number;
  vol_trail_ceiling: number;
}

export interface Metrics {
  roi: number;
  total_pnl: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  avg_trade_pnl: number;
  avg_hold_duration_hours: number;
  final_capital: number;
  peak_capital: number;
  max_concurrent_positions: number;
  buy_and_hold_roi?: number;
  capture_ratio?: number;
}

export interface Trade {
  symbol: string;
  side: TradeSide;
  size: number;
  price: number;
  timestamp: string;
  pnl: number;
  pnl_pct: number;
  hold_duration_hours: number;
  reason: string;
}

export interface Position {
  id: number;
  symbol: string;
  side: TradeSide;
  size: number;
  entry_price: number;
  entry_time: string;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  trailing_stop_active: boolean;
  trailing_stop_price: number;
}

export interface AIDecision {
  timestamp: string;
  symbol: string;
  signal: SignalType;
  confidence: number;
  price: number;
  pm_position_size: number;
  pm_stop_loss: number;
  pm_take_profit: number;
}

/**
 * Durable queue state for one backtest job. Tower creates the record before
 * the worker starts; a queued job has no `run_id` yet. An `interrupted` job
 * (worker restart) is never automatically retried.
 */
export interface BacktestJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  preset?: string | null;
  variant?: string | null;
  dataset_id?: string | null;
  historical_baseline_run_id?: string | null;
  /**
   * Populated before the runner starts; use it with
   * GET /api/backtests/live/{run_id}. Never assume job_id == run_id.
   */
  run_id?: string | null;
  progress_pct?: number | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  exit_code?: number | null;
  error?: string | null;
}

/** The only fields POST /api/backtests accepts — a named, reviewed condition. */
export interface BacktestLaunchRequest {
  preset: string;
  variant: string;
}

/** One F2 condition the UI may present for explicit operator confirmation. */
export interface BacktestPresetInfo {
  preset: string;
  variant: string;
  description: string;
  parameters: Record<string, string>;
  historical_baseline_run_id: string;
  estimated_minutes_min: number;
  estimated_minutes_max: number;
  /** Current host limit; the UI must not imply additional parallel capacity. */
  max_parallel: number;
}

export interface BacktestLaunchAccepted {
  job_id: string;
  status: 'queued';
  preset: string;
  variant: string;
  dataset_id: string;
  historical_baseline_run_id: string;
  estimated_minutes_min: number;
  estimated_minutes_max: number;
  max_parallel: number;
}

/**
 * Worker-generated baseline/current evidence. Free-form by contract: fields
 * vary when a baseline artifact is unavailable, so render nulls explicitly.
 */
export interface BacktestComparison {
  [key: string]: unknown;
}

export interface AssetSummary {
  symbol: string;
  trades: number;
  win_rate: number;
  pnl: number;
  roi: number;
  regime_coverage: {
    trend_up: number;
    sideways: number;
    trend_down: number;
  };
}

export interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeMarker {
  time: number;
  side: TradeSide;
  price: number;
  pnl: number | null;
  reason: string;
}

export interface RegimeBand {
  start_time: number;
  end_time: number;
  regime: MarketRegime;
  confidence: number;
}

export interface ChartData {
  symbol: string;
  candles: OHLCVCandle[];
  markers: TradeMarker[];
  regime_bands: RegimeBand[];
}

export interface EquityPoint {
  time: number;
  capital: number;
  roi_pct: number;
}

export interface BacktestSummary {
  run_id: string;
  timestamp: string;
  metrics: Metrics;
  config: BacktestConfig;
}

export interface AssetResult {
  symbol: string;
  trades: number;
  capital_invested: number;
  metrics: Metrics;
}

export interface BacktestResult {
  run_id: string;
  timestamp: string;
  config: BacktestConfig;
  portfolio_metrics: Metrics;
  asset_results: Record<string, AssetResult>;
  portfolio_history: EquityPoint[];
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export interface LiveSnapshot {
  portfolio_value: number;
  pnl: number;
  pnl_pct: number;
  drawdown_pct: number;
  open_positions_count: number;
  decisions_done: number;
  decisions_target: number;
  last_snapshot_ts: string;
}

export type EngineMode = 'paper' | 'real';

export type BasisSource = 'traded' | 'adopted' | 'reconstructed';

export interface OpenPosition {
  position_id?: number | null;
  protection?: PositionProtection | null;
  basis_source?: BasisSource;
  adopted_at?: string | null;
  venue_market?: string | null;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl_pct: number;
  trailing_stop_active: boolean;
  trailing_stop_price: number | null;
}

export interface LiveFill {
  order_id?: string | null;
  execution_quality?: ExecutionQuality | null;
  source?: 'engine' | 'exchange';
  settle_currency?: string | null;
  settle_fx_rate?: number | null;
  venue_market?: string | null;
  settle_price?: number | null;
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  timestamp: string;
  realized_pnl: number | null;
  realized_pnl_pct: number | null;
  /** Stable row id — the `before_id` cursor for fill-history paging. */
  id?: number | null;
  /** The lot this fill opened or closed (see the oracle's lots / lineage). */
  position_id?: number | null;
  /**
   * The orchestrator decision this fill executed — opens the decision card.
   * Null for a mechanical exit (stop / trail / force-close) or a venue-side fill.
   */
  decision_id?: string | null;
  /** Close reason on a SELL; `signal` on an engine BUY; `exchange_history` on an ingested row. */
  reason?: string | null;
  commission?: number | null;
}

export interface RealAccountStatus {
  as_of: string;
  currency?: string;
  quote_cash: number | null;
  positions_value?: number | null;
  total_value: number | null;
  num_holdings: number | null;
}

export interface LiveBacktestDetail {
  run_id: string;
  is_active: boolean;
  config: BacktestConfig | null;
  snapshot: LiveSnapshot | null;
  open_positions: OpenPosition[];
  recent_fills: LiveFill[];
  equity_curve: EquityPoint[];
  portfolio_metrics: Metrics | null;
}

export interface EngineStatus {
  mode?: EngineMode;
  session_id: string;
  trading_enabled: boolean;
  engine_alive: boolean;
  max_position_size_pct: number;
  max_daily_loss_pct: number;
  max_open_positions: number;
  last_snapshot_ts: string | null;
}

export interface EngineControls {
  max_position_size_pct?: number | null;
  max_daily_loss_pct?: number | null;
  max_open_positions?: number | null;
}

export interface LiveEngineDetail extends DataFreshness {
  exposure_pct?: number | null;
  mode?: EngineMode;
  currency?: string;
  observed_from?: string | null;
  session_id: string;
  trading_enabled: boolean;
  is_active: boolean;
  portfolio_value: number;
  pnl: number;
  pnl_pct: number;
  drawdown_pct: number;
  open_positions_count: number;
  last_snapshot_ts: string | null;
  open_positions: OpenPosition[];
  recent_fills: LiveFill[];
  equity_curve: EquityPoint[];
}

// --- Evaluation (Route G) ---

export type EvaluationTrigger = 'scheduled' | 'manual';

export interface EvaluationCheck {
  name: string;
  passed: boolean;
  detail?: string | null;
}

/**
 * Headline figures of one stored evaluation. Every numeric field is nullable
 * and that is load-bearing: null means "could not measure", never "measured
 * as zero".
 */
export interface EvaluationSummary {
  id: number;
  session_id: string;
  mode: EngineMode;
  trigger: EvaluationTrigger;
  generated_at: string;
  window_start: string;
  window_end: string;
  return_pct: number | null;
  benchmark_pct: number | null;
  /**
   * `return_pct / benchmark_pct`. Null when there was no benchmark coverage
   * AND null whenever `benchmark_pct` is below +1% — a ratio to a flat or
   * falling hold is meaningless. Lead with `alpha_pp`; never render null as 0.
   */
  capture_ratio: number | null;
  /**
   * `return_pct − benchmark_pct` in percentage points. Always defined when a
   * benchmark is, whatever its sign; null only when the benchmark could not
   * be fetched.
   */
  alpha_pp?: number | null;
  checks_failed: number;
  error?: string | null;
}

/**
 * The structured report behind the digest. Served as a free-form object by
 * the API; the known members are typed for convenience and everything else
 * passes through untouched.
 */
export interface EvaluationPayload {
  checks?: EvaluationCheck[];
  discontinuities?: unknown[];
  exposure_ceiling_pct?: number | null;
  exit_paths?: Record<string, unknown>[];
  symbols?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface EvaluationReportResponse extends EvaluationSummary {
  digest: string;
  payload: EvaluationPayload;
}

// --- Oracle (read-only lineage for agents and service tokens) ---
// Every oracle read is audited; these routes write nothing and are the only
// routes a Cloudflare Access service token may call.

export interface OracleSessionSummary {
  session_id: string;
  mode: string;
  trading_enabled: boolean;
  max_open_positions: number;
  last_snapshot_ts?: string | null;
  open_lots?: number;
  closed_lots?: number;
}

/**
 * One lot of the ledger. Prices are NOT rounded to a fixed decimal count —
 * format with fmtPrice (significant digits), never toFixed(2).
 */
export interface OracleLot {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  entry_timestamp: string;
  current_price?: number | null;
  status: string;
  unrealized_pnl: number;
  realized_pnl: number;
  transaction_costs: number;
  /** Hard stop, or null when the lot carries none. */
  stop_loss_price?: number | null;
  trailing_stop_active?: boolean;
  trailing_stop_price?: number | null;
  highest_price?: number | null;
  lowest_price?: number | null;
  confidence_score?: number;
  exit_price?: number | null;
  exit_timestamp?: string | null;
  /** Why the lot closed; empty while open. */
  exit_reason?: string;
  entry_regime_label?: string | null;
  entry_regime_confidence?: number | null;
  exit_regime_label?: string | null;
  exit_regime_confidence?: number | null;
  /**
   * `traded`: real fill, lifetime P&L. `reconstructed`: basis rebuilt from
   * venue history, still lifetime P&L. `adopted`: booked at the mark —
   * P&L is measured FROM ADOPTION, not lifetime.
   */
  basis_source?: BasisSource;
  adopted_at?: string | null;
  venue_market?: string | null;
  /**
   * The decision that opened the lot. Null for a trailing re-entry or an
   * adopted holding — no decision was made.
   */
  entry_decision_id?: string | null;
  /**
   * The decision whose execution closed the lot. Null for a mechanical close
   * (stop, trail, force-close) — read `exit_reason` instead.
   */
  exit_decision_id?: string | null;
}

/** One fill chained to a lot — the trade that actually moved money. */
export interface OracleFill {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
  pnl: number;
  pnl_pct: number;
  /** Close reason for a SELL; `exchange_history` for ingested rows. */
  reason?: string | null;
  /** `engine` placed the order; `exchange` was read back from the venue. */
  source?: 'engine' | 'exchange';
  settle_currency?: string | null;
  venue_market?: string | null;
  /** The decision this fill executed; null for a mechanical or venue-side fill. */
  decision_id?: string | null;
}

/** The full chain for one lot: the position, its fills, its trace files. */
export interface LotLineage {
  session_id: string;
  mode: string;
  lot: OracleLot;
  fills: OracleFill[];
  /** Entries of {name, size_bytes, modified_at, covers_until}. */
  trace_files?: Record<string, unknown>[];
  lineage_from: string;
  lineage_until: string;
}

export interface OracleLotsResponse {
  session_id: string;
  mode: string;
  total_matching: number;
  limit: number;
  offset: number;
  lots: OracleLot[];
}

export interface TraceFileInfo {
  name: string;
  size_bytes: number;
  modified_at: string;
}

export type OracleTraceRecordType = 'LLM_PROMPT' | 'ALGO_INPUT' | 'DECISION' | 'ERROR';

export interface TraceRecordsResponse {
  session_id: string;
  files_scanned: number;
  records_scanned: number;
  /** Slimmed records: {timestamp, workflow_id, agent_id, type, content, result, metadata}. */
  records: Record<string, unknown>[];
  truncated: boolean;
  keep_prompts: boolean;
}

/** The shared LLM call log — filtered by symbol/agent, never by session. */
export interface LlmCallsResponse {
  entries: Record<string, unknown>[];
  scanned_bytes: number;
}

export interface ContinuityGap {
  from_ts: string;
  until_ts: string;
  minutes: number;
}

export interface ContinuityReport {
  session_id: string;
  mode: string;
  snapshot_count: number;
  first_snapshot?: string | null;
  last_snapshot_ts?: string | null;
  max_gap_minutes?: number;
  /**
   * Snapshots whose total_value excluded unpriceable holdings — a drawdown
   * read across them measures a ticker outage, not the book.
   */
  unpriced_rows?: number;
  gaps: ContinuityGap[];
}

export interface LogTailResponse {
  session_id: string;
  file: string;
  size_bytes: number;
  bytes_read: number;
  truncated: boolean;
  lines: string[];
}

// --- Decision explorer + curve overlays (§H) ---

/** A page of a session's fill history, newest first (GET /api/engine/{id}/fills). */
export interface PaginatedLiveFills {
  session_id: string;
  mode: string;
  total_matching: number;
  limit: number;
  offset: number;
  fills: LiveFill[];
}

/** One sample of a curve. `value` is the accounting-currency level; `index` is 100 at the anchor for return context. */
export interface CurvePoint {
  timestamp: string;
  index: number;
  value: number;
}

/** One engine fill placed on the curve and linked to its decision. */
export interface FillMarker {
  order_id?: string | null;
  fill_id?: number | null;
  timestamp: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  pnl?: number | null;
  pnl_pct?: number | null;
  reason?: string | null;
  position_id?: number | null;
  /** Null for a mechanical exit (stop, trail) — there is no decision card to open. */
  decision_id?: string | null;
  /** The book's index at that hour — where to draw the marker. */
  book_index?: number | null;
}

/**
 * The book's equity beside the market on one hourly grid, every series indexed
 * to 100 at `anchor` (the start of the latest stretch with no book rebuild in
 * it — a comparison drawn across a rebuild is meaningless). Empty series with a
 * `notes` entry mean "could not measure", never flat.
 */
export interface EvaluationCurves extends DataFreshness {
  return_method?: string | null;
  net_of_fees?: boolean | null;
  cash_flow_adjusted?: boolean | null;
  session_id: string;
  mode: string;
  window_start: string;
  window_end: string;
  anchor?: string | null;
  end?: string | null;
  anchored_on_rebuild?: boolean;
  /** Symbols traded in the stretch, equal-weighted from the anchor. */
  basket?: string[];
  /** Traded symbols the venue could not price at the anchor — not in the basket. */
  unavailable?: string[];
  equity?: CurvePoint[];
  equal_weight?: CurvePoint[];
  btc?: CurvePoint[];
  exposure_matched?: CurvePoint[];
  markers?: FillMarker[];
  discontinuities?: Record<string, unknown>[];
  notes?: string[];
}

export type DecisionOutcome =
  | 'filled'
  | 'closed_lots'
  | 'hold'
  | 'no_price'
  | 'skipped_cycle_cap'
  | 'gate_entry'
  | 'gate_dual_portfolio'
  | 'sized_to_zero'
  | 'refused_before_rotation'
  | 'gate_extension'
  | 'gate_governor'
  | 'no_order'
  | 'guard_blocked'
  | 'not_filled'
  | 'no_lots_to_close'
  | 'sell_bypassed_trend_up'
  | 'sell_suppressed_protected'
  | 'sell_not_filled';

/**
 * One orchestrator decision and what the engine did with it — the card.
 * `executed` is true only for a filled buy or a sell that closed lots;
 * `outcome` names the path either way, so a declined buy says which gate
 * declined it.
 */
export interface DecisionSummary {
  /** The orchestrator's workflow id; what lots and fills point at. */
  decision_id: string;
  /** The engine's clock when it decided — bar time in a backtest, wall clock live. */
  decided_at: string;
  symbol: string;
  /** buy, sell or hold (as the orchestrator emitted it). */
  action: string;
  confidence: number;
  /** Dollar size after the orchestrator's adjustments (critic, floor, scaler). */
  position_size: number;
  /** The engine's price for the symbol at decision time; null when it had none. */
  price?: number | null;
  executed: boolean;
  outcome: DecisionOutcome | string;
  outcome_detail?: string | null;
  /** Dollar size after the engine's own sizing sequence, when it ran. */
  resolved_size?: number | null;
  /** The lot this decision opened, when it did. */
  position_id?: number | null;
  reasoning?: string;
  stop_loss?: number | null;
  take_profit?: number | null;
  trail_stop_pct?: number | null;
  pattern_confidence?: number;
  agent_consensus?: number;
  risk_score?: number;
  ml_p_profit?: number | null;
  regime_label?: string | null;
  regime_confidence?: number | null;
  /** Continuous regime weight in [0, 1]; null means the legacy hard gate was in force. */
  regime_weight?: number | null;
  critic_agree?: boolean | null;
  critic_reason_code?: string | null;
  critic_parse_failed?: boolean | null;
  pm_signal?: string | null;
  mtf_is_choppy?: boolean | null;
  mtf_trend_score?: number | null;
}

/**
 * The typed decision context the orchestrator attached — free-form beyond the
 * known members. Null for decisions recorded before the context existed.
 */
export interface DecisionContext {
  regime?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  mtf?: Record<string, unknown> | null;
  critic?: Record<string, unknown> | null;
  position_manager?: Record<string, unknown> | null;
  /** Steps (sell_critic, critic_modulate, confidence_floor, size_scale) with fired and size/confidence before/after. */
  adjustments?: Record<string, unknown>[] | null;
  [key: string]: unknown;
}

/**
 * The full decision path for one decision. `mode` is "paper", "real" or
 * "backtest"; on a run `trace_files` is empty.
 */
export interface DecisionDetail {
  session_id: string;
  mode: string;
  decision: DecisionSummary;
  context?: DecisionContext | null;
  /** ML-1 setup features at decision time. */
  features?: Record<string, number> | null;
  opened_lots?: OracleLot[];
  closed_lots?: OracleLot[];
  fills?: OracleFill[];
  /** Decision-trace files being written at the time; empty for a backtest. */
  trace_files?: Record<string, unknown>[];
}

/** A bounded page of decision records, newest first. */
export interface DecisionsResponse {
  session_id: string;
  mode: string;
  total_matching: number;
  limit: number;
  offset: number;
  decisions: DecisionSummary[];
}

/**
 * Frontend view-model: where a decision lives — a live engine session (oracle
 * routes) or a backtest run (backtest routes). One component serves both.
 */
export type DecisionSource =
  | { kind: 'session'; sessionId: string }
  | { kind: 'run'; runId: string };

/**
 * What a card or marker points at: a decision, or a mechanical exit with no
 * decision behind it (stop / trail / force-close — open the lot's lineage
 * instead, headed by `exit_reason`).
 */
export type DecisionSelection =
  | { kind: 'decision'; decisionId: string; summary?: DecisionSummary }
  | { kind: 'mechanical'; positionId?: number | null; reason?: string | null; symbol?: string }
  | { kind: 'fill'; fill: LiveFill; currency: string }
  | { kind: 'position'; position: OpenPosition }
  | { kind: 'event'; event: AuditEvent }
  | { kind: 'order'; orderId: string };

// Live monitor v2 — additive contract requested in front/BACKEND_UI_HANDOFF.md.
// Missing/null is unknown, including when an older server has no endpoint yet.
export interface DataFreshness {
  as_of?: string | null;
  generated_at?: string | null;
  snapshot_id?: string | null;
  stale_after_seconds?: number | null;
}

export interface ComponentHealth extends DataFreshness {
  state?: 'healthy' | 'degraded' | 'offline' | 'unknown' | null;
  label?: string | null;
  reason?: string | null;
}

export interface EngineTelemetry extends DataFreshness {
  session_id?: string | null;
  mode?: EngineMode | null;
  components?: {
    engine?: ComponentHealth | null;
    market_data?: ComponentHealth | null;
    exchange?: ComponentHealth | null;
    critic?: ComponentHealth | null;
  } | null;
  last_cycle_at?: string | null;
  cycle_duration_ms?: number | null;
  active_event_count?: number | null;
  incidents?: AuditEvent[] | null;
  arming?: {
    live_mode?: string | null;
    armed?: boolean | null;
    validate_only?: boolean | null;
    max_order_usd?: number | null;
  } | null;
  reconciliation?: {
    as_of?: string | null;
    state?: string | null;
    matched?: number | null;
    adopted?: number | null;
    unpriceable?: number | null;
    missing_on_exchange?: number | null;
    reason?: string | null;
  } | null;
}

export interface AuditEvent {
  id: string;
  occurred_at?: string | null;
  severity?: 'info' | 'warning' | 'critical' | null;
  category?: string | null;
  title?: string | null;
  detail?: string | null;
  resolved_at?: string | null;
  actor?: string | null;
  decision_id?: string | null;
  order_id?: string | null;
  position_id?: number | null;
  symbol?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  command_state?: string | null;
}

export interface AuditEventsResponse extends DataFreshness {
  events?: AuditEvent[] | null;
  next_cursor?: string | null;
  active_count?: number | null;
}

export interface ExecutionQuality {
  slippage_bps?: number | null;
  reference?: string | null;
  reference_price?: number | null;
  reference_at?: string | null;
  fees?: number | null;
  fee_currency?: string | null;
  fill_time_ms?: number | null;
  unavailable_reason?: string | null;
}

export interface OrderExecution {
  order_id: string;
  decision_id?: string | null;
  symbol?: string | null;
  side?: string | null;
  status?: string | null;
  trigger_type?: string | null;
  requested_quantity?: number | null;
  filled_quantity?: number | null;
  average_fill_price?: number | null;
  currency?: string | null;
  quality?: ExecutionQuality | null;
  events?: {
    id: string;
    stage?: string | null;
    occurred_at?: string | null;
    detail?: string | null;
  }[] | null;
}

export interface PositionProtection {
  allocation_pct?: number | null;
  effective_stop_price?: number | null;
  stop_distance_pct?: number | null;
  free_quantity?: number | null;
  bonded_quantity?: number | null;
  mechanism?: string | null;
  executable?: boolean | null;
  reason?: string | null;
}
