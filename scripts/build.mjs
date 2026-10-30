import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { themeCss, themedSvg } from './palette.mjs';
import { escape, renderStatsHtml, renderStatsSvg } from './stats-render.mjs';

const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../assets/contribution-graph.svg', import.meta.url), new URL('contribution-graph.svg', output));
const svg = await readFile(new URL('../assets/contribution-graph.svg', import.meta.url), 'utf8');
const template = await readFile(new URL('../graph/index.html', import.meta.url), 'utf8');
await writeFile(new URL('index.html', output), template.replace('<!-- GENERATED_GRAPH -->', svg));
for (const file of ['app.js', 'styles.css', 'theme.js']) {
  await copyFile(new URL(`../graph/${file}`, import.meta.url), new URL(file, output));
}
await writeFile(new URL('theme.css', output), themeCss(':root', ':root[data-theme="light"]', ':root[data-theme="dark"]'));
for (const theme of ['light', 'dark']) {
  await writeFile(new URL(`contribution-graph-${theme}.svg`, output), themedSvg(svg, theme));
}
const snapshot = JSON.parse(await readFile(new URL('../assets/profile-stats.json', import.meta.url), 'utf8'));
const statsSvg = renderStatsSvg(snapshot);
await writeFile(new URL('profile-stats.svg', output), statsSvg);
await copyFile(new URL('../assets/profile-stats.json', import.meta.url), new URL('profile-stats.json', output));
for (const theme of ['light', 'dark']) await writeFile(new URL(`profile-stats-${theme}.svg`, output), themedSvg(statsSvg, theme));
for (const file of ['stats.css', 'stats.js']) await copyFile(new URL(`../graph/${file}`, import.meta.url), new URL(file, output));
await mkdir(new URL('stats/', output), { recursive: true });
const statsTemplate = await readFile(new URL('../graph/stats.html', import.meta.url), 'utf8');
const updated = new Date(snapshot.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
await writeFile(new URL('stats/index.html', output), statsTemplate.replace('<!-- PROFILE_STATS -->', renderStatsHtml(snapshot)).replace('<!-- STATS_UPDATED -->', `Updated ${escape(updated)} UTC`));
console.log('Built dist/ using the saved graph; no API request or token needed.');
