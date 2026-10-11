import { wait } from './motion.js';

// Full-graphic view: the whole generation loop as one diagram, lit up stage
// by stage. Low priority — kept deliberately simple.
const NODES = [
  { title: 'The text so far', note: 'only what fits in the context window' },
  { title: 'Split into tokens', note: 'counted — this is what usage is measured in' },
  { title: 'The model', note: 'its numbers were fixed during training' },
  { title: 'A score for every possible next token', note: 'likely, not checked' },
  { title: 'Pick one and add it to the text', note: 'then go round again' },
];
const BOX = { x: 40, w: 300, h: 54 };
const TOP = 70;
const STEP = 100;

export function createSummary(parent) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  g.append('text').attr('class', 'chart-title').attr('x', BOX.x).attr('y', 36).text('The whole loop');

  g.append('defs')
    .append('marker')
    .attr('id', 'summary-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 9)
    .attr('refY', 5)
    .attr('markerWidth', 7)
    .attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('class', 'arrow-head')
    .attr('d', 'M0,0 L10,5 L0,10 z');

  const cx = BOX.x + BOX.w / 2;
  NODES.slice(1).forEach((_, k) =>
    g.append('line')
      .attr('class', 'arrow')
      .attr('x1', cx)
      .attr('x2', cx)
      .attr('y1', TOP + k * STEP + BOX.h + 4)
      .attr('y2', TOP + (k + 1) * STEP - 4)
      .attr('marker-end', 'url(#summary-arrow)')
  );

  // Loop back from the last stage to the first.
  const loopX = BOX.x + BOX.w + 50;
  const yFirst = TOP + BOX.h / 2;
  const yLast = TOP + (NODES.length - 1) * STEP + BOX.h / 2;
  g.append('path')
    .attr('class', 'arrow')
    .attr('d', `M${BOX.x + BOX.w + 4},${yLast} H${loopX} V${yFirst} H${BOX.x + BOX.w + 6}`)
    .attr('marker-end', 'url(#summary-arrow)');
  g.append('text')
    .attr('class', 'zone-label')
    .attr('transform', `translate(${loopX + 16},${(yFirst + yLast) / 2}) rotate(90)`)
    .attr('text-anchor', 'middle')
    .text('REPEAT');

  const nodes = g
    .selectAll('g.summary-node')
    .data(NODES)
    .join('g')
    .attr('class', 'summary-node')
    .attr('transform', (_, k) => `translate(${BOX.x},${TOP + k * STEP})`);
  nodes.append('rect').attr('width', BOX.w).attr('height', BOX.h).attr('rx', 6);
  nodes.append('text').attr('class', 'node-title').attr('x', 14).attr('y', 22).text((d) => d.title);
  nodes.append('text').attr('class', 'node-note').attr('x', 14).attr('y', 41).text((d) => d.note);

  return {
    g,
    async play(_cfg, alive) {
      for (let k = 0; k < NODES.length; k++) {
        nodes.classed('active', (_, j) => j === k);
        await wait(650);
        if (!alive()) return;
      }
      nodes.classed('active', false);
    },
  };
}
