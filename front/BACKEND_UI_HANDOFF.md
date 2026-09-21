# Live trading monitor — backend handoff, 2026-09-21

Status: **requested additive contract**, not a claim these backend capabilities
are deployed. The frontend consumes the resources below opportunistically. This
repository implements the UI, not the Python/Rust engine. `openapi.yaml` marks
new routes/schemas with `x-implementation-status: requested`. Treat
[`openapi.yaml`](openapi.yaml) as the authoritative machine-readable backend
contract (version `1.1.0-draft-live-monitor`); this document supplies the
operational semantics and rollout guidance behind it.

Approved visual: [live trading monitor](mockups/live-trading-approved.png).
The screenshot contains illustrative data; do not seed it into production.

## User-facing design

- One main portfolio-value performance chart, with accessible custom checkbox chips
  for portfolio, BTC, equal-weight and exposure-matched curves; 7/30/90-day ranges.
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
   existing index stays 100 at the shared anchor. `value` is in the accounting
   currency and every benchmark starts at the book's anchor value, so the chart
   uses one monetary axis. Frontend shows `index - 100` only in hover context.
   Rebuild boundaries and missing-price coverage must remain explicit.
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
- Replayed-strategy comparison: match starting holdings, cash flows, strategy and
  config versions, venue costs and market-data provenance. Separate from the
  current BTC/equal-weight overlays; no invented replay data in this release.

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
