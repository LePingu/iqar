# Live trading monitor — backend handoff, 2026-09-21

Status: **implemented in the backend on 2026-09-21** (migrations `c8e1f3a5b246`,
`d9f2a4c6e357`, and `a3f6c92e0b71` for the peer comparison in §4 below; see "What the backend serves"). The frontend still consumes
the resources opportunistically: a Tower older than that deploy answers 404 on the
new routes and omits the new fields. `openapi.yaml` marks them
`x-implementation-status: implemented`. Treat
[`openapi.yaml`](openapi.yaml) as the authoritative machine-readable backend
contract (version `1.1.0-live-monitor`); this document supplies the
operational semantics and rollout guidance behind it.

Approved visual: [live trading monitor](mockups/live-trading-approved.png).
The screenshot contains illustrative data; do not seed it into production.

## User-facing design

- One main performance chart — percent (`index`) or dollars (`rebased`) — with
  accessible custom checkbox chips for portfolio, BTC, equal-weight and
  exposure-matched curves, plus one chip per live peer bot (§4); 7/30/90-day ranges.
- Compact portfolio-value / P&L-return / drawdown / exposure / positions strip.
- Open positions, latest decisions (including declined book), recent fills and
  structured audit events in tabs below the curve.
- Right sidebar: compact telemetry + actionable incidents, then a persistent
  details explorer. Selecting fills, decisions, lots, events or chart markers
  opens the corresponding details; no modal on live routes.
- Real-money identity and Halt remain visible in the header. Settings and account
  reconciliation are secondary disclosures. Readers cannot control the engine.

## Rollout rules — essential

All new fields are optional AND nullable. `null` / absent means unavailable,
never zero, false, healthy, protected, filled, or an empty account. An empty list
means a successful read with no rows; a null list means not measured/available.
For audit events specifically, `events: []` is an empty successful result while
`events: null` signals unavailable data. The frontend accepts a nullable 200 body
or 204 for unavailable new resources. During rollout, 404 or 501 on
telemetry/events/order-detail also becomes an unavailable state.
401/403, 5xx and network failures remain visible errors; they must not look healthy.
Existing mandatory routes keep their error semantics.

Do not change existing fields or remove endpoints. Older payloads remain usable.
Return actual observed data only; no synthetic execution stages or guessed order
links. Keep real/paper session isolation and existing Access authorization.
These new reads never submit orders or contact the exchange synchronously.

## What the backend serves — read this before building

Everything below is stored by the engine at the moment it observes it and
served by the Tower without inference. Where the engine has no measurement the
field is null; render "unknown", never a default.

### Routes (all viewer-readable, session-scoped)

| Route | Poll | Serves | 404 means |
| --- | --- | --- | --- |
| `GET /api/engine/{s}/telemetry` | 15 s | `EngineTelemetry`: `components.{engine,market_data,exchange,critic}`, `last_cycle_at`, `cycle_duration_ms`, `arming`, `reconciliation`, `active_event_count`, top-10 `incidents` | engine never published (older engine or `LIVE_AUDIT_EVENTS=false`) |
| `GET /api/engine/{s}/events?limit&cursor&category&severity&active` | 30 s on the open tab | `AuditEventsResponse`, newest first, exclusive cursor on `(occurred_at, id)`; `events: []` is a real empty result | unknown session |
| `GET /api/engine/{s}/orders/{order_id}` | 5 s while non-terminal | `OrderExecution` with observed `events` stages and `quality` | order not stored (placed before 2026-09-21, or a venue-side fill) |

Component semantics: `engine` is derived by the Tower from the age of the
engine's telemetry row against the engine's own `stale_after_seconds` (2 ticks:
10 s real, 10 min paper); every other component is exactly what the engine
wrote, with its own `as_of`. `exchange` is null on a paper session. `critic`
is `degraded` when a critic response failed to parse this cycle (the decision
defaulted to agree=true), `unknown` when the orchestrator has no critic counter.
`arming` on a paper session is `{live_mode: "paper", armed: null, …}`; on a real
session it is the broker's effective switches.

Incidents are events with a `dedupe_key` and no `resolved_at`: `feed_stale`,
`exchange_unreachable`, `critic_degraded`, `unpriceable_holdings`. One row per
condition while it lasts; `resolved_at` is set in place on recovery, so the
same row moves from "active" to history. Plain events (no open state):
`lifecycle` (engine started / stopped / cycle failed), `control` (`requested`
by the Tower with the operator's identity → `applied` or `failed` by the
engine, each with `before`/`after` controls), `order` (rejected, or
validated-not-placed on an unarmed real engine), `reconciliation` (book
adjusted to the exchange: adopted / resized / retired symbols in `after`).

Orders: `status` ∈ submitted | acknowledged | partially_filled | filled |
rejected (no cancel/expire path exists in this engine yet). `events` stages
are only what was observed — a paper fill has `submitted → filled`, a Kraken
fill `submitted → acknowledged → filled`, a rejection `submitted → rejected`.
`quality.reference` is `arrival_last` (the engine's last observed price at
submission; the engine reads candles, not the book, so it is not a midpoint).
`slippage_bps` is positive-adverse for both sides and null with
`unavailable_reason` when there is no fill or no reference. `fill_time_ms` is
submission → final fill on filled orders only.

### Fields added to existing payloads (all nullable)

- `LiveEngineDetail`: `as_of` (latest snapshot time), `generated_at`,
  `snapshot_id`, `stale_after_seconds` (600), `exposure_pct` (crypto share of
  the book at `as_of`, excludes other-currency fiat; null without a snapshot).
- `OpenPosition`: `position_id`; `protection.{allocation_pct,
  effective_stop_price, stop_distance_pct, mechanism, reason}`.
  `effective_stop_price` is the level the engine's own `check_exits` fires on
  first (trailing when active and nearer, else hard stop). `mechanism` is
  `engine_managed` / `venue_order` from the engine's published configuration,
  null with a reason when unpublished. `executable`, `free_quantity`,
  `bonded_quantity` are **always null today** — not measured per lot.
- `LiveFill` (feed and history): `commission_currency`, `order_id`,
  `execution_quality` (the order's quality; null when the order is not stored).
- `FillMarkerModel`: `fill_id` (= `LiveFill.id`), `order_id`.
- `CurvePointModel`: `rebased` — the book's anchor dollars tracked along the
  series (`value_at_anchor × index / 100`). **This is the fix for the scale gap
  on the main chart**: `value` is the raw level (≈$10k book, ≈$60k BTC, ≈1.0
  basket) and must not be plotted; plot `index` (percent view) or `rebased`
  (dollar view). Null only when the book had no priced anchor.
- `EvaluationCurves`: `peers[]` (§4 below) and freshness fields (`as_of` = last equity point,
  `stale_after_seconds` 7200), `return_method: "ledger_change"`,
  `net_of_fees: true`, `cash_flow_adjusted: false`. Label the chart
  accordingly: it is the ledger's value indexed from the anchor, net of fees,
  not time-weighted and not adjusted for deposits/withdrawals inside the
  stretch. The "Ledger value change only" fallback is no longer needed — the
  curve IS that, stated. Reads are sub-second (bars are stored server-side).

### Not provided yet (keep rendering unknown)

Per-lot `executable` / bonded split; `cycle_duration_ms` on observe ticks
(full cycles only); cancel/expire order states; SSE. (The "replay comparison"
formerly listed here is now the peer comparison, §4 — served behind a flag.)

## 1. GET /api/engine/{session_id}/telemetry

Lightweight stored state; frontend polls every 15 seconds. Readable by Access
viewers. See `EngineTelemetry` in OpenAPI for exact field names.

```json
{
  "session_id": "live-real",
  "mode": "real",
  "snapshot_id": "engine-cycle-123",
  "as_of": "2026-09-21T06:32:08Z",
  "generated_at": "2026-09-21T06:32:09Z",
  "stale_after_seconds": 60,
  "components": {
    "engine": {"state": "healthy", "label": "Online", "as_of": "2026-09-21T06:32:08Z", "stale_after_seconds": 60},
    "market_data": null,
    "exchange": null,
    "critic": {"state": "degraded", "label": "Fallback", "reason": "Critic timeout; configured fallback active"}
  },
  "last_cycle_at": "2026-09-21T06:32:08Z",
  "cycle_duration_ms": 840,
  "active_event_count": 1,
  "incidents": [{"id": "incident-123", "severity": "warning", "title": "Critic unavailable — fallback active", "occurred_at": "2026-09-21T06:31:00Z"}],
  "arming": {"live_mode": "real", "armed": null, "validate_only": null, "max_order_usd": null},
  "reconciliation": null
}
```

- Component state: `healthy | degraded | offline | unknown`; optional display
  label and reason. Every independent source has its own measurement timestamp
  and freshness limit. Request time is NOT measurement time.
- Arming reports effective runtime configuration: mode, armed, validate-only,
  per-order USD cap. Null does not mean disarmed. Validate-only means validation
  without placing orders; display it neutrally.
- Reconciliation reports authoritative engine state, timestamp, `matched`,
  `adopted`, `unpriceable`, `missing_on_exchange` counts and reason. UI balance
  subtraction is not a reconciliation verdict. Never auto-correct holdings based
  on these read endpoints.
- Incidents are a small list of unresolved structured events, highest severity
  first. `active_event_count` is session-wide, not this list's length.

## 2. GET /api/engine/{session_id}/events?limit=50&cursor=...

Stored audit events, newest first. Readable by Access viewers. Stable opaque
exclusive cursor ordered by `(occurred_at, id)`; new events must not shift older
pages. Return `{events, next_cursor, active_count, as_of, generated_at, snapshot_id}`.
Frontend polls the open Events tab every 30 seconds; fetches older pages on demand.

Each `AuditEvent` has a stable `id`; nullable `occurred_at`, `severity`
(`info|warning|critical`), `category`, `title`, `detail`, `resolved_at`, `symbol`,
`decision_id`, `order_id`, `position_id`, `actor`, `before`, `after`, `command_state`.

Persist incidents such as feed stale/recovered, critic degraded/recovered,
reconciliation mismatch, order rejected, deploy/restart and control changes.
Deduplicate recurring incidents; record their resolution. Controls must distinguish
requested, applied and failed. Preserve actor and before/after values; redact
credentials/secrets/prompts. The UI does not infer applied from HTTP 202.

## 3. GET /api/engine/{session_id}/orders/{order_id}

Lazy read when a fill, event or chart marker with an order ID is selected. Stable
engine order identity must join decision → order → partial fills → lot. Scope the
lookup to the session. The endpoint returns `OrderExecution` with:

- `order_id`, nullable `decision_id`, `symbol`, `side`, `status`, `trigger_type`.
- `requested_quantity`, `filled_quantity`, `average_fill_price`, `currency`.
- `quality: ExecutionQuality | null` (below).
- `events`: chronological observed events with stable `id`, `stage`,
  `occurred_at`, `detail`. Suggested stages: `decision_created`, `risk_approved`,
  `submitted`, `acknowledged`, `partially_filled`, `filled`, `cancelled`, `rejected`,
  `expired`. Preserve partial fills/retries; never fill in missing timestamps.

Order status uses lowercase machine values. Terminal statuses: `filled`,
`cancelled`, `rejected`, `expired`. Frontend polls a selected nonterminal order
at 5 seconds, and stops for terminal or unavailable records.

`ExecutionQuality` (nullable members):

| Field | Meaning |
| --- | --- |
| `slippage_bps` | Signed adverse execution difference; positive is worse for either side |
| `reference` | Machine label such as `arrival_midpoint`, identifying the benchmark |
| `reference_price`, `reference_at` | Observed reference price and its timestamp |
| `fees`, `fee_currency` | Explicit amount and denomination; do not imply USD |
| `fill_time_ms` | Submission to final fill, only for completed orders; null if not known |
| `unavailable_reason` | Why a measurement cannot be made |

For an arrival-midpoint benchmark: BUY = `(avg_fill / midpoint - 1) * 10000`;
SELL = `(1 - avg_fill / midpoint) * 10000`. Reference must be positive, contemporaneous
and in the same quote currency. Missing quotes produce null, not zero. Preserve
submission bid/ask, acknowledgement and fill timestamps in storage for later TCA.
Fees should come from venue records with documented conversion, not guessed rates.

## 4. Peer comparison — `GET /api/peers/*` and `EvaluationCurves.peers[]`

Design and validation record: [`../analysis/PEER_BOT_COMPARISON.md`](../analysis/PEER_BOT_COMPARISON.md).
The question it answers for the operator: *is the book lucky, or does the
strategy add anything over a rule you can write in ten lines?* External
open-source bots (Freqtrade, NautilusTrader) run public strategies — an
always-in control, EMA-cross, Donchian breakout, MACD+volume — on our own
bars, the same universe, cash ($10k) and fees (0.26 %), and every one of their
trades is valued by the same scorer the book's own evaluation uses. Two forms:

- **Replay** (`mode: "replay"`): a bot's strategy backtested over one of our
  named windows (`window_label` = `sideways-2023-06`, `bull-2023-10`). Batch,
  historical, one row per (peer, window). Validated on real bot output.
- **Live shadow** (`mode: "live"`, `window_label: "live-shadow"`): the same
  bots trading dry-run on live Kraken data alongside the paper engine, all
  started at ONE shared moment with the same cash, polled hourly. Their books
  are served as extra series on the engine's own curve.

Gate: `PEER_COMPARISON_ENABLED` on the Tower. Off (the default) means the
`/api/peers/*` routes do not exist (404) and `EvaluationCurves.peers` is
`[]`. Render 404 here as **unavailable** — never as "no peers" — exactly as
for telemetry during rollout.

### Routes (viewer-readable)

| Route | Poll | Serves | 404 means |
| --- | --- | --- | --- |
| `GET /api/peers` | 5 min | `PeerScorecardSummary[]`: every peer's latest stored scorecard (replay or live). A peer never run is absent, not a placeholder. | feature off |
| `GET /api/peers/{peer_name}` | on selection | `PeerScorecardResponse`: summary + pasteable markdown `digest` + `payload` (`Scorecard.to_dict()`, and for rows written from 2026-09-21 on, `payload.equity[]` — the peer's hourly book) | feature off, or this peer never scored |
| `GET /api/peers/field/{window_label}?our_run_id=` | on view | `PeerField`: every peer scored on that window, each with `rank_capture_ratio` / `rank_return_pct` / `rank_max_drawdown_pct`; with `our_run_id`, one of our backtest runs scored through the identical function as `our_scorecard` | feature off; or `our_run_id` unknown |
| `GET /api/evaluation/{s}/curves` | 60 s (unchanged) | now also `peers[]`: `PeerCurveModel` per **live** peer with a valuation inside the stretch | (unchanged) |

### Views

**A. Live monitor — peer lines on the main chart (Route E `/live`, F `/live/real`).**
Each `peers[i].series` is drawn with the exact code used for `equal_weight` /
`btc`: same `index` or `rebased` choice, same anchor, same grid. One legend
chip per peer, off by default, labelled `peer_name` (`freqtrade-ema-cross`),
visually distinct from the benchmark chips (dashed/muted) so a reader never
mistakes a bot for a benchmark. `stale: true` → draw the line muted and add
"stale, last scored HH:MM" from `generated_at`; it is not a live line. A
compact table under the chart when at least one peer is present:
`peer_name · return since anchor (last index − 100) · gap to the book in pp
(book last index − peer last index) · last scored`. `notes[]` may now
contain per-peer entries ("freqtrade-control: no book valuation inside the
stretch; not drawn") — surface them where the existing notes are shown.
Never compute a peer's return from its trades client-side; the series is the
measurement.

**B. Peer field (Route C `/backtests/:runId`, new panel; or a `/peers` view).**
For a chosen `window_label`: every peer's curve is NOT served here (only
replay scorecards), so this is a table + rank tiles, not a chart:

- Rank tiles: "Rank N of M on capture", "… on return", "… on max drawdown",
  from `PeerFieldEntry.rank_*`; a null rank means the metric itself is null
  (unrankable), show "—".
- Table: `peer_name · return_pct · benchmark_pct · alpha_pp · capture_ratio ·
  sharpe_ratio · max_drawdown_pct · total_trades`. Null → "—" with the reason
  from the detail's `notes` on hover; **never 0**. `capture_ratio` is null
  whenever the equal-weight hold moved less than +1 % (a ratio to a flat or
  falling benchmark is meaningless — the flat-month rows all have it null;
  lead with `alpha_pp` there).
- `our_scorecard` (when the view passes `?our_run_id=`): the same row shape,
  `bot: "book"`, drawn as "you are here" among the peers. Null → the field is
  still worth showing, just without the marker.
- Provenance on the detail: `bars_hash`, `strategy_hash` — show the first 8
  chars; two rows with different hashes are not comparable and should say so.
- Small multiples across windows (one column per `window_label`) are the
  point of the view: a rank that holds across windows reads as edge, one that
  jumps reads as regime luck.

**C. Peer detail (drawer, from either view).** `digest` rendered as markdown
(it is the same scorecard table the CLI prints), `payload.ladder[]` as the
benchmark ladder rows, and — when `payload.equity` exists — that series on its
own small chart (`total_value` in dollars; `index` it client-side to 100 at its
first point, this one exception to "never compute client-side" because it is
a single series with nothing to align to).

### Semantics the UI must keep

- All peer numbers are **net of fees**, on the peer's own hourly
  mark-to-market against exchange bars — the same `return_method` as the
  book's curve. Do not label them time-weighted.
- The live shadow's peers start at the deploy's shared anchor
  (`PEER_LIVE_ANCHOR_AT`), which may be earlier or later than the book's own
  `anchor` (the last rebuild). `peers[].series` is already cut and re-indexed
  to the book's stretch server-side; do not re-anchor again.
- Replay peers ran on a 5-symbol validation basket (XBT/ETH/SOL/ADA/LINK).
  A replay scorecard is comparable to a book run only when `our_run_id` was
  on the same basket and window; the field endpoint does not check that —
  the operator does, using the hashes and `window_label`.
- Read-only. Nothing here starts a bot or a backtest.

## Additions to existing payloads

1. `LiveFill`: `order_id`, `execution_quality`, `commission_currency`. Feed/history
   quality is scoped to the fill; order-detail quality is explicitly the whole
   order. `commission_currency` is the ISO denomination of a numeric commission;
   when null, clients must not infer it from the book currency. Existing commission
   and settlement/FX fields remain intact. A fill does not imply its whole order
   completed.
2. `FillMarkerModel`: `order_id`, `fill_id` linking chart clicks to execution.
   Existing decision/lot links continue to work without them.
3. `OpenPosition`: `position_id`, `protection` (`PositionProtection` schema):
   `allocation_pct`, `effective_stop_price`, `stop_distance_pct`, `free_quantity`,
   `bonded_quantity`, `mechanism`, `executable`, `reason`.
   `mechanism` identifies venue order vs engine-managed stop. The engine decides
   executability, including bonded lots; frontend must not infer it from a stop price.
   Allocation/stop-distance are percentage points (e.g. 12.5 = 12.5%).
4. `LiveEngineDetail`: `exposure_pct` (0–100 portfolio fraction in percent), plus
   freshness fields below. Null exposure stays unknown; no browser inference.
5. `EvaluationCurves`: `return_method`, `net_of_fees`, `cash_flow_adjusted`, plus
   freshness fields. Only explicit true enables those labels in the UI. Each
   existing index stays 100 at the shared anchor. Frontend displays `index - 100`
   in percent. All benchmarks share the book's anchor and time grid; headline
   difference is shown only when latest timestamps align. Rebuild boundaries and
   missing-price coverage must remain explicit.
6. Shared optional freshness fields: `as_of`, `generated_at`, `snapshot_id`,
   `stale_after_seconds`. UTC ISO-8601 timestamps. `snapshot_id` identifies the
   underlying read version; independent resource versions must not be implied
   to be atomic. Chart benchmarking may lag positions; expose this honestly.

The main chart prefers evaluated curves. If unavailable, it may display measured
ledger capital change from the first positive snapshot in the chosen window, in
the SAME chart, explicitly labelled "Ledger value change only". This fallback is
not cash-flow-adjusted performance, never invents benchmarks, and never reaches
back before observed data. Backend additions should eventually remove this fallback.

## Existing resources retained

`/status` 15s, `/detail` 5s (also reads last-known state when halted/offline),
`/evaluation/{id}/curves` 60s; decisions and their lazy detail; fill history using
`before_id`; oracle lot lineage; real account snapshot 30s. Null optional lists,
metrics, context and quality must render safely. Detail panels fetch only on user
selection, and engine control endpoints remain operator-only.

## Later capabilities — not called by this frontend release

- Unified atomic snapshot read and stable decision cursor, replacing offset
  pagination for live decision history.
- Resumable event stream with event IDs and reconnect replay; polling remains
  the only transport used now. Do not expose an SSE URL as implemented prematurely.
- Replaying OUR OWN strategy under matched holdings/cash flows/config versions
  (a self-replica). Distinct from §4's peer comparison, which is served now:
  §4 compares against other bots, this would compare against ourselves.

## Backend acceptance checks

- Old payloads, partial payloads, null resources, empty arrays and zero values are
  distinguishable; zero fees/exposure remain real zero rather than unavailable.
- Real/paper reads never cross session boundaries. Viewer reads succeed while
  control writes enforce existing server authorization.
- A rejected order has its rejection evidence, not a synthetic fill timeline.
- Multiple fills keep stable identities and order linkage; paging while new data
  arrives does not duplicate/skip rows.
- Missing reference quotes yield null slippage. Unknown arming/protection remains
  unknown. Bonded quantities cannot imply executable stop protection.
- Deposits, withdrawals, rebuilds and stale pricing do not masquerade as strategy
  return. All curve comparisons use the same currency, anchor and timestamps.
- Event before/after fields and log links must not expose credentials or secrets.
- With `PEER_COMPARISON_ENABLED` unset, `EvaluationCurves` is byte-identical to the
  pre-peer payload apart from `rebased`; `/api/peers/*` is 404. With it set and no
  live peer, `peers: []` and no spurious notes.
