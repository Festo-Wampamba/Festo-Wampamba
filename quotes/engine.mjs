import { createHash, randomInt } from 'node:crypto';
import { reserveTexts } from './reserve.mjs';
import { palettes } from '../scripts/palette.mjs';
export const INTERVAL = 3 * 60 * 60 * 1000;
export const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
export const fingerprint = text => createHash('sha256').update(normalize(text)).digest('hex');
export const reserve = reserveTexts.map(text => ({ text, fingerprint: fingerprint(text), source: 'reserve' })).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
const reserved = new Set(reserve.map(quote => quote.fingerprint));
export const slotAt = now => Math.floor(Number(new Date(now)) / INTERVAL);
export function sixMonthsAgo(now) {
  const date = new Date(now), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 6);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end)); return date.toISOString();
}
export function validateText(text) {
  if (typeof text !== 'string' || text.length < 35 || text.length > 230 || /[<>\r\n\x00-\x1f]|https?:\/\//i.test(text) || text.split(/\s+/).some(word => word.length > 26)) throw new Error('Quotes must be plain text, 35–230 characters, with no links, markup or oversized words.');
  return text.trim();
}
export function validateState(state) {
  if (state?.version !== 1 || !Array.isArray(state.pending) || state.pending.length > 112 || !Array.isArray(state.used) || state.used.length > 1600 || !Array.isArray(state.recent) || state.recent.length > 56) throw new Error('Invalid quote state.');
  for (const quote of [...state.pending, ...state.recent, ...(state.current ? [state.current] : [])]) {
    validateText(quote.text);
    if (quote.fingerprint !== fingerprint(quote.text) || !['ai', 'reserve'].includes(quote.source)) throw new Error('Invalid quote identity.');
    if (quote.source === 'ai' && reserved.has(quote.fingerprint)) throw new Error('AI quote duplicates the reserve.');
    if (quote.source === 'reserve' && !reserved.has(quote.fingerprint)) throw new Error('Unknown reserve quote.');
  }
  for (const entry of state.used) if (!/^[a-f0-9]{64}$/.test(entry.fingerprint) || !Number.isFinite(Date.parse(entry.at))) throw new Error('Invalid quote history.');
  if (state.current && (!Number.isSafeInteger(state.current.slot) || !Number.isFinite(Date.parse(state.current.at)))) throw new Error('Invalid current quote.');
  return state;
}
export function resolveQuote(state, now = new Date()) {
  const slot = slotAt(now);
  if (!Number.isSafeInteger(slot) || slot < 0) throw new Error('Invalid clock.');
  const offset = state.current ? slot - state.current.slot - 1 : -1;
  const quote = state.current?.slot === slot ? state.current : (offset >= 0 ? state.pending[offset] : null) ?? reserve[slot % reserve.length];
  return { text: quote.text, source: quote.source, fingerprint: quote.fingerprint, slot, startsAt: new Date(slot * INTERVAL).toISOString(), nextChangeAt: new Date((slot + 1) * INTERVAL).toISOString() };
}
export function rotate(state, now = new Date()) {
  validateState(state);
  const slot = slotAt(now), at = new Date(now).toISOString(), cutoff = sixMonthsAgo(now);
  if (state.current?.slot > slot) throw new Error('Clock is behind the saved publication.');
  if (state.current?.slot === slot) return { state, changed: false };
  const used = state.used.filter(entry => entry.at > cutoff);
  const seen = new Set(used.map(entry => entry.fingerprint));
  const previous = state.current?.slot ?? slot - 1;
  const elapsed = slot - previous, recent = [...state.recent];
  let current;
  // Account for slots served by Vercel even if the scheduled publisher was delayed.
  for (let cursor = Math.max(previous + 1, slot - 1500); cursor <= slot; cursor++) {
    const offset = cursor - previous - 1;
    const quote = state.pending[offset] ?? reserve[cursor % reserve.length];
    const publishedAt = cursor === slot ? at : new Date(cursor * INTERVAL).toISOString();
    if (publishedAt > cutoff) {
      if (seen.has(quote.fingerprint)) throw new Error('Refusing a repeated quote.');
      used.push({ fingerprint: quote.fingerprint, at: publishedAt }); seen.add(quote.fingerprint);
    }
    current = { ...quote, slot: cursor, at: publishedAt }; recent.push(current);
  }
  const next = { version: 1, updatedAt: at, lastRefillAt: state.lastRefillAt ?? null, current, pending: state.pending.slice(elapsed), recent: recent.filter(quote => Date.parse(quote.at) > Number(new Date(now)) - 7 * 86400000).slice(-56), used };
  return { state: validateState(next), changed: true };
}
export function importBatch(state, texts, now = new Date()) {
  validateState(state);
  if (state.current && state.current.slot < slotAt(now)) state = rotate(state, now).state;
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > 112) throw new Error('Supply an array of 1–112 original quotes.');
  const seen = new Set([...state.used.filter(entry => entry.at > sixMonthsAgo(now)), ...state.pending].map(entry => entry.fingerprint));
  const pending = [...state.pending], additions = []; let added = 0;
  for (const item of texts) {
    const text = validateText(item), key = fingerprint(text);
    if (reserved.has(key) || seen.has(key)) continue;
    if (pending.length + additions.length >= 112) throw new Error('Quote queue is full; publish some before refilling.');
    additions.push({ text, fingerprint: key, source: 'ai' }); seen.add(key); added++;
  }
  for (let index = additions.length - 1; index > 0; index--) { const pick = randomInt(index + 1); [additions[index], additions[pick]] = [additions[pick], additions[index]]; }
  pending.push(...additions);
  return { state: validateState({ ...state, pending, lastRefillAt: added ? new Date(now).toISOString() : state.lastRefillAt }), added };
}
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
export function renderQuoteSvg(quote, theme = 'dark') {
  const colors = palettes[theme] ?? palettes.dark;
  const lines = []; let line = '';
  for (const word of quote.text.split(/\s+/)) { if ((line + ' ' + word).trim().length > 49 && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); }
  if (line) lines.push(line);
  const height = Math.max(190, 110 + lines.length * 36);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}" role="img" aria-labelledby="title"><title id="title">${escape(quote.text)}</title><rect x="1" y="1" width="898" height="${height - 2}" rx="18" fill="${colors.surface}" stroke="${colors.border}"/><path d="M28 34v${height - 68}" stroke="${colors.accent}" stroke-width="3"/><text x="52" y="38" fill="${colors.accent}" font-family="system-ui,sans-serif" font-size="12" letter-spacing="2">A LITTLE MOMENTUM</text><text x="848" y="38" text-anchor="end" fill="${colors.muted}" font-family="system-ui,sans-serif" font-size="12">FESTO WAMPAMBA</text><text fill="${colors.text}" font-family="Georgia,serif" font-size="30">${lines.map((text, index) => `<tspan x="52" y="${87 + index * 36}">${escape(text)}</tspan>`).join('')}</text><text x="52" y="${height - 25}" fill="${colors.muted}" font-family="system-ui,sans-serif" font-size="12">A fresh perspective every three hours</text></svg>`;
}
export function quoteReadme(readme, quote) {
  const start = '<!-- QUOTE:START -->', end = '<!-- QUOTE:END -->';
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) throw new Error('Missing or duplicate README quote markers.');
  const base = 'https://festo-contribution-journal.vercel.app/api/quote';
  const src = theme => `${base}?format=svg&amp;theme=${theme}&amp;v=${quote.slot}`;
  const block = `<a href="https://festo-contribution-journal.vercel.app/quotes/"><picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${src('dark')}">\n  <source media="(prefers-color-scheme: light)" srcset="${src('light')}">\n  <img src="${src('dark')}" alt="${escape(quote.text)}" width="100%">\n</picture></a>`;
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + block + '\n' + readme.slice(readme.indexOf(end));
}
