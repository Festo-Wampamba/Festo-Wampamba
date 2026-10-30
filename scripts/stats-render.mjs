import { themeCss } from './palette.mjs';
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const number = (value) => value.toLocaleString('en-US');
const date = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function visibleLanguages(snapshot) {
  const first = snapshot.languages.slice(0, 7);
  const remaining = snapshot.languages.slice(7);
  return remaining.length ? [...first, { name: 'Other', color: '#8794a5', share: remaining.reduce((sum, item) => sum + item.share, 0), bytes: remaining.reduce((sum, item) => sum + item.bytes, 0) }] : first;
}
const percent = (value) => `${(value * 100).toFixed(1)}%`;

const icons = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  commit: '<circle cx="12" cy="12" r="4"/><path d="M3 12h5m8 0h5"/>',
  pr: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10m12 0v-5a7 7 0 0 0-7-7m2-2-2 2 2 2"/>',
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/>',
  repo: '<path d="M5 4h14v17H7a3 3 0 0 1 0-6h12M5 4v14m4-11h6"/>',
  flame: '<path d="M13 3c1 5-4 6-2 10 1-1 2-2 2-4 4 3 6 6 4 10-2 4-9 4-11 0C3 13 9 10 9 6c2 1 3 3 2 5 3-3 2-5 2-8Z"/>',
};
const icon = (name, extra = '') => `<svg ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const range = (from, to) => from && to ? `${date(from)} – ${date(to)}` : 'No active streak';
const metrics = (snapshot) => [
  ['star', 'Total stars earned', snapshot.public.stars, 'original public repos'],
  ['commit', 'Total commits', snapshot.activity.commits, 'last 365 days'],
  ['pr', 'Total pull requests', snapshot.account.pullRequests, 'all time'],
  ['issue', 'Total issues', snapshot.account.issues, 'all time'],
  ['repo', 'Contributed to', snapshot.account.contributedTo, 'repositories · last year'],
];
const gradeProgress = (grade) => Math.min(1, Math.max(0, (100 - grade.percentile) / 75));
export function renderStatsSvg(snapshot) {
  const { public: p, history: h, grade } = snapshot;
  const languages = visibleLanguages(snapshot);
  let cursor = 56;
  const bar = languages.map((language) => {
    const width = language.share * 1088;
    const result = `<rect x="${cursor}" y="531" width="${width}" height="15" fill="${escape(language.color)}"><title>${escape(language.name)}: ${percent(language.share)}</title></rect>`;
    cursor += width;
    return result;
  }).join('');
  const legend = languages.map((language, index) => {
    const x = 56 + index % 2 * 560, y = 584 + Math.floor(index / 2) * 32;
    return `<circle cx="${x+5}" cy="${y-4}" r="5" fill="${escape(language.color)}"/><text x="${x+22}" y="${y}" fill="var(--text)" font-size="16">${escape(language.name)}</text><text x="${x+502}" y="${y}" text-anchor="end" fill="var(--muted)" font-size="16">${percent(language.share)}</text>`;
  }).join('');
  const rows = metrics(snapshot).map(([name, label, value, scope], index) => {
    const y = 151 + index * 46;
    return `<g class="stat-row" style="animation-delay:${index*80}ms"><svg x="56" y="${y-15}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg><text x="86" y="${y}" fill="var(--text)" font-size="14">${label}</text><text x="86" y="${y+16}" class="tiny">${scope}</text><text x="365" y="${y+4}" text-anchor="end" fill="var(--text)" font-size="22" font-weight="600">${number(value)}</text>${index<4?`<path d="M56 ${y+26}H380" stroke="var(--border)" opacity=".7"/>`:''}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="profile-stats" data-grade="${grade.achievedA?'a':'gold'}" viewBox="0 0 1200 808" width="1200" height="808" role="img" aria-labelledby="stats-title stats-description">
<title id="stats-title">${escape(snapshot.username)} — GitHub stats and streak</title><desc id="stats-description">Grade ${grade.level}, a community calculation. ${metrics(snapshot).map(([,label,value,scope])=>`${label}: ${number(value)} (${scope})`).join('. ')}. ${number(h.contributions)} contributions since ${date(h.from)}. Current streak ${h.current} days (${range(h.currentFrom,h.currentTo)}). Longest streak ${h.longest} days (${range(h.longestFrom,h.longestTo)}). Language usage measures code bytes across original public repositories. Updated ${date(snapshot.updatedAt)} UTC.</desc>
<defs><linearGradient id="glass" x2=".7" y2="1"><stop stop-color="var(--surface)"/><stop offset="1" stop-color="var(--canvas)"/></linearGradient><linearGradient id="rim"><stop stop-color="var(--signal)" stop-opacity=".55"/><stop offset=".5" stop-color="var(--border)"/><stop offset="1" stop-color="var(--signal)" stop-opacity=".18"/></linearGradient><radialGradient id="sheen" cx=".9" cy="0" r="1"><stop stop-color="var(--signal)" stop-opacity=".09"/><stop offset="1" stop-color="var(--signal)" stop-opacity="0"/></radialGradient></defs>
<style>${themeCss('.profile-stats', 'html[data-theme="light"] .profile-stats,.profile-stats[data-theme="light"]', 'html[data-theme="dark"] .profile-stats,.profile-stats[data-theme="dark"]')}
.profile-stats{--earned:#187343;--signal:var(--accent)}.profile-stats[data-grade=a]{--signal:var(--earned)}.profile-stats text{font-family:'Geist',system-ui,sans-serif}.profile-stats .tiny{fill:var(--muted);font-size:11px}.signal{--signal:var(--accent)}.signal.is-a{--signal:var(--earned)}.stat-row{animation:reveal .7s both}.rank-ring{animation:reveal 1.2s both}@keyframes reveal{from{opacity:.2}to{opacity:1}}@media(prefers-color-scheme:dark){.profile-stats{--earned:#67dba0}}.profile-stats[data-theme="light"]{--earned:#187343}.profile-stats[data-theme="dark"]{--earned:#67dba0}@media(prefers-reduced-motion:reduce){.stat-row,.rank-ring{animation:none}}</style>
<rect width="1200" height="808" rx="16" fill="var(--canvas)"/>
<text x="32" y="35" fill="var(--muted)" font-size="11" letter-spacing="2">${escape(snapshot.username.toUpperCase())} / GITHUB OVERVIEW</text><text x="1168" y="35" text-anchor="end" class="tiny">Updated ${date(snapshot.updatedAt)} UTC</text>
<g class="signal${grade.achievedA?' is-a':''}">
<rect x="32" y="68" width="570" height="346" rx="16" fill="url(#glass)" stroke="url(#rim)"/><rect x="32" y="68" width="570" height="346" rx="16" fill="url(#sheen)"/>
<text x="56" y="106" fill="var(--text)" font-size="21" font-weight="600">My stats</text><text x="578" y="104" text-anchor="end" class="tiny">Festo Wampamba</text>
${rows}
<path d="M407 132v234" stroke="var(--border)"/>
<g class="rank-ring"><circle cx="501" cy="220" r="61" fill="none" stroke="var(--border)" stroke-width="6"/><circle cx="501" cy="220" r="61" fill="none" stroke="var(--signal)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${gradeProgress(grade)*383.27} 383.27" transform="rotate(-90 501 220)"/><text x="501" y="232" text-anchor="middle" fill="var(--signal)" font-size="37" font-weight="600">${grade.level}</text></g>
<text x="501" y="313" text-anchor="middle" class="tiny" letter-spacing="1">COMMUNITY GRADE</text><text x="501" y="336" text-anchor="middle" class="tiny">${grade.achievedA?'A milestone reached':`A at score 75 · ${(100-grade.percentile).toFixed(1)} now`}</text>
<text x="56" y="391" class="tiny">${p.repositories} original public repos<tspan dx="22">${p.followers} followers</tspan></text>
<rect x="626" y="68" width="542" height="346" rx="16" fill="url(#glass)" stroke="url(#rim)"/><rect x="626" y="68" width="542" height="346" rx="16" fill="url(#sheen)"/>
<text x="650" y="106" fill="var(--text)" font-size="21" font-weight="600">Streak</text><text x="1144" y="104" text-anchor="end" class="tiny">Every day counts</text>
<path d="M850 142v225M878 266h266" stroke="var(--border)"/>
<circle cx="750" cy="214" r="62" fill="none" stroke="var(--border)" stroke-width="5"/><path d="M750 152a62 62 0 1 1-1 .01" fill="none" stroke="var(--signal)" stroke-width="5" stroke-linecap="round" stroke-dasharray="315 390" transform="rotate(30 750 214)"/>
<svg x="740" y="130" width="20" height="25" viewBox="0 0 24 24" fill="var(--signal)">${icons.flame}</svg><text x="750" y="228" text-anchor="middle" fill="var(--signal)" font-size="42" font-weight="600">${h.current}</text>
<text x="750" y="307" text-anchor="middle" fill="var(--signal)" font-size="14" font-weight="600">Current streak · days</text><text x="750" y="332" text-anchor="middle" class="tiny">${h.currentFrom?date(h.currentFrom):'Start today'}</text><text x="750" y="350" text-anchor="middle" class="tiny">${h.currentTo?`– ${date(h.currentTo)}`:''}</text>
<text x="878" y="162" class="tiny" letter-spacing="1">TOTAL CONTRIBUTIONS</text><text x="878" y="205" fill="var(--text)" font-size="34" font-weight="600">${number(h.contributions)}</text><text x="878" y="236" class="tiny">${date(h.from)} – Present</text>
<text x="878" y="295" class="tiny" letter-spacing="1">LONGEST STREAK</text><text x="878" y="333" fill="var(--text)" font-size="30" font-weight="600">${h.longest}<tspan dx="8" class="tiny">days</tspan></text><text x="878" y="358" class="tiny">${h.longestFrom?range(h.longestFrom,h.longestTo):'No streak yet'}</text>
<text x="650" y="391" class="tiny">Account history · UTC · today may be incomplete</text></g>
<rect x="32" y="438" width="1136" height="306" rx="14" fill="var(--surface)" stroke="var(--border)"/><text x="56" y="480" fill="var(--text)" font-size="23" font-weight="600">Code footprint</text><text x="56" y="506" class="tiny">Share of code bytes across original public repositories · forks excluded</text>
${bar}${legend}${languages.length?'':'<text x="56" y="584" class="tiny">No language data available.</text>'}
<text x="32" y="780" class="tiny">Direct from GitHub · dated snapshot · community grade uses the github-readme-stats formula</text></svg>\n`;
}

export function renderStatsHtml(snapshot) {
  const { public:p, history:h, grade } = snapshot;
  const languages = visibleLanguages(snapshot);
  return `<section class="stats-summary glass-panel${grade.achievedA?' is-a':''}" aria-labelledby="my-stats-heading"><header class="glass-heading"><div><p class="eyebrow">THE ACCOUNT, AT A GLANCE</p><h2 id="my-stats-heading">My stats</h2></div><span class="snapshot-status"><i aria-hidden="true"></i>GitHub snapshot</span></header>
<div class="stats-ledger"><table><caption class="sr-only">Festo Wampamba's GitHub statistics</caption><tbody>${metrics(snapshot).map(([name,label,value,scope],index)=>`<tr style="--row:${index}"><th scope="row">${icon(name)}<span>${label}<small>${scope}</small></span></th><td>${number(value)}</td></tr>`).join('')}</tbody></table>
<div class="grade-panel"><div class="grade-gauge" role="img" aria-label="Community grade ${grade.level}. Score ${(100-grade.percentile).toFixed(1)}, A begins at 75."><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="65" class="gauge-track"/><circle cx="80" cy="80" r="65" class="gauge-progress" style="--grade-length:${gradeProgress(grade)*408.4}"/></svg><strong>${grade.level}</strong></div><p>Community grade</p><span>${grade.achievedA?'A milestone reached':`Score ${(100-grade.percentile).toFixed(1)} / 75 for A`}</span><a href="#grade-method">How it works ↗</a></div></div>
<div class="public-metrics"><span><strong>${p.repositories}</strong> original public repos</span><span><strong>${p.followers}</strong> followers</span></div></section>
<section class="streak-panel glass-panel${grade.achievedA?' is-a':''}" aria-labelledby="streak-heading"><header class="glass-heading"><div><p class="eyebrow">SHOWING UP, DAY AFTER DAY</p><h2 id="streak-heading">Streak</h2></div>${icon('flame','class="heading-flame"')}</header><div class="streak-columns"><div class="streak-total"><strong>${number(h.contributions)}</strong><span>Total contributions</span><p>${date(h.from)}<br>– Present</p></div><div class="streak-current"><div class="streak-orbit">${icon('flame','class="orbit-flame"')}<strong>${h.current}</strong><span class="sr-only">days</span></div><h3>Current streak</h3><p>${h.currentFrom?date(h.currentFrom):'Start today'}<br>${h.currentTo?`– ${date(h.currentTo)}`:''}</p></div><div class="streak-best"><strong>${h.longest}</strong><span>Longest streak · days</span><p>${h.longestFrom?date(h.longestFrom):'No streak yet'}<br>${h.longestTo?`– ${date(h.longestTo)}`:''}</p></div></div><p class="streak-through">Account history · UTC · today may be incomplete</p></section>
<section class="language-panel" aria-labelledby="language-heading"><div class="panel-heading"><div><p class="eyebrow">THE CODE BEHIND THE WORK</p><h2 id="language-heading">Code footprint</h2></div><span>${snapshot.languages.length} languages</span></div><p class="panel-description">Share of code bytes across original public repositories. Forks excluded.</p><div class="language-bar" role="img" aria-label="Language distribution">${languages.map((language) => `<span style="width:${language.share*100}%;background:${escape(language.color)}" title="${escape(language.name)}: ${percent(language.share)}"></span>`).join('')}</div><ul class="language-list">${languages.map((language) => `<li><span><i aria-hidden="true" style="background:${escape(language.color)}"></i>${escape(language.name)}</span><strong>${percent(language.share)}</strong></li>`).join('')}</ul>${languages.length?'':'<p>No language data available.</p>'}<p class="language-note">Repository composition, rather than a measure of proficiency.</p></section>
<section class="stats-provenance" aria-label="Data scope"><p><strong>Updated from your GitHub account.</strong> Commits cover ${date(snapshot.period.from)} – ${date(snapshot.period.to)}. PR and issue totals span account history; repository contributions follow GitHub's last-year connection. Streaks cover ${date(h.from)} through today. Counts reflect the refresh token's visibility. The saved snapshot stays available if a refresh fails.</p><a href="../profile-stats.json" download>Download snapshot ↓</a></section><details class="grade-method" id="grade-method"><summary>About the grade and automatic colour</summary><p>This is a community grade, not an official GitHub rating. It uses the <a href="https://github.com/anuraghazra/github-readme-stats/blob/master/src/calculateRank.js">github-readme-stats formula</a>: annual commits and reviews, total pull requests and issues, stars and followers. At a score of 75 (grade A), these two panels change from gold to green automatically on the next successful refresh. A+ and S stay green; A− remains gold. All totals show their scope; private activity depends on token access. No extra repository permissions are requested by this page.</p></details>`;
}
