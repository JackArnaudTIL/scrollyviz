import { easeCubicInOut } from 'd3';
import { PAD, W, appendWrapped } from './layout.js';
import { dur, wait } from './motion.js';
import { display } from './tokens.js';

// Full-graphic view for "Choosing a Token": the "plan by" prediction reshaped
// by temperature (low → nearly always the top token; high → flatter, with the
// long tail of other tokens rising), then five runs at the default setting
// showing that sampling gives different picks.
const DIAL = { y: 70, x0: PAD + 10, x1: PAD + 290 };
const BARS_TOP = 172;
const ROW_H = 26;
const BAR_X = 120;
const BAR_MAX = W - 2 * PAD - BAR_X - 50;
const TAIL_PIECES = 20; // the "other tokens" probability, spread over many tokens

// Reshape probabilities by temperature: p^(1/T), renormalised.
function atTemperature(dist, tail, t) {
  const pieces = [...dist.map(([, p]) => p), ...Array(TAIL_PIECES).fill(tail / TAIL_PIECES)];
  const scaled = pieces.map((p) => p ** (1 / t));
  const total = scaled.reduce((a, b) => a + b, 0);
  const shown = scaled.slice(0, dist.length).map((p) => p / total);
  const other = scaled.slice(dist.length).reduce((a, b) => a + b, 0) / total;
  return [...shown, other];
}

export function createSamplingView(parent, data) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);
  const { dist, temperatures, runs, note } = data;
  const tail = 1 - dist.reduce((a, [, p]) => a + p, 0);
  const labels = [...dist.map(([t]) => display(t)), 'other tokens'];
  const byLabel = Object.fromEntries(temperatures.map((x) => [x.label, x]));

  // Measure the monospace font so each run's pick sits right after the context.
  const probe = g.append('text').attr('class', 'attn-token').text('M'.repeat(20));
  const charW = probe.node().getComputedTextLength() / 20 || 7.2;
  probe.remove();
  const RUN_CONTEXT = '…recovery plan by';

  // ---- Temperature dial ----
  g.append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', DIAL.y - 30).text('TEMPERATURE');
  g.append('line').attr('class', 'dial-track').attr('x1', DIAL.x0).attr('x2', DIAL.x1).attr('y1', DIAL.y).attr('y2', DIAL.y);
  const stopX = (i) => DIAL.x0 + (i / (temperatures.length - 1)) * (DIAL.x1 - DIAL.x0);
  temperatures.forEach((x, i) => {
    g.append('circle').attr('class', 'dial-stop').attr('cx', stopX(i)).attr('cy', DIAL.y).attr('r', 3);
    g.append('text').attr('class', 'demo-sub').attr('x', stopX(i)).attr('y', DIAL.y + 22).attr('text-anchor', 'middle').text(x.label);
  });
  const knob = g.append('circle').attr('class', 'dial-knob').attr('cy', DIAL.y).attr('r', 8);
  const status = g.append('text').attr('class', 'demo-sub').attr('x', PAD).attr('y', DIAL.y + 48);

  // ---- Bars ----
  g.append('text').attr('class', 'out-caption').attr('x', PAD).attr('y', BARS_TOP - 14).text('The model’s prediction after “…recovery plan by”:');
  const rows = g
    .append('g')
    .attr('transform', `translate(${PAD},${BARS_TOP})`)
    .selectAll('g')
    .data(labels)
    .join('g')
    .attr('class', (_, i) => `bar-row${i === 0 ? ' picked' : ''}`)
    .attr('transform', (_, i) => `translate(0,${i * ROW_H})`);
  rows.append('text').attr('class', 'bar-label').attr('x', BAR_X - 8).attr('y', ROW_H / 2 - 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => d);
  const bars = rows.append('rect').attr('class', 'bar').attr('x', BAR_X).attr('y', 3).attr('height', ROW_H - 10).attr('rx', 2);
  const pcts = rows.append('text').attr('class', 'bar-pct').attr('y', ROW_H / 2 - 2).attr('dy', '0.35em');

  // ---- Five runs ----
  const runsTop = BARS_TOP + labels.length * ROW_H + 40;
  const runsG = g.append('g').attr('transform', `translate(${PAD},${runsTop})`);
  runsG.append('text').attr('class', 'zone-label').text('FIVE RUNS AT THE DEFAULT TEMPERATURE');
  const runRows = runsG
    .selectAll('g.run')
    .data(runs)
    .join('g')
    .attr('class', 'run')
    .attr('transform', (_, i) => `translate(0,${22 + i * 22})`);
  runRows.append('text').attr('class', 'demo-sub').attr('y', 0).attr('dy', '0.35em').text((_, i) => `Run ${i + 1}`);
  runRows.append('text').attr('class', 'attn-token').attr('x', 56).attr('dy', '0.35em').text(RUN_CONTEXT);
  runRows
    .append('text')
    .attr('class', (d) => `attn-token run-pick${d === dist[0][0] ? '' : ' different'}`)
    .attr('x', 56 + (RUN_CONTEXT.length + 1) * charW)
    .attr('dy', '0.35em')
    .text((d) => d.trim());

  const foot = g.append('g').attr('transform', `translate(${PAD},${runsTop + 22 + runs.length * 22 + 20})`);
  appendWrapped(foot, note, { x: 0, y: 0, maxChars: 78, lineHeight: 14, cls: 'footnote' });

  const setTemperature = (label, ms) => {
    const i = temperatures.findIndex((x) => x.label === label);
    const probs = atTemperature(dist, tail, byLabel[label].t);
    knob.transition().duration(dur(ms)).ease(easeCubicInOut).attr('cx', stopX(i));
    bars.data(probs).transition().duration(dur(ms)).ease(easeCubicInOut).attr('width', (p) => p * BAR_MAX);
    pcts
      .data(probs)
      .text((p) => `${Math.round(p * 100)}%`)
      .transition()
      .duration(dur(ms))
      .ease(easeCubicInOut)
      .attr('x', (p) => BAR_X + p * BAR_MAX + 6);
  };

  return {
    g,
    async play(_cfg, alive) {
      runRows.interrupt().style('opacity', 0);
      bars.interrupt().attr('width', 0);
      pcts.interrupt().attr('x', BAR_X + 6);
      knob.interrupt().attr('cx', stopX(1));

      status.text('Default: likely tokens win most of the time.');
      setTemperature('default', 700);
      await wait(1600);
      if (!alive()) return;

      status.text('Low: almost always the top token, so replies are predictable.');
      setTemperature('low', 900);
      await wait(2000);
      if (!alive()) return;

      status.text('High: chances spread out, so replies vary more (and can wander).');
      setTemperature('high', 900);
      await wait(2000);
      if (!alive()) return;

      status.text('Default: likely tokens win most of the time.');
      setTemperature('default', 900);
      await wait(1000);
      if (!alive()) return;

      runRows.transition().delay((_, i) => dur(i * 350)).duration(dur(300)).style('opacity', 1);
    },
  };
}
