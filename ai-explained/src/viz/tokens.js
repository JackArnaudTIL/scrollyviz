import { interpolateRdBu, select } from 'd3';
import { W, PAD, zones, CONTENT_OFFSET } from './layout.js';
import { dur } from './motion.js';

// The INPUT zone: text shown as chips that wrap across rows. Chip widths come
// from character count (chips use a monospace font), so layout is deterministic
// and the "fly into place" animation can know a chip's slot before it exists.
//
// Two looks for the same chips:
//   plain – reads as ordinary text (no boxes, no gaps, real spaces)
//   chips – each token boxed, with leading spaces shown as '·'
// Switching plain → chips on the same key animates the text splitting apart.
//
// A '\n' token is a line break: invisible in plain text, a '↵' chip otherwise.
// If the text outgrows the space (maxHeight), the earliest tokens are dropped
// and a '…' marks the gap, so the most recent text stays visible.

// Width of one monospace character. 7.8 is a fallback; createTokens() measures
// the real font so plain text sits flush, with no gaps between tokens.
let charW = 7.8;
export const CHIP_H = 22;
export const CHIP_PAD = 5;
const GAP = 4;
const ROW_GAP = 10;
const COMPACT_ROW_H = 18;
const STRIP_H = 14;
const STRIP_CELLS = 6;
const MAX_W = W - 2 * PAD;
const ELLIPSIS = '…';

const ORIGIN = { x: PAD, y: zones.text.y + CONTENT_OFFSET };
const INPUT_MAX_H = zones.text.h - CONTENT_OFFSET;

// Leading spaces are part of a token; show them as a visible dot. In plain
// mode keep the space (as a non-breaking one, so SVG doesn't collapse it).
export const display = (t, plain = false) => {
  if (t === '\n') return plain ? '' : '↵';
  return t.replace(/^ /, plain ? ' ' : '·');
};

// Lay out tokens from `skip` onwards, after the optional prefix block and '…'.
// Returns positions for the prefix, the ellipsis and each visible token, plus
// the total height used.
function layoutChips(texts, { embed = false, plain = false, prefix = null, compact = false, skip = 0 } = {}) {
  const rowH = plain && compact ? COMPACT_ROW_H : CHIP_H + (embed ? STRIP_H + 4 : 0) + ROW_GAP;
  const gap = plain ? 0 : GAP;
  const pad = plain ? 0 : CHIP_PAD * 2;
  let x = 0;
  let y = 0;

  let prefixPos = null;
  if (prefix) {
    prefixPos = { x: 0, y: 0, w: prefix.length * charW + CHIP_PAD * 2 };
    x = prefixPos.w + GAP * 2;
  }
  let ellipsisPos = null;
  if (skip > 0) {
    ellipsisPos = { x, y, w: (ELLIPSIS.length + 1) * charW };
    x += ellipsisPos.w;
  }

  const positions = texts.slice(skip).map((t) => {
    const newline = t === '\n';
    let w = newline && plain ? 0 : display(t, plain).length * charW + pad;
    if (x > 0 && x + w > MAX_W) {
      x = 0;
      y += rowH;
    }
    // Plain text: a token's leading space is dropped when it starts a line.
    const trim = plain && x === 0 && t.startsWith(' ');
    if (trim) w -= charW;
    const pos = { x, y, w, trim };
    if (newline) {
      x = 0;
      y += rowH;
    } else {
      x += w + gap;
    }
    return pos;
  });

  const last = positions.at(-1);
  const height = (last ? last.y : 0) + (plain && compact ? COMPACT_ROW_H : CHIP_H + (embed ? STRIP_H + 4 : 0));
  return { positions, prefixPos, ellipsisPos, height };
}

// Drop the earliest tokens until the layout fits in maxHeight.
function fitLayout(texts, opts, maxHeight) {
  for (let skip = 0; skip < texts.length; skip++) {
    const layout = layoutChips(texts, { ...opts, skip });
    if (!maxHeight || layout.height <= maxHeight) return { ...layout, skip };
  }
  return { ...layoutChips(texts, { ...opts, skip: Math.max(0, texts.length - 1) }), skip: Math.max(0, texts.length - 1) };
}

function label(d, plain) {
  if (d.meta) return d.t;
  return d.trim ? d.t.slice(1) : display(d.t, plain);
}

// A token's "list of numbers": stable pseudo-random values seeded by its text,
// so the same token always gets the same strip.
function embedValues(t) {
  let h = 2166136261;
  for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: STRIP_CELLS }, (_, j) => {
    h = Math.imul(h ^ (j + 1), 2654435761);
    return ((h >>> 0) % 1000) / 1000;
  });
}

// origin: where the chips start, in the parent's coordinates (defaults to the
// INPUT zone). maxHeight: the space available below the origin. A second
// instance in the OUTPUT zone shows the model's reply.
export function createTokens(parent, { origin = ORIGIN, maxHeight = INPUT_MAX_H } = {}) {
  const g = parent.append('g').attr('transform', `translate(${origin.x},${origin.y})`);

  const probe = g.append('text').attr('class', 'chip-text').text('M'.repeat(40));
  const measured = probe.node().getComputedTextLength() / 40;
  if (measured > 0) charW = measured;
  probe.remove();

  const frames = g.append('g').attr('class', 'window-frames');
  // Right-aligned note on the zone's label row (context window, or `note`).
  const zoneNote = parent
    .append('text')
    .attr('class', 'zone-note')
    .attr('x', W - PAD)
    .attr('y', zones.text.y + 10)
    .attr('text-anchor', 'end')
    .style('opacity', 0);

  // texts:  token strings, in order
  // key:    chips with the same key + index are reused (and animate) across renders
  // embed:  show each chip's strip of numbers
  // window: context-window size in tokens; earlier chips fade
  // plain:  render as ordinary text rather than chips
  // compact: tighter line spacing (plain text only)
  // target: index of a token to highlight as "what comes next"; later ones fade
  // generatedFrom: index where the model's own tokens start (styled differently)
  // note:   text for the zone's right-hand note (the context window overrides it)
  // prefix: label for a boxed block before the tokens (a collapsed prompt)
  // stagger: animate chips one after another (off for fast streaming)
  // flash:  index of a token to outline briefly as it lands (shows the unit
  //         being added, even in plain text where tokens aren't boxed)
  function render({
    texts, key, embed = false, window = null, plain = false, compact = false, target = null,
    generatedFrom = null, note = null, prefix = null, stagger = true, flash = null,
  }) {
    const layout = fitLayout(texts, { embed, plain, prefix, compact }, maxHeight);
    const { skip } = layout;
    const items = texts.slice(skip).map((t, j) => ({ key: `${key}-${skip + j}`, t, i: skip + j, ...layout.positions[j] }));
    if (layout.ellipsisPos) items.unshift({ key: `${key}-ellipsis`, t: ELLIPSIS, i: -1, meta: true, ellipsis: true, ...layout.ellipsisPos });
    if (prefix) items.unshift({ key: `${key}-prefix`, t: prefix, i: -1, meta: true, prefix: true, ...layout.prefixPos });

    const outCount = window ? Math.max(0, texts.length - window) : 0;
    const faded = (d) =>
      (d.prefix && outCount > 0) || (!d.meta && (d.i < outCount || (target !== null && d.i > target)));
    const delay = (d, base = 0, step = 35) => dur(base + (stagger ? Math.max(d.i - skip, 0) * step : 0));
    const boxed = (d) => d.prefix || (!plain && !d.ellipsis);

    const sel = g.selectAll('g.chip').data(items, (d) => d.key);

    sel.exit().transition().duration(dur(250)).style('opacity', 0).remove();

    const enter = sel
      .enter()
      .append('g')
      .attr('class', 'chip')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('opacity', 0);
    enter
      .append('rect')
      .attr('class', 'chip-box')
      .attr('height', CHIP_H)
      .attr('rx', 4)
      .attr('width', (d) => d.w)
      .style('opacity', (d) => (boxed(d) ? 1 : 0));
    enter.append('text').attr('class', 'chip-text').attr('y', CHIP_H / 2).attr('dy', '0.35em');
    enter
      .append('g')
      .attr('class', 'strip')
      .attr('transform', `translate(0,${CHIP_H + 4})`)
      .style('opacity', 0)
      .selectAll('rect')
      .data((d) => embedValues(d.t))
      .join('rect')
      .attr('height', STRIP_H)
      .attr('fill', (v) => interpolateRdBu(v));

    const all = enter.merge(sel);
    all
      .classed('plain', plain)
      .classed('prefix', (d) => !!d.prefix)
      .classed('ellipsis', (d) => !!d.ellipsis)
      .classed('target', (d) => d.i === target)
      .classed('generated', (d) => !d.meta && generatedFrom !== null && d.i >= generatedFrom);
    all.select('.chip-text').text((d) => label(d, plain));
    // Strip cells follow the chip's current width (it changes plain ↔ chips).
    all.each(function (d) {
      select(this)
        .select('.strip')
        .selectAll('rect')
        .attr('x', (_, j) => (j * d.w) / STRIP_CELLS)
        .attr('width', Math.max(0, d.w / STRIP_CELLS - 1));
    });

    const ms = stagger ? 450 : 150;
    all
      .transition()
      .duration(dur(ms))
      .delay((d) => delay(d))
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('opacity', (d) => (faded(d) ? 0.2 : 1));
    const boxes = all.select('.chip-box');
    boxes
      .filter((d) => d.i !== flash)
      .transition()
      .duration(dur(ms))
      .delay((d) => delay(d))
      .attr('width', (d) => d.w)
      .style('opacity', (d) => (boxed(d) ? 1 : 0));
    // The newest token: outlined at once, then back to its normal look.
    boxes
      .filter((d) => d.i === flash)
      .interrupt()
      .classed('flash', true)
      .attr('width', (d) => d.w)
      .style('opacity', 1)
      .transition()
      .delay(dur(350))
      .duration(dur(500))
      .style('opacity', (d) => (boxed(d) ? 1 : 0))
      .on('end', function () {
        select(this).classed('flash', false);
      });
    all
      .select('.chip-text')
      .transition()
      .duration(dur(ms))
      .delay((d) => delay(d))
      .attr('x', (d) => (boxed(d) ? CHIP_PAD : 0));
    all
      .select('.strip')
      .transition()
      .duration(dur(400))
      .delay((d) => delay(d, 300, 50))
      .style('opacity', (d) => (embed && !d.meta ? 1 : 0));

    // Line breaks have no width, so they don't get a frame of their own.
    renderWindow(items.filter((d) => !d.meta && d.i >= outCount && d.w > 0), window, note, plain);
  }

  // One frame rect per row of in-window chips, plus the zone note.
  function renderWindow(inWindow, window, note, plain) {
    // Plain text has no gaps between tokens, so keep the frame tight to the text.
    const pad = plain ? 1 : 3;
    const rows = new Map();
    if (window) {
      for (const d of inWindow) {
        const r = rows.get(d.y) ?? { y: d.y, x0: Infinity, x1: -Infinity };
        r.x0 = Math.min(r.x0, d.x);
        r.x1 = Math.max(r.x1, d.x + d.w);
        rows.set(d.y, r);
      }
    }
    frames
      .selectAll('rect')
      .data([...rows.values()])
      .join('rect')
      .attr('class', 'window-frame')
      .attr('x', (r) => r.x0 - pad)
      .attr('y', (r) => r.y - 3)
      .attr('width', (r) => r.x1 - r.x0 + pad * 2)
      .attr('height', CHIP_H + 6)
      .attr('rx', 6)
      .style('opacity', 0)
      .transition()
      .delay(dur(900))
      .duration(dur(400))
      .style('opacity', 1);

    const text = window ? `▭ context window: last ${window} tokens` : note;
    if (text) zoneNote.text(text);
    zoneNote
      .transition()
      .delay(dur(window ? 900 : 0))
      .duration(dur(400))
      .style('opacity', text ? 1 : 0);
  }

  // Where the last token of `texts` will sit, in the parent's coordinates
  // (using the same fitting as render, so a flying token lands in the right place).
  function slotFor(texts, opts) {
    const pos = fitLayout(texts, opts, maxHeight).positions.at(-1);
    return { x: origin.x + pos.x, y: origin.y + pos.y };
  }

  return { render, slotFor };
}
