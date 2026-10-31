import snapshot from '../assets/quote-state.json' with { type: 'json' };
import { resolveQuote, validateState, renderQuoteSvg } from '../quotes/engine.mjs';
let latest = snapshot, expires = 0, pending;
export async function loadState(fetcher = fetch, now = Date.now()) {
  if (now < expires) return latest;
  if (!pending) pending = (async () => {
    try {
      const response = await fetcher('https://raw.githubusercontent.com/Festo-Wampamba/Festo-Wampamba/main/assets/quote-state.json', { signal: AbortSignal.timeout(4000), headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error('Snapshot unavailable');
      const body = await response.text(); if (body.length > 512000) throw new Error('Snapshot too large');
      const state = validateState(JSON.parse(body));
      if (Date.parse(state.updatedAt) >= Date.parse(latest.updatedAt)) latest = state;
    } catch { /* The timed reserve works even when GitHub or the writer is unavailable. */ }
    expires = now + 30000; return latest;
  })().finally(() => { pending = null; });
  return pending;
}
export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); return response.status(405).end(); }
  const url = new URL(request.url, 'https://festo-contribution-journal.vercel.app');
  const quote = resolveQuote(await loadState());
  const ttl = Math.max(0, Math.min(60, Math.floor((Date.parse(quote.nextChangeAt) - Date.now()) / 1000)));
  response.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttl}, must-revalidate`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Quote-Slot', String(quote.slot));
  const svg = url.searchParams.get('format') === 'svg';
  response.setHeader('Content-Type', svg ? 'image/svg+xml; charset=utf-8' : 'application/json; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  response.status(200);
  if (request.method === 'HEAD') return response.end();
  response.send(svg ? renderQuoteSvg(quote, url.searchParams.get('theme')) : JSON.stringify(quote));
}
