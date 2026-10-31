import { palettes } from './palette.mjs';

export const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const measure = (text, size) => [...text].reduce((sum, char) => sum + (char === ' ' ? .3 : /[ilI.,'!|]/.test(char) ? .3 : /[MW@#%&]/.test(char) ? .95 : /[mw]/.test(char) ? .82 : /[A-Z]/.test(char) ? .72 : .55) * size, 0);
export function wrap(text, width, size, max = 10) {
  const lines = []; let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size) > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  const result = lines.slice(0, max);
  if (lines.length > max) result[max - 1] += '…';
  return result.map(value => {
    if (measure(value, size) <= width) return value;
    let clipped = value.replace(/…$/, '');
    while (clipped && measure(clipped + '…', size) > width) clipped = clipped.slice(0, -1);
    return clipped + '…';
  });
}
export const textLines = (lines, x, y, size, fill, weight = 400, leading = size * 1.4) => `<text font-family="Arial,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" y="${y + i * leading}">${escape(line)}</tspan>`).join('')}</text>`;
export function cardFrame(width, height, theme) {
  const p = palettes[theme];
  return `<defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity="${theme === 'dark' ? '.10' : '.95'}"/><stop offset=".5" stop-color="#fff" stop-opacity=".015"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".055"/></linearGradient></defs><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="14" fill="${p.surface}"/><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="14" fill="url(#glass)" stroke="${p.border}"/>`;
}
export function picture(directory, id, alt, revision = '') {
  const src = (theme, compact = false) => `./assets/${directory}/${id}-${theme}${compact ? '-compact' : ''}.svg${revision ? '?v=' + revision : ''}`;
  return `<picture><source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${src('dark', true)}" /><source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="${src('light', true)}" /><source media="(prefers-color-scheme: dark)" srcset="${src('dark')}" /><source media="(prefers-color-scheme: light)" srcset="${src('light')}" /><img src="${src('dark')}" alt="${escape(alt)}" width="400" /></picture>`;
}
export function replaceBlock(readme, start, end, body) {
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) >= readme.indexOf(end)) throw new Error('Invalid README section markers.');
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + body + '\n' + readme.slice(readme.indexOf(end));
}
