import { readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  MAX_PENDING,
  fingerprint,
  importBatch,
  normalizeState,
  reserve,
  sixMonthsAgo,
  slotAt,
  validateState,
  validateText,
} from '../quotes/engine.mjs';

export const MIN_FUTURE_PENDING = 120; // 5 days at 24 hourly slots/day
export const TARGET_BATCH = 168; // 7 days at 24 hourly slots/day
export const CHUNK_SIZE = 56;
export const DEFAULT_MODEL = 'gemini-2.5-flash';

const reserveFingerprints = new Set(reserve.map(quote => quote.fingerprint));
const AUTHOR_ATTRIBUTION = /\s*(?:—|–|--|\s-\s)\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s*$/;
const THEMES = [
  'steady discipline and repeatable daily habits',
  'curiosity, learning through practice, and honest feedback',
  'resilience through setbacks and calm recovery',
  'intentional rest, focus, and protecting attention',
  'courage to start imperfect work and practical progress',
  'craftsmanship, clarity, purpose, and helping others',
];

export function countFuturePending(state, now = new Date()) {
  const currentState = normalizeState(state);
  const nowSlot = slotAt(now);
  if (!currentState.current) return currentState.pending.length;
  let future = 0;
  for (let index = 0; index < currentState.pending.length; index++) {
    if (currentState.current.slot + index + 1 > nowSlot) future++;
  }
  return future;
}

export function sanitizeCandidate(raw) {
  if (typeof raw !== 'string') return null;
  let text = raw.trim().replace(/\s+/g, ' ');
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
    text = text.slice(1, -1).trim();
  }
  if (AUTHOR_ATTRIBUTION.test(text)) return null;
  try {
    return validateText(text);
  } catch {
    return null;
  }
}

export function collectUniqueCandidates({ rawItems, blockedFingerprints, limit }) {
  const accepted = [];
  if (!Array.isArray(rawItems)) return accepted;
  for (const item of rawItems) {
    if (accepted.length >= limit) break;
    const text = sanitizeCandidate(item);
    if (!text) continue;
    const key = fingerprint(text);
    if (reserveFingerprints.has(key) || blockedFingerprints.has(key)) continue;
    blockedFingerprints.add(key);
    accepted.push(text);
  }
  return accepted;
}

export function buildPrompt({ count, avoidExamples = [], chunkIndex = 0 }) {
  const focus = THEMES[chunkIndex % THEMES.length];
  const sampleBlock = avoidExamples.length
    ? `\nAvoid repeating or closely paraphrasing these recent reflections:\n${avoidExamples.slice(0, 12).map(line => `- ${line}`).join('\n')}`
    : '';
  return [
    `Write exactly ${count} original, modern, grounded motivational reflections as a JSON array of plain-text strings.`,
    `Lean toward ${focus}, while keeping variety across discipline, learning, resilience, rest, courage, curiosity, purpose, and practical progress.`,
    'Strict rules for every string:',
    '- Plain text only, 55 to 170 characters (must stay strictly within 35 to 230 characters).',
    '- No HTML, markdown, links, URLs, emojis, line breaks, quotes around the sentence, or author attributions.',
    '- No single word longer than 26 characters.',
    '- Original phrasing only: no famous quotes, no clichés, no guaranteed-success promises, no medical or financial advice.',
    '- Warm, clear, practical, human tone suitable for a software engineer and tech educator profile.',
    sampleBlock,
  ].join('\n');
}

export async function requestGeminiQuotes({
  apiKey,
  model = DEFAULT_MODEL,
  count = CHUNK_SIZE,
  avoidExamples = [],
  chunkIndex = 0,
  fetcher = fetch,
  timeoutMs = 45000,
}) {
  if (!apiKey) throw new Error('Missing Gemini API key.');
  const safeModel = String(model || DEFAULT_MODEL).replace(/^models\//, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(safeModel)) throw new Error('Invalid Gemini model identifier.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`;
  const response = await fetcher(url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt({ count, avoidExamples, chunkIndex }) }] }],
      generationConfig: {
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const rawText = payload?.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim();
  if (!rawText) throw new Error('Gemini API returned an empty response.');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini API response was not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini API response was not a JSON string array.');
  return parsed;
}

export async function refillWithGemini({
  state,
  apiKey,
  model = DEFAULT_MODEL,
  minFuture = MIN_FUTURE_PENDING,
  targetBatch = TARGET_BATCH,
  now = new Date(),
  fetcher = fetch,
  maxRequests = 5,
}) {
  validateState(state);
  const futurePending = countFuturePending(state, now);
  if (futurePending >= minFuture) {
    return { skipped: true, reason: 'sufficient', futurePending, state, added: 0 };
  }
  const availableSpace = MAX_PENDING - futurePending;
  const needed = Math.min(targetBatch, availableSpace);
  if (needed <= 0) {
    return { skipped: true, reason: 'full', futurePending, state, added: 0 };
  }
  if (!apiKey) {
    return { skipped: true, reason: 'missing_key', futurePending, state, added: 0 };
  }

  const cutoff = sixMonthsAgo(now);
  const blockedFingerprints = new Set([
    ...state.used.filter(entry => entry.at > cutoff).map(entry => entry.fingerprint),
    ...state.pending.map(entry => entry.fingerprint),
    ...(state.current ? [state.current.fingerprint] : []),
  ]);
  const avoidExamples = [
    ...(state.current ? [state.current.text] : []),
    ...state.recent.slice(-8).map(quote => quote.text),
    ...state.pending.slice(-4).map(quote => quote.text),
  ];

  const accepted = [];
  for (let attempt = 0; attempt < maxRequests && accepted.length < needed; attempt++) {
    const remaining = needed - accepted.length;
    const requestCount = Math.min(CHUNK_SIZE, Math.max(20, remaining + 8));
    const rawItems = await requestGeminiQuotes({
      apiKey,
      model,
      count: requestCount,
      avoidExamples: [...avoidExamples, ...accepted.slice(-8)],
      chunkIndex: attempt,
      fetcher,
    });
    const fresh = collectUniqueCandidates({
      rawItems,
      blockedFingerprints,
      limit: remaining,
    });
    accepted.push(...fresh);
  }

  if (accepted.length === 0) {
    throw new Error('Gemini API produced no valid unique reflections.');
  }

  const imported = importBatch(state, accepted, now);
  return {
    skipped: false,
    reason: 'refilled',
    futurePending,
    futurePendingAfter: countFuturePending(imported.state, now),
    state: imported.state,
    added: imported.added,
  };
}

async function main() {
  const allowMissingKey = process.argv.includes('--allow-missing-key');
  const root = new URL('../', import.meta.url);
  const statePath = new URL('assets/quote-state.json', root);
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const result = await refillWithGemini({
    state,
    apiKey: process.env.GEMINI_API_KEY?.trim(),
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  });

  if (result.skipped) {
    if (result.reason === 'missing_key') {
      const message = `GEMINI_API_KEY secret is not configured (only ${result.futurePending} future quotes left); skipping cloud AI refill while the 4,704-entry reserve remains active.`;
      if (allowMissingKey) {
        console.log(`::warning::${message}`);
        return;
      }
      throw new Error(message);
    }
    console.log(`Queue healthy (${result.futurePending} future quotes >= ${MIN_FUTURE_PENDING}); no cloud refill needed.`);
    return;
  }

  if (result.added > 0) {
    const tempPath = new URL('assets/.quote-state.tmp', root);
    await writeFile(tempPath, JSON.stringify(result.state, null, 2) + '\n');
    await rename(tempPath, statePath);
  }
  console.log(`Refilled ${result.added} AI reflections via Gemini (${result.futurePending} -> ${result.futurePendingAfter} future quotes).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
