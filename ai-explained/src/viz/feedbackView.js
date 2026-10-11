import { PAD, W, appendParagraphs } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view for "Learning from Feedback": two candidate replies to the
// same request; a reviewer prefers one, and the model is nudged towards it.
const CARD = { x: PAD, w: W - 2 * PAD };

export function createFeedbackView(parent, demo) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  g.append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', 30).text('TWO POSSIBLE REPLIES');

  const cards = [
    { label: 'Reply A', text: demo.preferred, preferred: true, y: 46 },
    { label: 'Reply B', text: demo.other, preferred: false },
  ];
  // Lay out each card at the height its text needs.
  let y = cards[0].y;
  const built = cards.map((c) => {
    const cg = g.append('g').attr('transform', `translate(${CARD.x},${y})`);
    const box = cg.append('rect').attr('class', 'demo-panel').attr('width', CARD.w).attr('rx', 8);
    cg.append('text').attr('class', 'demo-title').attr('x', 14).attr('y', 24).text(c.label);
    const { height } = appendParagraphs(cg, c.text, { x: 14, y: 48, maxChars: 62, lineHeight: 16, cls: 'demo-text' });
    const h = 48 + height + 8;
    box.attr('height', h);
    const mark = cg
      .append('text')
      .attr('class', 'flag-right')
      .attr('x', CARD.w - 14)
      .attr('y', 24)
      .attr('text-anchor', 'end')
      .text('✓ Preferred by reviewer');
    y += h + 18;
    return { ...c, cg, box, mark };
  });

  const caption = g.append('g').attr('transform', `translate(${PAD},${y + 16})`);
  caption.append('text').attr('class', 'fact').text('The model is nudged so replies like A become more likely,');
  caption.append('text').attr('class', 'fact').attr('y', 20).text('and replies like B less likely.');

  const winner = built.find((c) => c.preferred);
  const loser = built.find((c) => !c.preferred);

  return {
    g,
    async play(_cfg, alive) {
      for (const c of built) {
        c.cg.interrupt().style('opacity', 0);
        c.box.classed('preferred', false);
        c.mark.interrupt().style('opacity', 0);
      }
      caption.interrupt().style('opacity', 0);

      built.forEach((c, i) => c.cg.transition().delay(dur(i * 400)).duration(dur(400)).style('opacity', 1));
      await wait(1800);
      if (!alive()) return;

      // The reviewer's choice.
      winner.box.classed('preferred', true);
      winner.mark.transition().duration(dur(300)).style('opacity', 1);
      loser.cg.transition().duration(dur(500)).style('opacity', 0.4);
      await wait(900);
      if (!alive()) return;

      caption.transition().duration(dur(400)).style('opacity', 1);
    },
  };
}
