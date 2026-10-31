import { palettes } from './palette.mjs';
export const USER = 'Festo-Wampamba', CHANNEL = 'UCSiPOa3Vowwi42t1BysexmQ';
const integer = value => Number.isSafeInteger(value) && value >= 0;
const number = value => { if (typeof value !== 'string' || !/^\d+$/.test(value) || !integer(Number(value))) throw new Error('Invalid YouTube statistic.'); return Number(value); };
export function validateBadges(data) {
  if (data?.version !== 1 || !Number.isFinite(Date.parse(data.updatedAt)) || data.github?.username !== USER || data.youtube?.channelId !== CHANNEL || typeof data.company !== 'string' || data.company.length > 40) throw new Error('Invalid badge snapshot.');
  for (const value of [data.github.followers, data.github.publicRepos, data.github.stars, data.youtube.views]) if (!integer(value)) throw new Error('Invalid badge count.');
  if (data.youtube.subscribers !== null && !integer(data.youtube.subscribers)) throw new Error('Invalid subscriber count.');
  return data;
}
export async function fetchBadges({ token, youtubeKey, fetcher = fetch, now = new Date() } = {}) {
  if (!token || !youtubeKey) throw new Error('GH_TOKEN and YOUTUBE_API_KEY are required to refresh all badges.');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'festo-profile-badges' };
  const get = async (url, options, service) => {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(30000) }); }
    catch { throw new Error(`${service} statistics request failed.`); }
    if (!response.ok) throw new Error(`${service} statistics unavailable (HTTP ${response.status}).`);
    try { return await response.json(); } catch { throw new Error(`${service} returned invalid data.`); }
  };
  const [user, channel] = await Promise.all([
    get(`https://api.github.com/users/${USER}`, { headers }, 'GitHub'),
    get(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL}&key=${encodeURIComponent(youtubeKey)}`, {}, 'YouTube'),
  ]);
  if (!integer(user.followers) || !integer(user.public_repos)) throw new Error('Incomplete GitHub profile.');
  const entry = channel.items?.find(item => item.id === CHANNEL), stats = entry?.statistics;
  if (!stats || typeof stats.hiddenSubscriberCount !== 'boolean') throw new Error('Incomplete YouTube channel statistics.');
  const repositories = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await get(`https://api.github.com/users/${USER}/repos?type=owner&per_page=100&page=${page}`, { headers }, 'GitHub');
    if (!Array.isArray(batch)) throw new Error('Incomplete public repository list.');
    for (const repo of batch) if (!integer(repo.stargazers_count) || typeof repo.fork !== 'boolean' || repo.private !== false || repo.owner?.login?.toLowerCase() !== USER.toLowerCase()) throw new Error('Invalid public repository metadata.');
    repositories.push(...batch);
    if (batch.length < 100) break;
    if (page === 20) throw new Error('Public repository pagination limit exceeded.');
  }
  if (repositories.length !== user.public_repos || new Set(repositories.map(repo => repo.id)).size !== repositories.length) throw new Error('Public repository list changed during refresh; retry later.');
  return validateBadges({ version: 1, updatedAt: now.toISOString(), github: { username: USER, followers: user.followers, publicRepos: user.public_repos, stars: repositories.filter(repo => !repo.fork).reduce((sum, repo) => sum + repo.stargazers_count, 0) }, youtube: { channelId: CHANNEL, subscribers: stats.hiddenSubscriberCount ? null : number(stats.subscriberCount), views: number(stats.viewCount) }, company: 'Lupora Tech' });
}
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const format = value => value === null ? 'Hidden' : value.toLocaleString('en-US');
export const badgeDefinitions = data => [
  { id: 'youtube-subscribers', label: 'Subscribers', value: format(data.youtube.subscribers), icon: 'youtube', href: `https://www.youtube.com/channel/${CHANNEL}?sub_confirmation=1` },
  { id: 'youtube-views', label: 'Views', value: format(data.youtube.views), icon: 'youtube', href: `https://www.youtube.com/channel/${CHANNEL}` },
  { id: 'github-followers', label: 'Followers', value: format(data.github.followers), icon: 'github', href: `https://github.com/${USER}?tab=followers` },
  { id: 'github-repos', label: 'Public repos', value: format(data.github.publicRepos), icon: 'github', href: `https://github.com/${USER}?tab=repositories` },
  { id: 'company', label: 'Company', value: data.company, icon: 'company', href: null },
];
export function renderBadge(badge, theme) {
  const colors = theme === 'light' ? palettes.light : palettes.dark;
  const labelWidth = Math.ceil(badge.label.length * 7.6), valueWidth = Math.ceil(badge.value.length * 8.8);
  const divider = 43 + labelWidth + 11, valueX = divider + 12, width = valueX + valueWidth + 14;
  const icon = badge.icon === 'youtube'
    ? '<rect x="13" y="11" width="20" height="14" rx="4" fill="#e53935"/><path d="m21 14 6 4-6 4z" fill="#fff"/>'
    : badge.icon === 'github'
      ? `<g transform="translate(14 10) scale(.75)" fill="${colors.text}"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.3 1.8 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></g>`
      : `<g fill="none" stroke="${colors.accent}" stroke-width="1.5"><rect x="15" y="10" width="15" height="17" rx="2"/><path d="M19 14h2m3 0h2m-7 4h2m3 0h2m-7 4h2m3 0h2M12 27h21"/></g>`;
  const description = `${badge.label}: ${badge.value}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="36" viewBox="0 0 ${width} 36" role="img" aria-labelledby="title"><title id="title">${escape(description)}</title><rect x=".5" y=".5" width="${width - 1}" height="35" rx="8" fill="${colors.surface}" stroke="${colors.border}"/>${icon}<text x="43" y="23" font-family="Arial,sans-serif" font-size="14" fill="${colors.muted}">${escape(badge.label)}</text><path d="M${divider} 10v16" stroke="${colors.border}"/><text x="${valueX}" y="23" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="${colors.text}">${escape(badge.value)}</text></svg>\n`;
}
export function renderBadgeReadme(data) {
  validateBadges(data);
  const revision = Date.parse(data.updatedAt);
  const badge = entry => {
    const picture = `<picture><source media="(prefers-color-scheme: dark)" srcset="./assets/badges/${entry.id}-dark.svg?v=${revision}" /><source media="(prefers-color-scheme: light)" srcset="./assets/badges/${entry.id}-light.svg?v=${revision}" /><img src="./assets/badges/${entry.id}-dark.svg?v=${revision}" alt="${escape(entry.label + ': ' + entry.value)}" height="36" /></picture>`;
    return entry.href ? `<a href="${escape(entry.href)}">${picture}</a>` : picture;
  };
  const entries = badgeDefinitions(data);
  return `<div>\n<p>\n${entries.slice(0, 2).map(badge).join(' ')}\n</p>\n<p>\n${entries.slice(2).map(badge).join(' ')}\n</p>\n</div>`;
}
export function updateBadgeReadme(readme, data) {
  const start = '<!-- PROFILE-BADGES:START -->', end = '<!-- PROFILE-BADGES:END -->';
  if (!readme.includes(start) && !readme.includes(end)) return readme;
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) throw new Error('Invalid README badge markers.');
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + renderBadgeReadme(data) + '\n' + readme.slice(readme.indexOf(end));
}
