import { palettes } from './palette.mjs';
import { escape, wrap, textLines, cardFrame, picture, replaceBlock } from './profile-card-ui.mjs';

export const CHANNEL = 'UCSiPOa3Vowwi42t1BysexmQ';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
export function validateVideos(data) {
  if (data?.version !== 1 || data.channelId !== CHANNEL || !Number.isFinite(Date.parse(data.updatedAt)) || !Array.isArray(data.videos) || data.videos.length < 1 || data.videos.length > 6) throw new Error('Invalid video snapshot; keeping the previous cards.');
  for (const video of data.videos) {
    if (!validId(video.id) || typeof video.title !== 'string' || !video.title.trim() || video.title.length > 300 || !integer(video.views) || !integer(video.durationSeconds) || video.durationSeconds === 0 || !Number.isFinite(Date.parse(video.publishedAt)) || Date.parse(video.publishedAt) > Date.parse(data.updatedAt)) throw new Error('Incomplete video statistics; keeping the previous cards.');
  }
  if (new Set(data.videos.map(video => video.id)).size !== data.videos.length) throw new Error('Duplicate video IDs.');
  return data;
}
function durationSeconds(value) {
  const match = typeof value === 'string' && value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) throw new Error('Invalid video duration.');
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}
export async function fetchVideos({ key, fetcher = fetch, now = new Date() } = {}) {
  if (!key) throw new Error('YOUTUBE_API_KEY is required to refresh video statistics.');
  const get = async (resource, parameters) => {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    url.search = new URLSearchParams({ ...parameters, key }).toString();
    let response;
    try { response = await fetcher(url.href, { signal: AbortSignal.timeout(30000), redirect: 'error' }); }
    catch { throw new Error('YouTube request failed; keeping the previous cards.'); }
    if (!response.ok) throw new Error(`YouTube unavailable (HTTP ${response.status}); keeping the previous cards.`);
    let data;
    try { data = await response.json(); } catch { throw new Error('YouTube returned invalid data.'); }
    if (!Array.isArray(data.items)) throw new Error('YouTube returned incomplete data.');
    return data.items;
  };
  const channels = await get('channels', { part: 'contentDetails', id: CHANNEL });
  const uploads = channels.find(item => item.id === CHANNEL)?.contentDetails?.relatedPlaylists?.uploads;
  if (typeof uploads !== 'string' || !/^UU[A-Za-z0-9_-]+$/.test(uploads)) throw new Error('YouTube channel uploads are unavailable.');
  const playlist = await get('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '12' });
  const ids = [...new Set(playlist.map(item => item.contentDetails?.videoId))];
  if (!ids.length || !ids.every(validId)) throw new Error('YouTube uploads are empty or invalid; keeping the previous cards.');
  const items = await get('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  const videos = ids.map(id => items.find(item => item.id === id)).filter(item => item && item.snippet?.liveBroadcastContent === 'none').slice(0, 6).map(item => {
    if (item.snippet.channelId !== CHANNEL || typeof item.statistics?.viewCount !== 'string' || !/^\d+$/.test(item.statistics.viewCount)) throw new Error('Incomplete YouTube video statistics.');
    return { id: item.id, title: item.snippet.title, views: Number(item.statistics.viewCount), publishedAt: item.snippet.publishedAt, durationSeconds: durationSeconds(item.contentDetails?.duration) };
  });
  return validateVideos({ version: 1, channelId: CHANNEL, updatedAt: now.toISOString(), videos });
}
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remainder = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}
const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function age(publishedAt, now) {
  const days = Math.max(0, Math.floor((now - new Date(publishedAt)) / 86400000));
  return days === 0 ? 'Published today' : days < 60 ? `${days} ${days === 1 ? 'day' : 'days'} ago` : days < 365 ? `${Math.floor(days / 30)} months ago` : `${Math.floor(days / 365)} ${days < 730 ? 'year' : 'years'} ago`;
}
export function renderVideoCard(video, thumbnail, theme, compact, now) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(thumbnail)) throw new Error('Invalid video thumbnail.');
  const p = palettes[theme], width = compact ? 320 : 400, panel = compact ? 320 : 388;
  const imageHeight = Math.round((panel - 2) * 9 / 16), titleY = imageHeight + 36, metaY = titleY + 85, height = metaY + 79;
  const description = `${video.title}. ${video.views.toLocaleString('en-US')} views. Published ${date(video.publishedAt)}. Duration ${formatDuration(video.durationSeconds)}.`;
  const duration = formatDuration(video.durationSeconds), badgeWidth = duration.length * 8 + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 12}" viewBox="0 0 ${width} ${height + 12}" role="img" aria-labelledby="title description"><title id="title">${escape(video.title)}</title><desc id="description">${escape(description)}</desc>${cardFrame(panel, height, theme)}<defs><clipPath id="thumb"><rect x="1" y="1" width="${panel - 2}" height="${imageHeight}" rx="13"/></clipPath></defs><image href="${thumbnail}" x="1" y="1" width="${panel - 2}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumb)"/><rect x="${panel - badgeWidth - 12}" y="${imageHeight - 31}" width="${badgeWidth}" height="24" rx="6" fill="#0d1117" fill-opacity=".94"/><text x="${panel - 22}" y="${imageHeight - 14}" text-anchor="end" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">${duration}</text>${textLines(wrap(video.title, panel - 40, 20, 3), 20, titleY, 20, p.text, 600, 25)}<path d="M20 ${metaY - 20}h${panel - 40}" stroke="${p.border}"/>${textLines([video.views.toLocaleString('en-US') + ' views'], 20, metaY + 3, 17, p.accent, 600)}${textLines([age(video.publishedAt, now)], 20, metaY + 28, 15, p.muted)}<text x="${panel - 20}" y="${metaY + 54}" text-anchor="end" font-family="Arial,sans-serif" font-size="14" fill="${p.muted}">${date(video.publishedAt)}</text><text x="20" y="${metaY + 54}" font-family="Arial,sans-serif" font-size="14" fill="${p.accent}">Watch tutorial ↗</text></svg>\n`;
}
export function updateVideosReadme(readme, data) {
  validateVideos(data);
  const revision = Date.parse(data.updatedAt);
  const cards = data.videos.map(video => `<a href="https://www.youtube.com/watch?v=${video.id}">${picture('videos', video.id, `${video.title} · ${video.views.toLocaleString('en-US')} views · ${date(video.publishedAt)} · ${formatDuration(video.durationSeconds)}`, revision)}</a>`);
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(`<p>${cards.slice(i, i + 2).join(' ')}</p>`);
  return replaceBlock(readme, '<!-- BEGIN YOUTUBE-CARDS -->', '<!-- END YOUTUBE-CARDS -->', `<div>\n${rows.join('\n')}\n</div>\n\n<sub>Video views updated ${date(data.updatedAt)} · Enterprise IT Mastery</sub>`);
}
