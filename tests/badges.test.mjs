import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBadges, renderBadge, badgeDefinitions, renderBadgeReadme, CHANNEL, USER } from '../scripts/badges.mjs';
const now = new Date('2026-10-31T00:00:00Z');
const makeFetcher = (hidden = false) => async url => ({ ok: true, json: async () => url.includes('googleapis.com') ? { items: [{ id: CHANNEL, statistics: { viewCount: '123456', subscriberCount: '188', hiddenSubscriberCount: hidden } }] } : url.includes('/repos?') ? [{ id: 1, owner: { login: USER }, private: false, fork: false, stargazers_count: 3 }, { id: 2, owner: { login: USER }, private: false, fork: true, stargazers_count: 5 }] : { followers: 17, public_repos: 2 } });
test('badge counts use official totals, include public forks in repo count, and exclude fork stars', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, options }); return makeFetcher()(url); };
  const data = await fetchBadges({ token: 'test-token', youtubeKey: 'test-key', fetcher, now });
  assert.deepEqual(data.github, { username: USER, followers: 17, publicRepos: 2, stars: 3 });
  assert.equal(data.youtube.views, 123456);
  assert.equal(data.youtube.subscribers, 188);
  assert.equal(calls.find(call => call.url.includes('googleapis.com')).options.headers, undefined);
  assert.ok(calls.filter(call => call.url.includes('api.github.com')).every(call => call.options.headers.Authorization === 'Bearer test-token'));
  assert.ok(!JSON.stringify(data).includes('test-key'));
  const hidden = await fetchBadges({ token: 'test-token', youtubeKey: 'test-key', fetcher: makeFetcher(true), now });
  assert.equal(hidden.youtube.subscribers, null);
});
test('API errors and incomplete counts cannot become plausible badge snapshots or expose the key', async () => {
  await assert.rejects(fetchBadges({ token: '', youtubeKey: 'key' }), /required/);
  await assert.rejects(fetchBadges({ token: 'token', youtubeKey: 'secret-key', fetcher: async () => { throw new Error('request URL secret-key'); } }), error => !error.message.includes('secret-key'));
  await assert.rejects(fetchBadges({ token: 'token', youtubeKey: 'key', fetcher: async () => ({ ok: true, json: async () => ({}) }) }), /Incomplete/);
});
test('badges show full comma-separated numbers, clear labels, escaped text and responsive light/dark pictures', async () => {
  const data = await fetchBadges({ token: 'token', youtubeKey: 'key', fetcher: makeFetcher(), now });
  const definitions = badgeDefinitions(data);
  assert.equal(definitions.find(entry => entry.id === 'youtube-views').value, '123,456');
  for (const definition of definitions) for (const theme of ['dark', 'light']) {
    const svg = renderBadge(definition, theme);
    assert.match(svg, /height="36"/); assert.ok(svg.includes(definition.label)); assert.ok(svg.includes(definition.value));
  }
  assert.match(renderBadge({ label: 'Company', value: 'A & B <Tech>', icon: 'company' }, 'light'), /A &amp; B &lt;Tech&gt;/);
  const html = renderBadgeReadme(data);
  assert.equal((html.match(/<picture>/g) ?? []).length, 6);
  assert.equal((html.match(/<source /g) ?? []).length, 12);
  assert.doesNotMatch(html, /retired|shieldcn|img.shields/);
});
