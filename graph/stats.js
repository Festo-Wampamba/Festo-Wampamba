const layout = document.querySelector('.stats-layout');
const panels = [...document.querySelectorAll('.glass-panel')];
const toggle = document.querySelector('#motion-toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches;
const visible = new Set(panels);
function updateMotion() {
  const stopped = paused || reduced.matches || document.hidden;
  layout.dataset.motion = stopped ? 'paused' : 'playing';
  for (const panel of panels) panel.dataset.motion = stopped || !visible.has(panel) ? 'paused' : 'playing';
  toggle.textContent = paused || reduced.matches ? 'Play animation' : 'Pause animation';
  toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
  toggle.disabled = reduced.matches;
  toggle.title = reduced.matches ? 'Animation follows your reduced-motion preference' : 'Control decorative animation';
}
toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
reduced.addEventListener('change', () => { paused = reduced.matches; updateMotion(); });
document.addEventListener('visibilitychange', updateMotion);
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) visible.add(entry.target);
    else visible.delete(entry.target);
  }
  updateMotion();
});
for (const panel of panels) observer.observe(panel);
updateMotion();
