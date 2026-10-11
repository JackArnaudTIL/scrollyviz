import { select } from 'd3';
import { scenes } from './scenes.js';
import { W, H, PAD, zones } from './layout.js';
import { dur, wait, fadeTo } from './motion.js';
import { createTokens, display, CHIP_H, CHIP_PAD } from './tokens.js';
import { createModel } from './modelGraph.js';
import { createOutput } from './output.js';
import { createScalingChart } from './scalingChart.js';
import { createComputeChart } from './computeChart.js';
import { createUsageChart } from './usageChart.js';
import { createSummary } from './summary.js';
import { createBrowserView } from './browserView.js';
import { createEmbeddingView } from './embeddingView.js';
import { createMeaningView } from './meaningView.js';
import { createStagesView } from './stagesView.js';
import { createAssistantView } from './assistantView.js';
import { createFeedbackView } from './feedbackView.js';
import { createFrozenView } from './frozenView.js';
import { createAttentionView } from './attentionView.js';
import { createSamplingView } from './samplingView.js';

// Factory: build everything once, then drive it with renderScene(i).
// Each scene is a declarative entry in scenes.js; this file turns it into
// calls on the zone/view modules, plus the short animated sequences.
//
// Scenes can be left mid-animation, so each one gets a run id; async
// sequences check alive() after every pause and stop if the reader has moved on.
export function createGraphic(container, data) {
  const el = select(container);
  let svg, zoneG, views, tokens, model, output;
  let runId = 0;

  function build() {
    svg = el
      .append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Diagram of how a language model works, updated as you scroll');

    svg.append('defs')
      .append('marker')
      .attr('id', 'pipeline-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('class', 'arrow-head')
      .attr('d', 'M0,0 L10,5 L0,10 z');

    const pipeline = svg.append('g').attr('class', 'view').style('opacity', 0);
    zoneG = {
      text: pipeline.append('g'),
      model: pipeline.append('g'),
      output: pipeline.append('g'),
    };
    const labels = { text: 'INPUT', model: 'MODEL', output: 'OUTPUT' };
    for (const [k, z] of Object.entries(zones)) {
      zoneG[k].append('text').attr('class', 'zone-label').attr('x', PAD).attr('y', z.y + 10).text(labels[k]);
    }
    // Arrows into the model and into the output dim along with their zone.
    [
      ['model', zones.text.y + zones.text.h, zones.model.y - 6],
      ['output', zones.model.y + zones.model.h + 5, zones.output.y - 6],
    ].forEach(([k, y1, y2]) =>
      zoneG[k]
        .append('line')
        .attr('class', 'arrow')
        .attr('x1', W / 2)
        .attr('x2', W / 2)
        .attr('y1', y1)
        .attr('y2', y2)
        .attr('marker-end', 'url(#pipeline-arrow)')
    );

    tokens = createTokens(zoneG.text);
    model = createModel(zoneG.model);
    output = createOutput(zoneG.output);

    views = {
      browser: createBrowserView(svg, data.prompts.email.brief),
      pipeline: { g: pipeline },
      scaling: createScalingChart(svg, data.scaling),
      compute: createComputeChart(svg, data.compute),
      usage: createUsageChart(svg, data.usage),
      summary: createSummary(svg),
      embedding: createEmbeddingView(svg, data.embedding),
      meaning: createMeaningView(svg, data.meaning),
      stages: createStagesView(svg),
      assistant: createAssistantView(svg, data.trainingDemo),
      feedback: createFeedbackView(svg, data.trainingDemo),
      frozen: createFrozenView(svg),
      attention: createAttentionView(svg, data.attention),
      sampling: createSamplingView(svg, data.sampling),
    };
  }

  function applyScene(i) {
    const s = scenes[i];
    if (!s) return;
    const run = ++runId;
    const alive = () => run === runId;

    svg.selectAll('*').interrupt().interrupt('pulse').interrupt('days').interrupt('typing');
    svg.selectAll('.flying').remove();

    for (const [k, v] of Object.entries(views)) {
      fadeTo(v.g, k === s.focus ? 1 : 0, 450);
      v.g.style('pointer-events', k === s.focus ? null : 'none');
    }

    if (s.focus === 'pipeline') playPipeline(s, alive);
    else if (views[s.focus]) views[s.focus].play(s[s.focus] ?? {}, alive);
    // 'none': every view has faded out above — a blank pause for a section break.
  }

  async function playPipeline(s, alive) {
    const prompt = data.prompts[s.prompt];
    const dim = s.dim ?? [];
    fadeTo(zoneG.model, dim.includes('model') ? 0.12 : 1);
    fadeTo(zoneG.output, dim.includes('output') ? 0.12 : 1);

    // The write scene starts from just the (collapsed) prompt. Otherwise show the
    // reply up to the prediction point, plus `picked` tokens after it (to carry
    // on from a scene that picked them).
    const base = s.write ? [] : [...prompt.tokens, ...(prompt.continuation ?? []).slice(0, s.picked ?? 0)];
    const prefix = s.prefix ? prompt.brief.label : null;
    // Same key for every scene on a prompt, so its chips are reused and animate
    // between looks (e.g. plain text splitting into tokens).
    const show = (texts, extra = {}) =>
      tokens.render({ texts, key: s.prompt, embed: s.embed, window: s.window, plain: s.plain, prefix, ...extra });
    show(base, { generatedFrom: s.generated ? 0 : null });
    output.setMode(s.output ?? null);

    if (s.write) await writeLoop(prompt, prefix, show, alive);
    else if (s.dataset) await datasetLoop(prompt, base, show, alive);
    else if (s.training) await trainingLoop(s, prompt, alive);
    else if (s.output === 'bars') await predictionLoop(s, prompt, base, show, alive);
  }

  // "Watch it write": each pass reads the whole input (prompt + context + reply so far),
  // a new token comes out of the model into the OUTPUT reply, and a copy is
  // added to the end of the INPUT for the next pass. Every token is animated;
  // the first few at a readable pace, the rest faster so the step doesn't drag.
  // No bars yet — the mechanics come later.
  // Every token makes two separate moves: model → output (then a short hold so
  // it registers), then output → input. The next prediction starts only after
  // the copy has joined the input.
  const SLOW_TOKENS = 3;
  const PACE = {
    slow: { think: 650, fly: 500, hold: 250, gap: 200 },
    fast: { think: 100, fly: 160, hold: 90, gap: 30 },
  };

  async function writeLoop(prompt, prefix, show, alive) {
    const reply = [...prompt.tokens, ...prompt.continuation];
    const from = { x: W / 2 - 20, y: zones.model.y + zones.model.h - 24 };
    const written = [];
    output.showReply(written);

    for (const [k, t] of reply.entries()) {
      const pace = k < SLOW_TOKENS ? PACE.slow : PACE.fast;
      model.pulse();
      await wait(pace.think);
      if (!alive()) return;
      written.push(t);

      const replySlot = output.replySlot(written);
      await fly(t, from, replySlot, true, pace.fly);
      if (!alive()) return;
      output.showReply(written, k);
      await wait(pace.hold);
      if (!alive()) return;

      // Fed back in: the new token joins the input for the next prediction.
      await fly(t, replySlot, tokens.slotFor(written, { plain: true, prefix }), true, pace.fly);
      if (!alive()) return;
      show([...written], { generatedFrom: 0, stagger: false });
      await wait(pace.gap);
      if (!alive()) return;
    }
  }

  // The dataset: slide along one sentence, turning each position into a
  // "given the text so far → next token" training example.
  async function datasetLoop(prompt, base, show, alive) {
    const sentence = [...base, ...prompt.continuation.slice(0, 2)];
    const trillions = data.compute.trainingTokens / 1e12;
    output.resetExamples(
      `Every position in every sentence works this way. Real training data runs to trillions of tokens — Chinchilla learned from ${trillions} trillion.`
    );
    for (const p of prompt.dataset.positions) {
      show(sentence, { target: p });
      await wait(500);
      if (!alive()) return;
      output.addExample(sentence.slice(0, p), sentence[p]);
      await wait(1100);
      if (!alive()) return;
    }
  }

  // Forward pass only (passes: 1), or forward + backpropagation repeated, with
  // the right answer's score climbing pass by pass.
  async function trainingLoop(s, prompt, alive) {
    const { target, passes } = prompt.training;
    const count = s.training === 'backprop' ? passes.length : 1;
    const score = (dist) => dist.find(([t]) => t === target)?.[1] ?? 0;
    const history = [];

    for (let k = 0; k < count; k++) {
      if (k > 0) {
        // Backpropagation: the error flows backwards and reweights connections.
        model.nudge();
        await wait(1100);
        if (!alive()) return;
      }
      // Forward propagation: signal flows input → output, producing a guess.
      model.pulse();
      await wait(700);
      if (!alive()) return;
      output.showBars(passes[k], 'train');
      history.push(score(passes[k]));
      output.markTarget(target, history);
      if (k < count - 1) {
        await wait(1500);
        if (!alive()) return;
      }
    }
  }

  // read: bars on screen before the pick; pick: highlight before it flies;
  // fly: travel time up to the input; settle: pause before the next round.
  const ROUND_PACE = {
    first: { read: 1400, pick: 450, fly: 600, settle: 600 },
    later: { read: 900, pick: 300, fly: 450, settle: 350 },
  };

  async function predictionLoop(s, prompt, base, show, alive) {
    const appendCount = s.append ?? 0;
    const predictions = prompt[s.predictions ?? 'next'];
    const rounds = Math.min(predictions.length, Math.max(1, appendCount));
    const appended = [];

    for (let j = 0; j < rounds; j++) {
      // The first two rounds at a reading pace; later rounds a little quicker.
      const pace = j < 2 ? ROUND_PACE.first : ROUND_PACE.later;
      const dist = predictions[j];
      model.pulse();
      output.showBars(dist, `${s.prompt}-${j}`);
      if (j >= appendCount) break;

      await wait(pace.read);
      if (!alive()) return;
      const from = output.pick(0);
      await wait(pace.pick);
      if (!alive()) return;

      const picked = dist[0][0];
      appended.push(picked);
      const texts = [...base, ...appended];
      const slot = tokens.slotFor(texts, { embed: s.embed, plain: s.plain, prefix: s.prefix ? prompt.brief.label : null });
      await fly(picked, from, slot, s.plain, pace.fly);
      if (!alive()) return;
      // The pick is added to the input; the next pass reads all of it.
      // No stagger: the new token appears at once, not after the others' delay.
      show(texts, { generatedFrom: s.generated ? 0 : base.length, stagger: false });
      await wait(pace.settle);
      if (!alive()) return;
    }

    if (s.flag === 'unchecked') output.flag(prompt.truth, prompt.caveat);
  }

  // A new token travels from where it was produced up to its slot in the text.
  const LINGER_MS = 300;

  async function fly(text, from, to, plain = false, ms = plain ? 500 : 700) {
    const t = svg
      .append('text')
      .attr('class', 'chip-text flying')
      .attr('x', from.x)
      .attr('y', from.y)
      .attr('dy', '0.35em')
      .text(display(text, plain));
    await t
      .transition()
      .duration(dur(ms))
      .attr('x', to.x + (plain ? 0 : CHIP_PAD))
      .attr('y', to.y + CHIP_H / 2)
      .end()
      .catch(() => {});
    // Linger briefly on arrival, so the token never vanishes while the copy in
    // its new slot fades in underneath. (Scene changes clear any leftovers.)
    setTimeout(() => t.remove(), dur(LINGER_MS));
  }

  return {
    init() {
      build();
      return this;
    },
    renderScene(i) {
      applyScene(i);
    },
    // The SVG scales via its viewBox, so there's nothing to recompute.
    resize() {},
  };
}

