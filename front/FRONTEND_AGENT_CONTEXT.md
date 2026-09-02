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

**Data sources** (all under the `/api/engine/*` namespace — paper/real trading is a
**separate route family** from `/api/backtests/*`; do NOT use the backtest live
endpoints for the engine):
- `GET /api/engine/{session_id}/status` — kill-switch state, risk limits, alive ping. Poll every 15 s.
- `GET /api/engine/{session_id}/detail` — positions, fills, equity curve, P&L. Poll every 5 s while active. (Open to any Access user — viewers can watch.)
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

- `OpenPositionsTable` — reuse from Route D: symbol · side · qty · entry $ · current $ · unrealised P&L%

- `RecentFillsFeed` — last 20 fills, newest first. **Show realized P&L on SELL
  fills**: `realized_pnl` / `realized_pnl_pct` are populated on sells and `null`
  on buys (a buy's stored pnl is only its fee, which would read as though every
  entry had already lost money). Colour the same way `OpenPositionsTable` colours
  unrealised P&L, and render nothing in that column for buys — a closed trade
  should say whether it made money, which the feed previously did not.

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
quote currency) stay at 2 decimals: those are dollars, not asset prices.

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
`session_id=live-real`. No new endpoints are required for the read path.

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

- `RunHealthBadge` — `run_health.degraded` plus its reasons. A degraded run is one
  whose critic or ML-1 was not functioning; its numbers are not a measurement.

- `HaltButton` — the highest-value control in the system. Halt must be reachable
  in one click and visually dominant; resume should be deliberately less prominent.

**Visual treatment**: unmistakably distinct from `/live`. Different accent colour,
a persistent "REAL MONEY" marker in the header, and the session id always visible.

**Until real trading is armed** this route will show an engine that authenticates
and reads balances but refuses every order. That is the intended first
deployment, not an error state — render it as healthy-but-idle.

---

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
