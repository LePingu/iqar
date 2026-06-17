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

export interface BacktestJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  run_id?: string | null;
  progress_pct?: number | null;
  error?: string | null;
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

export interface OpenPosition {
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
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  timestamp: string;
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
