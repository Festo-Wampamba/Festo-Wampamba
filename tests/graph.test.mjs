import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { dateRange, fetchDays, normalizeDays, renderGraph } from '../scripts/graph.mjs';
import { calendarStats } from '../scripts/calendar.mjs';

const now = new Date('2026-10-29T20:00:00Z');
const days = Array.from({ length: 59 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10),
  contributionCount: index === 0 ? 4 : index === 58 ? 7 : 0,
}));

test('two calendar months handle UTC, leap years, and year boundaries correctly', () => {
  assert.deepEqual(dateRange(now), { from: '2026-09-01T00:00:00.000Z', to: now.toISOString() });
  assert.equal(dateRange(new Date('2024-03-01T01:00:00Z')).from, '2024-02-01T00:00:00.000Z');
  assert.deepEqual(normalizeDays([...days].reverse(), now), days);
});

test('SVG reports independent totals and valid coordinates, including all-zero data', () => {
  const svg = renderGraph(days, now);
  assert.match(svg, /11 contributions across 2 active days; best day 7/);
  assert.match(svg, /2026-09-01: 4 contributions/);
  assert.match(svg, /2026-10-29: 7 contributions/);
  assert.equal((svg.match(/class="day"/g) ?? []).length, 59);
  assert.equal((svg.match(/class="month"/g) ?? []).length, 2);
  assert.match(svg, /Every calendar cell shows its date/);
  for (const day of days) {
    assert.ok(svg.includes(`data-date="${day.date}" data-count="${day.contributionCount}"`));
  }
  const empty = renderGraph(days.map((day) => ({ ...day, contributionCount: 0 })), now);
  assert.match(empty, /0 contributions across 0 active days/);
  assert.doesNotMatch(empty, /NaN|Infinity|<script|https?:\/\/(?!www.w3.org)/);
});

test('streak metrics count consecutive active days within the visible window', () => {
  const fixture = [0, 1, 3, 0, 4, 5, 1, 0].map((count, index) => ({ date: `2026-10-${index + 10}`, contributionCount: count }));
  assert.deepEqual(calendarStats(fixture), { total: 14, active: 5, peak: 5, longest: 3 });
});

test('only the current and previous month are rendered, with totals for those dates', () => {
  const end = new Date('2026-11-28T12:00:00Z');
  const start = Date.parse(dateRange(end).from);
  assert.equal(dateRange(end).from, '2026-10-01T00:00:00.000Z');
  const input = Array.from({ length: 59 }, (_, index) => ({ date: new Date(start + index * 86400000).toISOString().slice(0, 10), contributionCount: 1 }));
  const svg = renderGraph(input, end);
  assert.equal((svg.match(/class="month"/g) ?? []).length, 2);
  assert.equal((svg.match(/class="day"/g) ?? []).length, 59);
  assert.match(svg, /viewBox="0 0 1200 724"/);
  assert.match(svg, /59 contributions across 59 active days/);
  assert.doesNotMatch(svg, /data-month="2026-09"/);
  assert.equal(dateRange(new Date('2026-01-31T12:00:00Z')).from, '2025-12-01T00:00:00.000Z');
});

test('partial, duplicate, negative, and fractional data cannot replace a graph', () => {
  assert.throws(() => normalizeDays(days.slice(1), now), /Incomplete/);
  for (const bad of [{ ...days[0], date: days[1].date }, { ...days[0], contributionCount: -1 }, { ...days[0], contributionCount: 0.5 }]) {
    assert.throws(() => normalizeDays([bad, ...days.slice(1)], now), /Invalid/);
  }
});

test('GitHub query uses a bounded range, credentials stay in the header, and API failures are rejected', async () => {
  const token = 'test-secret';
  const result = await fetchDays({ token, now, fetcher: async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    const body = JSON.parse(options.body);
    assert.equal(body.variables.login, 'Festo-Wampamba');
    assert.equal(body.variables.from, '2026-09-01T00:00:00.000Z');
    assert.ok(!options.body.includes(token));
    return { ok: true, json: async () => ({ data: { user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: days }] } } } } }) };
  } });
  assert.deepEqual(result, days);
  await assert.rejects(fetchDays({ token: '', now }), /Set GH_TOKEN/);
  await assert.rejects(fetchDays({ token, now, fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  await assert.rejects(fetchDays({ token, now, fetcher: async () => ({ ok: true, json: async () => ({ errors: [{ message: token }] }) }) }), (error) => !error.message.includes(token));
  await assert.rejects(fetchDays({ token, now, fetcher: async () => ({ ok: true, json: async () => ({ data: { user: null } }) }) }), /no contribution calendar/);
});

test('failed CLI refresh preserves the previous SVG; deployment build works without credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'festo-graph-test-'));
  try {
    await Promise.all(['scripts', 'assets', 'graph', 'quotes'].map((directory) => mkdir(join(root, directory))));
    await mkdir(join(root, 'arcade/pacman'), { recursive: true });
    const pacmanFiles = ['index.html', 'app.js', 'style.css', 'theme.css', 'pacman-dark.svg', 'pacman-light.svg'];
    for (const file of pacmanFiles) await copyFile(new URL(`../arcade/pacman/${file}`, import.meta.url), join(root, 'arcade/pacman', file));
    for (const file of ['scripts/graph.mjs', 'scripts/calendar.mjs', 'scripts/palette.mjs', 'scripts/generate-graph.mjs', 'scripts/build.mjs', 'graph/index.html', 'graph/app.js', 'graph/styles.css', 'graph/theme.js', 'scripts/stats-render.mjs', 'graph/stats.html', 'graph/stats.css', 'graph/stats.js', 'assets/profile-stats.json', 'quotes/index.html', 'quotes/styles.css', 'quotes/app.js']) {
      await copyFile(new URL(`../${file}`, import.meta.url), join(root, file));
    }
    const svg = renderGraph(days, now);
    await writeFile(join(root, 'assets/contribution-graph.svg'), svg);
    const env = { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '' };
    const failed = spawnSync(process.execPath, ['scripts/generate-graph.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.equal(await readFile(join(root, 'assets/contribution-graph.svg'), 'utf8'), svg);
    const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    assert.deepEqual((await readdir(join(root, 'dist'))).sort(), ['app.js', 'contribution-graph.svg', 'contribution-graph-light.svg', 'contribution-graph-dark.svg', 'index.html', 'styles.css', 'theme.css', 'theme.js', 'profile-stats.svg', 'profile-stats-light.svg', 'profile-stats-dark.svg', 'profile-stats.json', 'stats', 'stats.css', 'stats.js', 'pacman', 'quotes'].sort());
    for (const file of pacmanFiles) assert.equal(await readFile(join(root, 'dist/pacman', file), 'utf8'), await readFile(new URL(`../arcade/pacman/${file}`, import.meta.url), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/contribution-graph.svg'), 'utf8'), svg);
    const page = await readFile(join(root, 'dist/index.html'), 'utf8');
    assert.ok(page.includes(svg));
    assert.ok(!page.includes('<!-- GENERATED_GRAPH -->'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
