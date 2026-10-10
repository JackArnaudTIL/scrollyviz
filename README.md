# scrollyviz

An npm-workspaces monorepo for scrollytelling data-viz pages.

```
scrollyviz-example/   the reference example — small, working, deliberately unchanged
polling-sim/           WIP — the next, more ambitious scroll (scaffold only so far)
ai-basics/             WIP — basic AI concepts for new starters (draft outline, no chart yet)
packages/scrolly-core/ chart-agnostic code shared by every app: Scrollama wiring,
                        motion helpers, and the sticky-layout CSS
site/                  the landing page that links to every app on the deployed site
```

Each app under the top level is a standalone Vite project with its own
`package.json`, `index.html`, and `src/` (steps, data loading, and the chart
itself — the parts that are inherently specific to one story). What's generic
across *any* scrollytelling page lives once, in `packages/scrolly-core/`, and
every app imports it by package name (`scrolly-core/scroller.js`, etc.) rather
than copy-pasting it.

See each app's own README for details.

## Quick start

```bash
npm install                                  # installs and links all workspaces
npm run dev --workspace scrollyviz-example   # http://localhost:5173/scrollyviz/scrollyviz-example/
npm run dev --workspace polling-sim
npm run dev --workspace ai-basics
```

## Building and deploying

The whole repo deploys as **one** GitHub Pages site,
`https://<user>.github.io/scrollyviz/`, with the landing page from `site/` at
the root and each app in its own sub-folder.

```bash
npm run build    # builds every app into dist/<app-name>/ and copies site/ into dist/
npm run preview  # serves dist/ at http://localhost:4173/scrollyviz/
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs the same
`npm run build` and publishes `dist/`. One-time setup in the GitHub repo:
**Settings → Pages → Source → GitHub Actions**.

## Adding a new app

1. Copy an existing app folder (e.g. `polling-sim/`) to `my-app/`.
2. In `my-app/package.json`, set `"name": "my-app"`.
3. In `my-app/vite.config.js`, set `base: '/scrollyviz/my-app/'` and
   `outDir: '../dist/my-app'`.
4. Add `"my-app"` to `workspaces` in the root `package.json`.
5. Add a link to `./my-app/` in `site/index.html`.
6. Run `npm install`, then `npm run dev --workspace my-app`.

## Adding something to the shared package

Ask first: does this code know what kind of chart it's driving? If yes, it
belongs in the app's own `src/viz/`. If no — it's scroll wiring, generic
motion, or layout — it belongs in `packages/scrolly-core/`.
