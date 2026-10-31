# Pac-Man profile replay

Production: https://festo-contribution-journal.vercel.app/pacman/

The README selects a gold light/dark SVG. The companion page adds pause, restart, scrubbing, reduced-motion support, and offscreen/background pausing. This is a recorded animation, not keyboard-controlled gameplay. Contributions come from the GitHub GraphQL calendar; arcade points are not additional contributions.

`pacman-contribution-graph` 5.3.1 is isolated here and integrity-locked. Vercel builds only copy the last successful saved assets; they need no API token or renderer dependency. The scheduled workflow refreshes daily and commits only after generation, tests and build succeed. Failed refreshes leave the live assets intact. GitHub may delay scheduled runs.

```sh
pnpm --dir arcade/pacman install --ignore-scripts --frozen-lockfile
node arcade/pacman/generate.mjs --saved
pnpm build
```

To fetch fresh activity, run `node arcade/pacman/generate.mjs` with `GH_TOKEN` or `GITHUB_TOKEN` in the environment. No credentials are published. The renderer is restricted to GitHub's GraphQL endpoint. `raw.svg` is its original output; `data.json` is the contribution snapshot and replay metadata. Both themes share the same replay.

Engine: https://github.com/abozanona/pacman-contribution-graph
