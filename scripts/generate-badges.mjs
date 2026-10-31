import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fetchBadges, validateBadges, badgeDefinitions, renderBadge, updateBadgeReadme } from './badges.mjs';
const assets = new URL('../assets/', import.meta.url), pending = [];
try {
  const data = process.argv.includes('--saved') ? validateBadges(JSON.parse(await readFile(new URL('profile-badges.json', assets), 'utf8'))) : await fetchBadges({ token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN, youtubeKey: process.env.YOUTUBE_API_KEY });
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const nextReadme = updateBadgeReadme(readme, data);
  await mkdir(new URL('badges/', assets), { recursive: true });
  const files = new Map([['profile-badges.json', JSON.stringify(data, null, 2) + '\n']]);
  for (const badge of badgeDefinitions(data)) for (const theme of ['light', 'dark']) files.set(`badges/${badge.id}-${theme}.svg`, renderBadge(badge, theme));
  if (readme !== nextReadme) files.set('../README.md', nextReadme);
  for (const [name, body] of files) { const temporary = new URL(name + `.${process.pid}.tmp`, assets); pending.push(temporary); await writeFile(temporary, body); }
  let index = 0; for (const name of files.keys()) await rename(pending[index++], new URL(name, assets));
  console.log(`Saved ${badgeDefinitions(data).length} profile badges from official statistics: ${data.github.publicRepos} public repositories, ${data.youtube.views.toLocaleString('en-US')} YouTube views.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await Promise.all(pending.map(path => rm(path, { force: true }))); }
