import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchDays, renderGraph } from './graph.mjs';
import { themedSvg } from './palette.mjs';

const destination = new URL('../assets/contribution-graph.svg', import.meta.url);
const temporary = new URL('../assets/.contribution-graph.svg.tmp', import.meta.url);
try {
  const now = new Date();
  const days = await fetchDays({ token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN, now });
  const svg = renderGraph(days, now);
  await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
  await writeFile(temporary, svg);
  await rename(temporary, destination);
  for (const theme of ['light', 'dark']) {
    await writeFile(temporary, themedSvg(svg, theme));
    await rename(temporary, new URL(`../assets/contribution-graph-${theme}.svg`, import.meta.url));
  }
  console.log(`Saved ${fileURLToPath(destination)} (${days.length} days).`);
} catch (error) {
  await rm(temporary, { force: true });
  console.error(`Graph refresh failed: ${error.message}`);
  process.exitCode = 1;
}
