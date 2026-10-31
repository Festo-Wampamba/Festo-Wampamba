import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fetchVideos, validateVideos, renderVideoCard, updateVideosReadme } from './videos.mjs';

const assets = new URL('../assets/', import.meta.url), pending = [];
try {
  const saved = process.argv.includes('--saved');
  const data = saved ? validateVideos(JSON.parse(await readFile(new URL('featured-videos.json', assets), 'utf8'))) : await fetchVideos({ key: process.env.YOUTUBE_API_KEY });
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const next = updateVideosReadme(readme, data);
  const files = new Map([['featured-videos.json', JSON.stringify(data, null, 2) + '\n']]);
  for (const video of data.videos) {
    let bytes;
    if (saved) bytes = await readFile(new URL(`videos/thumbnails/${video.id}.jpg`, assets));
    else {
      let response;
      try { response = await fetch(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, { signal: AbortSignal.timeout(30000), redirect: 'error' }); }
      catch { throw new Error('YouTube thumbnail request failed; keeping previous cards.'); }
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg') || Number(response.headers.get('content-length')) > 1000000) throw new Error('YouTube thumbnail unavailable.');
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (bytes.length > 1000000 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('Invalid YouTube JPEG; keeping previous cards.');
    files.set(`videos/thumbnails/${video.id}.jpg`, bytes);
    for (const theme of ['light', 'dark']) for (const compact of [false, true]) files.set(`videos/${video.id}-${theme}${compact ? '-compact' : ''}.svg`, renderVideoCard(video, `data:image/jpeg;base64,${bytes.toString('base64')}`, theme, compact, new Date(data.updatedAt)));
  }
  files.set('../README.md', next);
  await mkdir(new URL('videos/thumbnails/', assets), { recursive: true });
  // Fetch and validate everything before replacing any saved cards or README content.
  for (const [name, body] of files) { const temporary = new URL(name + `.${process.pid}.tmp`, assets); pending.push(temporary); await writeFile(temporary, body); }
  let index = 0; for (const name of files.keys()) await rename(pending[index++], new URL(name, assets));
  // Only the current selection is retained in the working tree.
  const { readdir } = await import('node:fs/promises');
  for (const folder of ['videos/', 'videos/thumbnails/']) for (const name of await readdir(new URL(folder, assets))) {
    if (/^[A-Za-z0-9_-]{11}(?:-(?:light|dark)(?:-compact)?\.svg|\.jpg)$/.test(name) && !data.videos.some(video => name.startsWith(video.id + (name.endsWith('.jpg') ? '.' : '-')))) await rm(new URL(folder + name, assets));
  }
  console.log(`Saved ${data.videos.length} YouTube cards with official views, publish dates and duration.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await Promise.all(pending.map(path => rm(path, { force: true }))); }
