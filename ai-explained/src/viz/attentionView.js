import { drawPath } from 'scrolly-core/transitions.js';
import { PAD, appendWrapped } from './layout.js';
import { dur, wait } from './motion.js';
import { display } from './tokens.js';

// Full-graphic view for "Paying Attention": about to predict the token after
// "plan by", the model weighs every earlier token. Curves run from the next
// position back to the tokens it attends to (thicker = stronger), the tokens
// are shaded by weight, and a short list ranks the strongest.
const TOP = 54;
const LINE_GAP = 74;
const SLOT_W = 24;
const LIST_ROW = 22;
const LIST_BAR_X = 110;
const LIST_BAR_MAX = 260;

export function createAttentionView(parent, data) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  // Measure the monospace font so tokens can be positioned exactly.
  const probe = g.append('text').attr('class', 'attn-token').text('M'.repeat(20));
  const charW = probe.node().getComputedTextLength() / 20 || 7.2;
  probe.remove();

  // Lay out each line's tokens as plain running text.
  const items = [];
  data.lines.forEach((line, li) => {
    const y = TOP + li * LINE_GAP;
    g.append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', y - 22).text(line.label);
    let x = PAD;
    for (const tok of line.tokens) {
      const text = tok.t.replace(/^ /, ' ');
      const width = text.length * charW;
      items.push({ t: tok.t, text, weight: tok.weight ?? 0, x, y, width, line: li });
      x += width;
    }
  });
  const attended = items.filter((d) => d.weight > 0);
  const maxWeight = Math.max(...attended.map((d) => d.weight));

  // The position being predicted: an empty slot after the last token.
  const last = items[items.length - 1];
  const slot = { x: last.x + last.width + 6, y: last.y };

  // Shading behind attended tokens, stronger for higher weight.
  const shades = g
    .append('g')
    .selectAll('rect')
    .data(attended)
    .join('rect')
    .attr('class', 'attn-shade')
    .attr('x', (d) => d.x - 1)
    .attr('y', (d) => d.y - 12)
    .attr('width', (d) => d.width + 2)
    .attr('height', 22)
    .attr('rx', 3);

  // Curves from the slot back to each attended token.
  const curve = (d) => {
    const sx = slot.x + SLOT_W / 2;
    const tx = d.x + d.width / 2;
    if (d.line === last.line) {
      // Same line: bow underneath.
      const sy = slot.y + 12;
      const depth = 26 + Math.abs(sx - tx) * 0.12;
      return `M${sx},${sy} Q${(sx + tx) / 2},${sy + depth} ${tx},${d.y + 12}`;
    }
    // Earlier lines: rise from the top of the slot to the bottom of the token.
    const sy = slot.y - 12;
    const ty = d.y + 12;
    return `M${sx},${sy} C${sx},${sy - 40} ${tx},${ty + 34} ${tx},${ty}`;
  };
  const arcs = g
    .append('g')
    .selectAll('path')
    .data(attended)
    .join('path')
    .attr('class', 'attn-arc')
    .attr('d', curve)
    .attr('stroke-width', (d) => 1 + d.weight * 14);

  g.append('g')
    .selectAll('text')
    .data(items)
    .join('text')
    .attr('class', (d) => `attn-token${d.weight > 0 ? ' attended' : ''}`)
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('dy', '0.35em')
    .text((d) => d.text);

  const slotG = g.append('g').attr('transform', `translate(${slot.x},${slot.y - 12})`);
  slotG.append('rect').attr('class', 'attn-slot').attr('width', SLOT_W).attr('height', 22).attr('rx', 4);
  slotG.append('text').attr('class', 'attn-slot-text').attr('x', SLOT_W / 2).attr('y', 11).attr('dy', '0.35em').attr('text-anchor', 'middle').text('?');

  // Ranked list of the strongest attention.
  const listTop = TOP + data.lines.length * LINE_GAP + 26;
  const list = g.append('g').attr('transform', `translate(${PAD},${listTop})`);
  list.append('text').attr('class', 'zone-label').text('WHERE ITS ATTENTION GOES');
  const ranked = [...attended].sort((a, b) => b.weight - a.weight).slice(0, 6);
  const rows = list
    .selectAll('g.attn-row')
    .data(ranked)
    .join('g')
    .attr('class', 'attn-row')
    .attr('transform', (_, i) => `translate(0,${18 + i * LIST_ROW})`);
  rows.append('text').attr('class', 'bar-label').attr('x', LIST_BAR_X - 8).attr('y', 9).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => display(d.t));
  rows.append('rect').attr('class', 'attn-bar').attr('x', LIST_BAR_X).attr('y', 2).attr('height', 14).attr('rx', 2).attr('width', (d) => (d.weight / maxWeight) * LIST_BAR_MAX);
  rows.append('text').attr('class', 'bar-pct').attr('x', (d) => LIST_BAR_X + (d.weight / maxWeight) * LIST_BAR_MAX + 6).attr('y', 9).attr('dy', '0.35em').text((d) => `${Math.round(d.weight * 100)}%`);

  const outcomeY = listTop + 18 + ranked.length * LIST_ROW + 22;
  const [predToken, predP] = data.prediction;
  const outcome = g.append('g').attr('transform', `translate(${PAD},${outcomeY})`);
  outcome.append('text').attr('class', 'fact').text(`→ So the most likely next token is “${predToken.trim()}” (${Math.round(predP * 100)}%).`);
  appendWrapped(outcome, data.note, { x: 0, y: 24, maxChars: 78, lineHeight: 14, cls: 'footnote' });

  return {
    g,
    async play(_cfg, alive) {
      arcs.interrupt().style('opacity', 0);
      shades.interrupt().style('opacity', 0);
      rows.interrupt().style('opacity', 0);
      outcome.interrupt().style('opacity', 0);

      await wait(600);
      if (!alive()) return;

      // Strongest attention first.
      const order = [...attended].sort((a, b) => b.weight - a.weight);
      arcs.each(function (d) {
        const rank = order.indexOf(d);
        const path = this;
        setTimeout(() => {
          if (!alive()) return;
          path.style.opacity = 0.35 + (d.weight / maxWeight) * 0.6;
          drawPath(arcs.filter((x) => x === d), dur(700));
        }, dur(rank * 140));
      });
      shades
        .transition()
        .delay((d) => dur(order.indexOf(d) * 140 + 300))
        .duration(dur(400))
        .style('opacity', (d) => 0.25 + (d.weight / maxWeight) * 0.75);
      await wait(order.length * 140 + 900);
      if (!alive()) return;

      rows.transition().delay((_, i) => dur(i * 120)).duration(dur(300)).style('opacity', 1);
      await wait(ranked.length * 120 + 400);
      if (!alive()) return;
      outcome.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
