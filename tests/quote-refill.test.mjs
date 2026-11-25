import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERVAL, MAX_PENDING, fingerprint, importBatch, reserve, rotate } from '../quotes/engine.mjs';
import {
  MIN_FUTURE_PENDING,
  collectUniqueCandidates,
  countFuturePending,
  refillWithGemini,
  requestGeminiQuotes,
  sanitizeCandidate,
} from '../scripts/refill-quotes-gemini.mjs';

const empty = () => ({
  version: 1,
  intervalMs: INTERVAL,
  updatedAt: '2026-10-31T00:00:00.000Z',
  lastRefillAt: null,
  current: null,
  pending: [],
  recent: [],
  used: [],
});

const makeUniqueQuotes = (count, prefix = 'Original reflection number') =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}: steady attention turns one honest hour into lasting craft.`);

test('countFuturePending counts only pending entries strictly after nowSlot', () => {
  const start = new Date('2026-11-25T10:00:00.000Z');
  let state = importBatch(empty(), makeUniqueQuotes(10), start).state;
  state = rotate(state, start).state;
  assert.equal(countFuturePending(state, start), 9);
  assert.equal(countFuturePending(state, new Date('2026-11-25T13:00:00.000Z')), 6);
  assert.equal(countFuturePending(state, new Date('2026-11-26T00:00:00.000Z')), 0);
});

test('sanitizeCandidate strips surrounding quotes and rejects attributions, markup, and invalid lengths', () => {
  assert.equal(
    sanitizeCandidate('  "Build one clear habit today and let tomorrow benefit from it."  '),
    'Build one clear habit today and let tomorrow benefit from it.'
  );
  assert.equal(sanitizeCandidate('Too short.'), null);
  assert.equal(sanitizeCandidate('A thoughtful sentence that ends with an attribution — Seneca'), null);
  assert.equal(sanitizeCandidate('A reflection with a link https://example.com should never pass validation.'), null);
  assert.equal(sanitizeCandidate('<b>A reflection with markup tags should always be rejected safely.</b>'), null);
});

test('refillWithGemini skips API call when Antigravity or prior refill left enough runway', async () => {
  const now = new Date('2026-11-25T10:00:00.000Z');
  let state = importBatch(empty(), makeUniqueQuotes(MIN_FUTURE_PENDING + 5), now).state;
  state = rotate(state, now).state;
  let called = false;
  const result = await refillWithGemini({
    state,
    apiKey: 'secret-test-key',
    now,
    fetcher: async () => {
      called = true;
      throw new Error('Should not be called');
    },
  });
  assert.equal(called, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'sufficient');
  assert.equal(result.added, 0);
});

test('refillWithGemini sends key in header only, filters duplicates/reserve, shuffles, and caps at MAX_PENDING', async () => {
  const now = new Date('2026-11-25T10:00:00.000Z');
  let state = importBatch(empty(), makeUniqueQuotes(10, 'Existing queue item'), now).state;
  state = rotate(state, now).state;
  const existingText = state.pending[0].text;
  let seenUrl = '';
  let seenHeader = '';
  let calls = 0;

  const result = await refillWithGemini({
    state,
    apiKey: 'test-gemini-secret-123',
    minFuture: 20,
    targetBatch: 30,
    now,
    fetcher: async (url, init) => {
      calls++;
      seenUrl = url;
      seenHeader = init.headers['x-goog-api-key'];
      const batch = [
        existingText, // duplicate of pending
        reserve[0].text, // duplicate of reserve
        'Short', // too short
        'A quote with attribution — Famous Author', // attribution rejected
        ...makeUniqueQuotes(25, `Fresh Gemini chunk ${calls}`),
      ];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(batch) }] } }],
        }),
      };
    },
  });

  assert.equal(result.skipped, false);
  assert.equal(result.added, 30);
  assert.equal(result.futurePendingAfter, 39);
  assert.ok(result.state.pending.length <= MAX_PENDING);
  assert.equal(seenHeader, 'test-gemini-secret-123');
  assert.doesNotMatch(seenUrl, /test-gemini-secret-123|key=/);
  assert.ok(calls >= 2);
});

test('requestGeminiQuotes retries transient 429/503 errors and never leaks the API key', async () => {
  const secret = 'AIza-super-secret-value';
  let attempts = 0;
  const recovered = await requestGeminiQuotes({
    apiKey: secret,
    retryDelaysMs: [1, 1],
    fetcher: async () => {
      attempts++;
      if (attempts === 1) return { ok: false, status: 503 };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(['Steady habits make difficult goals easier to approach every single week.']) }] } }],
        }),
      };
    },
  });
  assert.equal(attempts, 2);
  assert.equal(recovered.length, 1);

  await assert.rejects(
    () =>
      requestGeminiQuotes({
        apiKey: secret,
        retryDelaysMs: [1],
        fetcher: async () => ({ ok: false, status: 429 }),
      }),
    error => {
      assert.match(error.message, /HTTP 429/);
      assert.ok(!error.message.includes(secret));
      return true;
    }
  );
});

test('collectUniqueCandidates deduplicates normalized variants and reserve entries', () => {
  const blocked = new Set([fingerprint('A quiet hour of focus can solve what rushing only tangles.')]);
  const out = collectUniqueCandidates({
    rawItems: [
      'A QUIET HOUR OF FOCUS CAN SOLVE WHAT RUSHING ONLY TANGLES!',
      reserve[5].text,
      'Practice makes steady progress visible even on days that feel ordinary.',
      'Practice makes steady progress visible, even on days that feel ordinary!',
    ],
    blockedFingerprints: blocked,
    limit: 10,
  });
  assert.equal(out.length, 1);
});
