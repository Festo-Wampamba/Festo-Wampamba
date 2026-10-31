const text = document.querySelector('#quote-text'), notice = document.querySelector('#notice'), copy = document.querySelector('#copy');
let quote = null, timer = null, controller = null, retryAt = 0;
async function refresh() {
  if (controller || document.hidden) return;
  controller = new AbortController();
  try {
    const response = await fetch('/api/quote', { signal: controller.signal });
    if (!response.ok) throw new Error('Unavailable');
    const value = await response.json();
    if (typeof value.text !== 'string' || value.text.length > 230 || !Number.isFinite(Date.parse(value.nextChangeAt)) || Date.parse(value.nextChangeAt) <= Date.now()) throw new Error('Invalid reflection');
    quote = value; text.textContent = quote.text;
    notice.textContent = ''; retryAt = 0;
  } catch (error) {
    if (error.name !== 'AbortError') { notice.textContent = 'Keeping this reflection while the next one reconnects.'; retryAt = Date.now() + 30000; }
  } finally { controller = null; tick(); }
}
function tick() {
  if (quote && Date.now() >= Date.parse(quote.nextChangeAt) && Date.now() >= retryAt) void refresh();
}
function activity() {
  clearInterval(timer); timer = null;
  if (document.hidden) { controller?.abort(); return; }
  void refresh(); timer = setInterval(() => { tick(); if (!quote && Date.now() >= retryAt) void refresh(); }, 1000);
}
copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(text.textContent); notice.textContent = 'Quote copied. Carry it with you.'; }
  catch { notice.textContent = 'Select the quote text to copy it.'; }
});
document.addEventListener('visibilitychange', activity); activity();
