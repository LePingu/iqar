import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/services/api.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

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
