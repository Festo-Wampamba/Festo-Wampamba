# Contribution graph

This replaces the shared activity-graph service with a dependency-free Node.js SVG generator. The profile README loads `assets/contribution-graph.svg` from this repository. Visitors never make a GitHub API request. A failed refresh exits unsuccessfully and leaves the last good SVG untouched.

The graph is a monthly contribution calendar for the current and previous UTC calendar months, through today. Every cell shows the date at top left and the exact contribution count at bottom right. Fixed colour bands (0, 1–5, 6–15, 16–30, 31+) let months be compared without changing the scale. Each month has a total and active-day count. Overall metrics include total contributions, active days, highest daily count, and the longest active streak inside this window. Today can be incomplete; faded dates outside the window are not included in totals.

The hosted page adds day inspection, a keyboard-accessible day slider, and a pause/play control for subtle highlighting. On phones it displays one readable month at a time with previous/next navigation. It respects reduced motion and stops animations when offscreen or the document is hidden. The SVG contains no scripts or external resources, and its still image remains useful where animation is unsupported. GitHub README embeds do not provide the hosted page controls. No runtime API or additional dependencies are used.

## Palette and themes

The gold/yellow palette matches the profile README. Light mode uses warm cream surfaces; dark mode uses GitHub-like charcoal. Text, tiles, controls and selection outlines all adapt. The hosted page defaults to **System**, follows the device preference, and offers **Light** and **Dark** overrides that are saved in the browser. Both palettes are defined in `scripts/palette.mjs`; tests require at least 4.5:1 contrast for contribution counts and regular text.

The automatic image is `contribution-graph.svg`. Explicit variants are `contribution-graph-light.svg` and `contribution-graph-dark.svg`. All three are generated together, and the README's `<picture>` selects the matching variant. The automatic SVG also contains a colour-scheme media query for other embeds. The hosted page and SVG use the same palette source.

## Refresh and preview locally

Use Node.js 24 and pnpm. No package installation is necessary.

```sh
cd /home/festo/Festo-Wampamba
pnpm lint
pnpm test
pnpm generate
pnpm build
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4174`. Refresh requires `GH_TOKEN` or `GITHUB_TOKEN` in the environment. You can load your existing GitHub CLI authentication for that command with `GH_TOKEN="$(gh auth token)" pnpm generate`. Never put the token in the README, a public URL, or a committed file. Building/serving a saved SVG requires no credentials or network access.

## GitHub refresh workflow

After these changes are published to `main`, the **Refresh contribution graph** workflow runs daily around 02:17 Africa/Kampala and can also be run manually. GitHub can delay scheduled workflows, and schedules in inactive public repositories can be disabled after 60 days. Check Actions if the displayed refresh date stops advancing.

The default repository `GITHUB_TOKEN` is used for public contribution data and committing the SVG. Repository rules must permit that bot to push the generated asset to `main`. No personal token is needed for this default setup. To include contributions visible only to your authenticated account, optionally add a repository Actions secret named `CONTRIBUTIONS_TOKEN` with suitable read access. The generated image publishes aggregate daily counts only; it contains no repository names. Token visibility affects counts, so a local refresh with a personal token can differ from the default workflow. Counts follow GitHub's contribution rules, rather than counting every commit in every branch.

## Vercel

Import `Festo-Wampamba/Festo-Wampamba` as a **new** Vercel project with repository root `.` and framework **Other**. `vercel.json` sets the build command and `dist` output directory. The build copies the saved SVG; no GitHub token is needed in Vercel. Only `dist` is published.

Publish the local repository changes before importing it through Vercel's Git integration. The configured build is `node scripts/build.mjs`, and the output directory is `dist`. Node.js 24 is required. The build includes the theme controls, shared palette stylesheet, and all three SVG variants.

The image URL will be `https://YOUR-PROJECT.vercel.app/contribution-graph.svg`. The README already uses the repository copy for reliability. You can use the hosted URL in other websites, or replace the README image source with it after verifying that deployment.

For daily hosted refreshes, create a Vercel Deploy Hook targeting `main`, then store its URL as the repository Actions secret `VERCEL_DEPLOY_HOOK`. The refresh workflow calls it after saving the SVG. This explicitly requests a build instead of depending on bot-authored push behavior in the Git integration. A successful hook request only queues deployment; verify Vercel's final deployment status. No hook is needed for the repository image to update. Your Vercel plan and usage limits still apply.

## Your own server

Serve the `dist/` directory as static files with Nginx, Caddy, or your current web server. Use a public HTTPS hostname for embedding images on GitHub. The SVG is `/contribution-graph.svg`. No persistent Node.js process, database, or Docker container is required.

To update independently of GitHub Actions, keep a working checkout on the server, supply a read-only GitHub token to the refresh process using a protected environment file, and schedule `pnpm generate && pnpm build` once daily from that checkout. Never expose the repository root or environment file as the web root. Configure your web server to cache the SVG for a short period, for example five minutes. You can alternatively deploy the saved SVG from this repository without keeping any GitHub credentials on your web server. Existing hosting/domain costs still apply.

## References

- [GitHub contribution calendar API](https://docs.github.com/en/graphql/reference/users#contributioncalendar)
- [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Vercel build/output configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel Deploy Hooks](https://vercel.com/docs/deploy-hooks)
