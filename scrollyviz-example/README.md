# scrollyviz-example

The reference scrollytelling example, kept intentionally small and unchanged
as a working baseline. A single chart stays pinned while narrative text
scrolls past; each text block ("step") drives the chart to a new state
("scene"). Built with **Vite**, **D3**, and **Scrollama**.

This app is one of two in this repo — see the root `README.md` for how it
relates to `polling-sim/` and the shared `packages/scrolly-core/`.

## Quick start

From the repo root:

```bash
npm install
npm run dev --workspace scrollyviz-example   # http://localhost:5173
```

Or from inside this folder: `npm run dev`. Edit any file under `src/` and the
page reloads instantly.

```bash
npm run build    # production build → dist/
npm run preview  # serve the built output locally
```

## How it fits together

The whole design keeps three concerns apart:

- **Steps** — narrative text, one block per scene. Copy lives in
  `src/content/steps.js`.
- **The graphic** — one chart, built once, that *transitions* between states.
  It never rebuilds on scroll. Lives in `src/viz/`.
- **The scroller** — the wiring that detects the active step and calls
  `graphic.renderScene(i)`. Chart-agnostic, so it lives one level up in
  `packages/scrolly-core/scroller.js`, shared with every app in this repo.

The two files you'll edit most:

- **`src/viz/scenes.js`** — your storyboard. A declarative array describing what
  the chart shows at each step (what's highlighted, what's revealed). Reorder or
  insert beats here without touching rendering code.
- **`src/styles/main.css`** — this app's own identity (colors, type, chart
  element styling). The sticky/step *layout mechanics* are shared — see below.

```
src/
├── main.js              entry: build steps → load data → build graphic → wire scroller
├── viz/
│   ├── graphic.js       the sticky chart: init() once, renderScene(i) per step
│   ├── scenes.js        storyboard: step index → chart state
│   └── scales.js        shared scales so every scene shares one coordinate system
├── data/loader.js       fetch + shape the dataset
├── content/steps.js     narrative copy per step
└── styles/main.css      this app's identity: colors, type, chart element styling
public/data/series.json  static dataset, served as-is

../../packages/scrolly-core/   shared across apps — not edited here
├── scroller.js                Scrollama setup; step-enter → renderScene(i)
├── transitions.js             easing, line-draw, fades — all motion in one place
└── scrollytelling.css         the sticky graphic / scrolling steps layout
```

## Using your own data

1. Replace `public/data/series.json`.
2. Update the shaping in `src/data/loader.js` to match your fields.
3. Rewrite `src/viz/scenes.js` (what to show) and `src/content/steps.js` (what to
   say). Adjust `src/viz/graphic.js` only if your chart type changes.

The sample data is illustrative placeholder — swap it before publishing.

## Deploying to GitHub Pages

1. Push to a GitHub repo.
2. Set **`base`** in `vite.config.js` to `'/<sub-path>/'` (it's
   `'/scrollyviz-example/'` by default). For a `<user>.github.io` repo or a
   custom domain, use `'/'` instead.
3. In the repo: **Settings → Pages → Source → GitHub Actions**.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and
   publishes automatically; the live URL appears in the Actions run and under
   Settings → Pages.

## Accessibility

Keyboard focus is visible, and `prefers-reduced-motion` is respected (scene
changes become instant). If you add heavy motion, keep that path in mind.
