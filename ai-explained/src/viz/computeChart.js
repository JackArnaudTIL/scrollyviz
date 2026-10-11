import { scaleLinear, easeLinear } from 'd3';
import { W, H, PAD, fmtSci, fmtDuration } from './layout.js';
import { dur } from './motion.js';

// Full-graphic view: cumulative computing for training (fixed, paid once) vs
// answering (grows every day). A day counter runs; usage bars grow until the
// busier one passes the training line.
const BAR_H = 26;
const ROWS_Y = { training: 130 };

export function createComputeChart(parent, compute) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  const minBreakEven = Math.min(...Object.values(compute.rates).map((r) => r.breakEvenDays));
  const endDay = Math.ceil(minBreakEven * 1.5);
  const x = scaleLinear()
    .domain([0, compute.trainingFlops * 1.5])
    .range([PAD, W - PAD]);
  const clampW = (v) => Math.min(x(v), W - PAD) - PAD;

  g.append('text').attr('class', 'chart-title').attr('x', PAD).attr('y', 34).text('Computing: training vs answering');
  g.append('text')
    .attr('class', 'chart-sub')
    .attr('x', PAD)
    .attr('y', 56)
    .text(`${compute.label}: ${compute.N / 1e9} billion numbers, ${compute.trainingTokens / 1e12} trillion training tokens`);

  // Training row
  g.append('text').attr('class', 'row-label').attr('x', PAD).attr('y', ROWS_Y.training - 10).text('Training — paid once');
  g.append('rect')
    .attr('class', 'compute-bar training')
    .attr('x', PAD)
    .attr('y', ROWS_Y.training)
    .attr('width', clampW(compute.trainingFlops))
    .attr('height', BAR_H)
    .attr('rx', 3);
  g.append('text')
    .attr('class', 'bar-value')
    .attr('x', PAD + 8)
    .attr('y', ROWS_Y.training + BAR_H / 2)
    .attr('dy', '0.35em')
    .text(`≈ ${fmtSci(compute.trainingFlops)} calculations`);

  // Dashed reference line at the training total, through the usage rows.
  g.append('line')
    .attr('class', 'training-line')
    .attr('x1', x(compute.trainingFlops))
    .attr('x2', x(compute.trainingFlops))
    .attr('y1', ROWS_Y.training)
    .attr('y2', 380);

  const usageRows = g.append('g');
  const dayCounter = g.append('text').attr('class', 'day-counter').attr('x', W / 2).attr('y', 440).attr('text-anchor', 'middle');

  g.append('text')
    .attr('class', 'fact')
    .attr('x', PAD)
    .attr('y', 500)
    .text(`Each token of an answer ≈ ${fmtSci(compute.flopsPerToken)} calculations —`);
  g.append('text').attr('class', 'fact').attr('x', PAD).attr('y', 520).text('tiny, but paid on every token, for every user.');

  g.append('text').attr('class', 'footnote').attr('x', PAD).attr('y', H - 34).text('Rules of thumb: training ≈ 6 × numbers × training tokens;');
  g.append('text').attr('class', 'footnote').attr('x', PAD).attr('y', H - 20).text('answering ≈ 2 × numbers per token. Real systems add overheads.');

  return {
    g,
    async play({ rates: keys }, alive) {
      const rows = keys.map((key, i) => ({ key, ...compute.rates[key], y: 220 + i * 90 }));

      const sel = usageRows
        .selectAll('g.usage-row')
        .data(rows, (d) => d.key)
        .join((enter) => {
          const r = enter.append('g').attr('class', 'usage-row');
          r.append('text').attr('class', 'row-label').attr('x', PAD).attr('y', (d) => d.y - 10).text((d) => `Answering at ${d.label}`);
          r.append('rect').attr('class', 'compute-bar usage').attr('x', PAD).attr('y', (d) => d.y).attr('height', BAR_H).attr('rx', 3);
          r.append('text').attr('class', 'row-note').attr('y', (d) => d.y + BAR_H / 2).attr('dy', '0.35em');
          return r;
        });

      const bars = sel.select('.compute-bar');
      const notes = sel.select('.row-note').style('opacity', 0);
      bars.attr('width', 0);
      dayCounter.text('Day 0');

      const flopsAt = (d, day) => compute.flopsPerToken * d.tokensPerDay * day;

      // Named, so it doesn't cancel the view's own fade-in transition.
      await g
        .transition('days')
        .duration(dur(4500))
        .ease(easeLinear)
        .tween('days', () => (t) => {
          const day = t * endDay;
          dayCounter.text(`Day ${Math.round(day)}`);
          bars.attr('width', (d) => clampW(flopsAt(d, day)));
          notes
            .filter((d) => day >= d.breakEvenDays)
            .attr('x', x(compute.trainingFlops) + 8)
            .attr('y', (d) => d.y + BAR_H + 16)
            .text((d) => `passes training on day ${Math.round(d.breakEvenDays)}`)
            .style('opacity', 1);
        })
        .end()
        .catch(() => {});
      if (!alive()) return;

      // Rows that never caught up: say how long they would take.
      notes
        .filter((d) => d.breakEvenDays > endDay)
        .attr('x', (d) => PAD + clampW(flopsAt(d, endDay)) + 8)
        .text((d) => `would take ≈ ${fmtDuration(d.breakEvenDays)} to catch up`)
        .transition()
        .duration(dur(400))
        .style('opacity', 1);
    },
  };
}
