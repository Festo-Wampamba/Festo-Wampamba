import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { palettes } from './palette.mjs';
import { escape, wrap, textLines, cardFrame, picture, replaceBlock } from './profile-card-ui.mjs';

const projects = [
  { id: 'kore', category: '01 / SOFTWARE', title: 'Kore Standards', description: 'An AI-powered agentic job matching system connecting talent to the right opportunities.', tags: ['Next.js', 'Postgres', 'AI'], action: 'View repository', href: 'https://github.com/Festo-Wampamba/kore-standards', icon: '<path d="m9 7-5 5 5 5m6-10 5 5-5 5M14 4l-4 16"/>' },
  { id: 'mastery', category: '02 / EDUCATION', title: 'Enterprise IT Mastery', description: 'Practical tutorials on DevOps, networking and system administration. Learn, build and put your skills to work.', tags: ['Education', 'DevOps', 'Content'], action: 'Explore the channel', href: 'https://www.youtube.com/channel/UCSiPOa3Vowwi42t1BysexmQ', icon: '<rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 8 6 4-6 4z"/>' },
];
function render(project, theme, compact) {
  const p = palettes[theme], width = compact ? 320 : 400, panel = compact ? 320 : 388, height = compact ? 370 : 330, imageHeight = compact ? 160 : 190, totalHeight = height + imageHeight;
  const title = wrap(project.title, panel - 44, 27, 2), descriptionY = title.length > 1 ? 154 : 122;
  let chipX = 22;
  const chips = project.tags.map(tag => {
    const x = chipX, chipWidth = tag.length * 7.4 + 22; chipX += chipWidth + 8;
    return `<rect x="${x}" y="${height - 109}" width="${chipWidth}" height="27" rx="7" fill="${p.canvas}" stroke="${p.border}"/>${textLines([tag], x + 11, height - 91, 13, p.muted)}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight + 12}" viewBox="0 0 ${width} ${totalHeight + 12}" role="img" aria-labelledby="title description"><title id="title">${escape(project.title)}</title><desc id="description">${escape(project.description + ' ' + project.tags.join(', ') + '. ' + project.action)}</desc>${cardFrame(panel, totalHeight, theme)}<defs><clipPath id="photo"><rect x="1" y="1" width="${panel - 2}" height="${imageHeight}" rx="13"/></clipPath></defs><image href="data:image/jpeg;base64,${project.photo}" x="1" y="1" width="${panel - 2}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/><g transform="translate(0 ${imageHeight})">${textLines([project.category], 22, 33, 11, p.accent, 600)}<g transform="translate(${panel - 49} 17)" fill="none" stroke="${p.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${project.icon}</g>${textLines(title, 22, 82, 27, p.text, 600, 32)}${textLines(wrap(project.description, panel - 44, 18, 5), 22, descriptionY, 18, p.muted, 400, 26)}${chips}<path d="M22 ${height - 65}h${panel - 44}" stroke="${p.border}"/>${textLines([project.action], 22, height - 28, 17, p.accent, 600)}<text x="${panel - 25}" y="${height - 27}" text-anchor="end" fill="${p.accent}" font-family="Arial,sans-serif" font-size="23">↗</text></g></svg>\n`;
}
const root = new URL('../', import.meta.url), output = new URL('assets/showcase/', root);
await mkdir(output, { recursive: true });
for (const project of projects) {
  const photo = await readFile(new URL(`images/${project.id}.jpg`, output));
  if (photo[0] !== 255 || photo[1] !== 216 || photo[2] !== 255) throw new Error('Invalid showcase JPEG.');
  project.photo = photo.toString('base64');
  for (const theme of ['light', 'dark']) for (const compact of [false, true]) await writeFile(new URL(`${project.id}-${theme}${compact ? '-compact' : ''}.svg`, output), render(project, theme, compact));
}
const content = `## 📂 Project Showcase\n\n<div>\n<p>${projects.map(project => `<a href="${project.href}">${picture('showcase', project.id, `${project.title}: ${project.description} ${project.tags.join(', ')}. ${project.action}`, 'photos-v2')}</a>`).join(' ')}</p>\n</div>`;
const path = new URL('README.md', root), readme = await readFile(path, 'utf8');
const start = '<!-- PROFILE-SHOWCASE:START -->', end = '<!-- PROFILE-SHOWCASE:END -->';
let next;
if (readme.includes(start)) next = replaceBlock(readme, start, end, content);
else {
  const from = readme.indexOf('## 📂 Project Showcase'), to = readme.indexOf('\n---\n\n### 📺 Featured YouTube Videos', from);
  if (from < 0 || to < 0) throw new Error('Original showcase section not found.');
  next = readme.slice(0, from) + start + '\n' + content + '\n' + end + '\n' + readme.slice(to);
}
// Replace the third-party subscribe image with a simple, readable channel link.
next = next.replace(/<p align="center">\s*<a href="https:\/\/www\.youtube\.com\/channel\/UCSiPOa3Vowwi42t1BysexmQ\?sub_confirmation=1">[\s\S]*?<\/p>/, '<p><a href="https://www.youtube.com/channel/UCSiPOa3Vowwi42t1BysexmQ?sub_confirmation=1">Subscribe to Enterprise IT Mastery ↗</a></p>');
await writeFile(path, next);
console.log('Generated responsive project showcase cards in light and dark themes.');
