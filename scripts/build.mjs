import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { themeCss, themedSvg } from './palette.mjs';

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
console.log('Built dist/ using the saved graph; no API request or token needed.');
