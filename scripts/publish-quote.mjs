import { readFile, writeFile, rename } from 'node:fs/promises';
import { rotate, quoteReadme } from '../quotes/engine.mjs';
const root = new URL('../', import.meta.url), path = new URL('assets/quote-state.json', root);
const state = JSON.parse(await readFile(path, 'utf8'));
const result = rotate(state);
const readmePath = new URL('README.md', root);
const readme = await readFile(readmePath, 'utf8');
const next = quoteReadme(readme, result.state.current);
if (result.changed) {
  const temp = new URL('assets/.quote-state.tmp', root);
  await writeFile(temp, JSON.stringify(result.state, null, 2) + '\n'); await rename(temp, path);
}
if (readme !== next) await writeFile(readmePath, next);
console.log(result.changed ? `Published quote for slot ${result.state.current.slot}.` : 'This three-hour slot is already published.');
