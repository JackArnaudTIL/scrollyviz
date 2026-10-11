import './styles/main.css';
import 'scrolly-core/scrollytelling.css';

import { loadData } from './data/loader.js';
import { steps } from './content/steps.js';
import { concepts } from './content/concepts.js';
import { createGraphic } from './viz/graphic.js';
import { initScroller } from 'scrolly-core/scroller.js';
import { createProgressNav } from './nav.js';

// Same bootstrap sequence as scrollyviz-example and polling-sim: build steps → load data →
// build graphic once → wire the scroller.
async function main() {
  buildSteps();
  buildGlossary();

  const data = await loadData();

  const container = document.getElementById('graphic');
  const graphic = createGraphic(container, data).init();
  graphic.renderScene(0);

  // The scroller drives the graphic; the progress nav follows along.
  const nav = createProgressNav(steps);
  const tracked = {
    renderScene(i) {
      graphic.renderScene(i);
      nav.setActive(i);
    },
    resize: () => graphic.resize(),
  };
  initScroller(tracked);

  // Dev aid: ?scene=N scrolls straight to step N, so a scene can be tuned or
  // screenshotted without scrolling through the whole story.
  const jump = new URLSearchParams(location.search).get('scene');
  if (jump !== null) {
    document.querySelector(`.step[data-step="${+jump}"]`)?.scrollIntoView({ block: 'center' });
    tracked.renderScene(+jump);
  }
}

function buildSteps() {
  const wrap = document.getElementById('steps');
  wrap.innerHTML = steps
    .map(
      (s, i) => `
        <section class="step" data-step="${i}">
          ${s.section ? sectionBreak(s) : stepCard(s)}
        </section>`
    )
    .join('');
  wrap.querySelectorAll('.concept').forEach(fitTooltip);
}

function stepCard(s) {
  return `
    <div class="step-card">
      <h2>${s.title}</h2>
      ${renderBody(s.body)}
    </div>`;
}

// A pause between groups of steps: the group name as a plain heading.
function sectionBreak(s) {
  return `
    <div class="step-card section-break">
      <h2>${s.section}</h2>
      ${s.body ? renderBody(s.body) : ''}
    </div>`;
}

// Body lines become paragraphs; consecutive lines starting with '•' (leading
// spaces allowed) are grouped into one bulleted list, styled via .step-list.
function renderBody(body) {
  const BULLET = /^\s*•\s*/;
  let html = '';
  let list = [];
  const flush = () => {
    if (list.length) html += `<ul class="step-list">${list.map((li) => `<li>${li}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const raw of [].concat(body)) {
    const line = markConcepts(raw);
    if (BULLET.test(line)) {
      list.push(line.replace(BULLET, ''));
    } else {
      flush();
      html += `<p>${line}</p>`;
    }
  }
  flush();
  return html;
}

// {{key}} or {{key|shown text}} → a key-concept term with a tooltip holding
// its definition from content/concepts.js. Focusable, so it works by keyboard
// and by tap on touch screens.
let tipCount = 0;
function markConcepts(text) {
  return text.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}\}/g, (match, key, shown) => {
    const term = Object.keys(concepts).find((k) => k.toLowerCase() === key.toLowerCase());
    const definition = term && concepts[term];
    if (!definition) {
      console.warn(`Unknown key concept "${key}" — add it to content/concepts.js`);
      return shown ?? key;
    }
    const id = `concept-tip-${++tipCount}`;
    return (
      `<span class="concept" tabindex="0" aria-describedby="${id}">${shown ?? key}` +
      `<span class="concept-tip" id="${id}" role="tooltip">` +
      `${definition}<span class="concept-tip-label">Key concept</span></span></span>`
    );
  });
}

// The "Key concepts" list after the story: every term in content/concepts.js,
// in A–Z order. Keys are lower case, so the first letter is capitalised here.
function buildGlossary() {
  const list = document.getElementById('glossary-list');
  if (!list) return;
  list.innerHTML = Object.entries(concepts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, definition]) => `<dt>${key[0].toUpperCase() + key.slice(1)}</dt><dd>${definition}</dd>`)
    .join('');
}

// Nudge a tooltip left if it would run off the right edge of the screen.
function fitTooltip(term) {
  const tip = term.querySelector('.concept-tip');
  const fit = () => {
    tip.style.setProperty('--tip-shift', '0px');
    const overflow = tip.getBoundingClientRect().right - (document.documentElement.clientWidth - 12);
    if (overflow > 0) tip.style.setProperty('--tip-shift', `${-overflow}px`);
  };
  term.addEventListener('mouseenter', fit);
  term.addEventListener('focus', fit);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  document.getElementById('graphic').innerHTML =
    '<p class="error">Could not load the visualization. Check the data path and reload.</p>';
});
