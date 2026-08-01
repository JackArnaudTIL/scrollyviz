# scrolly-core

The parts of a scrollytelling page that don't know anything about the chart
they're driving:

- **`scroller.js`** — wraps Scrollama, watches `.step` elements, calls
  `graphic.renderScene(i)`. Takes any object with `renderScene(i)` and
  `resize()` — never imports a specific chart.
- **`transitions.js`** — `drawPath()`, `fade()`, and the shared easing curve.
  Pure D3-selection helpers; no knowledge of what's being drawn.
- **`scrollytelling.css`** — the sticky graphic / scrolling steps layout
  mechanics. Reads design tokens (`--font-display`, etc.) from the consuming
  app's own stylesheet rather than defining them.

If a change here needs to know what kind of chart it is, it belongs in the
app's own `src/viz/`, not here.
