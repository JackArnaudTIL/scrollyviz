// Fixed drawing coordinates. The SVG uses a viewBox, so everything is laid out
// in these units and the browser scales it to fit the container — no resize
// maths anywhere in the viz code.
export const W = 480;
export const H = 640;
export const PAD = 20;

// The three stacked pipeline zones. Each zone's label sits at y + 10; its
// content starts at y + CONTENT_OFFSET.
export const zones = {
  text: { y: 16, h: 170 },
  model: { y: 222, h: 198 },
  output: { y: 452, h: 180 },
};
export const CONTENT_OFFSET = 26;

// Greedy word wrap by character count — good enough for short SVG captions.
export function wrapLines(text, maxChars) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Append wrapped text as <tspan>s, one per line.
export function appendWrapped(parent, text, { x, y, maxChars, lineHeight = 15, cls }) {
  const t = parent.append('text').attr('class', cls).attr('x', x).attr('y', y);
  wrapLines(text, maxChars).forEach((line, i) => {
    t.append('tspan').attr('x', x).attr('dy', i === 0 ? 0 : lineHeight).text(line);
  });
  return t;
}

// Wrapped text that honours '\n' (line break) and '\n\n' (paragraph gap).
// Returns { text, height } — the <text> element and the height it uses.
export function appendParagraphs(parent, text, { x, y, maxChars, lineHeight = 15, cls }) {
  const t = parent.append('text').attr('class', cls).attr('x', x).attr('y', y);
  let height = lineHeight;
  let first = true;
  text.split('\n\n').forEach((para, p) => {
    para.split('\n').forEach((raw, r) => {
      wrapLines(raw, maxChars).forEach((line, k) => {
        const gap = !first && p > 0 && r === 0 && k === 0 ? 1.6 : 1;
        const dy = first ? 0 : lineHeight * gap;
        if (!first) height += dy;
        t.append('tspan').attr('x', x).attr('dy', dy).text(line);
        first = false;
      });
    });
  });
  return { text: t, height };
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

// 5.88e23 → "5.9 × 10²³"
export function fmtSci(v) {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  const sup = String(e).split('').map((c) => SUP[c]).join('');
  return `${m.toFixed(1)} × 10${sup}`;
}

// 1e9 → "1B", 1e12 → "1T"
export function fmtTokens(v) {
  return v >= 1e12 ? `${v / 1e12}T` : `${v / 1e9}B`;
}

export function fmtDuration(days) {
  return days < 365 ? `${Math.round(days)} days` : `${(days / 365).toFixed(1)} years`;
}
