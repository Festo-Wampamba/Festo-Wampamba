# Operations & Zero-Downtime Recovery Runbook

Last verified: **25 November 2026** (Africa/Kampala).  
This document is the durable operational reference for maintaining `Festo-Wampamba/Festo-Wampamba` and `https://festo-contribution-journal.vercel.app/` with zero downtime, rapid troubleshooting, and safe updates. It contains **no secrets or credential values**.

---

## 1. Architecture & Live Endpoints

| Component | Location / URL | Role |
| --- | --- | --- |
| GitHub profile repository | `https://github.com/Festo-Wampamba/Festo-Wampamba` | README, source generators, committed SVG/JSON snapshots, GitHub Actions |
| Production website (Vercel) | `https://festo-contribution-journal.vercel.app/` | Interactive contribution journal (`/`) |
| GitHub Overview & Stats | `/stats/`, `/profile-stats.svg`, `/profile-stats.json` | Account overview, streaks, code footprint, grade A→green rule |
| Pac-Man Replay | `/pacman/`, `/pacman/pacman-dark.svg`, `/pacman/pacman-light.svg` | Contribution-based Pac-Man replay |
| Motivational Reflections | `/quotes/` | Interactive hourly reflection viewer |
| Live Quote API | `/api/quote`, `/api/quote?format=svg&theme=dark` | Serverless JSON/SVG endpoint reading live `main` state with bundled fallback |
| Build & runtime | Node.js `24.x`, ES modules, `pnpm`, `node scripts/build.mjs` → `dist/` | Zero-credential static build from committed snapshots |

### Deployment model
- **Vercel's GitHub App integration** automatically builds and deploys every non-ignored push to `main` (including commits made by `github-actions[bot]`).
- `scripts/ignore-build.mjs` skips Vercel rebuilds when commits only modify `README.md` and/or `assets/quote-state.json` because `/api/quote` fetches live `assets/quote-state.json` dynamically from `raw.githubusercontent.com`.
- `VERCEL_DEPLOY_HOOK` was intentionally removed (PR #10) and deleted from GitHub Secrets because it duplicated Vercel Git deployments and caused intermittent 30-second timeouts.

---

## 2. Automated Workflows (24/7 Cloud — No Local PC Required)

All eight repository workflows run in GitHub Actions even when your PC is turned off:

| Workflow file | Nominal schedule (Africa/Kampala) | Concurrency group | Secrets / vars used | Failure safety |
| --- | --- | --- | --- | --- |
| `.github/workflows/quotes.yml` | Hourly at `:17` (`17 * * * *`) | `motivation-publication` | `github.token` | Push retry backoff (`5s`/`10s`/`15s`); `/api/quote` projects forward on time even if cron is delayed |
| `.github/workflows/refill-quotes.yml` | Daily at `06:17` (`17 3 * * *`) | `motivation-publication` | `GEMINI_API_KEY`, optional var `GEMINI_MODEL` | Only calls Gemini when `< 120` future quotes remain; 3-model free-tier fallback; 4,704-entry reserve underneath |
| `.github/workflows/quote-review.yml` | 31 May & 30 Nov at `09:00` | — | `github.token` (`issues: write`) | Opens a semi-annual review Issue checklist (idempotent; skips if already open) |
| `.github/workflows/profile-badges.yml` | Daily at `01:47` (`47 22 * * *`) | `profile-badges-refresh` | `github.token`, `YOUTUBE_API_KEY` | Validates response before overwriting; retains last good badges on failure |
| `.github/workflows/update-stats.yml` | Daily at `02:00` (`0 23 * * *`) | `profile-stats-refresh` | `CONTRIBUTIONS_TOKEN \|\| METRICS_TOKEN \|\| github.token` | Validates response before overwriting; retains last good stats on failure |
| `.github/workflows/contribution-graph.yml` | Daily at `02:17` (`17 23 * * *`) | `contribution-graph-${{ github.ref }}` | `CONTRIBUTIONS_TOKEN \|\| github.token` | Validates complete daily range before overwriting; retains last good graph |
| `.github/workflows/pacman.yml` | Daily at `02:43` (`43 23 * * *`) | `profile-pacman-refresh` | `CONTRIBUTIONS_TOKEN \|\| github.token` | Runs tests + build before committing; retains last good replay |
| `.github/workflows/youtube-cards.yml` | Daily at `03:00` (`0 0 * * *`) | `youtube-cards-${{ github.ref }}` | `YOUTUBE_API_KEY` | Validates non-empty videos + JPEG thumbnails; retains last good cards |

---

## 3. Three-Tier Hourly Quote & Dual-Refill System

Core files: `quotes/engine.mjs`, `quotes/reserve.mjs`, `api/quote.js`, `scripts/publish-quote.mjs`, `scripts/import-quotes.mjs`, `scripts/submit-quote-batch.mjs`, `scripts/refill-quotes-gemini.mjs`, `assets/quote-state.json`.

### Key parameters
- **Cadence**: `INTERVAL = 60 * 60 * 1000` (1 hour, 24 slots/day, 168/week).
- **Queue & history bounds**:
  - `MAX_PENDING = 336` (14 full days of future AI reflections).
  - `MAX_RECENT = 168` (7 days of displayed text history).
  - `MAX_USED = 4600` (6+ calendar months of SHA-256 normalized fingerprints; `api/quote.js` ceiling = `1048576` bytes / 1 MB).
- **Commit attribution**: Automated quote commits use author `Festo Wampamba <festotechug@gmail.com>` with committer `github-actions[bot]`:
  - Hourly publish: `chore: publish an automated hourly reflection` (`README.md` + `assets/quote-state.json`).
  - Queue refill: `chore: replenish AI-written inspiration queue` (`assets/quote-state.json` only).

### Three refill tiers (zero conflict)
1. **Tier 1 — Antigravity on-demand refills (primary when active)**:
   - Top up `assets/quote-state.json` up to `336` future quotes via `node scripts/submit-quote-batch.mjs /abs/path/to/batch.json`.
   - As long as `futurePending >= 120` (5 days), the daily cloud Gemini job skips cleanly and uses **zero Gemini API quota**.
2. **Tier 2 — 24/7 Cloud Gemini fallback (`refill-quotes.yml`)**:
   - Shares the `motivation-publication` concurrency group with `quotes.yml` so the two jobs never race.
   - When `futurePending < 120`, calls the GA **Gemini Interactions API** (`POST https://generativelanguage.googleapis.com/v1/interactions`, header `Api-Revision: 2026-05-20`, header `x-goog-api-key`, `store: false`, `generation_config.thinking_level: "low"`, top-level `response_format`).
   - Uses an automatic **3-model free-tier fallback chain**:
     1. `gemini-4-hydrogen` *(default / newest free-tier daily driver)*
     2. `gemini-3.8-flash` *(automatic fallback on 404/408/429/5xx)*
     3. `gemini-3.5-flash-lite` *(high-throughput free-tier fallback)*
   - Generates up to `TARGET_BATCH = 216` reflections (filling toward `336` / 14 days so Gemini runs roughly once every 9 days), sanitizes/validates every entry (`35–230` chars, plain text, no attributions/links/markup), deduplicates against 6-month `used` + `pending` + `reserve`, cryptographically shuffles via `importBatch()`, runs `tests/quotes.test.mjs`, and pushes.
3. **Tier 3 — Built-in 4,704-entry reserve (`quotes/reserve.mjs`)**:
   - `56 × 84 = 4,704` unique original two-sentence reflections (**196 days** at 24/day, longer than any 6 calendar months).
   - Serves automatically if the AI queue ever empties, guaranteeing zero downtime and zero repeats.

### Legacy local Codex status
- Both local Codex automations (`refill-festo-s-inspiration-quotes` and `review-inspiration-system-in-six-months`) were archived out of `~/.codex/automations/` into `~/.codex/automations-disabled/` on 25 Nov 2026 so no duplicate writer can collide with cloud refills.

---

## 4. Secrets & Repository Variables

Configure under **GitHub Repo → Settings → Secrets and variables → Actions**:

| Name | Type | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | Google AI Studio free-tier key for `refill-quotes.yml` (sent only in `x-goog-api-key` header) |
| `METRICS_TOKEN` | Secret | GitHub token for `update-stats.yml` account statistics |
| `YOUTUBE_API_KEY` | Secret | Official YouTube Data API v3 key for `profile-badges.yml` and `youtube-cards.yml` |
| `GEMINI_MODEL` | Variable *(optional)* | Override preferred first model in the fallback chain (default: `gemini-4-hydrogen`) |

*(Never commit keys, paste keys into chat/issues, or pass `GEMINI_API_KEY` in a URL query string.)*

---

## 5. Zero-Downtime Incident & Recovery Playbook

### A. Gemini API returns 404 (model retired) or repeated 429/503
1. **Immediate zero-code mitigation**: Set Actions repository variable `GEMINI_MODEL` to a current official free-tier model (e.g., `gemini-3.5-flash-lite` or Google's newest daily-driver model from `https://aistudio.google.com/docs/models`).
2. **Verify live without touching the queue**:
   ```sh
   gh workflow run refill-quotes.yml -R Festo-Wampamba/Festo-Wampamba --ref main -f verify_api=true
   ```
   Or test your key directly from a terminal (replace `YOUR_KEY` locally):
   ```sh
   curl -sS -X POST "https://generativelanguage.googleapis.com/v1/interactions" \
     -H "Content-Type: application/json" \
     -H "Api-Revision: 2026-05-20" \
     -H "x-goog-api-key: YOUR_KEY" \
     -d '{"model":"gemini-3.5-flash-lite","input":"Reply with OK.","store":false}'
   ```
3. **Update code permanently**: Update `DEFAULT_MODEL` / `DEFAULT_MODELS` in `scripts/refill-quotes-gemini.mjs` and `refill-quotes.yml`, run `pnpm lint && pnpm test`, and open a PR.
4. **If the key itself expired/revoked (HTTP 401/403)**: Generate a new key at `https://aistudio.google.com/apikey`, update the `GEMINI_API_KEY` secret in GitHub, and re-run `verify_api=true`. Meanwhile, the existing queue + 4,704-entry reserve keep production running with zero downtime.

### B. Hourly quote commit delayed or skipped
- GitHub Actions `schedule` is best-effort and may delay runs by 5–30+ minutes.
- `/api/quote` and `/quotes/` automatically project the current hourly slot forward on time; `rotate()` catches up missed slots cleanly on the next run.
- To publish immediately:
  ```sh
  gh workflow run quotes.yml -R Festo-Wampamba/Festo-Wampamba --ref main
  ```

### C. Vercel site looks stale or out of sync with `main`
1. Check Vercel's commit status on the newest non-quote `main` commit:
   ```sh
   gh api repos/Festo-Wampamba/Festo-Wampamba/commits/main/status --jq '.statuses[] | {context, state, description, updated_at}'
   ```
2. Compare live SVG hashes against committed `main` files:
   ```sh
   curl -fsSL https://festo-contribution-journal.vercel.app/contribution-graph-dark.svg | sha256sum
   sha256sum assets/contribution-graph-dark.svg
   ```
3. Confirm Vercel's GitHub App still has access to `Festo-Wampamba/Festo-Wampamba` in Vercel Project Settings → Git. Remember that commits touching *only* `README.md` and `assets/quote-state.json` intentionally report `Canceled by Ignored Build Step`.

### D. Stats, Contribution Graph, Pac-Man, Badges, or YouTube Videos failed
- All five refresh workflows validate upstream responses **before** overwriting committed snapshots, so a failed run never wipes live visuals.
- Inspect the failed step:
  ```sh
  gh run list -R Festo-Wampamba/Festo-Wampamba --status failure --limit 5
  gh run view <RUN_ID> -R Festo-Wampamba/Festo-Wampamba --log-failed | tail -80
  ```
- Once the transient upstream error or expired token (`METRICS_TOKEN` / `YOUTUBE_API_KEY`) is resolved, trigger a manual refresh with `gh workflow run <workflow.yml> -R Festo-Wampamba/Festo-Wampamba --ref main`.

### E. Emergency manual AI queue top-up (Antigravity or local)
1. Check remaining future runway without modifying your checkout:
   ```sh
   node -e "import { readFileSync } from 'node:fs'; import { countFuturePending } from './scripts/refill-quotes-gemini.mjs'; console.log('futurePending:', countFuturePending(JSON.parse(readFileSync('assets/quote-state.json', 'utf8'))));"
   ```
2. Write a JSON array of 1–336 validated plain-text strings to an absolute path and submit safely in an isolated worktree:
   ```sh
   node scripts/submit-quote-batch.mjs /absolute/path/to/batch.json
   ```

---

## 6. Local Verification & Health Check Commands

```sh
# Syntax check, full unit test suite, and static production build (no credentials needed)
pnpm lint
pnpm test
pnpm build

# Local preview server (default http://127.0.0.1:4179/)
pnpm preview

# Live production smoke check
for route in "/" "/stats/" "/pacman/" "/quotes/" "/api/quote"; do
  printf "%s %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' "https://festo-contribution-journal.vercel.app${route}")" "$route"
done
```

---

## 7. Migration Record (23–25 November 2026)

- **PR #10**: Removed redundant `VERCEL_DEPLOY_HOOK` steps from `contribution-graph.yml`, `pacman.yml`, and `update-stats.yml`; deleted `VERCEL_DEPLOY_HOOK` GitHub Actions secret; updated `graph/HOSTING.md`.
- **PR #11**: Switched `quotes.yml` and `quotes/engine.mjs` from 3-hour to 1-hour cadence (`MAX_PENDING = 336`, `MAX_RECENT = 168`, `MAX_USED = 4600`), expanded `quotes/reserve.mjs` to 4,704 entries (196 days), raised `api/quote.js` snapshot cap to 1 MB, and added automatic lossless legacy slot migration.
- **PR #12**: Added 24/7 cloud Gemini fallback workflow (`refill-quotes.yml` + `scripts/refill-quotes-gemini.mjs`), 6-month cloud review Issue workflow (`quote-review.yml`), push-retry backoff on `quotes.yml` / `refill-quotes.yml`, and `tests/quote-refill.test.mjs`.
- **Commit `55bdc74`**: Initial Antigravity Tier-1 batch top-up (+252 reflections → 333 future hourly quotes / ~13.9 days runway).
- **PR #13 & PR #14**: Migrated `refill-quotes-gemini.mjs` to the GA `POST /v1/interactions` API (`Api-Revision: 2026-05-20`), replaced deprecated `gemini-2.5-flash` with the automatic 3-model free-tier chain (`gemini-4-hydrogen` → `gemini-3.8-flash` → `gemini-3.5-flash-lite`), added `--verify-key` / `verify_api`, and verified live in GitHub Actions (run `45608880063`).
- **Local Codex shutdown**: Archived local Codex automations out of `~/.codex/automations/` into `~/.codex/automations-disabled/`.
- **Antigravity Gemini skills**: Installed official `google-gemini/gemini-skills` (`gemini-api-dev`, `gemini-api-cli`, `gemini-live-api-dev`, `gemini-omni-flash-api`).
