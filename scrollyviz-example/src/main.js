import './styles/main.css';
import 'scrolly-core/scrollytelling.css';

import { loadData } from './data/loader.js';
import { steps } from './content/steps.js';
import { createGraphic } from './viz/graphic.js';
import { initScroller } from 'scrolly-core/scroller.js';

// Bootstrap sequence, top to bottom:
//   1. build the step DOM from content
//   2. load + shape data
//   3. build the graphic once
//   4. wire the scroller so steps drive scenes
async function main() {
  buildSteps();

  const data = await loadData();

  const container = document.getElementById('graphic');
  const graphic = createGraphic(container, data).init();

  // Render the first scene immediately so the graphic isn't blank before scroll.
  graphic.renderScene(0);

  initScroller(graphic);
}

function buildSteps() {
  const wrap = document.getElementById('steps');
  wrap.innerHTML = steps
    .map(
      (s, i) => `
        <section class="step" data-step="${i}">
          <h2>${s.title}</h2>
          <p>${s.body}</p>
        </section>`
    )
    .join('');
}

main().catch((err) => {
  console.error('Failed to start:', err);
  document.getElementById('graphic').innerHTML =
    '<p class="error">Could not load the visualization. Check the data path and reload.</p>';
});
