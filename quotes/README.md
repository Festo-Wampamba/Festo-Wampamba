# A little momentum

Live page: https://festo-contribution-journal.vercel.app/quotes/
Public JSON: `/api/quote`; SVG: `/api/quote?format=svg&theme=dark` (or `light`).

The Node endpoint reads the bounded snapshot on GitHub main and renders the current hourly slot. The page refreshes automatically at the next slot. No OpenAI API key, database account, paid provider, or Vercel cron job is required. The publisher's GitHub schedule runs at 17 minutes past each hour in GitHub Actions (independent of your local PC) and may be delayed; the endpoint projects queued quotes forward in the meantime, then serves the deterministic reserve when the queue is exhausted. Delayed publication records the same planned slots, so it cannot unexpectedly change the current quote.

## Storage and repeat policy

`assets/quote-state.json` stores up to 336 pending AI-written reflections (two weeks at 24 daily slots), 168 recently displayed full texts (seven days at 24 daily slots), and a six-calendar-month fingerprint history (capped at 4,600 entries). Cleanup runs whenever a new slot is published or an overdue queue is refilled. Text fingerprints normalize punctuation, spacing and case; similar ideas or paraphrases are not guaranteed unique. New AI batches are randomly shuffled without reordering already planned slots. The 4,704-entry original reserve is shared by the publisher and hosted endpoint. Its fixed shuffled order covers 196 days, longer than any six-calendar-month window. AI imports cannot duplicate any reserve entry. Keep the reserve order and content stable during the six-month window; review it before replacing it.

Vercel generates the SVG on demand; image files do not accumulate. Quote-only commits skip full builds while the endpoint reads the latest data. Git retains previous commits, including previous README alternatives and old snapshot contents; deleting current data does not erase Git history. The seven-day policy applies to displayed quote text in the current snapshot, not unused quotes or the permanent fallback collection.

## AI writer and fallback

The GitHub Actions workflow `Publish a fresh reflection` runs every hour in GitHub's cloud (even when your PC is off), updating `README.md` and `assets/quote-state.json` using the owner's previously verified GitHub-associated author email with `github-actions[bot]` as committer. Commit messages explicitly identify automation (`chore: publish an automated hourly reflection`). GitHub can take time to update contribution counts and its image proxy can delay the visible card.

Fresh AI-written batches (up to 336 pending quotes, e.g. 168 for a week) can be imported on demand in Antigravity using `scripts/submit-quote-batch.mjs` without any paid API key. Whenever the AI queue empties, the 4,704-entry reserve continues rotating hourly for over six calendar months with zero repeats. Disable any local Codex refill automation before using on-demand refills so two writers never run concurrently.

## Maintenance

```sh
pnpm lint
pnpm test
pnpm build
pnpm preview
# http://127.0.0.1:4179/quotes/

# Validate and import quotes into the current checkout, without publishing:
node scripts/import-quotes.mjs /absolute/path/to/quotes.json

# Safely validate, test and publish an AI batch in an isolated worktree:
node scripts/submit-quote-batch.mjs /absolute/path/to/quotes.json

# Publish current slot locally (idempotent):
node scripts/publish-quote.mjs
```

Batch format: JSON array of plain-text strings, each 35–230 characters. No HTML, URLs, multiline strings, oversized words or unsupported author attributions. The submit helper retries concurrent updates without force pushes or changes to the user's checkout. Schedules should use this helper; no agent needs to edit workflow files or the quote renderer for a refill.
