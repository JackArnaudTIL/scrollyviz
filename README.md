# scrollyviz

An npm-workspaces monorepo for scrollytelling data-viz pages.

```
scrollyviz-example/   the reference example — small, working, deliberately unchanged
polling-sim/           WIP — the next, more ambitious scroll (scaffold only so far)
packages/scrolly-core/ chart-agnostic code shared by every app: Scrollama wiring,
                        motion helpers, and the sticky-layout CSS
```

Each app under the top level is a standalone Vite project with its own
`package.json`, `index.html`, and `src/` (steps, data loading, and the chart
itself — the parts that are inherently specific to one story). What's generic
across *any* scrollytelling page lives once, in `packages/scrolly-core/`, and
both apps import it by package name (`scrolly-core/scroller.js`, etc.) rather
than copy-pasting it.

See each app's own README for details.

## Quick start

```bash
npm install                                  # installs and links all workspaces
npm run dev --workspace scrollyviz-example   # http://localhost:5173
npm run dev --workspace polling-sim
```

## Adding something to the shared package

Ask first: does this code know what kind of chart it's driving? If yes, it
belongs in the app's own `src/viz/`. If no — it's scroll wiring, generic
motion, or layout — it belongs in `packages/scrolly-core/`.
