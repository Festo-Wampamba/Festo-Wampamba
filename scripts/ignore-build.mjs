import { execFileSync } from 'node:child_process';
// Runtime reads the live quote data. Quote-only commits need no new deployment.
try {
  const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (!base || !/^[a-f0-9]{40}$/.test(base)) process.exit(1);
  const files = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  process.exit(files.length && files.every(file => ['README.md', 'assets/quote-state.json'].includes(file)) ? 0 : 1);
} catch { process.exit(1); }
