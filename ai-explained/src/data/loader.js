import { json } from 'd3';

// Loads the story data from /public and derives everything computed from it,
// once, here — so graphic.js only ever receives ready-to-draw values.
// BASE_URL is injected by Vite (see vite.config.js).
export async function loadData() {
  const raw = await json(`${import.meta.env.BASE_URL}data/story.json`);

  return {
    meta: raw.meta,
    prompts: raw.prompts,
    scaling: shapeScaling(raw.scaling),
    compute: shapeCompute(raw.compute),
    usage: shapeUsage(raw.usage),
    embedding: raw.embedding,
    meaning: raw.meaning,
    trainingDemo: raw.trainingDemo,
    attention: raw.attention,
    sampling: raw.sampling,
  };
}

// One error-vs-data curve per model size, log-spaced along the data axis, plus
// the value at each power of ten (for the "drop per 10× more data" labels).
function shapeScaling({ params, dataRange, points, models, source }) {
  const { E, A, B, alpha, beta } = params;
  const loss = (N, D) => E + A / N ** alpha + B / D ** beta;
  const [lo, hi] = dataRange.map(Math.log10);

  const curves = Object.entries(models).map(([key, { label, N }]) => {
    const series = Array.from({ length: points }, (_, i) => {
      const D = 10 ** (lo + ((hi - lo) * i) / (points - 1));
      return { tokens: D, loss: loss(N, D) };
    });
    const decades = [];
    for (let p = Math.ceil(lo); p <= hi; p++) decades.push({ tokens: 10 ** p, loss: loss(N, 10 ** p) });
    return { key, label, N, series, decades };
  });

  return { source, curves };
}

// Training is a one-off cost; usage is a per-token cost that accumulates.
// breakEvenDays answers "how long until usage has cost as much as training?"
function shapeCompute(c) {
  const { N, trainingTokens, label } = c.model;
  const trainingFlops = c.flopsPerParamPerTrainingToken * N * trainingTokens;
  const flopsPerToken = c.flopsPerParamPerGeneratedToken * N;

  const rates = Object.fromEntries(
    Object.entries(c.usageRates).map(([key, r]) => [
      key,
      { ...r, breakEvenDays: trainingFlops / (flopsPerToken * r.tokensPerDay) },
    ])
  );

  return { source: c.source, label, N, trainingTokens, trainingFlops, flopsPerToken, rates };
}

// Tokens per turn of a conversation. Each turn the model re-reads everything
// so far (input) and writes a reply (output), so input grows turn on turn.
function shapeUsage({ source, wordsPerToken, conversation }) {
  const { firstMessage, followUp, reply, turns: count } = conversation;
  const turns = [];
  let context = firstMessage;
  for (let t = 1; t <= count; t++) {
    turns.push({ turn: t, input: context, output: reply });
    context += reply + followUp;
  }
  const totals = {
    input: turns.reduce((a, d) => a + d.input, 0),
    output: turns.reduce((a, d) => a + d.output, 0),
  };
  return { source, wordsPerToken, turns, totals };
}
