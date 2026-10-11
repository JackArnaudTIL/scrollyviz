// Timing helpers for this app's multi-step sequences (training loop, token
// picking). Generic fades live in scrolly-core/transitions.js; these exist
// because d3 transitions ignore the CSS reduced-motion rule, so every duration
// and pause here goes through dur() and collapses to 0 when motion is reduced.
const reduceMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const dur = (ms) => (reduceMotion ? 0 : ms);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, dur(ms)));

export function fadeTo(selection, opacity, ms = 500) {
  selection.transition().duration(dur(ms)).style('opacity', opacity);
}
