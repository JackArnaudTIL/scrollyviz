import { PAD, W, appendParagraphs } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view for "Frozen After Training": a timeline from training data
// to your conversation, and the difference between what a model knows (fixed
// in training, up to its cutoff) and what it sees (its context window, now).
const LINE_Y = 150;
const X0 = PAD;
const X1 = W - PAD;
const AT = { cutoff: 0.5, release: 0.66, chat: 0.92 };
const x = (f) => X0 + f * (X1 - X0);

export function createFrozenView(parent) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  g.append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', 40).text('A MODEL’S TIMELINE');
  g.append('line').attr('class', 'time-axis').attr('x1', X0).attr('x2', X1).attr('y1', LINE_Y).attr('y2', LINE_Y);
  g.append('text').attr('class', 'demo-sub').attr('x', X1).attr('y', LINE_Y + 34).attr('text-anchor', 'end').text('time →');

  // Training data runs up to the cutoff; then training; then the frozen model in use.
  const dataBand = g.append('rect').attr('class', 'time-data').attr('x', X0).attr('y', LINE_Y - 14).attr('height', 28).attr('rx', 4);
  const dataLabel = g.append('text').attr('class', 'time-label').attr('x', X0 + 8).attr('y', LINE_Y).attr('dy', '0.35em').text('training data');
  const trainBand = g
    .append('rect')
    .attr('class', 'time-train')
    .attr('x', x(AT.cutoff))
    .attr('y', LINE_Y - 14)
    .attr('width', x(AT.release) - x(AT.cutoff))
    .attr('height', 28);
  const frozenBand = g
    .append('rect')
    .attr('class', 'time-frozen')
    .attr('x', x(AT.release))
    .attr('y', LINE_Y - 14)
    .attr('width', X1 - x(AT.release))
    .attr('height', 28)
    .attr('rx', 4);

  const marker = (f, label, below = false) => {
    const m = g.append('g').attr('transform', `translate(${x(f)},0)`);
    m.append('line').attr('class', 'time-marker').attr('y1', LINE_Y - (below ? 18 : 30)).attr('y2', LINE_Y + (below ? 30 : 18));
    m.append('text').attr('class', 'time-marker-label').attr('y', below ? LINE_Y + 46 : LINE_Y - 38).attr('text-anchor', 'middle').text(label);
    return m;
  };
  const cutoff = marker(AT.cutoff, 'knowledge cutoff');
  const release = marker(AT.release, 'released', true);
  const trainLabel = g
    .append('text')
    .attr('class', 'time-label')
    .attr('x', (x(AT.cutoff) + x(AT.release)) / 2)
    .attr('y', LINE_Y)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .text('training');
  const chat = g.append('g').attr('transform', `translate(${x(AT.chat)},${LINE_Y})`);
  chat.append('circle').attr('class', 'time-chat').attr('r', 7);
  chat.append('text').attr('class', 'time-marker-label').attr('y', -38).attr('text-anchor', 'middle').text('your chat');

  // What it knows vs what it sees.
  const cards = [
    {
      title: 'What it KNOWS',
      body: 'Learned from its training data, up to the cutoff. Fixed: your conversations don’t change it.',
      cls: 'card-knows',
    },
    {
      title: 'What it SEES',
      body: 'Only what’s in its context window right now: your prompt, the conversation so far, any files.',
      cls: 'card-sees',
    },
  ];
  const cardW = (X1 - X0 - 16) / 2;
  const cardGs = cards.map((c, i) => {
    const cg = g.append('g').attr('transform', `translate(${X0 + i * (cardW + 16)},${LINE_Y + 70})`);
    cg.append('rect').attr('class', `demo-panel ${c.cls}`).attr('width', cardW).attr('height', 150).attr('rx', 8);
    cg.append('text').attr('class', 'demo-title').attr('x', 14).attr('y', 26).text(c.title);
    appendParagraphs(cg, c.body, { x: 14, y: 52, maxChars: 28, lineHeight: 17, cls: 'demo-text' });
    return cg;
  });

  return {
    g,
    async play(_cfg, alive) {
      [dataLabel, trainBand, trainLabel, frozenBand, cutoff, release, chat, ...cardGs].forEach((s) => s.interrupt().style('opacity', 0));
      dataBand.interrupt().attr('width', 0);

      // Data accumulates up to the cutoff…
      dataBand.transition().duration(dur(900)).attr('width', x(AT.cutoff) - X0);
      dataLabel.transition().delay(dur(400)).duration(dur(400)).style('opacity', 1);
      await wait(950);
      if (!alive()) return;
      cutoff.transition().duration(dur(300)).style('opacity', 1);
      trainBand.transition().delay(dur(200)).duration(dur(400)).style('opacity', 1);
      trainLabel.transition().delay(dur(300)).duration(dur(400)).style('opacity', 1);
      await wait(700);
      if (!alive()) return;
      // …then the model is released, frozen, and used.
      release.transition().duration(dur(300)).style('opacity', 1);
      frozenBand.transition().delay(dur(200)).duration(dur(400)).style('opacity', 1);
      await wait(700);
      if (!alive()) return;
      chat.transition().duration(dur(300)).style('opacity', 1);
      await wait(500);
      if (!alive()) return;
      cardGs.forEach((c, i) => c.transition().delay(dur(i * 300)).duration(dur(400)).style('opacity', 1));
    },
  };
}
