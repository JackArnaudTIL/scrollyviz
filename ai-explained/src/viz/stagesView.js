import { PAD, W } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view opening the training section: the stages that turn text
// into an assistant. Things the model is (or starts from) are filled cards;
// the training stages between them are outlined, with an orange title.
const STAGES = [
  { kind: 'thing', title: 'Text data', note: 'trillions of tokens: books, websites, code…' },
  { kind: 'process', title: 'Pre-training', note: 'predict the next token, again and again' },
  { kind: 'thing', title: 'Base model', note: 'a powerful autocomplete' },
  { kind: 'process', title: 'Fine-tuning', note: 'examples of requests with good answers' },
  { kind: 'process', title: 'Learning from feedback', note: 'people pick the better of two answers' },
  { kind: 'thing', title: 'Assistant', note: 'ready to use, then frozen' },
];
const BOX = { x: PAD + 30, w: W - 2 * PAD - 60, h: 56 };
const TOP = 40;
const STEP = 92;

export function createStagesView(parent) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  g.append('defs')
    .append('marker')
    .attr('id', 'stages-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 9)
    .attr('refY', 5)
    .attr('markerWidth', 7)
    .attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('class', 'arrow-head')
    .attr('d', 'M0,0 L10,5 L0,10 z');

  const cx = BOX.x + BOX.w / 2;
  const arrows = g
    .append('g')
    .selectAll('line')
    .data(STAGES.slice(1))
    .join('line')
    .attr('class', 'arrow')
    .attr('x1', cx)
    .attr('x2', cx)
    .attr('y1', (_, k) => TOP + k * STEP + BOX.h + 4)
    .attr('y2', (_, k) => TOP + (k + 1) * STEP - 4)
    .attr('marker-end', 'url(#stages-arrow)');

  const nodes = g
    .append('g')
    .selectAll('g')
    .data(STAGES)
    .join('g')
    .attr('class', (d) => `stage stage-${d.kind}`)
    .attr('transform', (_, k) => `translate(${BOX.x},${TOP + k * STEP})`);
  nodes.append('rect').attr('width', BOX.w).attr('height', BOX.h).attr('rx', 8);
  nodes.append('text').attr('class', 'stage-title').attr('x', 16).attr('y', 23).text((d) => d.title);
  nodes.append('text').attr('class', 'stage-note').attr('x', 16).attr('y', 42).text((d) => d.note);

  return {
    g,
    async play(_cfg, alive) {
      nodes.interrupt().style('opacity', 0);
      arrows.interrupt().style('opacity', 0);
      // Build the pipeline top to bottom.
      for (let k = 0; k < STAGES.length; k++) {
        if (k > 0) arrows.filter((_, j) => j === k - 1).transition().duration(dur(250)).style('opacity', 1);
        nodes.filter((_, j) => j === k).transition().delay(dur(150)).duration(dur(350)).style('opacity', 1);
        await wait(450);
        if (!alive()) return;
      }
    },
  };
}
