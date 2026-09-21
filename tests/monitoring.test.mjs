import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvePoints, ledgerCurve, alignedComparison, isStale, measurement, rows, fillReturns } from '../src/utils/monitoring.ts';
import { fmtPrice, formatMoney, formatPercentage, formatDate, formatTradePrice } from '../src/utils/trading.ts';

test('null metrics remain unavailable while measured zero remains zero', () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(fmtPrice(value), '—');
    assert.equal(formatMoney(value), '—');
    assert.equal(formatPercentage(value), '—');
    assert.equal(measurement(value), '—');
  }
  assert.equal(fmtPrice(0), '0.00');
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(formatPercentage(0), '+0.00%');
  assert.equal(formatDate(null), 'Not recorded');
  assert.deepEqual(rows(null), []);
  assert.deepEqual(rows([null, { id: 1 }]), [{ id: 1 }]);
});

test('curve conversion sorts, deduplicates and rejects missing measurements', () => {
  const result = curvePoints([
    null,
    { timestamp: '2026-09-21T01:00:00Z', index: 105 },
    { timestamp: 'bad date', index: 150 },
    { timestamp: '2026-09-21T02:00:00Z', index: null },
    { timestamp: '2026-09-21T00:00:00Z', index: 100 },
    { timestamp: '2026-09-21T01:00:00Z', index: 104 },
  ]);
  assert.deepEqual(result.map(p => p.value), [0, 4]);
  assert.ok(result[0].time < result[1].time);
  assert.deepEqual(curvePoints(null), []);
});

test('headline benchmark difference requires matching latest observations', () => {
  const book = [{ timestamp: '2026-09-21T01:00:00Z', index: 104 }];
  assert.equal(alignedComparison(book, [{ timestamp: '2026-09-20T01:00:00Z', index: 102 }]), null);
  assert.deepEqual(alignedComparison(book, [{ timestamp: book[0].timestamp, index: 102 }]), { benchmark: 2, difference: 2 });
});

test('ledger fallback respects the window and requires a positive measured anchor', () => {
  const now = Date.parse('2026-09-21T00:00:00Z');
  const t = now / 1000;
  assert.deepEqual(ledgerCurve([{ time: t - 10 * 86400, capital: 10 }, { time: t - 86400, capital: 100 }, { time: t, capital: 110 }], 7, now).map(p => Math.round(p.value)), [0, 10]);
  assert.deepEqual(ledgerCurve([{ time: t, capital: 0 }], 7, now), []);
  assert.deepEqual(ledgerCurve(null, 7, now), []);
});

test('freshness distinguishes unknown from stale and healthy', () => {
  const now = Date.parse('2026-09-21T00:01:00Z');
  assert.equal(isStale(null, now), null);
  assert.equal(isStale({ as_of: 'bad', stale_after_seconds: 30 }, now), null);
  assert.equal(isStale({ as_of: '2026-09-21T00:00:00Z', stale_after_seconds: 30 }, now), true);
  assert.equal(isStale({ as_of: '2026-09-21T00:00:45Z', stale_after_seconds: 30 }, now), false);
});


test('realized fill returns preserve gains, losses, zero, and independently missing values', () => {
  const sell = { side: 'SELL', source: 'engine', realized_pnl: 25, realized_pnl_pct: 4.25 };
  assert.deepEqual(fillReturns(sell), { pnl: 25, roi: 4.25 });
  assert.deepEqual(fillReturns({ ...sell, realized_pnl: -12, realized_pnl_pct: -2 }), { pnl: -12, roi: -2 });
  assert.deepEqual(fillReturns({ ...sell, realized_pnl: 0, realized_pnl_pct: 0 }), { pnl: 0, roi: 0 });
  assert.deepEqual(fillReturns({ ...sell, realized_pnl: null }), { pnl: null, roi: 4.25 });
  assert.deepEqual(fillReturns({ ...sell, realized_pnl_pct: null }), { pnl: 25, roi: null });
  assert.deepEqual(fillReturns({ ...sell, side: 'BUY' }), { pnl: null, roi: null });
  assert.deepEqual(fillReturns({ ...sell, source: 'exchange' }), { pnl: null, roi: null });
});

test('small trade prices retain their precision and explicit currency', () => {
  assert.equal(formatTradePrice(.00042, 'EUR'), '€0.000420');
  assert.equal(formatTradePrice(0, 'USD'), '$0.00');
  assert.equal(formatTradePrice(null, 'USD'), '—');
});
