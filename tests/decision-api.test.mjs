import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/services/api.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('liquidation preserves typed confirmation and explicit lot selection; acceptance is only queued', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ queued: 'liquidate', session_id: 'live/real', by: 'operator@example.com' });
  };
  const result = await api.liquidateEngine('live/real', { confirm: 'live/real', position_ids: [7, 8] });
  assert.equal(requests[0].url, '/api/engine/live%2Freal/liquidate');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { confirm: 'live/real', position_ids: [7, 8] });
  assert.equal(result.queued, 'liquidate');
  await api.liquidateEngine('live-paper', { confirm: 'live-paper' });
  assert.deepEqual(JSON.parse(requests[1].options.body), { confirm: 'live-paper' });
});

test('engine detail keeps tradeable and held quantities separate without altering totals', async () => {
  const detail = { portfolio_value: 1000, open_positions_count: 1, open_positions: [{ symbol: 'SOLUSD', quantity: 2 }], held_positions: [{ symbol: 'SOLUSD', reason: 'staked', quantity: 3, current_price: 100, value: 300, position_ids: [7] }] };
  capture(detail);
  assert.deepEqual(await api.getEngineDetail('live-real'), detail);
});

function capture(payload = {}) {
  const urls = [];
  globalThis.fetch = async url => { urls.push(new URL(url, 'http://localhost')); return Response.json(payload); };
  return urls;
}

test('declined decisions preserve false and encode session and filters', async () => {
  const urls = capture({ decisions: [], total_matching: 0 });
  const result = await api.getDecisions({ kind: 'session', sessionId: 'paper/a' }, { executed: false, symbol: 'BTC/USDT', action: 'buy', offset: 0, limit: 50 });
  assert.equal(urls[0].pathname, '/api/oracle/paper%2Fa/decisions');
  assert.equal(urls[0].searchParams.get('executed'), 'false');
  assert.equal(urls[0].searchParams.get('symbol'), 'BTC/USDT');
  assert.equal(urls[0].searchParams.get('offset'), '0');
  assert.deepEqual(result.decisions, []);
});

test('run decision links use backtest endpoints and escape identities', async () => {
  const urls = capture();
  await api.getDecision({ kind: 'run', runId: 'run/a' }, 'decision/#1');
  assert.equal(urls[0].pathname, '/api/backtests/run%2Fa/decisions/decision%2F%231');
});

test('fill history uses a stable cursor and preserves date and source filters', async () => {
  const urls = capture();
  await api.getEngineFills('live-real', { before_id: 17, limit: 50, source: 'exchange', side: 'SELL', since: '2026-09-01T00:00:00Z' });
  assert.equal(urls[0].searchParams.get('before_id'), '17');
  assert.equal(urls[0].searchParams.has('offset'), false);
  assert.equal(urls[0].searchParams.get('since'), '2026-09-01T00:00:00Z');
  assert.equal(urls[0].searchParams.get('source'), 'exchange');
});

test('curves preserve missing measurements instead of synthesizing values', async () => {
  capture({ equity: [], btc: [], anchor: null, notes: ['No priced snapshot'] });
  const curves = await api.getEvaluationCurves('live-paper', { windowDays: 30 });
  assert.equal(curves.anchor, null);
  assert.deepEqual(curves.btc, []);
  assert.deepEqual(curves.notes, ['No priced snapshot']);
});

test('benchmark failures retain the backend reason', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Benchmark venue unreachable' }, { status: 502 });
  await assert.rejects(api.getEvaluationCurves('live-real'), /502.*Benchmark venue unreachable/);
});

test('optional monitor resources tolerate an older backend', async () => {
  for (const status of [404, 501, 204]) {
    globalThis.fetch = async () => new Response(null, { status });
    assert.equal(await api.getEngineTelemetry('live-real'), null);
    assert.equal(await api.getEngineEvents('live-real'), null);
    assert.equal(await api.getOrderExecution('live-real', 'order-1'), null);
  }
  capture(null);
  assert.equal(await api.getEngineTelemetry('live-real'), null);
});

test('optional monitor reads retain auth and operational failures', async () => {
  for (const status of [401, 403, 500, 503]) {
    globalThis.fetch = async () => Response.json({ detail: 'Cannot read state' }, { status });
    await assert.rejects(api.getEngineTelemetry('live-real'), error => error.status === status && error.message.includes('Cannot read state'));
  }
});

test('event filters, cursor and order identities are encoded without changing scope', async () => {
  const urls = capture();
  await api.getEngineEvents('live/real', { cursor: 'cursor/a+b=', category: 'critic_degraded', severity: 'warning', active: true });
  await api.getOrderExecution('live/real', 'order/#1');
  assert.equal(urls[0].pathname, '/api/engine/live%2Freal/events');
  assert.equal(urls[0].searchParams.get('cursor'), 'cursor/a+b=');
  assert.equal(urls[0].searchParams.get('category'), 'critic_degraded');
  assert.equal(urls[0].searchParams.get('severity'), 'warning');
  assert.equal(urls[0].searchParams.get('active'), 'true');
  assert.equal(urls[1].pathname, '/api/engine/live%2Freal/orders/order%2F%231');
});

test('peer reads preserve the feature-gated routes and run identity', async () => {
  const urls = capture([]);
  await api.getPeers();
  await api.getPeer('freqtrade/ema');
  await api.getPeerField('bull-2023-10', 'run/a');
  assert.equal(urls[0].pathname, '/api/peers');
  assert.equal(urls[1].pathname, '/api/peers/freqtrade%2Fema');
  assert.equal(urls[2].pathname, '/api/peers/field/bull-2023-10');
  assert.equal(urls[2].searchParams.get('our_run_id'), 'run/a');
});
