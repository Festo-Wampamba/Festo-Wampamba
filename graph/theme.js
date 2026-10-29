// Apply a saved preference before paint; CSS handles the system preference.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('contribution-theme');
    if (['light', 'dark'].includes(saved)) preference = saved;
  } catch { /* System mode also works when browser storage is unavailable. */ }
  document.documentElement.dataset.theme = preference;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#theme-select');
    select.value = preference;
    select.addEventListener('change', () => {
      document.documentElement.dataset.theme = select.value;
      try { localStorage.setItem('contribution-theme', select.value); } catch { /* Keep this session's selection. */ }
    });
  }, { once: true });
})();
