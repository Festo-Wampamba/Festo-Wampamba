import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { accountHistory, calculateGrade, fetchStats, normalizeStats, statsRange, streakStats } from '../scripts/stats-data.mjs';
import { renderStatsHtml, renderStatsSvg, visibleLanguages } from '../scripts/stats-render.mjs';

const now = new Date('2026-10-30T12:00:00Z');
const from = Date.parse(statsRange(now).from);
const days = Array.from({ length: 365 }, (_, index) => ({ date: new Date(from + index * 86400000).toISOString().slice(0, 10), contributionCount: index === 0 ? 5 : index === 363 ? 2 : index === 364 ? 4 : 0 }));
const repository = (stars, languages) => ({ stargazerCount: stars, languages: { pageInfo: { hasNextPage: false }, edges: languages.map(([name, size, color]) => ({ size, node: { name, color } })) } });
const repos = [repository(2, [['TypeScript', 100, '#3178c6'], ['JavaScript', 100, '#f1e05a']]), repository(3, [['TypeScript', 100, '#3178c6']])];
const user = {
  createdAt: '2025-10-31T00:00:00Z', pullRequests: { totalCount: 21 }, issues: { totalCount: 8 }, repositoriesContributedTo: { totalCount: 4 },
  followers: { totalCount: 8 },
  contributionsCollection: { totalCommitContributions: 7, totalPullRequestContributions: 2, totalIssueContributions: 1, totalPullRequestReviewContributions: 1, contributionCalendar: { weeks: [{ contributionDays: days }] } },
};

test('profile snapshot aggregates real activity, original repository stars, and language bytes', () => {
  const snapshot = normalizeStats(user, repos, now);
  assert.equal(snapshot.period.from, '2025-10-31T00:00:00.000Z');
  assert.equal(snapshot.activity.contributions, 11);
  assert.equal(snapshot.activity.activeDays, 3);
  assert.deepEqual(snapshot.public, { repositories: 2, stars: 5, followers: 8 });
  assert.equal(snapshot.totalLanguageBytes, 300);
  assert.equal(snapshot.languages[0].share, 2 / 3);
  assert.deepEqual(snapshot.streak, { current: 2, longest: 2, through: '2026-10-30' });
  assert.equal(snapshot.recentWeeks.length, 13);
  assert.deepEqual(snapshot.recentWeeks.at(-1), { from: '2026-10-26', to: '2026-10-30', count: 6 });
  assert.equal(new Date(snapshot.recentWeeks[0].from).getUTCDay(), 1);
  assert.equal(new Date(snapshot.recentWeeks.at(-2).to).getUTCDay(), 0);
});
test('streak remains active through yesterday but ends after a missed full day', () => {
  const fixture = (values) => values.map((count, index) => ({ date: `2026-10-${20 + index}`, contributionCount: count }));
  assert.deepEqual(streakStats(fixture([1, 2, 0])), { current: 2, longest: 2, through: '2026-10-21' });
  assert.deepEqual(streakStats(fixture([1, 0, 0])), { current: 0, longest: 1, through: null });
  assert.deepEqual(streakStats(fixture([0, 0])), { current: 0, longest: 0, through: null });
});
test('partial calendars and language connections cannot become successful snapshots', () => {
  const broken = structuredClone(user);
  broken.contributionsCollection.contributionCalendar.weeks[0].contributionDays.pop();
  assert.throws(() => normalizeStats(broken, repos, now), /calendar/);
  const partialRepo = structuredClone(repos[0]);
  partialRepo.languages.pageInfo.hasNextPage = true;
  assert.throws(() => normalizeStats(user, [partialRepo], now), /Incomplete repository/);
});
test('snapshot fetch pages through original public repositories with credentials kept in headers', async () => {
  const cursors = [];
  const snapshot = await fetchStats({ token: 'not-a-real-token', now, fetcher: async (_, options) => {
    const body = JSON.parse(options.body);
    if (!body.query.includes('repositories(first:100')) return { ok: true, json: async () => ({ data: { user } }) };
    cursors.push(body.variables.cursor);
    assert.match(body.query, /privacy:PUBLIC/);
    assert.match(body.query, /isFork:false/);
    assert.ok(!options.body.includes('not-a-real-token'));
    const second = body.variables.cursor === 'page-two';
    return { ok: true, json: async () => ({ data: { user: { ...user, repositories: { nodes: [repos[second ? 1 : 0]], totalCount: 2, pageInfo: { hasNextPage: !second, endCursor: second ? null : 'page-two' } } } } }) };
  } });
  assert.deepEqual(cursors, [null, 'page-two']);
  assert.equal(snapshot.public.stars, 5);
  await assert.rejects(fetchStats({ token: '', now }), /Set GH_TOKEN/);
  await assert.rejects(fetchStats({ token: 'x', now, fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});
test('cards preserve data scope, escape language labels, and handle empty language data', () => {
  const snapshot = { ...normalizeStats(user, repos, now), account: { pullRequests: 21, issues: 8, contributedTo: 4 }, history: accountHistory(days, user.createdAt, now), grade: { level: 'B+', percentile: 48, achievedA: false } };
  snapshot.languages[0].name = '<Unsafe & name>';
  const svg = renderStatsSvg(snapshot);
  assert.match(svg, /last 365 days/);
  assert.match(svg, /&lt;Unsafe &amp; name&gt;/);
  assert.doesNotMatch(svg, /NaN|Infinity|<script|<Unsafe/);
  assert.match(renderStatsHtml(snapshot), /Total commits/);
  const achieved = { ...snapshot, grade: { level: 'A', percentile: 25, achievedA: true } };
  assert.match(renderStatsHtml(achieved), /stats-summary glass-panel is-a/);
  assert.match(renderStatsSvg(achieved), /class="signal is-a"/);
  assert.doesNotMatch(renderStatsHtml(snapshot), /glass-panel is-a/);
  const empty = { ...snapshot, languages: [], totalLanguageBytes: 0 };
  assert.match(renderStatsSvg(empty), /No language data available/);
  assert.match(renderStatsHtml(empty), /No language data available/);
  const many = { ...snapshot, languages: Array.from({ length: 10 }, (_, i) => ({ name: `Language ${i}`, share: 0.1, bytes: 10, color: '#888888' })) };
  const visible = visibleLanguages(many);
  assert.equal(visible.length, 8);
  assert.equal(visible.at(-1).name, 'Other');
  assert.ok(Math.abs(visible.reduce((sum, item) => sum + item.share, 0) - 1) < 0.0001);
});
test('an unsuccessful refresh leaves all previous statistics files intact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'festo-stats-test-'));
  try {
    await mkdir(join(root, 'scripts'));
    await mkdir(join(root, 'assets'));
    for (const name of ['generate-stats.mjs', 'stats-data.mjs', 'stats-render.mjs', 'graph.mjs', 'calendar.mjs', 'palette.mjs']) await copyFile(new URL(`../scripts/${name}`, import.meta.url), join(root, 'scripts', name));
    for (const name of ['profile-stats.svg', 'profile-stats-light.svg', 'profile-stats-dark.svg', 'profile-stats.json']) await writeFile(join(root, 'assets', name), 'last-good-snapshot');
    const result = spawnSync(process.execPath, ['scripts/generate-stats.mjs'], { cwd: root, env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '' }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    for (const name of ['profile-stats.svg', 'profile-stats-light.svg', 'profile-stats-dark.svg', 'profile-stats.json']) assert.equal(await readFile(join(root, 'assets', name), 'utf8'), 'last-good-snapshot');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('community grade switches green only at A, A+ and S', () => {
  const base = { commits: 3119, pullRequests: 378, issues: 17, reviews: 0, stars: 3, followers: 18 };
  const current = calculateGrade(base);
  assert.equal(current.level, 'B+');
  assert.equal(current.achievedA, false);
  assert.equal(calculateGrade({ ...base, stars: 50 }).level, 'A-');
  assert.equal(calculateGrade({ ...base, stars: 50 }).achievedA, false);
  assert.equal(calculateGrade({ ...base, stars: 200, reviews: 50 }).level, 'A');
  assert.equal(calculateGrade({ ...base, stars: 200, reviews: 50 }).achievedA, true);
  const maximum = calculateGrade({ commits: 100000, pullRequests: 100000, issues: 100000, reviews: 100000, stars: 100000, followers: 100000 });
  assert.equal(maximum.level, 'S');
  assert.equal(maximum.achievedA, true);
  assert.equal(calculateGrade({ commits:0,pullRequests:0,issues:0,reviews:0,stars:0,followers:0 }).level, 'C');
});
test('account history preserves dates, lifetime totals and streaks across years', () => {
  const fixture = ['2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03'].map((date,index)=>({date,contributionCount:[1,2,3,4,0,0][index]}));
  const history = accountHistory(fixture,'2025-12-29T22:00:00Z',new Date('2026-01-03T10:00:00Z'));
  assert.equal(history.contributions,10);
  assert.equal(history.longest,4);
  assert.equal(history.longestFrom,'2025-12-29');
  assert.equal(history.longestTo,'2026-01-01');
  assert.equal(history.current,0);
  assert.equal(history.currentFrom,null);
  assert.throws(()=>accountHistory(fixture.slice(1),'2025-12-29T22:00:00Z',new Date('2026-01-03T10:00:00Z')),/Incomplete/);
  assert.throws(()=>accountHistory([...fixture,fixture[0]],'2025-12-29T22:00:00Z',new Date('2026-01-03T10:00:00Z')),/Incomplete/);
});

test('stats motion pauses manually, for reduced motion, in background and per offscreen panel', async () => {
  const handlers = {};
  const layout = { dataset: {} };
  const panels = [{ dataset:{} }, { dataset:{} }];
  const toggle = { setAttribute(name,value){this[name]=value;},addEventListener(name,handler){handlers[name]=handler;} };
  const reduced = { matches:false,addEventListener(_,handler){handlers.reduced=handler;} };
  const document = { hidden:false,querySelector(selector){return selector==='.stats-layout'?layout:toggle;},querySelectorAll(){return panels;},addEventListener(_,handler){handlers.visibility=handler;} };
  runInNewContext(await readFile(new URL('../graph/stats.js',import.meta.url),'utf8'), {
    document,matchMedia:()=>reduced,IntersectionObserver:class { constructor(callback){handlers.intersection=callback;} observe(){} },
  });
  assert.equal(panels[0].dataset.motion,'playing');
  handlers.click();
  assert.equal(layout.dataset.motion,'paused');
  assert.equal(toggle['aria-pressed'],'true');
  handlers.click();
  handlers.intersection([{target:panels[0],isIntersecting:false}]);
  assert.equal(panels[0].dataset.motion,'paused');
  assert.equal(panels[1].dataset.motion,'playing');
  document.hidden=true;handlers.visibility();
  assert.equal(panels[1].dataset.motion,'paused');
  document.hidden=false;handlers.visibility();
  reduced.matches=true;handlers.reduced();
  assert.equal(toggle.disabled,true);
  assert.equal(layout.dataset.motion,'paused');
  reduced.matches=false;handlers.reduced();
  handlers.intersection([{target:panels[0],isIntersecting:true}]);
  assert.equal(panels[0].dataset.motion,'playing');
});
