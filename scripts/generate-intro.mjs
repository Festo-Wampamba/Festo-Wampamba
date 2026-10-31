import { readFile, writeFile } from 'node:fs/promises';
import { palettes } from './palette.mjs';

const roles = ['Founder of Lupora Tech', 'System Administrator', 'Full-Stack Developer', 'Tech Educator'];
const bio = 'Festo Wampamba is a Systems Engineer and the founder of Lupora Tech, a startup dedicated to engineering ground-up solutions for the African tech ecosystem. While a seasoned Full-Stack Developer, his core expertise lies in Systems Administration and Networking, ensuring that the innovations built at Lupora Tech are backed by robust, high-performance infrastructure';
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const measure = (text, size) => [...text].reduce((sum, char) => sum + (char === ' ' ? .32 : /[ilI.,'!|]/.test(char) ? .3 : /[MW@#%&]/.test(char) ? .95 : /[mw]/.test(char) ? .82 : /[A-Z]/.test(char) ? .72 : .56) * size, 0);
function wrap(text, width, size) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) { const next = line ? `${line} ${word}` : word; if (line && measure(next, size) > width) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); return lines;
}
function render(theme, compact) {
  const p = palettes[theme], width = compact ? 480 : 900, font = compact ? 26 : 21, lineHeight = compact ? 38 : 32;
  const bodyY = compact ? 214 : 96, lines = wrap(bio, width - 4, font), height = bodyY + (lines.length - 1) * lineHeight + 14;
  const widths = compact ? [232, 232, 232, 232] : [240, 231, 225, 168];
  const labels = compact ? [['Founder of', 'Lupora Tech'], ['System', 'Administrator'], ['Full-Stack', 'Developer'], ['Tech', 'Educator']] : roles.map(role => [role]);
  let nextX = 0;
  const cards = roles.map((role, index) => {
    const x = compact ? (index % 2) * 248 : nextX, y = compact ? Math.floor(index / 2) * 94 : 0, w = widths[index], h = compact ? 78 : 54;
    nextX += w + 12;
    return `<g aria-label="${escape(role)}"><rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="12" fill="${p.surface}" fill-opacity=".86"/><rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="12" fill="url(#glass)" stroke="${p.border}"/><path d="M${x + 14} ${y + 1.5}h${w - 28}" stroke="#ffffff" stroke-opacity="${theme === 'dark' ? '.2' : '.95'}"/><text text-anchor="middle" fill="${p.text}" font-family="Arial,sans-serif" font-size="${compact ? 23 : 18.5}" font-weight="500">${labels[index].map((label, row) => `<tspan x="${x + w / 2}" y="${y + (compact ? 32 : 33) + row * 28}">${escape(label)}</tspan>`).join('')}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escape(roles.join(' · '))}</title><desc id="description">${escape(bio)}</desc><defs><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity="${theme === 'dark' ? '.13' : '.95'}"/><stop offset=".5" stop-color="#ffffff" stop-opacity="${theme === 'dark' ? '.025' : '.35'}"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".055"/></linearGradient></defs>${cards}<text x="0" fill="${p.text}" font-family="Arial,sans-serif" font-size="${font}" font-weight="400">${lines.map((line, index) => `<tspan x="0" y="${bodyY + index * lineHeight}">${escape(line)}</tspan>`).join('')}</text></svg>\n`;
}
const root = new URL('../', import.meta.url);
for (const theme of ['dark', 'light']) for (const compact of [false, true]) await writeFile(new URL(`assets/profile-intro-${theme}${compact ? '-compact' : ''}.svg`, root), render(theme, compact));
const block = `<div>\n<picture>\n  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/profile-intro-dark-compact.svg" />\n  <source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="./assets/profile-intro-light-compact.svg" />\n  <source media="(prefers-color-scheme: dark)" srcset="./assets/profile-intro-dark.svg" />\n  <source media="(prefers-color-scheme: light)" srcset="./assets/profile-intro-light.svg" />\n  <img src="./assets/profile-intro-dark.svg" alt="${escape(roles.join(' | ') + '. ' + bio)}" width="900" />\n</picture>\n</div>`;
const path = new URL('README.md', root), readme = await readFile(path, 'utf8');
const start = '<!-- PROFILE-INTRO:START -->', end = '<!-- PROFILE-INTRO:END -->';
let next;
if (readme.includes(start)) {
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2) throw new Error('Invalid intro markers.');
  next = readme.slice(0, readme.indexOf(start) + start.length) + '\n' + block + '\n' + readme.slice(readme.indexOf(end));
} else {
  const before = readme.indexOf('**`Founder of Lupora Tech'), after = readme.indexOf('<!-- PROFILE-BADGES:START -->', before);
  if (before < 0 || after < 0 || !readme.slice(before, after).includes(bio)) throw new Error('Original intro not found; no README change made.');
  next = readme.slice(0, before) + start + '\n' + block + '\n' + end + '\n\n' + readme.slice(after);
}
await writeFile(path, next);
console.log('Generated larger profile introduction with four glass-style role titles and responsive light/dark variants.');
