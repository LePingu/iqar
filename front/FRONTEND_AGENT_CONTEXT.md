# Trader-Strat Frontend: Agent Context & Guidelines

## 1. System Overview (The Backend Context)
You are an AI agent tasked with building the "Control Tower" frontend for **Trader-Strat**, an advanced cryptocurrency backtesting and live-trading research system. 

The backend system you are interfacing with is highly robust and performant, consisting of two main layers:
1. **High-Performance Rust Core**: Handles sub-millisecond calculation of 25+ technical indicators (via SIMD) and parallel asset scanning across 300+ crypto pairs.
2. **Python AI Orchestrator**: A LangGraph-based multi-agent system. For every trading decision, a graph of specialized agents (Pattern Detector, Sentiment Analyzer, Cross-Asset Correlation, Risk Assessor, Position Manager) evaluate the market context and emit structured execution decisions (Buy/Sell/Hold, Confidence, Size, SL/TP) enhanced by an LLM ensemble.

**Your Goal**: Build a frontend that matches the robustness and sophistication of this backend. The user is abandoning legacy Streamlit/TUI interfaces because they are too fragile. You must build a highly maintainable, premium, data-heavy dashboard.

---

## 2. Tech Stack & Architectural Rules
The user has mandated the following stack for the decoupled frontend project:

- **Build Tool**: Vite
- **Framework**: React
- **Language**: TypeScript (Strict mode mandatory)
- **Routing**: `@tanstack/react-router` (Type-safe routing)
- **State/Data Fetching**: `@tanstack/react-query` (For REST calls and WebSocket synchronization)

### Critical Frontend Guidelines
1. **No Magic Frameworks**: Avoid meta-frameworks like Next.js unless strictly necessary. Keep it as a clean Vite SPA.
2. **Robust Data Handling**: You will be dealing with massive datasets (e.g., backtest results with thousands of trades). You MUST use robust headless libraries like `@tanstack/react-table` for data grids to ensure virtualization and zero lag.
3. **Advanced Charting**: You will need to render complex financial charts. Plan to use **TradingView Lightweight Charts** for rendering candlestick data, trade entry/exit markers, and indicator lines.
4. **API Integration**: Assume a Backend-for-Frontend (BFF) REST API and WebSocket connection provided by the Python backend. Use TanStack Query to manage all async state.

---

## 3. Design Aesthetics & Theming
The user has explicitly requested a **Golden and Dark Theme** with a "wow" factor. 

### Styling Rules
- **Vanilla CSS**: Use Vanilla CSS (with CSS variables/tokens) for maximum control. **DO NOT use TailwindCSS** unless the user explicitly requests it later.
- **Color Palette**:
  - Backgrounds: Deep, rich darks (e.g., `#0A0A0A`, `#141414`, `#1A1A1A`).
  - Accents: Vibrant gold (e.g., `#FFD700`, `#D4AF37`, `#F9A826`).
  - Typography: Crisp white/off-white for high contrast.
- **Premium Feel**:
  - Implement **glassmorphism** (semi-transparent backgrounds with `backdrop-filter: blur()`) for panels and cards.
  - Use subtle, smooth micro-animations on hover states and route transitions.
  - Use modern typography (e.g., Google Fonts: `Inter`, `Outfit`, or `Roboto Mono` for numbers).

---

## 4. Core Views to Implement

Set up the TanStack Router with these five routes. They map directly to the endpoints in `openapi.yaml`.

---

### A. Control Tower / Launch (`/`)

**Purpose**: Launch new backtests and inspect system health.

**Data sources**:
- `GET /api/system/status` — Rust version, LLM latency, DB size (poll every 30 s)
- `POST /api/backtests` — submit a new run; on 202 redirect to `/backtests/jobs/:jobId`

**Components**:
- `SystemStatusBar` — top-of-page strip showing Rust core ✅, LLM latency, DB size
- `LaunchForm` — controlled form mapping 1-to-1 to `BacktestConfig` schema; boolean flags render as toggle chips, not raw checkboxes; defaults match the validated P1 stack (`fixed_universe`, `dual_portfolio`, `regime_continuous`, `position_rotation`, `disable_ai_exits` all on; `mock_critic` off)
- Preset selector: **Bull / Bear / Sideways** — clicking one sets `start_date`/`end_date` and any preset-specific flag overrides
- Submit fires `POST /api/backtests`, then routes to the live monitor for the returned `job_id`

---

### B. Runs Browser (`/backtests`)

**Purpose**: Browse and compare all completed backtest runs. This is the primary read-only view and the first view to build.

**Data sources**:
- `GET /api/backtests?limit=20&offset=N` — paginated list of `BacktestSummary` objects; each row already contains `metrics` AND `config`, so the flag column renders without a second request

**Components**:
- `RunsTable` (TanStack Table with virtualised rows) — columns: timestamp, ROI, capture ratio, Sharpe, WR, DD, trades, and a **flag chip row** showing which of the 6 key booleans were on for that run (`fixed_universe`, `dual_portfolio`, `regime_continuous`, `position_rotation`, `disable_ai_exits`, `mock_critic`)
- `MetricSummaryCard` — hover-expanded card per row showing the full metrics breakdown
- Clicking a row navigates to `/backtests/:runId`

**Notes**:
- The flag chip column is the key differentiator vs. a plain log list — users can immediately see which stack produced which result
- Sort by `capture_ratio` descending by default; allow column sorting

---

### C. Run Detail + Chart Explorer (`/backtests/:runId`)

**Purpose**: Deep-dive into a single completed run — equity curve, per-asset chart with overlaid trades and regime bands.

**Data sources**:
- `GET /api/backtests/:runId` → `BacktestResult` — full metrics, per-asset results, equity curve (`portfolio_history` array of `EquityPoint`)
- `GET /api/backtests/:runId/assets` → `AssetSummary[]` — lightweight sidebar list (no OHLCV)
- `GET /api/backtests/:runId/charts/:symbol` → `ChartData` — **fire only on user selection**, never prefetch all assets

**Components**:
- `EquityCurveChart` — TradingView area chart of `EquityPoint.capital` over time; secondary line for equal-weight buy-and-hold (derived from `metrics.buy_and_hold_roi`)
- `KPIStrip` — glassmorphic row of cards: ROI · capture ratio · Sharpe · max DD · WR · trades
- `AssetSidebar` — scrollable list of `AssetSummary` chips ordered by P&L; clicking one fires the lazy chart load
- `CandlestickExplorer` — mounts only after an asset is selected; renders `ChartData.candles` as a candlestick series; overlays `TradeMarker` entries (green flag for buys, red for sells + P&L annotation); draws `RegimeBand` as coloured background bands (`trend_up` = muted gold, `sideways` = muted grey, `trend_down` = muted red)
- `TradesGrid` (TanStack Table, virtualised) — paginated via `GET /api/backtests/:runId/trades`; filterable by symbol

**Performance constraint**: the raw 5-min CSV for one asset can be 870 k+ rows. The backend slices to the backtest window. The frontend must NOT request chart data for all assets at init — only for the selected one.

---

### D. Live Run Monitor (`/backtests/live` → `/backtests/live/:runId`)

**Purpose**: Watch a backtest unfold in real time — open positions, rolling equity curve, recent fills.

**Routing**: navigate to `/backtests/live` when a run is launched; the page auto-resolves the
`run_id` via the first poll and then redirects to `/backtests/live/:runId` to make the URL bookmarkable.

**Data sources** (all implemented and tested):
- `GET /api/backtests/live` — auto-detects the active run; returns `LiveBacktestDetail`; 404 when nothing is running. Poll this on page mount to get the `run_id`, then switch to the next endpoint.
- `GET /api/backtests/live/:runId` — poll every 2–3 s; returns `LiveBacktestDetail` with open positions, last 20 fills, full equity curve from SQLite, and `is_active` flag.
- `GET /api/backtests/jobs/:runId` — lightweight progress endpoint (`progress_pct` 0–100, `status` running/completed); use as a thin status badge without fetching the full detail payload.

**When to stop polling**: `LiveBacktestDetail.is_active === false` AND `portfolio_metrics !== null` → run is done. Auto-navigate to `/backtests/:runId` for the completed-run view.

> **SSE stream** (`GET /api/backtests/jobs/:jobId/stream`) is **not yet implemented** on the backend.
> Do not wire `EventSource` yet — use the polling endpoints above. The SSE endpoint is documented in
> `openapi.yaml` for future reference; its events (`decision`, `metrics`, `done`, `error`) are unchanged.

**Components**:
- `JobStatusBadge` — running (pulse gold) / completed (green check); derives status from `is_active` + `portfolio_metrics != null`
- `LiveProgressBar` — `decisions_done / decisions_target` from `LiveSnapshot`; shown as a progress strip under the header
- `LiveKPIStrip` — portfolio value · P&L% · max drawdown · open positions; refreshes on every poll from `LiveSnapshot`
- `OpenPositionsTable` — live table from `LiveBacktestDetail.open_positions`; columns: symbol · side · qty · entry $ · current $ · unrealised P&L% · trailing stop indicator (✓/·)
- `LiveEquityCurve` — TradingView area chart fed by `equity_curve`; append new points on each poll without re-rendering from scratch (use `chart.update()` not `chart.setData()` after the first render)
- `RecentFillsFeed` — scrolling list of `recent_fills` (last 20, newest first); symbol · side · price · timestamp
- On `is_active === false`: freeze the feed, show "Run complete" banner, auto-redirect after 3 s

---

### E. Live Trading Dashboard (`/live`)

**Purpose**: Monitor and control the live trading engine. This is the operator console — it surfaces the engine kill-switch, risk limits, live positions, equity curve, and the fills feed, all in one view.

**Architecture note**: The live engine writes to the same `portfolio_snapshots`, `positions`, and `trades` tables that the backtest monitor (Route D) already reads. Route E reuses those monitoring components but adds the engine-control panel on top.

**Data sources**:
- `GET /api/engine/{session_id}/status` — kill-switch state, risk limits, alive ping. Poll every 15 s.
- `POST /api/engine/{session_id}/halt` — disable trading (queued to engine)
- `POST /api/engine/{session_id}/resume` — re-enable trading (queued to engine)
- `PUT /api/engine/{session_id}/controls` — update risk limits without restart
- `GET /api/backtests/live/{session_id}` — positions, fills, equity curve. Reuse from Route D. Poll every 5 s while alive.

**Default session_id**: `live-paper` (matches `LIVE_SESSION_ID` env var). Hard-code for now; add a session picker later when multiple sessions exist.

**Components**:

- `EngineControlPanel` — top-of-page glassmorphic card:
  - Status badge: `trading_enabled` → gold pulse "TRADING" / grey "HALTED" / red "ENGINE DOWN" (when `engine_alive=false`)
  - Last heartbeat: `last_snapshot_ts` formatted as relative time ("2 min ago")
  - `HaltButton` / `ResumeButton` — POST halt or resume; optimistically flip the badge, then confirm on next status poll
  - `RiskLimitsForm` — three inline editable fields (max position size %, daily loss %, max positions); PUT on submit

- `LiveKPIStrip` — reuse from Route D: portfolio value · P&L% · drawdown · open positions count

- `LiveEquityCurve` — reuse from Route D: TradingView area chart; append points on each poll

- `OpenPositionsTable` — reuse from Route D: symbol · side · qty · entry $ · current $ · unrealised P&L%

- `RecentFillsFeed` — reuse from Route D: last 20 fills, newest first

**When engine_alive=false**: show the control panel in a degraded state (grey badge, disabled Halt/Resume, stale KPIs greyed out). Do NOT redirect — the user needs to stay on this page to see the engine is down and to send a command when it comes back.

**When the engine has never started** (no session row): show a single `EngineNotStarted` banner with the launch command:
```
./scripts/launch-engine.sh --session=live-paper --capital=10000
```

---

## 5. First Steps for the Agent

Build in this order — later views depend on components from earlier ones:

1. **Project scaffold**: Vite + React-TS, TanStack Router, TanStack Query, CSS variables for the golden/dark theme.
2. **Core reusables**: `GlassCard`, `KPICard`, `FlagChip`, `StatusBadge` — these are used across all views.
3. **Runs Browser (`/backtests`)** — first because it is pure read-only (one `GET`), validates the API contract, and gives the user something useful immediately.
4. **Run Detail + Chart Explorer (`/backtests/:runId`)** — equity curve first (no lazy chart needed), then asset sidebar + candlestick explorer.
5. **Launch + Live Monitor (`/` and `/backtests/live`)** — introduce the POST flow and the polling live-monitor after the read-only views are solid. SSE is deferred; use `GET /api/backtests/live/:runId` polling for now.
6. **Live placeholder (`/live`)** — last; one banner component, no logic.

Present the layout and routing skeleton to the user before building charting integrations.
