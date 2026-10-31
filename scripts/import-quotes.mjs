import { readFile, writeFile, rename } from 'node:fs/promises';
import { importBatch } from '../quotes/engine.mjs';
const file = process.argv[2]; if (!file) throw new Error('Usage: node scripts/import-quotes.mjs /path/to/quotes.json');
const path = new URL('../assets/quote-state.json', import.meta.url);
const state = JSON.parse(await readFile(path, 'utf8'));
const result = importBatch(state, JSON.parse(await readFile(file, 'utf8')));
if (result.added) { const temp = new URL('../assets/.quote-state.tmp', import.meta.url); await writeFile(temp, JSON.stringify(result.state, null, 2) + '\n'); await rename(temp, path); }
console.log(`Accepted ${result.added} new quotes; ${result.state.pending.length} pending.`);
