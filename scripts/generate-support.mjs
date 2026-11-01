import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { palettes } from './palette.mjs';
import { escape, wrap, textLines, cardFrame, picture, replaceBlock } from './profile-card-ui.mjs';

const root = new URL('../', import.meta.url), output = new URL('assets/support/', root);
const logos = JSON.parse(await readFile(new URL('logos.json', output), 'utf8'));
const coffee = { id: 'coffee', title: 'Buy me a coffee', label: 'FUEL THE NEXT IDEA', body: 'Support my tutorials and projects.', action: 'Support the next tutorial', href: 'https://www.buymeacoffee.com/festoug', color: '#FFDD00' };
const star = { id: 'star', title: 'Show some love', label: 'SUPPORT OPEN SOURCE', body: 'Star a repository you find useful.', action: 'Explore my repositories', href: 'https://github.com/Festo-Wampamba?tab=repositories' };
const sponsors = [
  { id: 'paypal', title: 'PayPal', color: '#00457C', href: 'https://paypal.me/festo12' },
  { id: 'kofi', title: 'Ko-fi', color: '#F16061', href: 'https://ko-fi.com/festo' },
  { id: 'patreon', title: 'Patreon', color: '#F96854', href: 'https://patreon.com/SoftwareEngineer960' },
];
function featureCard(item, theme, compact) {
  const p = palettes[theme], width = compact ? 320 : 400, panel = compact ? 320 : 388, height = compact ? 184 : 164;
  const icon = item.id === 'coffee'
    ? `<rect x="22" y="19" width="42" height="45" rx="12" fill="${item.color}"/><g transform="translate(31 29)" fill="none" stroke="#272413" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16l-2 17H6zM3 4h18v4H3zM6 1h12l2 3M7 14h10"/></g>`
    : `<rect x="22" y="19" width="42" height="45" rx="12" fill="${p.accent}" fill-opacity=".14"/><path d="m43 27 3.7 7.5 8.3 1.2-6 5.8 1.4 8.2-7.4-3.9-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2z" fill="${p.accent}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 12}" viewBox="0 0 ${width} ${height + 12}" role="img" aria-labelledby="title description"><title id="title">${escape(item.title)}</title><desc id="description">${escape(item.body + ' ' + item.action)}</desc>${cardFrame(panel, height, theme)}${icon}${textLines([item.label], 80, 32, 10.5, p.accent, 600)}${textLines([item.title], 80, 59, 23, p.text, 600)}${textLines(wrap(item.body, panel - 44, 17, 2), 22, 101, 17, p.muted, 400, 25)}${textLines([item.action], 22, height - 22, 16, p.accent, 600)}<text x="${panel - 22}" y="${height - 21}" text-anchor="end" font-family="Arial,sans-serif" font-size="20" fill="${p.accent}">↗</text></svg>\n`;
}
function sponsorCard(item, theme) {
  const p = palettes[theme], width = 264, panel = 256, height = 154;
  const source = logos[item.id];
  if (typeof source !== 'string' || !source.startsWith('<svg ') || /<(?:script|foreignObject|image|use)\b|\bhref\s*=|\bon\w+\s*=/i.test(source)) throw new Error('Invalid saved sponsor logo.');
  const icon = source.replace(/<svg\b[^>]*>/, '<svg x="26" y="26" width="20" height="20" viewBox="0 0 24 24" fill="white">').replace(/<title>.*?<\/title>/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 12}" viewBox="0 0 ${width} ${height + 12}" role="img" aria-labelledby="title description"><title id="title">Support with ${escape(item.title)}</title><desc id="description">Support my projects with ${escape(item.title)}.</desc>${cardFrame(panel, height, theme)}<rect x="18" y="18" width="36" height="36" rx="10" fill="${item.color}"/>${icon}${textLines([item.title], 66, 43, 22, p.text, 600)}<path d="M18 74h220" stroke="${p.border}"/>${textLines(['Support my next project.'], 18, 101, 16, p.muted)}${textLines(['Support with ' + item.title], 18, 132, 15, p.accent, 600)}<text x="238" y="133" text-anchor="end" font-family="Arial,sans-serif" font-size="18" fill="${p.accent}">↗</text></svg>\n`;
}
await mkdir(output, { recursive: true });
for (const theme of ['light', 'dark']) for (const compact of [false, true]) {
  for (const item of [coffee, star]) await writeFile(new URL(`${item.id}-${theme}${compact ? '-compact' : ''}.svg`, output), featureCard(item, theme, compact));
  for (const item of sponsors) await writeFile(new URL(`${item.id}-${theme}${compact ? '-compact' : ''}.svg`, output), sponsorCard(item, theme));
}
const link = (item, width = 400) => `<a href="${item.href}">${picture('support', item.id, item.id === 'star' ? 'Show some love by starring my repositories' : item.id === 'coffee' ? 'Buy me a coffee: support my tutorials and projects' : `Support my projects with ${item.title}`, 'glass-v1', width)}</a>`;
const coffeeBlock = `### ☕ Support my work\n\n<div>\n<p>${link(coffee)}</p>\n</div>`;
const sponsorBlock = `<div>\n<p>${link(star)}</p>\n</div>\n\n## 💰 Support me by sponsoring my projects\n\n<div>\n<p>${sponsors.map(item => link(item, 264)).join(' ')}</p>\n</div>`;
const path = new URL('README.md', root);
let readme = await readFile(path, 'utf8');
for (const [id, content, original] of [
  ['COFFEE', coffeeBlock, /<h3 align="left">Support:<\/h3>\s*<a href="https:\/\/www\.buymeacoffee\.com\/festoug"[^>]*>[\s\S]*?<\/a>/],
  ['SUPPORT', sponsorBlock, /(?:^###\s*\n\s*)?^\s*### Show some love by starring some repositories[\s\S]*?\[!\[Patreon\][^\n]*\n?$/m],
]) {
  const start = `<!-- PROFILE-${id}:START -->`, end = `<!-- PROFILE-${id}:END -->`;
  if (readme.includes(start)) readme = replaceBlock(readme, start, end, content);
  else {
    if (!original.test(readme)) throw new Error(`Original ${id.toLowerCase()} section not found.`);
    readme = readme.replace(original, start + '\n' + content + '\n' + end + '\n');
  }
}
await writeFile(path, readme);
console.log('Generated adaptive coffee, repository-star and sponsorship cards with existing destinations.');
