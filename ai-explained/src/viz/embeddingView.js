import { interpolateRdBu } from 'd3';
import { PAD, appendWrapped } from './layout.js';
import { dur, wait } from './motion.js';
import { display } from './tokens.js';

// Full-graphic view for "Text becomes tokens": one short phrase turned into
// numbers, in four rows that build up in order —
//   TEXT        the phrase as written
//   TOKENS      the phrase split into token chips (the text slides apart)
//   TOKEN IDS   each token's number in the model's vocabulary
//   NUMBERS     each ID swapped for its list of numbers: a grid, one row per
//               token, cells shaded by value
const ROWS = { text: 40, tokens: 120, ids: 196, grid: 290 };
const CHIP_H = 26;
const CHIP_PAD = 6;
const CHIP_GAP = 18;
const LABEL_W = 108; // grid: token + ID column
const CELL_W = 50;
const CELL_H = 30;
const CELL_GAP = 3;

const fmt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
// Values run roughly −1…1; keep the shading light enough for the numbers to read.
const shade = (v) => interpolateRdBu(0.5 + v * 0.38);

export function createEmbeddingView(parent, data) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);
  const { tokens, ids, vectors, note } = data;

  // Measure the monospace font so the phrase and chips line up exactly.
  const probe = g.append('text').attr('class', 'embed-token').text('M'.repeat(20));
  const charW = probe.node().getComputedTextLength() / 20 || 8.4;
  probe.remove();

  const labels = { text: 'TEXT', tokens: 'TOKENS', ids: 'TOKEN IDS', grid: 'NUMBERS (EMBEDDINGS)' };
  for (const [k, y] of Object.entries(ROWS)) {
    g.append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', y - (k === 'grid' ? 24 : 16)).text(labels[k]);
  }

  // Phrase positions: tokens laid end to end as plain text.
  const plain = tokens.map((t) => t.replace(/^ /, ' '));
  // A leading space would indent the phrase; start one character early instead.
  const phraseX = tokens[0].startsWith(' ') ? PAD - charW : PAD;
  let px = phraseX;
  const phrasePos = plain.map((t) => {
    const x = px;
    px += t.length * charW;
    return x;
  });
  // Chip positions: the same tokens, boxed and spread apart.
  let cx = PAD;
  const chips = tokens.map((t, i) => {
    const label = display(t);
    const w = label.length * charW + CHIP_PAD * 2;
    const chip = { i, t, label, plain: plain[i], x: cx, w, mid: cx + w / 2 };
    cx += w + CHIP_GAP;
    return chip;
  });

  // ---- Text: the phrase stays put; copies of its pieces slide into chips ----
  g.append('text')
    .attr('class', 'embed-token')
    .attr('x', phraseX)
    .attr('y', ROWS.text)
    .attr('dy', '0.35em')
    .text(plain.join(''));

  // ---- Tokens ----
  const tokenG = g.append('g');
  const boxes = tokenG
    .selectAll('rect')
    .data(chips)
    .join('rect')
    .attr('class', 'embed-chip')
    .attr('x', (d) => d.x)
    .attr('y', ROWS.tokens)
    .attr('width', (d) => d.w)
    .attr('height', CHIP_H)
    .attr('rx', 4);
  const words = tokenG
    .selectAll('text')
    .data(chips)
    .join('text')
    .attr('class', 'embed-token')
    .attr('dy', '0.35em');

  // ---- Token IDs ----
  const idG = g.append('g');
  const idItems = idG
    .selectAll('g')
    .data(chips)
    .join('g')
    .attr('transform', (d) => `translate(${d.mid},0)`);
  idItems
    .append('text')
    .attr('class', 'embed-id')
    .attr('y', ROWS.ids)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .text((d) => `#${ids[d.i]}`);

  // ---- Numbers grid ----
  const gridG = g.append('g').attr('transform', `translate(${PAD},${ROWS.grid})`);
  const dims = vectors[0].length;
  const header = gridG.append('g');
  for (let d = 0; d < dims; d++) {
    header
      .append('text')
      .attr('class', 'embed-dim')
      .attr('x', LABEL_W + d * (CELL_W + CELL_GAP) + CELL_W / 2)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .text(d + 1);
  }
  header
    .append('text')
    .attr('class', 'embed-dim')
    .attr('x', LABEL_W + dims * (CELL_W + CELL_GAP) + 4)
    .attr('y', -4)
    .text('…');

  const rows = gridG
    .selectAll('g.embed-row')
    .data(chips)
    .join('g')
    .attr('class', 'embed-row')
    .attr('transform', (d) => `translate(0,${d.i * (CELL_H + CELL_GAP)})`);
  rows
    .append('text')
    .attr('class', 'embed-token')
    .attr('y', CELL_H / 2)
    .attr('dy', '0.35em')
    .text((d) => d.label);
  rows
    .append('text')
    .attr('class', 'embed-id')
    .attr('x', LABEL_W - 8)
    .attr('y', CELL_H / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .text((d) => `#${ids[d.i]}`);
  const cells = rows
    .selectAll('g.embed-cell')
    .data((d) => vectors[d.i].map((v, k) => ({ v, k, row: d.i })))
    .join('g')
    .attr('class', 'embed-cell')
    .attr('transform', (c) => `translate(${LABEL_W + c.k * (CELL_W + CELL_GAP)},0)`);
  cells.append('rect').attr('width', CELL_W).attr('height', CELL_H).attr('rx', 3).attr('fill', (c) => shade(c.v));
  cells
    .append('text')
    .attr('class', 'embed-value')
    .attr('x', CELL_W / 2)
    .attr('y', CELL_H / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .text((c) => fmt(c.v));
  rows
    .append('text')
    .attr('class', 'embed-dim')
    .attr('x', LABEL_W + dims * (CELL_W + CELL_GAP) + 4)
    .attr('y', CELL_H / 2)
    .attr('dy', '0.35em')
    .text('…');

  const gridBottom = ROWS.grid + tokens.length * (CELL_H + CELL_GAP);
  const caption = g.append('g').attr('transform', `translate(${PAD},${gridBottom + 34})`);
  caption.append('text').attr('class', 'fact').text('The model never sees the words, only this grid of numbers.');
  appendWrapped(caption, note, { x: 0, y: 22, maxChars: 78, lineHeight: 14, cls: 'footnote' });


  return {
    g,
    async play(_cfg, alive) {
      // Reset: token copies back on the phrase; everything below hidden.
      words.interrupt().attr('x', (d) => phrasePos[d.i]).attr('y', ROWS.text).text((d) => d.plain).style('opacity', 0);
      boxes.interrupt().style('opacity', 0);
      idItems.interrupt().style('opacity', 0);
      header.interrupt().style('opacity', 0);
      rows.interrupt().style('opacity', 0);
      caption.interrupt().style('opacity', 0);

      await wait(700);
      if (!alive()) return;

      // Split: a copy of each token peels off the phrase and slides into its chip.
      words
        .transition()
        .delay((d) => dur(d.i * 60))
        .duration(dur(600))
        .attr('x', (d) => d.x + CHIP_PAD)
        .attr('y', ROWS.tokens + CHIP_H / 2)
        .on('start', function (d) {
          this.textContent = d.label;
          this.style.opacity = 1;
        });
      boxes.transition().delay((d) => dur(300 + d.i * 60)).duration(dur(400)).style('opacity', 1);
      await wait(1300);
      if (!alive()) return;

      // Look up each token's ID.
      idItems.transition().delay((d) => dur(d.i * 120)).duration(dur(300)).style('opacity', 1);
      await wait(1300);
      if (!alive()) return;

      // Swap each ID for its numbers, row by row.
      header.transition().duration(dur(300)).style('opacity', 1);
      rows.transition().delay((d) => dur(d.i * 220)).duration(dur(350)).style('opacity', 1);
      await wait(tokens.length * 220 + 500);
      if (!alive()) return;

      caption.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
