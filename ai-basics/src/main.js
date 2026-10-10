import './styles/main.css';
import 'scrolly-core/scrollytelling.css';

import { loadData } from './data/loader.js';
import { steps } from './content/steps.js';
import { createGraphic } from './viz/graphic.js';
import { initScroller } from 'scrolly-core/scroller.js';

// Same bootstrap sequence as scrollyviz-example and polling-sim: build steps → load data →
// build graphic once → wire the scroller.
async function main() {
  buildSteps();

  const data = await loadData();

  const container = document.getElementById('graphic');
  const graphic = createGraphic(container, data).init();
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
