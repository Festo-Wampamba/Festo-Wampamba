import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchVideos, validateVideos, renderVideoCard, updateVideosReadme, CHANNEL } from '../scripts/videos.mjs';

const now = new Date('2026-10-31T12:00:00Z');
const video = { id: 'abcdefghijk', title: 'Build <better> systems & learn', views: 12345, publishedAt: '2026-10-01T10:00:00Z', durationSeconds: 3672 };
const snapshot = () => ({ version: 1, channelId: CHANNEL, updatedAt: now.toISOString(), videos: [{ ...video }] });
const readme = 'Before\n<!-- BEGIN YOUTUBE-CARDS -->\nLast good cards\n<!-- END YOUTUBE-CARDS -->\nAfter';
function fetcher(url) {
  const path = new URL(url).pathname;
  const items = path.endsWith('/channels') ? [{ id: CHANNEL, contentDetails: { relatedPlaylists: { uploads: 'UUtest' } } }]
    : path.endsWith('/playlistItems') ? [{ contentDetails: { videoId: video.id } }]
      : [{ id: video.id, snippet: { title: video.title, channelId: CHANNEL, publishedAt: video.publishedAt, liveBroadcastContent: 'none' }, statistics: { viewCount: '12345' }, contentDetails: { duration: 'PT1H1M12S' } }];
  return Promise.resolve({ ok: true, json: async () => ({ items }) });
}
test('fetches real view counts, publish dates and duration from the channel uploads', async () => {
  const calls = [];
  const data = await fetchVideos({ key: 'test-secret', now, fetcher: url => { calls.push(url); return fetcher(url); } });
  assert.deepEqual(data, snapshot());
  assert.equal(calls.length, 3);
  assert(!JSON.stringify(data).includes('test-secret'));
});
test('empty feeds and incomplete API statistics cannot wipe last good cards or leak the API key', async () => {
  await assert.rejects(fetchVideos({ key: 'secret', fetcher: async () => ({ ok: true, json: async () => ({ items: [] }) }) }), /channel|uploads/i);
  await assert.rejects(fetchVideos({ key: 'secret', fetcher: async () => { throw new Error('https://api?key=secret'); } }), error => !error.message.includes('secret'));
  await assert.rejects(fetchVideos({ key: 'secret', fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  assert.throws(() => updateVideosReadme(readme, { ...snapshot(), videos: [] }), /snapshot/i);
  for (const invalid of [{ views: undefined }, { views: -1 }, { id: '../escape' }, { durationSeconds: 0 }, { publishedAt: 'broken' }]) {
    const data = snapshot(); Object.assign(data.videos[0], invalid);
    assert.throws(() => validateVideos(data), /video/i);
  }
});
test('cards retain full counts, dates, duration, escaped titles and accessible text in both themes', () => {
  for (const theme of ['light', 'dark']) for (const compact of [false, true]) {
    const svg = renderVideoCard(video, 'data:image/jpeg;base64,/9j/2Q==', theme, compact, now);
    for (const value of ['12,345 views', '1:01:12', '1 Oct 2026', '30 days ago', '&lt;better&gt;', '&amp; learn']) assert(svg.includes(value), value);
    assert(!svg.includes('<better>'));
    assert(!svg.includes('<script'));
  }
  const next = updateVideosReadme(readme, snapshot());
  assert(next.startsWith('Before\n') && next.endsWith('\nAfter'));
  assert(next.includes('https://www.youtube.com/watch?v=abcdefghijk'));
  assert(next.includes('(max-width: 600px)'));
  assert.equal((next.match(/<picture>/g) || []).length, 1);
  const six = { ...snapshot(), videos: Array.from({ length: 6 }, (_, index) => ({ ...video, id: `abcdefghij${index}` })) };
  const rows = [...updateVideosReadme(readme, six).matchAll(/<p>(.*?)<\/p>/g)];
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal((row[1].match(/<picture>/g) || []).length, 3);
    assert.equal((row[1].match(/width="264"/g) || []).length, 3);
  }
  assert.throws(() => updateVideosReadme('missing markers', snapshot()), /markers/);
  assert.throws(() => updateVideosReadme(readme + '<!-- BEGIN YOUTUBE-CARDS -->', snapshot()), /markers/);
});
