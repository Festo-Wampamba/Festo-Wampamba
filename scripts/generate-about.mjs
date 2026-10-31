import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { palettes } from './palette.mjs';

const cards = [
  { id: 'education', label: 'EDUCATION', title: 'Business Computing', body: 'BBC student at Makerere University Business School', icon: 'book' },
  { id: 'building', label: 'BUILDING', title: 'Kore Standards', body: 'Lead Developer. Building innovative, industry-standard software.', icon: 'code', href: 'https://github.com/Festo-Wampamba/kore-standards' },
  { id: 'creating', label: 'CREATING', title: 'Enterprise IT Mastery', body: 'Content on DevOps, networking and system administration.', icon: 'video', href: 'https://www.youtube.com/channel/UCSiPOa3Vowwi42t1BysexmQ' },
  { id: 'expertise', label: 'EXPERTISE', title: 'Infrastructure & Web', body: 'Ask me about system infrastructure, networking and web development.', icon: 'network' },
];
const socials = [
  { id: 'x', label: 'X', width: 82, href: 'https://twitter.com/festo_techug' },
  { id: 'linkedin', label: 'LinkedIn', width: 132, href: 'https://www.linkedin.com/in/festoug/' },
  { id: 'website', label: 'Website', width: 128, href: 'https://festoug.com' },
  { id: 'youtube', label: 'YouTube', width: 132, href: 'https://www.youtube.com/channel/UCSiPOa3Vowwi42t1BysexmQ' },
];
const email = 'festotechug@gmail.com';
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const measure = (text, font) => [...text].reduce((sum, char) => sum + (char === ' ' ? .3 : /[ilI.,'!|]/.test(char) ? .3 : /[MW@#%&]/.test(char) ? .95 : /[mw]/.test(char) ? .82 : /[A-Z]/.test(char) ? .72 : .55) * font, 0);
function wrap(text, width, font) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) { const next = line ? `${line} ${word}` : word; if (line && measure(next, font) > width) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); return lines;
}
function frame(width, height, p, dark) {
  return `<defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity="${dark ? '.1' : '.95'}"/><stop offset=".48" stop-color="#fff" stop-opacity="${dark ? '.018' : '.3'}"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".035"/></linearGradient></defs><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="${p.surface}"/><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="url(#glass)" stroke="${p.border}"/><path d="M14 1.5h${width - 28}" stroke="#fff" stroke-opacity="${dark ? '.18' : '.95'}"/>`;
}
const icons = {
  book: '<path d="M3 5c4-2 7-1 9 1 2-2 5-3 9-1v14c-4-2-7-1-9 1-2-2-5-3-9-1zM12 6v14"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  video: '<rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 8 6 4-6 4z"/>',
  network: '<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="1" y="16" width="7" height="6" rx="1"/><rect x="16" y="16" width="7" height="6" rx="1"/><path d="M12 8v5H4v3m8-3h8v3"/>',
};
function cardSvg(card, theme, compact) {
  const p = palettes[theme], width = compact ? 320 : 400, cardWidth = compact ? 320 : 388, height = compact ? 192 : 172, font = compact ? 18 : 17.5;
  const lines = wrap(card.body, cardWidth - 44, font);
  const desc = `${card.label}: ${card.title}. ${card.body}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escape(card.title)}</title><desc id="description">${escape(desc)}</desc>${frame(cardWidth, height - 12, p, theme === 'dark')}<g transform="translate(22 17) scale(.7)" fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[card.icon]}</g><text x="48" y="29" fill="${p.accent}" font-family="Arial,sans-serif" font-size="11" letter-spacing="1.6">${card.label}</text>${card.href ? `<text x="${cardWidth - 24}" y="30" text-anchor="end" fill="${p.accent}" font-family="Arial,sans-serif" font-size="17">↗</text>` : ''}<text x="22" y="65" fill="${p.text}" font-family="Arial,sans-serif" font-size="22" font-weight="600">${escape(card.title)}</text><text fill="${p.muted}" font-family="Arial,sans-serif" font-size="${font}">${lines.map((line, index) => `<tspan x="22" y="${98 + index * 25}">${escape(line)}</tspan>`).join('')}</text></svg>\n`;
}
function socialIcon(id, p) {
  if (id === 'youtube') return '<rect x="15" y="14" width="20" height="14" rx="4" fill="#e53935"/><path d="m23 17 6 4-6 4z" fill="#fff"/>';
  if (id === 'linkedin') return '<rect x="16" y="13" width="18" height="18" rx="3" fill="#0a66c2"/><text x="19" y="26" fill="#fff" font-family="Arial,sans-serif" font-size="12" font-weight="700">in</text>';
  if (id === 'x') return `<g transform="translate(16 13) scale(.75)" fill="${p.text}"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.2-8.3L1 2h6.5l4.4 6.8zm-1.1 18h1.7L6.6 3.9H4.8z"/></g>`;
  if (id === 'email') return `<g fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round"><rect x="15" y="15" width="20" height="14" rx="3"/><path d="m16 17 9 7 9-7"/></g>`;
  return `<g transform="translate(16 13)" fill="none" stroke="${p.muted}" stroke-width="1.4"><circle cx="9" cy="9" r="9"/><ellipse cx="9" cy="9" rx="4" ry="9"/><path d="M0 9h18"/></g>`;
}
function buttonSvg(item, theme) {
  const p = palettes[theme], height = 44;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${item.width}" height="44" viewBox="0 0 ${item.width} 44" role="img" aria-labelledby="title"><title id="title">${escape(item.label)}</title>${frame(item.width, height, p, theme === 'dark')}${socialIcon(item.id, p)}<text x="46" y="27" fill="${p.text}" font-family="Arial,sans-serif" font-size="15" font-weight="500">${escape(item.label)}</text></svg>\n`;
}
const root = new URL('../', import.meta.url), dir = new URL('assets/about/', root);
await mkdir(dir, { recursive: true });
for (const theme of ['dark', 'light']) {
  for (const card of cards) for (const compact of [false, true]) await writeFile(new URL(`${card.id}-${theme}${compact ? '-compact' : ''}.svg`, dir), cardSvg(card, theme, compact));
  for (const item of [...socials, { id: 'email', label: email, width: 280 }]) await writeFile(new URL(`${item.id}-${theme}.svg`, dir), buttonSvg(item, theme));
}
function picture(id, alt, width, compact = false) {
  const src = (theme, small = false) => `./assets/about/${id}-${theme}${small ? '-compact' : ''}.svg`;
  return `<picture>${compact ? `<source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${src('dark', true)}" /><source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="${src('light', true)}" />` : ''}<source media="(prefers-color-scheme: dark)" srcset="${src('dark')}" /><source media="(prefers-color-scheme: light)" srcset="${src('light')}" /><img src="${src('dark')}" alt="${escape(alt)}" width="${width}" /></picture>`;
}
const cardHtml = card => { const image = picture(card.id, `${card.label}: ${card.title}. ${card.body}`, 400, true); return card.href ? `<a href="${card.href}">${image}</a>` : image; };
const block = `## 👨‍💻 About Me\n\n<div>\n<p>${cards.slice(0, 2).map(cardHtml).join(' ')}</p>\n<p>${cards.slice(2).map(cardHtml).join(' ')}</p>\n<p><a href="mailto:${email}">${picture('email', 'Email: ' + email, 280)}</a></p>\n</div>\n\n### 🤝 Connect with me\n\n<div>\n<p>${socials.map(item => `<a href="${item.href}">${picture(item.id, item.label, item.width)}</a>`).join(' ')}</p>\n</div>`;
const start = '<!-- PROFILE-ABOUT:START -->', end = '<!-- PROFILE-ABOUT:END -->', path = new URL('README.md', root), readme = await readFile(path, 'utf8');
let next;
if (readme.includes(start)) {
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) throw new Error('Invalid About Me markers.');
  next = readme.slice(0, readme.indexOf(start) + start.length) + '\n' + block + '\n' + readme.slice(readme.indexOf(end));
} else {
  const before = readme.indexOf('## 👨‍💻 About Me'), after = readme.indexOf('\n---\n\n## 📂 Project Showcase', before);
  if (before < 0 || after < 0 || !readme.slice(before, after).includes(email)) throw new Error('Original About Me section not found.');
  next = readme.slice(0, before) + start + '\n' + block + '\n' + end + '\n\n' + readme.slice(after);
}
await writeFile(path, next);
console.log('Generated four responsive glass cards, an email link and four matching social buttons.');
