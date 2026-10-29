import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { palettes, themeCss, themedSvg } from '../scripts/palette.mjs';

function luminance(hex) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
test('both palettes keep contribution counts, dates and body text readable', () => {
  for (const [theme, palette] of Object.entries(palettes)) {
    for (let index = 0; index < 5; index++) {
      assert.ok(contrast(palette[`tile-${index}`], palette[`ink-${index}`]) >= 4.5, `${theme}: tile ${index}`);
    }
    for (const ink of ['text', 'muted', 'subtle', 'accent']) {
      for (const background of ['page-bg', 'surface', 'canvas']) {
        assert.ok(contrast(palette[ink], palette[background]) >= 4.5, `${theme}: ${ink} on ${background}`);
      }
    }
  }
});
test('standalone image themes can be fixed without changing contribution data', () => {
  const svg = '<svg class="calendar"><text>1200 contributions</text></svg>';
  for (const theme of ['light', 'dark']) {
    assert.equal(themedSvg(svg, theme), `<svg class="calendar" data-theme="${theme}"><text>1200 contributions</text></svg>`);
  }
  assert.match(themeCss(':root', '.light', '.dark'), /@media\(prefers-color-scheme:dark\)/);
  assert.throws(() => themedSvg(svg, 'unknown'), /Invalid/);
});
test('theme selection persists and falls back safely when storage is unavailable', async () => {
  const source = await readFile(new URL('../graph/theme.js', import.meta.url), 'utf8');
  for (const saved of ['light', 'dark', 'invalid', null, 'unavailable']) {
    let ready;
    let change;
    let stored;
    const select = { value: '', addEventListener: (_, callback) => { change = callback; } };
    const root = { dataset: {} };
    runInNewContext(source, {
      document: { documentElement: root, addEventListener: (_, callback) => { ready = callback; }, querySelector: () => select },
      localStorage: { getItem() { if (saved === 'unavailable') throw new Error('Storage disabled'); return saved; }, setItem(_, value) { stored = value; } },
    });
    assert.equal(root.dataset.theme, ['light', 'dark'].includes(saved) ? saved : 'system');
    ready();
    assert.equal(select.value, root.dataset.theme);
    select.value = 'dark';
    change();
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(stored, 'dark');
    select.value = 'system';
    change();
    assert.equal(root.dataset.theme, 'system');
  }
});
