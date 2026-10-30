import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { fetchStats } from './stats-data.mjs';
import { renderStatsSvg } from './stats-render.mjs';
import { themedSvg } from './palette.mjs';

const pending = [];
try {
  const snapshot = await fetchStats({ token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
  const svg = renderStatsSvg(snapshot);
  const files = new Map([
    ['profile-stats.json', JSON.stringify(snapshot, null, 2) + '\n'],
    ['profile-stats.svg', svg],
    ['profile-stats-light.svg', themedSvg(svg, 'light')],
    ['profile-stats-dark.svg', themedSvg(svg, 'dark')],
  ]);
  await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
  for (const [name, body] of files) {
    const temporary = new URL(`../assets/.${name}.tmp`, import.meta.url);
    pending.push(temporary);
    await writeFile(temporary, body);
  }
  let index = 0;
  for (const name of files.keys()) await rename(pending[index++], new URL(`../assets/${name}`, import.meta.url));
  console.log(`Saved profile statistics (${snapshot.activity.contributions} annual contributions; ${snapshot.public.repositories} original public repositories).`);
} catch (error) {
  console.error(`Stats refresh failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all(pending.map((path) => rm(path, { force: true })));
}
