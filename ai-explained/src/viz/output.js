import { scaleLinear } from 'd3';
import { W, PAD, zones, CONTENT_OFFSET, appendWrapped } from './layout.js';
import { dur, fadeTo } from './motion.js';
import { display, createTokens } from './tokens.js';

// The OUTPUT zone. Three modes, one sub-group each:
//   reply    – the text the model has written so far, as plain text
//   bars     – next-token probabilities (also used during training, where the
//              bars morph pass to pass and the right answer is marked)
//   examples – training examples cut from one sentence ("given this → next")
const IW = W - 2 * PAD;
const ORIGIN = { x: PAD, y: zones.output.y + CONTENT_OFFSET };

const ROW_H = 24;
const BARS_TOP = 16; // room for the caption above the bars (as in the reply view)
const BAR_X = 100;
const BAR_MAX = 250;
const pct = (p) => `${Math.round(p * 100)}%`;

export function createOutput(parent) {
  const g = parent.append('g').attr('transform', `translate(${ORIGIN.x},${ORIGIN.y})`);
  const modes = {
    reply: g.append('g').style('opacity', 0),
    bars: g.append('g').style('opacity', 0),
    examples: g.append('g').style('opacity', 0),
  };

  // ---- reply ----
  modes.reply.append('text').attr('class', 'out-caption').attr('x', 0).attr('y', 4).text('The model’s reply:');
  const REPLY_ORIGIN = { x: 0, y: 16 };
  const reply = createTokens(modes.reply, {
    origin: REPLY_ORIGIN,
    maxHeight: zones.output.h - CONTENT_OFFSET - REPLY_ORIGIN.y,
  });

  // ---- bars ----
  const bars = modes.bars;
  bars
    .append('text')
    .attr('class', 'zone-note')
    .attr('x', IW)
    .attr('y', zones.output.y + 10 - ORIGIN.y)
    .attr('text-anchor', 'end')
    .text('illustrative probabilities');
  bars.append('text').attr('class', 'out-caption').attr('x', 0).attr('y', 4).text('The model’s prediction:');
  const barsBody = bars.append('g').attr('transform', `translate(0,${BARS_TOP})`);
  const rows = barsBody.append('g');
  const flags = barsBody.append('g');
  const x = scaleLinear().domain([0, 1]).range([0, BAR_MAX]);
  let current = [];

  // ---- examples ----
  const ex = modes.examples;
  ex.append('text').attr('class', 'out-caption').attr('x', 0).attr('y', 4).text('Training examples cut from this one sentence:');
  const exRows = ex.append('g').attr('transform', 'translate(0,16)');
  const exCaption = ex.append('g');
  const CTX_X = 190;

  return {
    setMode(mode) {
      for (const [k, sel] of Object.entries(modes)) fadeTo(sel, k === mode ? 1 : 0, 400);
    },

    // ---- reply ----
    // flash: index of the newest token, outlined briefly as it lands.
    showReply(texts, flash = null) {
      reply.render({ texts, key: 'reply', plain: true, compact: true, stagger: false, flash });
    },

    // Where the last token of `texts` will sit in the reply, in SVG coordinates.
    replySlot(texts) {
      const p = reply.slotFor(texts, { plain: true, compact: true });
      return { x: ORIGIN.x + p.x, y: ORIGIN.y + p.y };
    },

    // dist: [[token, probability], ...]. Rows are keyed by token, so showing a
    // new distribution with overlapping tokens morphs bars instead of redrawing.
    showBars(dist, key) {
      flags.selectAll('*').remove();
      current = dist.map(([t, p], i) => ({ key: `${key}-${t}`, t, p, i }));
      const sel = rows.selectAll('g.bar-row').data(current, (d) => d.key);
      sel.exit().remove();

      const enter = sel
        .enter()
        .append('g')
        .attr('class', 'bar-row')
        .attr('transform', (d) => `translate(0,${d.i * ROW_H})`);
      enter.append('text').attr('class', 'bar-label').attr('x', BAR_X - 8).attr('y', ROW_H / 2 - 2).attr('dy', '0.35em').attr('text-anchor', 'end');
      enter.append('rect').attr('class', 'bar').attr('x', BAR_X).attr('y', 3).attr('height', ROW_H - 10).attr('rx', 2).attr('width', 0);
      enter.append('text').attr('class', 'bar-pct').attr('y', ROW_H / 2 - 2).attr('dy', '0.35em').attr('x', BAR_X + 6).style('opacity', 0);

      const all = enter.merge(sel).classed('picked', false).classed('target', false);
      all.select('.bar-label').text((d) => display(d.t));
      all.transition().duration(dur(500)).attr('transform', (d) => `translate(0,${d.i * ROW_H})`);
      all
        .select('.bar')
        .transition()
        .delay((d) => dur(d.i * 80))
        .duration(dur(600))
        .attr('width', (d) => x(d.p));
      all
        .select('.bar-pct')
        .text((d) => pct(d.p))
        .transition()
        .delay((d) => dur(d.i * 80))
        .duration(dur(600))
        .attr('x', (d) => BAR_X + x(d.p) + 6)
        .style('opacity', 1);
    },

    // Highlight a row; returns its label position in SVG coordinates (for the fly-up).
    pick(i) {
      rows.selectAll('g.bar-row').classed('picked', (d) => d.i === i);
      return { x: ORIGIN.x + 24, y: ORIGIN.y + BARS_TOP + i * ROW_H + ROW_H / 2 - 2 };
    },

    // Mark the picked row as wrong and the true answer as right, plus a caveat.
    flag(truth, caveat) {
      flags.selectAll('*').remove();
      const picked = current[0];
      const right = current.find((d) => d.t === truth);
      const mark = (d, text, cls) =>
        flags
          .append('text')
          .attr('class', cls)
          .attr('x', BAR_X + x(d.p) + 44)
          .attr('y', d.i * ROW_H + ROW_H / 2 - 2)
          .attr('dy', '0.35em')
          .text(text);
      mark(picked, '✗ most likely — but wrong', 'flag-wrong');
      if (right) mark(right, '✓ correct', 'flag-right');
      if (caveat) {
        appendWrapped(flags, caveat, { x: 0, y: current.length * ROW_H + 14, maxChars: 68, cls: 'caveat' });
      }
      flags.style('opacity', 0).transition().duration(dur(400)).style('opacity', 1);
    },

    // Training: mark the right answer's row, and show how its score has moved
    // across passes (history = its probability after each pass so far).
    markTarget(target, history) {
      flags.selectAll('*').remove();
      rows.selectAll('g.bar-row').classed('target', (d) => d.t === target);
      const row = current.find((d) => d.t === target);
      if (row) {
        flags
          .append('text')
          .attr('class', 'flag-right')
          .attr('x', BAR_X + x(row.p) + 44)
          .attr('y', row.i * ROW_H + ROW_H / 2 - 2)
          .attr('dy', '0.35em')
          .text('✓ right answer');
      }
      flags
        .append('text')
        .attr('class', 'readout')
        .attr('x', 0)
        .attr('y', current.length * ROW_H + 18)
        .text(`Score for the right answer, ${display(target)}: ${history.map(pct).join(' → ')}`);
      flags.style('opacity', 0).transition().delay(dur(500)).duration(dur(400)).style('opacity', 1);
    },

    // ---- examples ----
    resetExamples(caption) {
      exRows.selectAll('*').remove();
      exCaption.selectAll('*').remove();
      if (caption) appendWrapped(exCaption, caption, { x: 0, y: 138, maxChars: 68, cls: 'caveat' });
    },

    // context: tokens before the target (only the last few are shown).
    addExample(context, target) {
      const i = exRows.selectAll('g').size();
      const shown = context.slice(-3).map((t) => display(t)).join(' ');
      const row = exRows
        .append('g')
        .attr('transform', `translate(0,${i * ROW_H})`)
        .style('opacity', 0);
      row.append('text').attr('class', 'bar-label').attr('x', CTX_X).attr('y', ROW_H / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
        .text(context.length > 3 ? `… ${shown}` : shown);
      row.append('text').attr('class', 'out-caption').attr('x', CTX_X + 12).attr('y', ROW_H / 2).attr('dy', '0.35em').text('→');
      row.append('text').attr('class', 'bar-label example-target').attr('x', CTX_X + 32).attr('y', ROW_H / 2).attr('dy', '0.35em').text(display(target));
      row.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
