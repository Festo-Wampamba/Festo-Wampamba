import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('Vercel skips quote-only changes but preserves any code change since the last deployment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quote-build-test-'));
  try {
    git(root, 'init'); git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.com');
    await writeFile(join(root, 'README.md'), 'first'); git(root, 'add', '.'); git(root, 'commit', '-m', 'initial');
    const base = git(root, 'rev-parse', 'HEAD');
    await writeFile(join(root, 'README.md'), 'second'); git(root, 'add', '.'); git(root, 'commit', '-m', 'quote');
    const script = new URL('../scripts/ignore-build.mjs', import.meta.url).pathname;
    const run = env => spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: base, ...env } }).status;
    assert.equal(run({}), 0);
    await writeFile(join(root, 'source.js'), 'export const changed = true;'); git(root, 'add', '.'); git(root, 'commit', '-m', 'code');
    assert.equal(run({}), 1); assert.equal(run({ VERCEL_GIT_PREVIOUS_SHA: '' }), 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('AI batch helper publishes only quote data and preserves a dirty user checkout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quote-submit-test-')), work = join(root, 'work'), remote = join(root, 'origin.git');
  try {
    await mkdir(work); git(root, 'init', '--bare', remote); git(work, 'init', '-b', 'main');
    git(work, 'config', 'user.name', 'Test'); git(work, 'config', 'user.email', 'test@example.com');
    for (const dir of ['scripts', 'quotes', 'assets', 'api', 'tests']) await mkdir(join(work, dir));
    for (const file of ['quotes/engine.mjs', 'quotes/reserve.mjs', 'scripts/palette.mjs', 'api/quote.js', 'assets/quote-state.json', 'scripts/import-quotes.mjs', 'scripts/submit-quote-batch.mjs', 'tests/quotes.test.mjs']) await copyFile(new URL(`../${file}`, import.meta.url), join(work, file));
    await writeFile(join(work, 'package.json'), '{"type":"module"}'); await writeFile(join(work, 'README.md'), 'preserve me');
    git(work, 'add', '.'); git(work, 'commit', '-m', 'fixture'); git(work, 'remote', 'add', 'origin', remote); git(work, 'push', '-u', 'origin', 'main');
    const initial = git(work, 'rev-parse', 'HEAD'); await writeFile(join(work, 'README.md'), 'unfinished user work');
    const batch = join(root, 'batch.json'); await writeFile(batch, JSON.stringify(['A useful experiment can turn an uncertain afternoon into a clearer plan for the work ahead.']));
    const result = spawnSync(process.execPath, ['scripts/submit-quote-batch.mjs', batch], { cwd: work, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /published to main/);
    assert.equal(await readFile(join(work, 'README.md'), 'utf8'), 'unfinished user work'); assert.equal(git(work, 'rev-parse', 'HEAD'), initial);
    git(work, 'fetch', 'origin', 'main'); assert.equal(git(work, 'diff', '--name-only', initial, 'origin/main'), 'assets/quote-state.json');
  } finally { await rm(root, { recursive: true, force: true }); }
});
