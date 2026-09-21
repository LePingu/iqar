// Run against a local Vite server. Every API request is intercepted; no orders
// or other writes can reach a real engine from this regression suite.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4173';
const artifacts = process.env.TEST_ARTIFACT_DIR ?? '/private/tmp/iqar-ui-check/screenshots';
await mkdir(artifacts, { recursive: true });
const now = Date.now();
const asOf = new Date(now).toISOString();
const points = Array.from({ length: 120 }, (_, i) => ({ timestamp: new Date(now - (119 - i) * 3600000).toISOString(), index: 100 + i / 28 + Math.sin(i * .7) * .12, value: 100000 + i * 36 }));
const fill = { id: 42, symbol: 'BTC/USD', side: 'BUY', price: 62410, quantity: .024, timestamp: asOf, realized_pnl: null, realized_pnl_pct: null, source: 'engine', order_id: 'order-42', decision_id: 'decision-42', position_id: 7, execution_quality: { slippage_bps: 4.2, fees: .84, fee_currency: 'USD', fill_time_ms: 320, reference: 'arrival_midpoint' } };
const metricFills = [
  { ...fill, id: 43, symbol: 'ETH/USD', side: 'SELL', quantity: .5, price: 2480, realized_pnl: 125, realized_pnl_pct: 10.25, commission: .25, execution_quality: null },
  { ...fill, id: 44, symbol: 'SOL/USD', side: 'SELL', realized_pnl: -12.5, realized_pnl_pct: -2.5 },
  { ...fill, id: 45, symbol: 'ZERO/USD', side: 'SELL', realized_pnl: 0, realized_pnl_pct: 0, commission: 0 },
  { ...fill, id: 46, symbol: 'UNKNOWN/USD', side: 'SELL', realized_pnl: null, realized_pnl_pct: null },
  { ...fill, id: 47, symbol: 'ENTRY/USD', side: 'BUY', realized_pnl: -1, realized_pnl_pct: -1 },
  { ...fill, id: 48, symbol: 'VENUE/USD', side: 'SELL', source: 'exchange', realized_pnl: 999, realized_pnl_pct: 99, price: .00042, settle_price: .00042, settle_currency: 'EUR', settle_fx_rate: null, venue_market: 'VENUE/EUR' },
  { ...fill, id: 49, symbol: 'ROI/USD', side: 'SELL', realized_pnl: null, realized_pnl_pct: 3.5 },
];
const position = { position_id: 7, symbol: 'BTC/USD', side: 'BUY', quantity: .024, entry_price: 62410, current_price: 63800, unrealized_pnl_pct: 2.23, trailing_stop_active: true, basis_source: 'traded', protection: { allocation_pct: 12, executable: false, reason: 'Bonded quantity cannot be sold', free_quantity: 0, bonded_quantity: .024, effective_stop_price: 61200 } };
const decision = { decision_id: 'decision-42', decided_at: asOf, symbol: 'BTC/USD', action: 'buy', confidence: .82, position_size: 1500, executed: true, outcome: 'filled', price: 62410, reasoning: 'Trend and risk checks passed.' };
const event = { id: 'incident-1', occurred_at: asOf, severity: 'warning', title: 'Critic unavailable — fallback active', detail: 'The configured fallback is active while the critic recovers.', order_id: 'order-42' };
const errors = [];
const browser = await chromium.launch({ headless: true });
async function scenario(kind = 'full', role = 'admin', route = '/live') {
  const page = await browser.newPage({ viewport: { width: 1586, height: 1000 } });
  page.on('pageerror', error => errors.push(`${kind}: ${error.message}`));
  const requests = [];
  await page.route('**/api/**', async intercepted => {
    const request = intercepted.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push({ path, method: request.method() });
    const mode = route === '/live/real' ? 'real' : 'paper';
    const json = data => intercepted.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return json({ email: 'test@example.com', can_control: role === 'admin' });
    if (request.method() !== 'GET') return json({ queued: 'test-command', session_id: `live-${mode}` });
    if (kind === 'null') return json(null);
    if (path.endsWith('/status')) return json({ session_id: `live-${mode}`, mode: kind === 'mismatch' ? 'paper' : mode, engine_alive: true, trading_enabled: true, last_snapshot_ts: asOf, max_position_size_pct: .1, max_daily_loss_pct: .05, max_open_positions: 10 });
    if (path.endsWith('/telemetry')) {
      if (kind === 'legacy') return intercepted.fulfill({ status: 404, body: '{}' });
      if (kind === 'partial') return json({ components: { engine: null, critic: null }, incidents: null, reconciliation: null, arming: null });
      return json({ mode, as_of: asOf, stale_after_seconds: 60, components: { engine: { state: 'healthy', label: 'Online' }, market_data: { state: 'healthy', label: 'Fresh' }, exchange: { state: 'healthy', label: 'Connected' }, critic: { state: 'degraded', label: 'Fallback' } }, last_cycle_at: asOf, cycle_duration_ms: 840, active_event_count: 1, incidents: [event] });
    }
    if (path.endsWith('/detail')) return json(kind === 'partial' ? { mode, open_positions: [null, { ...position, quantity: null, entry_price: null, current_price: null, unrealized_pnl_pct: null, protection: null }], recent_fills: [null, { ...fill, price: null, quantity: null, timestamp: null, execution_quality: null }], portfolio_value: null, pnl_pct: null, drawdown_pct: null, exposure_pct: null, equity_curve: null } : { mode, currency: 'USD', portfolio_value: 104280, pnl: 4280, pnl_pct: 4.28, drawdown_pct: -1.12, exposure_pct: 38, open_positions_count: 1, last_snapshot_ts: asOf, open_positions: [position], recent_fills: kind === 'metrics' ? metricFills : [fill], equity_curve: points.map(p => ({ time: Math.floor(Date.parse(p.timestamp) / 1000), capital: p.value, roi_pct: p.index - 100 })) });
    if (path.endsWith('/curves')) return json(kind === 'partial' ? { mode, equity: null, markers: null, notes: null, btc: null, equal_weight: null } : kind === 'legacy' ? null : { mode, equity: points, btc: points.map((p, i) => ({ ...p, index: 100 + i / 60 })), equal_weight: [], exposure_matched: [], anchor: points[0].timestamp, as_of: asOf, net_of_fees: true, cash_flow_adjusted: true, markers: [{ timestamp: points[90].timestamp, symbol: 'BTC/USD', side: 'BUY', book_index: points[90].index, decision_id: 'decision-42' }] });
    if (path.includes('/orders/')) return json(kind === 'partial' ? { order_id: 'order-42', quality: null, events: null } : { order_id: 'order-42', status: 'filled', quality: fill.execution_quality, events: ['decision_created', 'risk_approved', 'submitted', 'acknowledged', 'filled'].map((stage, i) => ({ id: String(i), stage, occurred_at: asOf, detail: stage === 'filled' ? '0.024 BTC at $62,410' : null })) });
    if (path.endsWith('/decisions')) return json({ total_matching: 1, decisions: [{ ...decision, ...(kind === 'partial' ? { action: null, outcome: null, confidence: null, price: null } : {}) }] });
    if (path.includes('/decisions/')) return json(kind === 'partial' ? { decision: null, context: null, fills: null, opened_lots: null, closed_lots: null } : { decision, context: null, fills: null, opened_lots: null, closed_lots: null });
    if (path.endsWith('/events')) return json(kind === 'legacy' ? null : { events: kind === 'partial' ? null : [event], next_cursor: null });
    if (path.endsWith('/fills')) return json({ fills: kind === 'partial' ? null : kind === 'metrics' ? metricFills : [fill], total_matching: kind === 'metrics' ? metricFills.length : 1 });
    if (path.endsWith('/lineage')) return json({ lot: null, fills: null });
    return json(null);
  });
  await page.goto(base + route);
  await page.locator('.trading-header, .monitor-error').first().waitFor();
  return { page, requests };
}
try {
  const { page, requests } = await scenario();
  await page.getByRole('button', { name: 'BTC/USD', exact: true }).click();
  await page.getByText('Bonded quantity cannot be sold').waitFor();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.getByRole('tab', { name: /Recent fills/ }).click();
  await page.getByRole('button', { name: /BTC\/USD.*inspect fill/ }).click();
  await page.getByText('0.024 BTC at $62,410').waitFor();
  assert.equal(await page.locator('.performance-canvas').count(), 1);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.ok(requests.some(r => r.path.endsWith('/orders/order-42')));
  const btc = page.getByRole('checkbox', { name: 'BTC', exact: true });
  await btc.uncheck(); assert.equal(await btc.isChecked(), false); await btc.check();
  await page.screenshot({ path: `${artifacts}/desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Decision reasoning ↗' }).click();
  await page.getByText('No path recorded', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'View audit ↗' }).click();
  assert.equal(await page.getByRole('tab', { name: 'Events', exact: true }).getAttribute('aria-selected'), 'true');
  await page.locator('.audit-event').first().click();
  await page.getByText('The configured fallback is active while the critic recovers.').waitFor();
  await page.getByRole('tab', { name: 'Events', exact: true }).focus();
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('tab', { name: /Open positions/ }).getAttribute('aria-selected'), 'true');
  await page.getByRole('button', { name: 'Halt trading', exact: true }).click();
  await page.getByText('Halt requested.', { exact: false }).waitFor();
  assert.ok(requests.some(r => r.path.endsWith('/halt') && r.method === 'POST'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: /Recent fills/ }).click();
  await page.getByRole('button', { name: /BTC\/USD.*inspect fill/ }).click();
  await page.screenshot({ path: `${artifacts}/mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page overflows horizontally');
  await page.close();
  console.log('PASS desktop/mobile selection, timeline, curve toggles, audit, keyboard tabs and mocked halt');

  for (const kind of ['null', 'partial', 'legacy']) {
    const { page } = await scenario(kind);
    await page.getByRole('tab', { name: /Latest decisions/ }).click();
    if (kind === 'partial') {
      await page.locator('.decision-open').first().click();
      await page.getByText('Decision detail is unavailable.').waitFor();
    }
    await page.getByRole('tab', { name: /Recent fills/ }).click();
    if (kind !== 'null') {
      await page.getByRole('button', { name: /BTC\/USD.*inspect fill/ }).click();
      await page.getByRole('button', { name: 'Browse fill history' }).click();
    }
    await page.getByRole('tab', { name: 'Events', exact: true }).click();
    await page.screenshot({ path: `${artifacts}/${kind}.png`, fullPage: true });
    const body = await page.locator('body').innerText();
    assert.ok(!body.includes('NaN') && !body.includes('Invalid Date'), `${kind} leaked invalid measurements`);
    await page.close();
    console.log(`PASS ${kind} payload state`);
  }
  const metrics = await scenario('metrics');
  const metricPage = metrics.page;
  await metricPage.getByRole('tab', { name: /Recent fills/ }).click();
  const table = metricPage.locator('.fills-table').first();
  await table.getByText('+10.25%', { exact: true }).waitFor();
  const assertReturns = async (asset, pnl, roi) => {
    const row = table.locator('tr').filter({ has: metricPage.getByRole('button', { name: `${asset} — inspect fill`, exact: true }) });
    assert.equal(await row.locator('[data-metric="realized-pnl"]').innerText(), pnl);
    assert.equal(await row.locator('[data-metric="roi"]').innerText(), roi);
    return row;
  };
  const gain = await assertReturns('ETH/USD', '+$125.00', '+10.25%');
  assert.equal(await gain.locator('[data-metric="quantity"]').innerText(), '0.500');
  assert.equal(await gain.locator('[data-metric="commission"]').innerText(), '0.250');
  await assertReturns('SOL/USD', '-$12.50', '-2.50%');
  await assertReturns('ZERO/USD', '+$0.00', '+0.00%');
  await assertReturns('UNKNOWN/USD', '—', '—');
  await assertReturns('ENTRY/USD', '—', '—');
  const venue = await assertReturns('VENUE/USD', '—', '—');
  assert.match(await venue.locator('[data-metric="price"]').innerText(), /0\.000420/);
  await assertReturns('ROI/USD', '—', '+3.50%');
  await metricPage.locator('.portfolio-strip').getByText('+$4,280.00', { exact: true }).waitFor();
  await metricPage.locator('.portfolio-strip').getByText('ROI +4.28%', { exact: true }).waitFor();
  await metricPage.getByRole('button', { name: 'ETH/USD — inspect fill', exact: true }).click();
  await metricPage.locator('.fill-return-summary').getByText('+10.25%', { exact: true }).waitFor();
  await metricPage.locator('.details-content summary').filter({ hasText: /^Fill details$/ }).click();
  assert.match(await metricPage.locator('.details-content').innerText(), /Commission \(reported\)/);
  await metricPage.getByRole('button', { name: 'Browse fill history' }).click();
  await metricPage.locator('.fills-table').nth(1).getByText('+10.25%', { exact: true }).waitFor();
  await metricPage.screenshot({ path: `${artifacts}/metrics.png`, fullPage: true });
  await metricPage.close();
  console.log('PASS fill metric parity: gains, losses, zero, null, entries, venue fills, tiny prices, legacy commission, portfolio P&L and history');

  const reader = await scenario('full', 'reader');
  assert.equal(await reader.page.getByRole('button', { name: 'Halt trading', exact: true }).count(), 0);
  assert.equal(await reader.page.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
  await reader.page.locator('summary').filter({ hasText: 'Engine settings' }).click();
  const riskLimits = reader.page.getByRole('definition');
  assert.ok(await riskLimits.count() >= 3);
  await reader.page.getByText('10.0%', { exact: true }).waitFor();
  await reader.page.getByText('5.0%', { exact: true }).waitFor();
  await reader.page.close();
  const real = await scenario('full', 'admin', '/live/real');
  await real.page.getByText('Real money', { exact: true }).last().waitFor();
  assert.equal(await real.page.locator('.performance-canvas').count(), 1);
  await real.page.close();
  const mismatch = await scenario('mismatch', 'admin', '/live/real');
  await mismatch.page.getByRole('alert').filter({ hasText: 'Wrong book' }).waitFor();
  assert.equal(await mismatch.page.locator('.performance-canvas').count(), 0);
  await mismatch.page.close();
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('PASS reader controls, real-money route, book isolation; no browser runtime errors');
} finally { await browser.close(); }
