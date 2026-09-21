# Trader-Strat Frontend: Agent Context & Guidelines

> **Returning agent?** §7 (hand-off log) lists what changed in the backend contract since
> the last hand-off, newest first, with the section each change lives in. Read it before
> anything else; `openapi.yaml` beside this file is the schema. Elements marked
> `x-implementation-status: requested` are frontend requests, not deployed capabilities.

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

**Purpose**: Approve one named F2 condition and launch it through Tower's durable queue.

**Data sources**:
- `GET /api/system/status` — system health.
- `GET /api/backtests/presets` — reviewed conditions, resolved `parameters`, descriptions, historical baseline, runtime estimate, and host concurrency limit.
- `POST /api/backtests` — submit only `{preset, variant}` after explicit confirmation. Requires a control operator and returns 202 with `job_id`.

**Components**:
- `SystemStatusBar` — system health.
- `LaunchForm` — select a server-provided F2 condition, show its resolved parameters and time estimate, then ask for approval of exactly one test. The confirmation button submits the request. Raw config fields, CLI arguments, filesystem paths, images and provider settings are not accepted by this endpoint.
- On 202 navigate to `/backtests/jobs/:jobId`. Poll `GET /api/backtests/jobs/:jobId`; do not use job ID as run ID and do not auto-detect another active run for a queued request.
- Show backend error details, including a 409 if the uploaded dataset is not mounted or registered. Do not silently fall back to a local run.

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

**Routing**: a launch navigates to `/backtests/jobs/:jobId`. Queue status supplies
`run_id` before execution; use that ID for `/backtests/live/:runId`. The standalone
`/backtests/live` page remains an auto-detect view for existing runs.

**Data sources** (all implemented and tested):
- `GET /api/backtests/live` — auto-detects the active run; returns `LiveBacktestDetail`; 404 when nothing is running. Poll this on page mount to get the `run_id`, then switch to the next endpoint.
- `GET /api/backtests/live/:runId` — poll every 2–3 s; returns `LiveBacktestDetail` with open positions, last 20 fills, full equity curve from SQLite, and `is_active` flag.
- `GET /api/backtests/jobs/:jobId` — durable state (`queued`, `running`, `completed`, `failed`, `interrupted`), progress and `run_id`. Stop polling on a terminal state; an interrupted job never auto-retries. Legacy run IDs remain readable.
- `GET /api/backtests/jobs/:jobId/comparison` — worker-recorded baseline/current evidence on terminal results. Show net equity return, costs, drawdown and validity. Display missing baseline artifacts explicitly.

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

**Architecture note**: A **paper** engine writes to the same `portfolio_snapshots`, `positions`, and `trades` tables that the backtest monitor (Route D) already reads, so Route E reuses those monitoring components and adds the engine-control panel on top.

> **A real engine does not.** It writes `real_positions`, `real_trades` and
> `real_portfolio_snapshots` — a separate table set, for retention and blast
> radius (financial records must not live in the tables that disposable backtest
> runs churn). **The frontend does not need to care**: `GET /api/engine/{id}/detail`
> and `/status` pick the table set from `engine_controls.mode` and serve the same
> shapes either way. The payload tells you which it served via `mode`. What the
> frontend *does* need to care about is the extra fields that only appear on a
> real session — `basis_source`, `source`, `settle_currency`, `currency`,
> `observed_from` — each described below.

**Data sources** (all under the `/api/engine/*` namespace — paper/real trading is a
**separate route family** from `/api/backtests/*`; do NOT use the backtest live
endpoints for the engine):
- `GET /api/engine/{session_id}/status` — kill-switch state, risk limits, alive ping. Poll every 15 s.
- `GET /api/engine/{session_id}/detail` — positions, fills, equity curve, P&L. Poll every 5 s while active. (Open to any Access user — viewers can watch.)
- `GET /api/engine/{session_id}/fills?limit=50&offset=N` — fill **history**, newest first,
  filters `symbol|side|source|since|until`. `recent_fills` in `/detail` is the live feed
  (last 20); this is how the `RecentFillsFeed` gets a "load older" / date-range control.
  Page with `before_id=<smallest id on your page>` while the feed is live (offsets drift).
  Rows carry `id`, `position_id`, `decision_id` (→ §H card), `reason`, `commission`.
- `POST /api/engine/{session_id}/halt` — disable trading (operator-only; 403 for viewers)
- `POST /api/engine/{session_id}/resume` — re-enable trading (operator-only)
- `PUT /api/engine/{session_id}/controls` — update risk limits without restart (operator-only)

> **View vs control — how to gate the UI.** Do **NOT** keep an email list in the
> frontend. Call `GET /api/auth/me` on load; it returns `{ email, can_control }`
> where `can_control` is derived server-side from `ENGINE_CONTROL_EMAILS`. Show the
> control panel (halt/resume/limits) only when `can_control` is true; render
> read-only for everyone else. This is cosmetic — the backend independently 403s
> non-operators on the control endpoints regardless of what the UI shows. To add a
> **reader**, add their email to the **Cloudflare Access policy** (dashboard) and do
> NOT add them to `ENGINE_CONTROL_EMAILS`; no code or config change ships to git.

> **Route separation:** `/api/backtests/live*` monitors **backtests**; `/api/engine/*`
> monitors the **live trading engine**. They read the same DB tables but are distinct
> routes, and the backtest auto-detect (`GET /api/backtests/live`) deliberately
> **excludes** engine sessions — so a backtest and the paper engine can run at the
> same time without the backtest monitor latching onto the engine.

**Default session_id**: `live-paper` (matches `LIVE_SESSION_ID` env var). Hard-code for now; add a session picker later when multiple sessions exist.

**Components**:

- `EngineControlPanel` — top-of-page glassmorphic card:
  - Status badge: `trading_enabled` → gold pulse "TRADING" / grey "HALTED" / red "ENGINE DOWN" (when `engine_alive=false`)
  - Last heartbeat: `last_snapshot_ts` formatted as relative time ("2 min ago")
  - `HaltButton` / `ResumeButton` — POST halt or resume; optimistically flip the badge, then confirm on next status poll
  - `RiskLimitsForm` — three inline editable fields (max position size %, daily loss %, max positions); PUT on submit

- `LiveKPIStrip` — reuse from Route D: portfolio value · P&L% · drawdown · open positions count

- `LiveEquityCurve` — reuse from Route D: TradingView area chart; append points on each poll

- `OpenPositionsTable` — reuse from Route D: symbol · side · qty · entry · current · unrealised P&L%.
  **On a real session, check `basis_source` before rendering that percentage.**
  Three values, three different meanings:

  - `traded` — this engine opened the lot. P&L is lifetime.
  - `reconstructed` — the lot predates the engine, but the venue's own trade
    history covered it, so `entry_price` is the **real average cost** and the
    percentage is genuine lifetime P&L. Measured on the live account: 10 of 14
    lots, e.g. ETH −7.9%, HYPE +123.5%, POL −77.4%.
  - `adopted` — the lot predates the engine and history could **not** cover it
    (no fills at all, or fills explaining too little of the balance). `entry_price`
    is the mark at `adopted_at`, so the percentage is **P&L under management**,
    measured from adoption — not lifetime return. **It will read 0.00% at
    adoption and that is correct**, not a loading state.

  Label the last one (a badge, or "since <adopted_at>"): an adopted lot rendered
  as lifetime return is a wrong number, not a missing one. Do **not** label
  `reconstructed` that way — it *is* lifetime.

  > **One symbol can now have SEVERAL rows.** An adopted holding is rebuilt as
  > its individual **FIFO lots**, each keeping the price and date it was actually
  > bought at — measured on the live account, 14 holdings become **26 lots**
  > (ETH 5, SOL 3, XLM 3). That is deliberate: the rest of the strategy is
  > lot-based, so a stop applies per lot rather than to a blend of buys spanning
  > (for PENGU) a 3× price range. **Group by `symbol` in the table** and show the
  > lots underneath, or the list reads as duplicates. A lot flagged `adopted`
  > sitting beside `reconstructed` lots of the same symbol is the quantity no buy
  > explains — a staking accrual or an airdrop — priced at the mark.

  **`venue_market`** is the pair the asset actually traded on — `PENGU/EUR` for a
  position the book calls `PENGUUSD`. Internal symbols are always `<BASE>USD`
  because the analytics stack is USD-denominated and the symbol names a price
  *series*, not a settlement pair. Show it as the reference that ties a position
  back to the exchange statement; the live account's positions were bought on
  `ETH/GBP`, `SOL/GBP`, `PENGU/EUR`, `HYPE/EUR` and the legacy `MATICGBP`.

- `RecentFillsFeed` — last 20 fills, newest first. **Show realized P&L on SELL
  fills**: `realized_pnl` / `realized_pnl_pct` are populated on sells and `null`
  on buys (a buy's stored pnl is only its fee, which would read as though every
  entry had already lost money). Colour the same way `OpenPositionsTable` colours
  unrealised P&L, and render nothing in that column for buys — a closed trade
  should say whether it made money, which the feed previously did not.

  **On a real session the feed also carries fills this engine never placed.**
  `source` is `engine` (this engine submitted the order) or `exchange` (read back
  from Kraken's own trade history — a manual trade in the Kraken app, or anything
  from before the engine existed). **Distinguish them**: attributing a hand trade
  to the strategy misreads the strategy's record. Exchange fills also carry
  `settle_currency` — the account has settled on GBP, EUR and USD pairs — and
  `settle_fx_rate`, the rate used to convert into the book's accounting currency,
  taken from the fill's own date rather than today's. A **null `settle_fx_rate`
  on a non-accounting-currency fill means no rate was available and `price` is
  UNCONVERTED**; flag it rather than showing it beside converted numbers as if
  comparable. Exchange fills carry no realized P&L (`0`): pairing a historical
  sell with the buy that opened it needs a cost basis the account does not have,
  and a computed number there would be fiction beside real ones.

  **Show the native price beside the converted one.** `price` is in the accounting
  currency; `settle_price` is what the venue actually reported, in
  `settle_currency`, on `venue_market`. So a PENGU buy renders as *USD 0.007037
  (EUR 0.006104 on PENGU/EUR @ 1.15293)* — the parenthesised half is the figure an
  operator can check against their Kraken statement, and the only one that will
  match it.

### Live monitor metric preservation

The approved redesign changes layout and chart axes; it does not remove financial
or operational measurements. Recent-fill requirements also apply to the paged
fill-history table, which uses the same row model.

| Metric | Required location in the redesigned UI |
| --- | --- |
| Portfolio value | Portfolio summary, in accounting currency |
| Monetary P&L and ROI % | P&L summary with ROI underneath; display both |
| Maximum drawdown and open-position count | Portfolio summary |
| Fill realized P&L and ROI % | Separate visible values in recent/history rows and selected-fill summary |
| Fill quantity and price | Visible table columns; retain small-price precision |
| Fill commission | Visible column and fill details; do not assume a legacy commission's currency |
| Fill timestamp | Time and date in the table; full timestamp in the inspector |
| Native price, settlement currency, conversion rate and venue pair | Price-cell secondary line and fill details; label unconverted rows |
| Fill side, source and reason | Table and inspector |
| Position quantity, entry/current price, unrealised P&L % and trailing status | Open-positions table |
| FIFO lot count, aggregate quantity, basis and adoption date | Position groups/badges and inspector |
| Trailing-stop price | Position inspector, separate from the effective protection stop |
| Maximum position %, daily loss % and maximum slots | Engine settings; editable for operators and visible to readers |
| Engine heartbeat | Telemetry widget, separately from engine-cycle time |
| Exchange cash, holdings value, total and holdings count | Exchange-account disclosure |
| Ledger total, exchange/ledger difference, managed-position count and account-read time | Exchange-account disclosure; retain stale indication |
| Decision confidence, regime weight, ML probability, critic/MTF values and requested/resolved size | Decision cards and the metrics/signals disclosure, even if context is null |
| Historical equity | The one percentage chart; current monetary balance remains in the summary |

ROI comes from `realized_pnl_pct`; do not calculate it in the browser or confuse
it with portfolio ROI. SELL engine fills display monetary return and ROI
independently. Null is `—`; measured zero remains `+$0.00` / `+0.00%`. BUY rows
do not show an entry fee as realized return, and exchange-history fills never gain
invented strategy P&L. Preserve legacy commission when execution-quality data is
unavailable; fill-level and whole-order fees are distinct. Exchange-versus-ledger
subtraction is an independently sampled comparison, not a reconciliation verdict.

**When engine_alive=false**: show the control panel in a degraded state (grey badge, disabled Halt/Resume, stale KPIs greyed out). Do NOT redirect — the user needs to stay on this page to see the engine is down and to send a command when it comes back.

**When the engine has never started** (no session row): show a single `EngineNotStarted` banner with the launch command:
```
./scripts/run/engine.sh --session=live-paper --capital=10000
```

---

### Number formatting — significant digits, not fixed decimals

Crypto prices span nine orders of magnitude in one table: XBT at ~78,000 and a
meme asset at 0.0000012345. A fixed `toFixed(2)` renders the second as `0.00`,
and even `toFixed(6)` keeps one significant digit out of five.

**The API no longer rounds prices** — the column is `Numeric(20, 8)` and the
backend used to truncate to 6dp, destroying the information before the client
saw it. Formatting is now entirely the client's job, so it has to be done right.

**Rule — for any price or quantity:**

- `|x| >= 1` → 2 decimals (`78645.87`, `4.44`)
- `0 < |x| < 1` → keep **3 significant digits**, i.e. 3 digits after the leading
  zeros, never fewer than 2 decimals

```
0.1698        -> 0.170
0.02571       -> 0.0257
0.0002571     -> 0.000257
0.00001234    -> 0.0000123
0.0000012345  -> 0.00000123
```

One-liner that implements it:

```ts
const fmtPrice = (x: number): string =>
  Math.abs(x) >= 1 ? x.toFixed(2)
  : x === 0        ? "0.00"
  : x.toFixed(Math.max(2, 2 - Math.floor(Math.log10(Math.abs(x)))));
```

Apply it to `price`, `entry_price`, `current_price` and `quantity` everywhere —
fills feed, positions table, tooltips. **Money totals** (portfolio value, P&L in
quote currency) stay at 2 decimals: those are money, not asset prices.

**Do not hardcode `$`.** Every engine payload carries `currency`, and it is not
decoration: the audited real account's own Kraken screen reports GBP while the
book accounts in USD, and the two differ by ~35%. Render the symbol from
`currency` and show it next to every money total. A real balance with no currency
beside it is not a figure anyone should act on.

---

### F. Real-Money Portfolio (`/live/real`)

**Purpose**: a deliberately separate console for real capital. Not a theme
variant of Route E — a different page, because the most dangerous failure mode in
this system is acting on the wrong one.

**Why separate rather than a toggle**: paper and real write to the same tables
under different `session_id`s, so a session picker would put "$10,000 of
pretend money" and "$10,000 of real money" one dropdown apart. They should never
be one misclick apart.

**Data sources**: the same `/api/engine/{session_id}/*` family, with
`session_id=live-real`. No new endpoints are required for the read path — the
endpoints resolve `engine_controls.mode` and serve the real table set, and the
payload confirms it with `mode: "real"`.

**What a real session's payload carries that a paper one does not** (all
described in Route E; repeated here because this is the page that must get them
right):

| field | where | why it changes what you render |
|---|---|---|
| `mode` | detail, status | Confirms you are looking at the real book. Assert it matches the route; if `/live/real` ever receives `mode: "paper"`, that is a **hard error state**, not a fallback — show it, do not render the numbers. |
| `currency` | detail | Denomination of every money figure. Never hardcode `$`. |
| `basis_source` / `adopted_at` | positions | An adopted lot's P&L is measured **from adoption**, not lifetime. A freshly-adopted account is entirely adopted lots. |
| `source` | fills | `exchange` fills were not placed by this engine — manual trades, or history predating it. |
| `settle_currency` / `settle_fx_rate` | fills | The pair actually settled in GBP/EUR/USD; the rate is the fill's own date. Null rate on a non-accounting currency = **unconverted**. |
| `observed_from` | detail | When the **engine started watching** — not when the account started trading. There is no equity curve before it. |

> **`/real/account` `num_holdings` will not equal `/detail` `open_positions_count`,
> and that is correct.** Measured on the live account: **18 holdings, 14
> positions**. Two reasons, both deliberate — (a) balances below the dust floor
> are valued in equity but never become managed lots (3 of them), and (b) a
> staked balance is reported by the exchange under its own ticker (`SOL03.S`
> beside `SOL`) and merged into **one** position, since it is one asset. If the
> UI shows both numbers, explain the gap rather than letting it read as a
> reconciliation failure. `total_value` on both endpoints *does* agree.

**Do not draw the curve back to zero.** `observed_from` is the first snapshot the
engine recorded. An account that has traded for two years will have a curve that
begins the day observation began, and an axis starting at 0 or a line
extrapolated backwards both assert a history the system does not have. Start the
chart at `observed_from` and say so.

**Components** — the four things that would have caught real incidents:

- `ArmingStatePanel` — real money requires **four independent switches**, and the
  operator must never have to infer their state from a log line:
  `LIVE_MODE=real` · `LIVE_KRAKEN_ARMED` · `LIVE_KRAKEN_VALIDATE_ONLY` ·
  `LIVE_KRAKEN_MAX_ORDER_USD`. Render as four explicit badges. **Validate-only is
  the safe state and should read as safe, not as an error** — in that mode orders
  are sent to Kraken for validation and never placed.

- `CashReconciliation` — exchange balance vs ledger balance, side by side, with
  the drift. The engine refuses to start when these disagree beyond $1 or 1%
  (untracked deposits and untracked positions need opposite corrections, so it
  will not guess). Show the last successful reconciliation time.

  > **Cash is the smaller half of this.** The engine also reconciles *positions*
  > against the exchange every cycle, and on a fully-deployed account that is the
  > half that matters: the audited account reconciles cash perfectly at $0.0044
  > vs $0.0044 while holding £1,900 of coins. Position reconciliation adopts
  > holdings the book does not know about, and **reports — never auto-resolves —**
  > a position the book holds that the exchange does not, because that is either
  > an unrecorded manual sale or a failed read and those need opposite fixes.
  > Surface the counts (`matched` / `adopted` / `unpriceable`) rather than a
  > single green tick.

- `StakedHoldingsNote` — a bonded balance **cannot be sold** without unbonding
  first, and the exchange reports it under its own ticker (`SOL03.S` beside
  `SOL`) which the engine merges into one lot. So a position's `quantity` is the
  economic size, and part of it may be untradeable: on the audited account 1.148
  of 3.658 SOL is bonded and **all** 112.9 XTZ is. The engine sizes exits to the
  free amount and refuses outright when a lot is fully bonded. If the UI shows a
  stop or trail on such a lot, say that it cannot execute — otherwise the screen
  promises protection the account cannot deliver.

- `RunHealthBadge` — `run_health.degraded` plus its reasons. A degraded run is one
  whose critic or ML-1 was not functioning; its numbers are not a measurement.

- `HaltButton` — the highest-value control in the system. Halt must be reachable
  in one click and visually dominant; resume should be deliberately less prominent.

**Visual treatment**: unmistakably distinct from `/live`. Different accent colour,
a persistent "REAL MONEY" marker in the header, and the session id always visible.

**Until real trading is armed** this route will show an engine that authenticates
and reads balances but refuses every order. That is the intended first
deployment, not an error state — render it as healthy-but-idle. In that state the
page is a **portfolio and audit view**: adopted positions, the exchange's own fill
history, the equity curve from the moment observation began. All of it is real;
none of it was placed by the strategy yet.

> **`ArmingStatePanel` data source (since 2026-09-21):**
> `GET /api/engine/{session_id}/telemetry` → `arming.{live_mode, armed,
> validate_only, max_order_usd}`, published by the engine from its broker's
> effective switches. Null (or a 404 from an older Tower) is *unknown*: render
> "arming state unavailable", never "unarmed" — claiming that for a possibly-armed
> engine is the more dangerous of the two errors.

---

### G. Daily Evaluation (`/live/evaluation`)

Answers one question — *is this book beating an equal-weight hold of what it
trades?* — and hands the operator a file they can paste elsewhere. The tower
computes it nightly; this view shows the latest and lets you force a fresh one.

**Endpoints**: `POST /api/evaluation/{session_id}/run` ·
`GET /api/evaluation/{session_id}/latest` · `GET .../history` ·
`GET /api/evaluation/reports/{id}/download`

**The button.** One primary action, *Run evaluation now*. Three things matter:

1. **It is slow on purpose** — it walks hourly exchange bars for every symbol the
   session traded, so budget 20–60s. Use a determinate pending state with the
   elapsed time, not a spinner that looks hung. Disable the button while in
   flight; do not let a second click queue a second run.
2. **It is a control action**, same bar as halting the engine. Hide it (don't
   just disable it) when `GET /api/auth/me` returns `can_control: false` — a
   read-only viewer still sees the latest report, just not the button.
3. **`200` does not mean success.** If the exchange was unreachable the report is
   still stored and still returns `200`, with `error` set and `capture_ratio:
   null`. Render the error; never fall back to `0`.

**Reading the result.** Lead with `capture_ratio` — system return ÷ equal-weight
hold of the symbols actually traded. Above 1.0 is positive alpha; 0.50 is the
project's bull gate. Beside it, `return_pct` and `benchmark_pct` so the ratio is
legible rather than magic.

> **Null is not zero, anywhere in this payload.** `return_pct`,
> `benchmark_pct` and `capture_ratio` are all nullable, and a null means *we could
> not measure*, not *it was flat*. Render an em-dash and the reason. This is the
> single most important rule on this screen: the analysis it replaces went wrong
> twice by treating an unmeasured window as a measured zero.

Also surface, because each is a finding rather than a statistic:

- **`checks_failed`** — a count of failing invariants. Non-zero is a badge, not a
  footnote; the per-check detail is in `payload.checks` as `{name, passed,
  detail}`. These catch things like the position cap being breached or
  `realized_pnl` never being written.
- **`payload.discontinuities`** — book rebuilds inside the window (cash moved
  with no fill behind it). When present, say plainly that measurement starts
  *after* the last one, because a return read across a rebuild is meaningless.
- **`payload.exposure_ceiling_pct`** — max slots × typical lot, as a share of the
  book. Below ~100% the engine physically cannot deploy its cash; worth a warning
  chip when it is low.
- **`payload.exit_paths`** and **`payload.symbols`** — small tables, render as-is.

**The digest.** `digest` is markdown sized to paste into a chat message. Give it
both affordances: a copy-to-clipboard button, and a download link pointing
straight at `/api/evaluation/reports/{id}/download` (it already sets
`Content-Disposition` with a sensible filename — do not fetch and re-wrap it).

**History.** `GET .../history` returns summaries only — no digest, no payload —
so it is cheap to chart. A sparkline of `capture_ratio` over time is the point of
storing them: one reading is a number, a month of them is a trend.

**Empty state.** `GET .../latest` returns `404` when nothing has been run yet.
Prompt the operator to run one. Do not render zeros.

### H. Decision explorer + curve overlays (`/live`, `/live/real`, `/backtests/:runId`)

**Purpose**: every buy and sell card explains itself, and the equity curve shows the market
beside the book. Two questions, one navigation: *why did this trade happen?* (card → hover →
click) and *is the book ahead of just holding?* (overlays on the curve).

**Data sources** (all read-only; auth = any Access user)

- `GET /api/evaluation/{session_id}/curves?window_days=30` → `EvaluationCurves`. Poll every
  60 s. Series `equity`, `equal_weight`, `btc`, `exposure_matched`, each a list of
  `{timestamp, index, value}` on one hourly grid, **indexed to 100 at `anchor`**. `markers[]`
  are the engine's fills with `decision_id` and `book_index` (where on the book's curve to
  draw them). `502` = benchmark venue unreachable (render the reason, never a flat line);
  `404` = unknown session; `422` = `since` not before `until`.
- `GET /api/oracle/{session_id}/decisions` (live sessions) and
  `GET /api/backtests/{run_id}/decisions` (runs) → `DecisionsResponse`, newest first,
  paged (`limit` ≤ 500). Filters: `symbol`, `action` (buy|sell|hold), `executed`
  (true|false), `outcome`, `since`, `until`. **Every decision the orchestrator produced is a
  row, executed or not** — `executed=false` is the book of what was declined.
- `GET …/decisions/{decision_id}` → `DecisionDetail`: the summary, the typed `context`
  (the full path), `features`, and the `opened_lots` / `closed_lots` / `fills` that point back
  at this decision. On a run, `mode` is `"backtest"` and `trace_files` is empty.
- Lots and fills now carry the link: `OracleLot.entry_decision_id` / `exit_decision_id`,
  `OracleFill.decision_id` (all nullable — see *Semantics*).

**Components**

- `LiveEquityCurve` gains **overlays**: `equal_weight` (muted gold), `btc` (muted grey),
  `exposure_matched` (dashed gold). Each toggleable in the legend. The legend states the
  anchor date and, when `anchored_on_rebuild` is true, "since last rebuild" — the series
  deliberately start at the last deploy/recovery that reset the book, because a comparison
  drawn across one is meaningless. Draw `markers` at `(timestamp, book_index)`: ▲ buy, ▼ sell.
  Empty series come with a `notes` entry saying why (no priced snapshot, venue coverage,
  stretch shorter than an hour) — render the note, never a flat line or a zero.
- `DecisionCard` replaces the bare fill row in `RecentFillsFeed` and the trade rows in
  `TradesGrid`: symbol · side · price · confidence · an **outcome chip**. **Hover** opens a
  compact popover from `DecisionSummary`: regime label + weight, critic verdict +
  `critic_reason_code`, `ml_p_profit`, `pm_signal`, MTF choppy, `position_size` vs
  `resolved_size`. Hovering a card highlights its marker on the curve and vice-versa
  (shared `decision_id`).
- `DecisionPathDrawer` opens on **click** and renders `DecisionDetail.context` as a vertical
  timeline in this order: `regime` → `signals` (pattern / sentiment / correlation / risk,
  consensus, weights) → `mtf` → `critic` (verdict, reason, `clamped`) →
  `position_manager` (raw size, `kelly_info`) → `adjustments[]` as a step list
  (`sell_critic`, `critic_modulate`, `confidence_floor`, `size_scale`; show `fired`, and
  size/confidence before → after) → the engine's `outcome` + `outcome_detail` → the linked
  lots and fills. Marker with `decision_id: null` = a mechanical exit (stop / trail /
  force-close): open the lot's lineage instead, headed by `exit_reason`.
- `DeclinedBook` tab on the live dashboard: `executed=false`, grouped by `outcome` — what the
  engine did not buy, and which gate said no. This is half of what entry skill means.

**Semantics — read before rendering**

- `outcome` values: `filled`, `closed_lots` (the two with `executed: true`), `hold`,
  `no_price`, `skipped_cycle_cap`, `gate_entry`, `gate_dual_portfolio`, `sized_to_zero`,
  `refused_before_rotation`, `gate_extension`, `gate_governor`, `no_order`, `guard_blocked`,
  `not_filled`, `no_lots_to_close`, `sell_bypassed_trend_up`, `sell_suppressed_protected`,
  `sell_not_filled`. Chip colour by family: executed / declined-by-gate / hold / not-filled.
- `context: null` means the decision was recorded before the path existed (or replayed from
  an old file): show "no path recorded", not an empty timeline.
- `decided_at` is the engine's clock — bar time on a run, wall clock live — not the fill time.
- **Null is not zero, anywhere in these payloads** (same rule as §G). `regime_weight: null`
  means the legacy hard gate was in force; `price: null` means the engine had no price.
- Before the backend carrying this is deployed, `/decisions` returns `total_matching: 0`
  for a live session: render "no decisions recorded yet", not an error and not zeros.
- Never compute a benchmark client-side from fill prices; the curves come from exchange
  bars fetched for the purpose.

## 5. Connecting the Frontend to the Backend

The frontend is deployed **on the same OVH Public Cloud instance** as the backend, as a
container named `iqar` in `docker-compose.yml`, and is the **only** service exposed
to the internet. It serves the built SPA and **reverse-proxies `/api` to the backend
over the internal Docker network**, so the browser only ever talks to **one origin**.
That removes CORS, third-party-cookie, and token-juggling problems entirely.

```
Browser ─► Cloudflare Access (SSO) ─► cloudflared ─► iqar:80 (nginx)
                                                       ├── serves the SPA (static)
                                                       └── /api ─► tower:8000  (internal)
```

Because everything is one origin behind Cloudflare Access, the Access cookie/JWT is
**first-party** — login "just works" in the browser, with **no service token or
`cloudflared access` dance**. (An earlier draft of this section used a local
service-token/user-token Vite proxy against the tunnel hostname; that approach is
obsolete now that the frontend is co-deployed and reverse-proxies the API.)

### 5.1 API base — relative `/api`

The SPA must call the API at a **relative** base so requests hit its own origin and
nginx proxies them on to the backend. The browser cannot reach `tower:8000` directly:

```ts
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
```

In production set nothing (the `/api` default is correct). In local dev, point
`VITE_API_BASE_URL` at the Vite proxy (see 5.3).

### 5.2 The iqar repo: Dockerfile + nginx

The iqar repo builds the static SPA and serves it with nginx, which also proxies
`/api` to `tower`. Two files belong in that repo:

`Dockerfile`:
```dockerfile
# ---- build the SPA ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build                       # → /app/dist

# ---- serve with nginx ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`deploy/nginx.conf`:
```nginx
# WebSocket upgrade plumbing (http context; conf.d is included inside http{}).
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  # SPA client-side routing: unknown paths fall back to index.html.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Reverse-proxy the API to the internal backend. nginx forwards the
  # Cf-Access-Jwt-Assertion header and the CF_Authorization cookie to tower, so
  # the email-based control auth (halt/resume/limits) keeps working.
  location /api/ {
    proxy_pass http://tower:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;          # live WS streams
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;                         # long-lived WS / SSE
  }
}
```

**CI**: build and push to the **same registry namespace** as the backend —
`ghcr.io/lepingu/iqar:<sha>` and `:latest` — then redeploy only the
frontend on the host:
```
docker compose pull iqar && docker compose up -d iqar
```
`tower` needs no redeploy when only the frontend changes. This repo already wires
`iqar` into `docker-compose.yml` and points the Cloudflare tunnel at `http://iqar:80`;
the registry tag is `IQAR_IMAGE` in `.env.production` (defaults to `:latest`).

### 5.3 Local development

No Cloudflare needed locally — run the backend and frontend side by side and let the
Vite dev server proxy `/api`:

```ts
// vite.config.ts (dev only)
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true, ws: true },
  },
},
```

Start the backend with `uvicorn src.api.main:app --port 8000` (or
`docker compose -f docker-compose.local.yml up`), then `npm run dev`. Locally the
control endpoints are open — `ACCESS_CONTROL_ENABLED=false` logs a startup warning and
`require_control_user` returns `dev-local` — so you can exercise halt/resume/limits
without any token. On the server, those require your email in `ENGINE_CONTROL_EMAILS`.

---

## 6. First Steps for the Agent

> **Before any data view will load**, set the API base + dev proxy (§5) — the SPA
> reaches the backend through its own origin (`/api`), never `tower:8000` directly.

Build in this order — later views depend on components from earlier ones:

1. **Project scaffold**: Vite + React-TS, TanStack Router, TanStack Query, CSS variables for the golden/dark theme.
2. **Core reusables**: `GlassCard`, `KPICard`, `FlagChip`, `StatusBadge` — these are used across all views.
3. **Runs Browser (`/backtests`)** — first because it is pure read-only (one `GET`), validates the API contract, and gives the user something useful immediately.
4. **Run Detail + Chart Explorer (`/backtests/:runId`)** — equity curve first (no lazy chart needed), then asset sidebar + candlestick explorer.
5. **Launch + Live Monitor (`/` and `/backtests/live`)** — introduce the POST flow and the polling live-monitor after the read-only views are solid. SSE is deferred; use `GET /api/backtests/live/:runId` polling for now.
6. **Live placeholder (`/live`)** — last; one banner component, no logic.

Present the layout and routing skeleton to the user before building charting integrations.

---

## 7. Hand-off log (what changed in the contract, newest first)

Each entry: date · what a frontend agent must do · where it is specified. `openapi.yaml`
beside this file contains the schemas. Entries marked `x-implementation-status:
requested` are pending backend work; `GET /openapi.json` on a running tower reports
what that deployment actually serves.

### 2026-09-21 (later) — peer bot comparison: backend implemented, views requested

- **Read [BACKEND_UI_HANDOFF.md §4](BACKEND_UI_HANDOFF.md#4-peer-comparison--get-apipeers-and-evaluationcurvespeers)**
  — routes, the three views (peer lines on the live chart; the peer field with
  rank tiles; the peer detail drawer), and the semantics to keep. This
  supersedes the earlier same-day entry below that listed these routes as
  `requested`: they are now `x-implementation-status: implemented` in
  `openapi.yaml`, validated on real Freqtrade and NautilusTrader output.
- **Gate**: `PEER_COMPARISON_ENABLED` on the Tower, default off. Off → `/api/peers/*`
  404 (render *unavailable*, not "no peers") and `EvaluationCurves.peers: []`.
- **New endpoints**: `GET /api/peers`, `GET /api/peers/{peer_name}`,
  `GET /api/peers/field/{window_label}?our_run_id=`.
- **New schemas**: `PeerScorecardSummary`, `PeerScorecardResponse`, `PeerFieldEntry`,
  `PeerField`, `PeerCurveModel`.
- **Existing schemas gained fields** (additive): `EvaluationCurves.peers[]`
  (live-shadow peers on the book's own axis, already cut and re-indexed to the
  book's `anchor` server-side); `CurvePointModel.rebased` on **every** curve
  series — see next bullet.
- **Bug this fixes on the current chart**: the main chart plots `value`, which is
  the raw level (≈$10k book vs ≈$60k BTC) — hence the scale gap. Plot `index`
  (percent) or the new `rebased` (the book's anchor dollars tracked along the
  series); never `value`. Offer the two as a percent/dollar toggle.
- **Views requested** (Route E/F chart chips + table; Route C or `/peers` field
  panel; detail drawer) — all specified in §4 of the handoff. No new top-level
  route is required for the chart work; the field panel may be either.
- **Behaviour to know**: live-shadow rows exist only once the peer containers run
  (they have not yet been deployed); until then `peers: []` even with the flag
  on, and `GET /api/peers` shows replay rows only. Replay rows are on a 5-symbol
  validation basket; the field is comparable to a book run only on the same
  basket and window (the handoff explains the hashes to show).

### 2026-09-21 — approved live monitor redesign and backend requests

- **Read [BACKEND_UI_HANDOFF.md](BACKEND_UI_HANDOFF.md)** — §"What the backend
  serves" is the authoritative restatement of routes, fields and semantics.
- Approved reference: [live-trading-approved.png](mockups/live-trading-approved.png).
  Screenshot values are illustrative; the frontend does not ship fixture data.
- This replaces Route E/F's stacked charts and decision modal: one percentage
  chart, custom benchmark toggles, tabs for positions/decisions/fills/events,
  compact telemetry and a persistent right-hand details explorer. Halt stays in
  the header; engine settings and real account reconciliation use disclosures.
- **Implemented (backend, same day)**: `/api/engine/{session_id}/telemetry`,
  `/events`, `/orders/{order_id}` and every additive field. OpenAPI elements now
  carry `x-implementation-status: implemented`. A Tower older than this deploy
  still 404s the new routes and omits the new fields — the rollout rules
  (nullable, empty-vs-null, unavailable-not-healthy) still cover that case.
- Additive nullable fields cover freshness, exposure, return methodology,
  fill execution quality/order linkage and position protection. Null is unknown.
  404 on new reads renders unavailable; auth/service errors remain visible.
- `/curves` is now served from stored hourly bars (sub-second reads) and states
  `return_method` / `net_of_fees` / `cash_flow_adjusted` explicitly — the
  "Ledger value change only" fallback is no longer needed.
- Event streams and replay comparison remain future work, not UI dependencies.

### 2026-09-19 — decision identity, decision explorer, curve overlays

- **New views**: §H (decision cards with hover/click, the decision-path drawer, the declined
  book, and the equity-curve overlays). Fits into Route E (`/live`), F (`/live/real`) and
  C (`/backtests/:runId`) — no new top-level route required.
- **New endpoints**: `GET /api/oracle/{session_id}/decisions`,
  `GET /api/oracle/{session_id}/decisions/{decision_id}`,
  `GET /api/backtests/{run_id}/decisions`, `GET /api/backtests/{run_id}/decisions/{decision_id}`,
  `GET /api/evaluation/{session_id}/curves`.
- **Fill history**: `GET /api/engine/{session_id}/fills` (`PaginatedLiveFills`) — §E data
  sources. `LiveFill` gained `id`, `position_id`, `decision_id`, `reason`, `commission`.
  `LiveEngineDetail.recent_fills` unchanged (still the last 20).
- **New schemas**: `DecisionSummary`, `DecisionDetail`, `DecisionsResponse`, `EvaluationCurves`,
  `CurvePointModel`, `FillMarkerModel`.
- **Existing schemas gained fields** (additive, nullable): `OracleLot.entry_decision_id`,
  `OracleLot.exit_decision_id`, `OracleFill.decision_id`. Existing views keep working
  unchanged; the lineage view (§ oracle lots) can now link a fill to its decision.
- **Behaviour to know**: decisions are recorded by the engine from the deploy that carries
  this onward; earlier lots have `entry_decision_id: null`. The curves endpoint caches
  benchmark prices for 15 minutes — poll it, do not debounce it further.
- **Not in the backend yet**: statistical confidence (null-model percentiles, bootstrap
  intervals) and external-bot comparison. When they land they will appear here first.
