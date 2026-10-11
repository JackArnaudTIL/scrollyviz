import { range } from 'd3';
import { W, PAD, zones, CONTENT_OFFSET } from './layout.js';
import { dur } from './motion.js';

// The MODEL zone: a small neural network drawn as a node map — input, hidden
// and output layers stacked top to bottom (matching the page's top-to-bottom
// flow). Each connection stands for one of the model's numbers (a weight):
// thicker and darker = larger. Training reweights the connections, sweeping
// backwards from output to input; prediction sends activity forwards.
const LAYERS = [
  { label: 'input', n: 7 },
  { label: 'hidden', n: 9 },
  { label: 'hidden', n: 9 },
  { label: 'output', n: 5 },
];
const ROW_GAP = 46;
const NODE_GAP = 36;
const R = 6;
const STEP = 170; // ms between layers in the pulse / nudge sweeps

// Small seeded PRNG so the network looks the same on every load.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const edgeWidth = (d) => 0.4 + Math.abs(d.w) * 1.8;
const edgeOpacity = (d) => 0.08 + Math.abs(d.w) * 0.5;

export function createModel(parent) {
  const g = parent.append('g').attr('transform', `translate(0,${zones.model.y + CONTENT_OFFSET})`);
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim();
  const paper = css.getPropertyValue('--paper').trim();

  const rng = mulberry32(7);
  const nodes = LAYERS.flatMap((L, l) =>
    range(L.n).map((j) => ({ l, x: W / 2 + (j - (L.n - 1) / 2) * NODE_GAP, y: l * ROW_GAP }))
  );
  const edges = [];
  for (let l = 0; l < LAYERS.length - 1; l++) {
    const from = nodes.filter((d) => d.l === l);
    const to = nodes.filter((d) => d.l === l + 1);
    for (const a of from) for (const b of to) edges.push({ l, a, b, w: rng() * 2 - 1 });
  }

  const edgeSel = g
    .append('g')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('class', 'edge')
    .attr('x1', (d) => d.a.x)
    .attr('y1', (d) => d.a.y)
    .attr('x2', (d) => d.b.x)
    .attr('y2', (d) => d.b.y)
    .attr('stroke-width', edgeWidth)
    .attr('stroke-opacity', edgeOpacity);

  const nodeSel = g
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', 'node')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', R)
    .style('fill', paper);

  LAYERS.forEach((L, l) =>
    g.append('text')
      .attr('class', 'zone-note')
      .attr('x', PAD)
      .attr('y', l * ROW_GAP)
      .attr('dy', '0.35em')
      .text(L.label)
  );

  g.append('text')
    .attr('class', 'zone-note')
    .attr('x', W / 2)
    .attr('y', (LAYERS.length - 1) * ROW_GAP + 28)
    .attr('text-anchor', 'middle')
    .text('Each line is one of the model’s numbers — a real model has billions');

  const lastEdgeLayer = LAYERS.length - 2;

  return {
    // Training: adjust every weight, sweeping backwards from output to input.
    nudge() {
      for (const d of edges) d.w = Math.max(-1, Math.min(1, d.w + (rng() - 0.5) * 0.7));
      edgeSel
        .transition()
        .delay((d) => dur((lastEdgeLayer - d.l) * STEP))
        .duration(dur(220))
        .style('stroke', accent)
        .transition()
        .duration(dur(450))
        .style('stroke', null)
        .attr('stroke-width', edgeWidth)
        .attr('stroke-opacity', edgeOpacity);
    },
    // Prediction: activity flows forward, layer by layer.
    pulse() {
      nodeSel
        .transition('pulse')
        .delay((d) => dur(d.l * STEP))
        .duration(dur(160))
        .style('fill', accent)
        .transition()
        .duration(dur(320))
        .style('fill', paper);
      edgeSel
        .transition('pulse')
        .delay((d) => dur(d.l * STEP + STEP / 2))
        .duration(dur(140))
        .attr('stroke-opacity', (d) => Math.min(1, edgeOpacity(d) + 0.35))
        .transition()
        .duration(dur(300))
        .attr('stroke-opacity', edgeOpacity);
    },
  };
}
