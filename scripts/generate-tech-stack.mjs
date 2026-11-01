import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { escape, replaceBlock } from './profile-card-ui.mjs';

const root = new URL('../', import.meta.url), output = new URL('assets/tech/', root);
const catalog = JSON.parse(await readFile(new URL('catalog.json', output), 'utf8'));
await mkdir(output, { recursive: true });
const groups = new Map();
for (const badge of catalog) {
  if (!/^[a-z0-9-]+$/.test(badge.id) || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(badge.originalColor) || !Number.isSafeInteger(badge.width) || badge.width < 32 || /<(?:script|foreignObject|image|use)\b|\bhref\s*=|\bon\w+\s*=/i.test(badge.svg)) throw new Error('Invalid saved tech badge.');
  const width = badge.width + (badge.replacementIcon ? 24 : 0);
  // Preserve the original outlined labels and working logos; only replace the frame.
  let artwork = badge.svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/^<path\b[^>]*\/>/, '');
  if (badge.replacementIcon) {
    if (!/^<svg\b/.test(badge.replacementIcon) || /<(?:script|foreignObject|image|use)\b|\bhref\s*=|\bon\w+\s*=/i.test(badge.replacementIcon)) throw new Error('Invalid replacement tech logo.');
    artwork = badge.replacementIcon + `<g transform="translate(24 0)">${artwork}</g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="36" viewBox="0 0 ${width} 36" role="img" aria-labelledby="title"><title id="title">${escape(badge.label)}</title><rect x=".5" y=".5" width="${width - 1}" height="35" rx="10" fill="${badge.originalColor}" stroke="#fff" stroke-opacity=".12"/><g transform="translate(0 2)">${artwork}</g></svg>\n`;
  await writeFile(new URL(badge.id + '.svg', output), svg);
  if (!groups.has(badge.group)) groups.set(badge.group, []);
  groups.get(badge.group).push(`<img src="./assets/tech/${badge.id}.svg?v=rounded-v1" alt="${escape(badge.label)}" width="${width}" height="36" />`);
}
const content = `## 💻 Tech Stacks\n\n${[...groups].map(([name, badges]) => `#### ${name}\n\n<div>\n<p>${badges.join(' ')}</p>\n</div>`).join('\n\n')}`;
const path = new URL('README.md', root), readme = await readFile(path, 'utf8');
const start = '<!-- PROFILE-TECH:START -->', end = '<!-- PROFILE-TECH:END -->';
let next;
if (readme.includes(start)) next = replaceBlock(readme, start, end, content);
else {
  const from = readme.indexOf('## 💻 Tech Stacks'), to = readme.indexOf('### 📦 Top Repositories', from);
  if (from < 0 || to < 0) throw new Error('Original tech stack section not found.');
  next = readme.slice(0, from) + start + '\n' + content + '\n' + end + '\n\n' + readme.slice(to);
}
await writeFile(path, next);
console.log(`Generated ${catalog.length} rounded local tech badges with their original colors and logos.`);
