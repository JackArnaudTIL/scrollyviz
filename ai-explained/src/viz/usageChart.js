import { scaleBand, scaleLinear, axisBottom, axisLeft } from 'd3';
import { W, H, PAD } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view: tokens as the unit of usage (and cost). Two tiles explain
// input vs output tokens; a stacked bar per conversation turn shows input
// growing, because the whole conversation is sent again every turn.
const m = { top: 250, right: 24, bottom: 120, left: 60 };

export function createUsageChart(parent, usage) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);
  const { turns, totals, wordsPerToken } = usage;

  g.append('text').attr('class', 'chart-title').attr('x', PAD).attr('y', 34).text('Tokens are how usage is counted');
  g.append('text')
    .attr('class', 'chart-sub')
    .attr('x', PAD)
    .attr('y', 56)
    .text(`Rule of thumb: 1 token ≈ ${wordsPerToken} of an English word`);

  // Input / output tiles
  const tiles = g.append('g');
  const TILE_W = (W - 2 * PAD - 12) / 2;
  [
    { cls: 'input', title: 'Input tokens', lines: ['Everything the model reads:', 'your message, the conversation', 'so far, any attached documents'] },
    { cls: 'output', title: 'Output tokens', lines: ['Everything the model writes.', 'Usually priced higher per', 'token than input.'] },
  ].forEach((t, i) => {
    const tg = tiles.append('g').attr('transform', `translate(${PAD + i * (TILE_W + 12)},80)`);
    tg.append('rect').attr('class', `tile tile-${t.cls}`).attr('width', TILE_W).attr('height', 104).attr('rx', 6);
    tg.append('text').attr('class', 'tile-title').attr('x', 12).attr('y', 26).text(t.title);
    t.lines.forEach((l, j) => tg.append('text').attr('class', 'tile-text').attr('x', 12).attr('y', 50 + j * 17).text(l));
  });

  // Stacked bars per turn
  const x = scaleBand()
    .domain(turns.map((d) => d.turn))
    .range([m.left, W - m.right])
    .padding(0.3);
  const y = scaleLinear()
    .domain([0, Math.max(...turns.map((d) => d.input + d.output))])
    .nice()
    .range([H - m.bottom, m.top]);

  g.append('text').attr('class', 'row-label').attr('x', PAD).attr('y', m.top - 22).text('Tokens per turn of one conversation (illustrative)');
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - m.bottom})`)
    .call(axisBottom(x).tickFormat((t) => `Turn ${t}`).tickSizeOuter(0));
  g.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(axisLeft(y).ticks(5).tickSizeOuter(0));

  const cols = g
    .append('g')
    .selectAll('g')
    .data(turns)
    .join('g');
  const inBars = cols.append('rect').attr('class', 'usage-in').attr('x', (d) => x(d.turn)).attr('width', x.bandwidth());
  const outBars = cols.append('rect').attr('class', 'usage-out').attr('x', (d) => x(d.turn)).attr('width', x.bandwidth());

  const legend = g.append('g').attr('transform', `translate(${m.left},${H - m.bottom + 40})`);
  legend.append('rect').attr('class', 'usage-in').attr('width', 12).attr('height', 12);
  legend.append('text').attr('class', 'tile-text').attr('x', 18).attr('y', 10).text('input');
  legend.append('rect').attr('class', 'usage-out').attr('x', 70).attr('width', 12).attr('height', 12);
  legend.append('text').attr('class', 'tile-text').attr('x', 88).attr('y', 10).text('output');

  const notes = g.append('g').style('opacity', 0);
  notes.append('text').attr('class', 'fact').attr('x', PAD).attr('y', H - 46).text('The whole conversation is re-read every turn, so');
  notes.append('text').attr('class', 'fact').attr('x', PAD).attr('y', H - 26).text(`${turns.length} turns use ${totals.input.toLocaleString()} input + ${totals.output.toLocaleString()} output tokens.`);

  const base = y(0);

  return {
    g,
    async play(_cfg, alive) {
      tiles.style('opacity', 0);
      notes.style('opacity', 0);
      inBars.attr('y', base).attr('height', 0);
      outBars.attr('y', base).attr('height', 0);

      tiles.transition().duration(dur(500)).style('opacity', 1);
      await wait(800);
      if (!alive()) return;

      inBars
        .transition()
        .delay((d, i) => dur(i * 350))
        .duration(dur(400))
        .attr('y', (d) => y(d.input))
        .attr('height', (d) => base - y(d.input));
      outBars
        .transition()
        .delay((d, i) => dur(i * 350 + 200))
        .duration(dur(300))
        .attr('y', (d) => y(d.input + d.output))
        .attr('height', (d) => y(d.input) - y(d.input + d.output));
      await wait(turns.length * 350 + 500);
      if (!alive()) return;

      notes.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
