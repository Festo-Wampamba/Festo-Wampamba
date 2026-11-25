# A little momentum

Live page: https://festo-contribution-journal.vercel.app/quotes/
Public JSON: `/api/quote`; SVG: `/api/quote?format=svg&theme=dark` (or `light`).

The Node endpoint reads the bounded snapshot on GitHub main and renders the current hourly slot. The page refreshes automatically at the next slot. No OpenAI API key, database account, paid provider, or Vercel cron job is required. The publisher's GitHub schedule runs at 17 minutes past each hour in GitHub Actions (independent of your local PC) and may be delayed; the endpoint projects queued quotes forward in the meantime, then serves the deterministic reserve when the queue is exhausted. Delayed publication records the same planned slots, so it cannot unexpectedly change the current quote.

## Storage and repeat policy

`assets/quote-state.json` stores up to 336 pending AI-written reflections (two weeks at 24 daily slots), 168 recently displayed full texts (seven days at 24 daily slots), and a six-calendar-month fingerprint history (capped at 4,600 entries). Cleanup runs whenever a new slot is published or an overdue queue is refilled. Text fingerprints normalize punctuation, spacing and case; similar ideas or paraphrases are not guaranteed unique. New AI batches are randomly shuffled without reordering already planned slots. The 4,704-entry original reserve is shared by the publisher and hosted endpoint. Its fixed shuffled order covers 196 days, longer than any six-calendar-month window. AI imports cannot duplicate any reserve entry. Keep the reserve order and content stable during the six-month window; review it before replacing it.

Vercel generates the SVG on demand; image files do not accumulate. Quote-only commits skip full builds while the endpoint reads the latest data. Git retains previous commits, including previous README alternatives and old snapshot contents; deleting current data does not erase Git history. The seven-day policy applies to displayed quote text in the current snapshot, not unused quotes or the permanent fallback collection.

## AI writer, dual refill, and fallback

The GitHub Actions workflow `Publish a fresh reflection` runs every hour in GitHub's cloud (even when your PC is off), updating `README.md` and `assets/quote-state.json` using the owner's previously verified GitHub-associated author email with `github-actions[bot]` as committer. Commit messages explicitly identify automation (`chore: publish an automated hourly reflection`). GitHub can take time to update contribution counts and its image proxy can delay the visible card.

Queue refills follow a three-tier design with zero conflicts:

1. **Antigravity on-demand refills (primary when active)**: Whenever you are working in Antigravity, you can top up `assets/quote-state.json` (up to 336 pending quotes = 14 days) via `scripts/submit-quote-batch.mjs`. Keeping at least 120 future quotes in the queue keeps the cloud Gemini job idle and avoids using Gemini API quota.
2. **Cloud Gemini fallback (`Refill AI inspiration queue (Gemini fallback)`)**: Runs daily in GitHub Actions (~06:17 Africa/Kampala, plus manual trigger), sharing the `motivation-publication` concurrency group with the hourly publisher. Only when fewer than **120 future quotes** (< 5 days) remain does it call the Gemini API (via repository secret `GEMINI_API_KEY` and optional variable `GEMINI_MODEL`, default `gemini-2.5-flash`) to generate up to 168 original reflections, strictly validate and deduplicate them against the 6-month history and reserve, randomly shuffle them via `importBatch()`, verify `tests/quotes.test.mjs`, and push `assets/quote-state.json`. If `GEMINI_API_KEY` is absent, it logs a warning and exits cleanly.
3. **Built-in 4,704-entry reserve**: Whenever the AI queue is empty, the deterministic reserve rotates hourly for 196 days (> 6 calendar months) with zero repeats.

A separate workflow (`Six-month inspiration system review`) opens a review checklist Issue on 31 May and 30 November (09:00 Africa/Kampala), replacing local Codex review schedules. Disable any legacy local Codex refill/review automations on your PC so two writers never compete.

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
