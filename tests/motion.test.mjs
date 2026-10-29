import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('motion respects pause, reduced motion, visibility, and offscreen state', async () => {
  const node = (dataset = {}) => ({
    dataset, events: {}, hidden: false, attributes: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? '0 0 1200 628'; },
    removeAttribute(name) { delete this.attributes[name]; },
  });
  const day = node({ day: '0', date: '2026-10-29', count: '7' });
  const calendar = node();
  calendar.querySelectorAll = (selector) => selector === '.day' ? [day] : selector === '.month' ? [node({ month: '2026-10', label: 'October 2026', crop: '0 0 360 380' })] : [];
  const scene = node();
  scene.querySelector = () => calendar;
  const button = node();
  const elements = {
    '.scene': scene, '#motion-button': button, '#day-range': node(), '#day-output': node(),
    '.toolbar': node(), '.inspector': node(), '.mobile-stats': node(), '.month-nav': node(), '#previous-month': node(), '#next-month': node(), '#month-label': node(),
  };
  const doc = {
    hidden: false, events: {}, querySelector: (selector) => elements[selector], querySelectorAll: () => [],
    addEventListener(name, callback) { this.events[name] = callback; },
  };
  const media = { matches: false, addEventListener(name, callback) { this.change = callback; } };
  const mobile = { matches: false, addEventListener() {} };
  let intersection;
  class Observer {
    constructor(callback) { intersection = callback; }
    observe() {}
  }
  const source = await readFile(new URL('../graph/app.js', import.meta.url), 'utf8');
  runInNewContext(source, { document: doc, matchMedia: (query) => query.includes('prefers-reduced-motion') ? media : mobile, IntersectionObserver: Observer });
  assert.equal(calendar.dataset.running, 'false');
  intersection([{ isIntersecting: true }]);
  assert.equal(calendar.dataset.running, 'true');
  button.events.click();
  assert.equal(calendar.dataset.running, 'false');
  intersection([{ isIntersecting: false }]);
  intersection([{ isIntersecting: true }]);
  assert.equal(calendar.dataset.running, 'false', 'scrolling must not cancel a manual pause');
  button.events.click();
  assert.equal(calendar.dataset.running, 'true');
  intersection([{ isIntersecting: false }]);
  assert.equal(calendar.dataset.running, 'false');
  intersection([{ isIntersecting: true }]);
  doc.hidden = true;
  doc.events.visibilitychange();
  assert.equal(calendar.dataset.running, 'false');
  doc.hidden = false;
  doc.events.visibilitychange();
  assert.equal(calendar.dataset.running, 'true');
  media.matches = true;
  media.change();
  assert.equal(calendar.dataset.running, 'false');
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Reduced motion');
  media.matches = false;
  media.change();
  assert.equal(calendar.dataset.running, 'true');
  assert.equal(button.disabled, false);
});
