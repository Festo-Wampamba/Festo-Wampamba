const scene = document.querySelector('.scene');
const calendar = scene.querySelector('.calendar');
const motionButton = document.querySelector('#motion-button');
const range = document.querySelector('#day-range');
const output = document.querySelector('#day-output');
const days = [...calendar.querySelectorAll('.day')].sort((a, b) => Number(a.dataset.day) - Number(b.dataset.day));
const months = [...calendar.querySelectorAll('.month')];
const fullView = calendar.getAttribute('viewBox');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 767px)');
const previous = document.querySelector('#previous-month');
const next = document.querySelector('#next-month');
let monthIndex = months.length - 1;
let wantsMotion = true;
let inView = false;

function syncMotion() {
  const enabled = wantsMotion && !reduced.matches;
  calendar.dataset.running = String(enabled && inView && !document.hidden);
  motionButton.disabled = reduced.matches;
  motionButton.setAttribute('aria-pressed', String(enabled));
  motionButton.textContent = reduced.matches ? 'Reduced motion' : enabled ? 'Pause motion' : 'Play motion';
}
function showMonth() {
  const month = months[monthIndex];
  const view = mobile.matches ? month.dataset.crop : fullView;
  calendar.setAttribute('viewBox', view);
  const dimensions = view.split(' ');
  calendar.setAttribute('width', dimensions[2]);
  calendar.setAttribute('height', dimensions[3]);
  document.querySelector('#month-label').textContent = month.dataset.label;
  previous.disabled = monthIndex === 0;
  next.disabled = monthIndex === months.length - 1;
}
function inspect(index) {
  const day = days[index];
  if (!day) return;
  calendar.querySelectorAll('[data-selected]').forEach((node) => node.removeAttribute('data-selected'));
  day.dataset.selected = 'true';
  const count = Number(day.dataset.count);
  const date = new Date(`${day.dataset.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  output.textContent = `${count.toLocaleString()} contribution${count === 1 ? '' : 's'} · ${date}`;
  range.value = String(index);
  range.setAttribute('aria-valuetext', `${date}: ${count} contributions`);
  monthIndex = months.findIndex((month) => day.dataset.date.startsWith(month.dataset.month));
  showMonth();
}
function moveMonth(direction) {
  const target = months[monthIndex + direction];
  if (!target) return;
  const day = days.filter((item) => item.dataset.date.startsWith(target.dataset.month)).at(-1);
  inspect(Number(day.dataset.day));
}
previous.addEventListener('click', () => moveMonth(-1));
next.addEventListener('click', () => moveMonth(1));
mobile.addEventListener('change', showMonth);
range.addEventListener('input', () => inspect(Number(range.value)));
motionButton.addEventListener('click', () => { wantsMotion = !wantsMotion; syncMotion(); });
calendar.addEventListener('pointermove', (event) => {
  const day = event.target.closest('.day');
  if (day && day.dataset.selected !== 'true') inspect(Number(day.dataset.day));
});
calendar.addEventListener('click', (event) => {
  const day = event.target.closest('.day');
  if (day) inspect(Number(day.dataset.day));
});
reduced.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncMotion(); }, { threshold: 0.1 });
observer.observe(scene);
calendar.dataset.enhanced = 'true';
document.querySelectorAll('[data-stat]').forEach((node) => { node.textContent = Number(calendar.dataset[node.dataset.stat]).toLocaleString(); });
for (const selector of ['.mobile-stats', '.toolbar', '.inspector', '.month-nav']) document.querySelector(selector).hidden = false;
range.max = String(days.length - 1);
inspect(days.length - 1);
syncMotion();
