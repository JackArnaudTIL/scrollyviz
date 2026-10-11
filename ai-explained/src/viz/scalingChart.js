import { scaleLog, scaleLinear, axisBottom, axisLeft, line, extent } from 'd3';
import { drawPath } from 'scrolly-core/transitions.js';
import { W, H, fmtTokens } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view: error vs training data, one curve per model size.
// Log x axis — each tick is 10× more data — with the drop per 10× labelled on
// the first curve to show diminishing returns.
const m = { top: 92, right: 24, bottom: 104, left: 60 };

export function createScalingChart(parent, scaling) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);
  const { curves } = scaling;

  const allLoss = curves.flatMap((c) => c.series.map((d) => d.loss));
  const x = scaleLog()
    .domain(extent(curves[0].series, (d) => d.tokens))
    .range([m.left, W - m.right]);
  const y = scaleLinear()
    .domain(extent(allLoss))
    .nice()
    .range([H - m.bottom, m.top]);

  g.append('text').attr('class', 'chart-title').attr('x', m.left).attr('y', 34).text('More text to learn from → lower error');
  g.append('text').attr('class', 'chart-sub').attr('x', m.left).attr('y', 56).text('Numbers show how much the error drops');
  g.append('text').attr('class', 'chart-sub').attr('x', m.left).attr('y', 72).text('with each 10× more training data');

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${H - m.bottom})`)
    .call(axisBottom(x).tickValues(curves[0].decades.map((d) => d.tokens)).tickFormat(fmtTokens).tickSizeOuter(0));
  g.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(axisLeft(y).ticks(5).tickSizeOuter(0));
  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', (m.left + W - m.right) / 2)
    .attr('y', H - m.bottom + 38)
    .attr('text-anchor', 'middle')
    .text('Text the model trained on (tokens)');
  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', `translate(18,${(m.top + H - m.bottom) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Error (lower is better)');

  const lineGen = line()
    .x((d) => x(d.tokens))
    .y((d) => y(d.loss));

  // Curve labels form a small legend in the empty top-right of the plot —
  // direct labels at the curve ends collide with the gain labels.
  const legendX = x(curves[0].decades[1].tokens) + 14;
  const legendY = y(curves[0].series[0].loss);
  const curveGroups = new Map(
    curves.map((c, k) => {
      const cg = g.append('g').attr('class', `curve-group curve-${c.key}`).style('opacity', 0);
      cg.append('path').datum(c.series).attr('class', 'curve').attr('d', lineGen);
      const ly = legendY + k * 20;
      cg.append('line')
        .attr('class', 'curve curve-label')
        .attr('x1', legendX)
        .attr('x2', legendX + 18)
        .attr('y1', ly)
        .attr('y2', ly);
      cg.append('text')
        .attr('class', 'curve-label')
        .attr('x', legendX + 24)
        .attr('y', ly)
        .attr('dy', '0.35em')
        .text(c.label);
      return [c.key, cg];
    })
  );

  // Diminishing returns, labelled on the first curve.
  const gains = g.append('g').attr('class', 'gains');
  const dec = curves[0].decades;
  gains
    .selectAll('circle')
    .data(dec)
    .join('circle')
    .attr('class', 'gain-dot')
    .attr('r', 4)
    .attr('cx', (d) => x(d.tokens))
    .attr('cy', (d) => y(d.loss));
  gains
    .selectAll('text')
    .data(dec.slice(1).map((d, j) => ({ a: dec[j], b: d })))
    .join('text')
    .attr('class', 'gain-label')
    .attr('x', (p) => x(Math.sqrt(p.a.tokens * p.b.tokens)) + 6)
    .attr('y', (p) => y((p.a.loss + p.b.loss) / 2) - 8)
    .attr('text-anchor', 'start')
    .text((p) => `−${(p.a.loss - p.b.loss).toFixed(2)}`);

  g.append('text').attr('class', 'footnote').attr('x', m.left).attr('y', H - 34).text('Curves: Chinchilla scaling fit (Hoffmann et al., 2022),');
  g.append('text').attr('class', 'footnote').attr('x', m.left).attr('y', H - 20).text('constants as refit by Epoch AI (Besiroglu et al., 2024).');

  return {
    g,
    async play({ models, gains: showGains }, alive) {
      for (const cg of curveGroups.values()) cg.style('opacity', 0);
      gains.selectAll('*').style('opacity', 0);

      for (const [k, key] of models.entries()) {
        const cg = curveGroups.get(key);
        cg.style('opacity', 1);
        cg.select('.curve-label').style('opacity', 0).transition().delay(dur(1000)).duration(dur(300)).style('opacity', 1);
        drawPath(cg.select('.curve'), dur(1200));
        await wait(1400);
        if (!alive()) return;

        if (k === 0 && showGains) {
          gains
            .selectAll('*')
            .transition()
            .delay((_, j) => dur(j * 150))
            .duration(dur(300))
            .style('opacity', 1);
          await wait(1800);
          if (!alive()) return;
        }
      }
    },
  };
}
