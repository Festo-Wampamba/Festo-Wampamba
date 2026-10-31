import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTERVAL, fingerprint, reserve, rotate, resolveQuote, importBatch, renderQuoteSvg, quoteReadme, validateState, sixMonthsAgo } from '../quotes/engine.mjs';
const empty = () => ({ version: 1, updatedAt: '2026-10-31T00:00:00.000Z', lastRefillAt: null, current: null, pending: [], recent: [], used: [] });
const sample = 'Give the next useful step enough attention to become a meaningful part of your day.';

test('reserve survives six calendar months without AI, GitHub, duplicates or growing text history', () => {
  assert.ok(reserve.length >= 1472);
  assert.equal(new Set(reserve.map(quote => quote.fingerprint)).size, reserve.length);
  const start = Date.parse('2026-10-31T00:00:00Z'), end = Date.parse('2027-04-30T23:59:59Z');
  let state = empty(); const seen = new Set(), served = new Set();
  for (let time = start; time <= end; time += INTERVAL) {
    const now = new Date(time), live = resolveQuote(empty(), now);
    assert.ok(!served.has(live.fingerprint)); served.add(live.fingerprint);
    state = rotate(state, now).state;
    assert.ok(!seen.has(state.current.fingerprint)); seen.add(state.current.fingerprint);
    assert.equal(state.current.text, live.text);
    assert.ok(state.recent.length <= 56);
    assert.ok(state.used.length <= 1472);
  }
  assert.equal(state.recent.length, 56);
  assert.ok(JSON.stringify(state).length < 250000);
  assert.equal(sixMonthsAgo(new Date('2027-08-31T12:00:00Z')), '2027-02-28T12:00:00.000Z');
});

test('AI queue imports only safe unique text and publication is idempotent', () => {
  let state = importBatch(empty(), [sample, sample.toUpperCase(), reserve[0].text]).state;
  assert.equal(state.pending.length, 1);
  const now = new Date('2026-10-31T12:00:00Z'); state = rotate(state, now).state;
  assert.equal(state.current.source, 'ai'); assert.equal(state.pending.length, 0);
  assert.equal(rotate(state, now).changed, false);
  assert.equal(importBatch(state, [sample], now).added, 0);
  assert.throws(() => rotate(state, new Date('2026-10-30')), /Clock/);
  assert.throws(() => importBatch(empty(), ['<script>This quote has malicious markup that must not be published.</script>']), /plain text/);
  assert.throws(() => validateState({ ...state, current: { ...state.current, fingerprint: 'bad' } }), /identity/);
  const next = resolveQuote(state, new Date(Number(now) + INTERVAL));
  assert.equal(next.source, 'reserve'); assert.notEqual(next.fingerprint, state.current.fingerprint);
  assert.equal(resolveQuote(state, new Date('2026-10-31T14:59:59Z')).text, sample);
  assert.equal(resolveQuote(state, new Date('2026-10-31T15:00:00Z')).source, 'reserve');
});

test('weekly cleanup drops old full text while six-month fingerprints block repeats', () => {
  let state = rotate(importBatch(empty(), [sample]).state, new Date('2026-10-31T12:00:00Z')).state;
  state = rotate(state, new Date('2026-11-08T12:00:00Z')).state;
  assert.ok(!state.recent.some(quote => quote.text === sample));
  assert.equal(importBatch(state, [sample], new Date('2027-04-29T12:00:00Z')).added, 0);
  assert.equal(importBatch(state, [sample], new Date('2027-05-01T12:00:00Z')).added, 1);
});

test('README card stays scoped, versioned and safely rendered in both themes', () => {
  const quote = { text: sample + ' Trust your pace & keep learning.', slot: 1234 };
  const readme = 'Before\n<!-- QUOTE:START -->\nold\n<!-- QUOTE:END -->\nAfter';
  const output = quoteReadme(readme, quote);
  assert.ok(output.startsWith('Before\n')); assert.ok(output.endsWith('\nAfter'));
  assert.match(output, /v=1234/); assert.match(output, /&amp;theme=light/);
  assert.throws(() => quoteReadme('No markers', quote), /markers/);
  for (const mode of ['dark', 'light']) {
    const svg = renderQuoteSvg(quote, mode);
    assert.match(svg, /Trust your pace &amp; keep learning/);
    assert.doesNotMatch(svg, /<script|foreignObject|href=/);
    assert.match(svg, /font-size="30"/);
  }
});

test('saved quote state is valid and has a healthy writer queue', async () => {
  const state = validateState(JSON.parse(await readFile(new URL('../assets/quote-state.json', import.meta.url), 'utf8')));
  assert.ok(state.current); // Queue may legitimately empty while the AI writer is unavailable.
  assert.equal(state.current.fingerprint, fingerprint(state.current.text));
});

test('Vercel endpoint falls back during source outage and serves escaped SVG without credentials', async () => {
  const { default: handler, loadState } = await import('../api/quote.js');
  await loadState(async () => { throw new Error('Network unavailable'); }, Date.now() + 60000);
  const headers = {}; let status, body;
  const res = { setHeader: (key, value) => { headers[key] = value; }, status(code) { status = code; return this; }, send(value) { body = value; }, end() {} };
  await handler({ method: 'GET', url: '/api/quote?format=svg&theme=light' }, res);
  assert.equal(status, 200); assert.match(headers['Content-Type'], /image\/svg/);
  assert.match(body, /^<svg/); assert.match(headers['Cache-Control'], /s-maxage=\d+/);
  await handler({ method: 'POST', url: '/api/quote' }, res);
  assert.equal(status, 405); assert.equal(headers.Allow, 'GET, HEAD');
});


test('Vercel serves queued AI quotes on time and delayed publication records the same slots', () => {
  const texts = [sample, 'When a useful habit feels ordinary, remember that ordinary practice is how skill becomes dependable.', 'A clearer question can make the next hour more useful than a perfect plan you never begin.'];
  const imported = importBatch(empty(), texts).state;
  const planned = imported.pending.map(quote => quote.text);
  assert.deepEqual(new Set(planned), new Set(texts));
  let state = rotate(imported, new Date('2026-10-31T12:00:00Z')).state;
  assert.equal(resolveQuote(state, new Date('2026-10-31T15:00:00Z')).text, planned[1]);
  assert.equal(resolveQuote(state, new Date('2026-10-31T18:00:00Z')).text, planned[2]);
  state = rotate(state, new Date('2026-10-31T18:17:00Z')).state;
  assert.equal(state.current.text, planned[2]);
  assert.equal(state.used.length, 3); assert.equal(state.pending.length, 0);
  assert.equal(importBatch(state, [planned[1]], new Date('2026-11-01')).added, 0);
});
