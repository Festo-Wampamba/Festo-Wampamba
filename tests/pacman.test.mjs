import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../arcade/pacman/${name}`, import.meta.url), 'utf8');

test('Pac-Man replay publishes a complete calendar with independently verified totals', async () => {
  const snapshot = JSON.parse(await read('data.json'));
  const dates = snapshot.days.map(day => day.date);
  assert.ok(dates.length >= 365);
  assert.equal(new Set(dates).size, dates.length);
  for (let index = 0; index < dates.length; index++) {
    assert.ok(Number.isSafeInteger(snapshot.days[index].count) && snapshot.days[index].count >= 0);
    if (index) assert.equal(Date.parse(dates[index]) - Date.parse(dates[index - 1]), 86400000);
  }
  assert.equal(snapshot.total, snapshot.days.reduce((sum, day) => sum + day.count, 0));
  assert.equal(snapshot.active, snapshot.days.filter(day => day.count > 0).length);
  assert.equal(snapshot.from, dates[0]);
  assert.equal(snapshot.to, dates.at(-1));
  const html = await read('index.html');
  assert.ok(html.includes(snapshot.total.toLocaleString('en-US')));
  assert.ok(html.includes(`max="${snapshot.duration}"`));
  assert.doesNotMatch(html, /Local preview|unpublished|live snake|<!-- \w+ -->/);
});

test('both Pac-Man themes preserve the same self-contained animated replay', async () => {
  const themes = await Promise.all(['dark', 'light'].map(theme => read(`pacman-${theme}.svg`)));
  for (const svg of themes) {
    assert.match(svg, /viewBox="0 -4 1166 188"/);
    assert.match(svg, /role="img"/);
    assert.match(svg, /<animateTransform\b/);
    assert.doesNotMatch(svg, /<script\b|\bon\w+=|(?:href|src)="(?:https?:|\/\/|data:(?!image\/png;base64,))|gh[pousr]_[A-Za-z0-9]|github_pat_/i);
  }
  const motion = svg => svg.replace(/#[0-9a-f]{6}\b/gi, 'COLOR').match(/<animate(?:Transform)?\b[^>]*>/g);
  assert.deepEqual(motion(themes[0]), motion(themes[1]));
  assert.notEqual(themes[0], themes[1]);
});
