import { themeCss } from './palette.mjs';
const number = (value) => value.toLocaleString('en-US');
const xml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const parseDate = (value) => new Date(`${value}T00:00:00Z`);

export function calendarStats(days) {
  let run = 0;
  let longest = 0;
  for (const day of days) {
    run = day.contributionCount ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { total: days.reduce((sum, day) => sum + day.contributionCount, 0), active: days.filter((day) => day.contributionCount > 0).length, peak: Math.max(...days.map((day) => day.contributionCount)), longest };
}

export function renderCalendar(days, username) {
  const stats = calendarStats(days);
  const months = [...new Set(days.map((day) => day.date.slice(0, 7)))];
  const columns = Math.min(2, months.length);
  const cardWidth = (1128 - (columns - 1) * 24) / columns;
  const rows = Math.ceil(months.length / columns);
  const height = 164 + rows * 484 + 76;
  const indexed = new Map(days.map((day, index) => [day.date, { ...day, index }]));
  const colors = Array.from({ length: 5 }, (_, index) => `var(--tile-${index})`);
  const levelFor = (count) => count === 0 ? 0 : count <= 5 ? 1 : count <= 15 ? 2 : count <= 30 ? 3 : 4;
  const monthMarkup = months.map((key, monthIndex) => {
    const first = parseDate(`${key}-01`);
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth();
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const x = 36 + (monthIndex % columns) * (cardWidth + 24);
    const y = 160 + Math.floor(monthIndex / columns) * 484;
    const cell = (cardWidth - 40) / 7;
    const total = days.filter((day) => day.date.startsWith(key)).reduce((sum, day) => sum + day.contributionCount, 0);
    const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const tiles = Array.from({ length: count }, (_, index) => {
      const date = `${key}-${String(index + 1).padStart(2, '0')}`;
      const day = indexed.get(date);
      const column = (index + offset) % 7;
      const row = Math.floor((index + offset) / 7);
      const tx = x + 20 + column * cell;
      const ty = y + 102 + row * 55;
      const width = cell - 5;
      if (!day) return `<g opacity=".35"><rect x="${tx}" y="${ty}" width="${width}" height="48" rx="5" fill="var(--tile-0)"/><text x="${tx + 6}" y="${ty + 16}" font-size="10" fill="var(--subtle)">${index + 1}</text></g>`;
      const level = levelFor(day.contributionCount);
      const ink = `var(--ink-${level})`;
      return `<g class="day" data-day="${day.index}" data-date="${date}" data-count="${day.contributionCount}" aria-label="${date}: ${day.contributionCount} contributions"><title>${date}: ${day.contributionCount} contributions</title><rect class="tile" x="${tx}" y="${ty}" width="${width}" height="48" rx="5" fill="${colors[level]}"/><text x="${tx + 6}" y="${ty + 16}" fill="${ink}" font-size="13">${index + 1}</text><text x="${tx + width - 6}" y="${ty + 40}" text-anchor="end" fill="${ink}" font-size="22" font-weight="600">${day.contributionCount}</text><rect class="selection-outline" x="${tx - 1.5}" y="${ty - 1.5}" width="${width + 3}" height="51" rx="7" fill="none" stroke="var(--selection)" stroke-width="2"/></g>`;
    }).join('');
    const active = days.filter((day) => day.date.startsWith(key) && day.contributionCount > 0).length;
    return `<g class="month" data-month="${key}" data-label="${monthLabel}" data-crop="${x - 8} ${y - 8} ${cardWidth + 16} 476" style="--delay:${monthIndex * 100}ms"><rect x="${x}" y="${y}" width="${cardWidth}" height="460" rx="12" fill="var(--surface)" stroke="var(--border)"/><text x="${x + 20}" y="${y + 32}" font-size="26" font-weight="600" fill="var(--text)">${first.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}<tspan dx="9" fill="var(--subtle)" font-weight="400" font-size="13">${year}</tspan></text><text x="${x + 20}" y="${y + 57}" fill="var(--muted)" font-size="14">${number(total)} contributions<tspan dx="10" fill="var(--subtle)">/ ${active} active days</tspan></text>${['M','T','W','T','F','S','S'].map((label, index) => `<text x="${x + 20 + index * cell + (cell - 5) / 2}" y="${y + 88}" text-anchor="middle" fill="var(--subtle)" font-size="10">${label}</text>`).join('')}${tiles}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="calendar" data-total="${stats.total}" data-active="${stats.active}" data-peak="${stats.peak}" data-longest="${stats.longest}" data-running="true" viewBox="0 0 1200 ${height}" width="1200" height="${height}" role="img" aria-labelledby="calendar-title calendar-description">
<title id="calendar-title">${xml(username)} — Contribution journal</title><desc id="calendar-description">${number(stats.total)} contributions across ${stats.active} active days; best day ${stats.peak}. Longest streak in this window: ${stats.longest} days. Every calendar cell shows its date at top left and exact contribution count at bottom right. ${days[0].date} to ${days.at(-1).date} UTC.</desc>
<style>${themeCss('.calendar', 'html[data-theme="light"] .calendar,.calendar[data-theme="light"]', 'html[data-theme="dark"] .calendar,.calendar[data-theme="dark"]')}.calendar text{font-family:'Geist',system-ui,sans-serif}.calendar .day{cursor:pointer}.calendar .selection-outline{opacity:0;pointer-events:none}.calendar .day[data-selected="true"] .selection-outline{opacity:1}.calendar .day:hover .tile{stroke:var(--selection);stroke-width:1.5}.calendar[data-running="false"] *{animation-play-state:paused!important}@media(prefers-reduced-motion:no-preference){.calendar .month{animation:month-appear .6s ease-out var(--delay) both}.calendar[data-enhanced="true"][data-running="true"] .day[data-selected="true"] .selection-outline{animation:selection-pulse 3s ease-in-out infinite}}@media(prefers-reduced-motion:reduce){.calendar *{animation:none!important;transition:none!important}}@keyframes month-appear{from{opacity:.4;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes selection-pulse{50%{opacity:.4}}</style>
<rect width="1200" height="${height}" rx="16" fill="var(--canvas)"/>
<text x="36" y="38" fill="var(--muted)" font-size="11" letter-spacing="2">${xml(username.toUpperCase())} / CONTRIBUTION JOURNAL</text>
<text x="36" y="99" fill="var(--text)" font-size="46" font-weight="600" letter-spacing="-2">${number(stats.total)}<tspan dx="12" font-size="14" font-weight="400" letter-spacing="0" fill="var(--muted)">contributions</tspan></text>
<text x="490" y="85" fill="var(--text)" font-size="30" font-weight="550">${stats.active}<tspan dx="8" fill="var(--muted)" font-size="12" font-weight="400">active days</tspan></text>
<text x="735" y="85" fill="var(--text)" font-size="30" font-weight="550">${stats.peak}<tspan dx="8" fill="var(--muted)" font-size="12" font-weight="400">busiest day</tspan></text>
<text x="970" y="85" fill="var(--text)" font-size="30" font-weight="550">${stats.longest}<tspan dx="8" fill="var(--muted)" font-size="12" font-weight="400">day best streak</tspan></text>
<text x="36" y="132" fill="var(--subtle)" font-size="12">${days[0].date} — ${days.at(-1).date} · ${days.length} days · UTC</text>
${monthMarkup}
<text x="36" y="${height - 36}" fill="var(--muted)" font-size="11">Date at top left. Contributions at bottom right.</text>
<g transform="translate(690 ${height - 48})"><text x="0" y="12" fill="var(--muted)" font-size="11">Daily contributions</text>${colors.map((color, index) => `<rect x="${130 + index * 77}" width="14" height="14" rx="3" fill="${color}" stroke="var(--border)"/><text x="${150 + index * 77}" y="11" fill="var(--muted)" font-size="10">${['0','1–5','6–15','16–30','31+'][index]}</text>`).join('')}</g></svg>\n`;
}
