import { easeCubicInOut } from 'd3';
import { W, PAD, appendWrapped } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view for "What the Numbers Mean": embeddings as positions on a
// map of meaning. Tokens start scattered at random, then glide into clusters
// (days, months, work words, small words) — standing in for what training does
// to embeddings, and leading into the "how a model learns" steps.
const MAP = { x: PAD, y: 40, w: W - 2 * PAD, h: 470 };
const INSET = 34; // keep labels clear of the frame

// Small seeded PRNG so the "random" starting positions are the same each time.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMeaningView(parent, data) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);
  const sx = (v) => MAP.x + INSET + v * (MAP.w - 2 * INSET);
  const sy = (v) => MAP.y + INSET + v * (MAP.h - 2 * INSET);

  const rng = mulberry32(11);
  const points = data.points.map((p) => ({ ...p, rx: rng(), ry: rng(), focus: p.t === data.focus }));

  g.append('text').attr('class', 'zone-label').attr('x', MAP.x).attr('y', MAP.y - 12).text('A MAP OF MEANING');
  g.append('rect').attr('class', 'map-frame').attr('x', MAP.x).attr('y', MAP.y).attr('width', MAP.w).attr('height', MAP.h).attr('rx', 8);

  // Group labels, placed above each cluster's learned position.
  const groupLabels = g
    .append('g')
    .selectAll('text')
    .data(Object.entries(data.groups))
    .join('text')
    .attr('class', 'map-group')
    .attr('text-anchor', 'middle')
    .each(function ([key]) {
      const members = points.filter((p) => p.g === key);
      const cx = members.reduce((a, p) => a + p.x, 0) / members.length;
      const top = Math.min(...members.map((p) => p.y));
      this.setAttribute('x', sx(cx));
      this.setAttribute('y', sy(top) - 22);
    })
    .text(([, label]) => label);

  const dots = g
    .append('g')
    .selectAll('g')
    .data(points)
    .join('g')
    .attr('class', (p) => `map-point${p.focus ? ' focus' : ''}`);
  dots.append('circle').attr('r', (p) => (p.focus ? 5.5 : 4));
  dots.append('text').attr('x', 8).attr('dy', '0.35em').text((p) => p.t);

  const caption = g.append('g').attr('transform', `translate(${PAD},${MAP.y + MAP.h + 30})`);
  const status = caption.append('text').attr('class', 'fact');
  appendWrapped(caption, data.note, { x: 0, y: 22, maxChars: 78, lineHeight: 14, cls: 'footnote' });

  const place = (sel, key) => sel.attr('transform', (p) => `translate(${sx(p[key === 'random' ? 'rx' : 'x'])},${sy(p[key === 'random' ? 'ry' : 'y'])})`);

  return {
    g,
    async play(_cfg, alive) {
      dots.interrupt();
      place(dots, 'random');
      groupLabels.interrupt().style('opacity', 0);
      status.text('Before training: positions are random.');

      await wait(1200);
      if (!alive()) return;

      status.text('After training: similar words end up close together.');
      dots
        .transition()
        .delay((p, i) => dur(i * 40))
        .duration(dur(2200))
        .ease(easeCubicInOut)
        .attr('transform', (p) => `translate(${sx(p.x)},${sy(p.y)})`);
      await wait(2200 + points.length * 40);
      if (!alive()) return;

      groupLabels.transition().duration(dur(500)).style('opacity', 1);
    },
  };
}
