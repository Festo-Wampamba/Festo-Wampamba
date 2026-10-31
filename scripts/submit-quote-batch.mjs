// Publish AI batches in a disposable worktree; never disturb the user's checkout.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateText } from '../quotes/engine.mjs';
const input = process.argv[2]; if (!input) throw new Error('Usage: node scripts/submit-quote-batch.mjs /path/to/quotes.json');
const file = resolve(input), body = await readFile(file, 'utf8');
if (body.length > 64000) throw new Error('Batch too large.');
const texts = JSON.parse(body); if (!Array.isArray(texts) || texts.length < 1 || texts.length > 112) throw new Error('Invalid quote batch.');
texts.forEach(validateText);
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'festo-quote-refill-')), work = join(scratch, 'repo');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let added = false;
try {
  git(['fetch', 'origin', 'main']); git(['worktree', 'add', '--detach', work, 'origin/main']); added = true;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) { git(['fetch', 'origin', 'main']); git(['reset', '--hard', 'origin/main'], work); }
    console.log(execFileSync(process.execPath, ['scripts/import-quotes.mjs', file], { cwd: work, encoding: 'utf8' }).trim());
    if (!git(['status', '--porcelain', '--', 'assets/quote-state.json'], work).trim()) { console.log('No new quotes to publish.'); break; }
    execFileSync(process.execPath, ['--test', 'tests/quotes.test.mjs'], { cwd: work, stdio: 'pipe' });
    git(['add', 'assets/quote-state.json'], work);
    git(['-c', 'user.name=Festo Wampamba', '-c', 'user.email=festotechug@gmail.com', 'commit', '-m', 'chore: replenish AI-written inspiration queue'], work);
    try { git(['push', 'origin', 'HEAD:main'], work); console.log('AI quote queue published to main.'); break; }
    catch { if (attempt === 2) throw new Error('Concurrent updates prevented publication; no force push was attempted.'); }
  }
} finally {
  if (added) git(['worktree', 'remove', '--force', work]);
  await rm(scratch, { recursive: true, force: true });
}
