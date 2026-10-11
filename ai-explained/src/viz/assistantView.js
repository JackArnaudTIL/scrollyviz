import { PAD, W, appendParagraphs } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view for "From Autocomplete to Assistant": the same request
// given to a base model (which just continues the pattern) and to a
// fine-tuned assistant (which answers it), side by side.
const COL_GAP = 16;
const COL_W = (W - 2 * PAD - COL_GAP) / 2;
const PROMPT = { y: 30, h: 76 };
const PANEL = { y: 140 };

export function createAssistantView(parent, demo) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  // The request both models are given.
  const prompt = g.append('g').attr('transform', `translate(${PAD},${PROMPT.y})`);
  prompt.append('text').attr('class', 'zone-label').text('THE SAME REQUEST');
  prompt.append('rect').attr('class', 'bubble-user').attr('y', 12).attr('width', W - 2 * PAD).attr('height', PROMPT.h - 12).attr('rx', 10);
  appendParagraphs(prompt, `“${demo.request}”`, { x: 12, y: 36, maxChars: 62, lineHeight: 17, cls: 'demo-request' });

  const panels = [
    { title: 'Base model', sub: 'after pre-training only', text: demo.base, verdict: '✗ continues the pattern', ok: false },
    { title: 'Assistant', sub: 'after fine-tuning', text: demo.tuned, verdict: '✓ answers the request', ok: true },
  ].map((p, i) => {
    const pg = g.append('g').attr('transform', `translate(${PAD + i * (COL_W + COL_GAP)},${PANEL.y})`);
    pg.append('text').attr('class', 'demo-title').text(p.title);
    pg.append('text').attr('class', 'demo-sub').attr('y', 16).text(p.sub);
    const box = pg.append('rect').attr('class', 'demo-panel').attr('y', 28).attr('width', COL_W).attr('rx', 8);
    const { text, height } = appendParagraphs(pg, p.text, { x: 12, y: 52, maxChars: 30, lineHeight: 16, cls: 'demo-text' });
    const verdict = pg.append('text').attr('class', p.ok ? 'flag-right' : 'flag-wrong').attr('x', 0).text(p.verdict);
    return { lines: text.selectAll('tspan'), verdict, box, height };
  });
  // Both panels match the taller text; verdicts sit just below.
  const panelH = Math.max(...panels.map((p) => p.height)) + 36;
  for (const p of panels) {
    p.box.attr('height', panelH);
    p.verdict.attr('y', 28 + panelH + 22);
  }

  return {
    g,
    async play(_cfg, alive) {
      for (const p of panels) {
        p.lines.interrupt().style('opacity', 0);
        p.verdict.interrupt().style('opacity', 0);
      }
      await wait(500);
      if (!alive()) return;
      // Both "write" line by line, side by side.
      for (const p of panels) {
        p.lines.transition().delay((_, i) => dur(i * 160)).duration(dur(200)).style('opacity', 1);
      }
      const longest = Math.max(...panels.map((p) => p.lines.size()));
      await wait(longest * 160 + 400);
      if (!alive()) return;
      for (const p of panels) p.verdict.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
