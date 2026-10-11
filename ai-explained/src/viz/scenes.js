// The storyboard. Each entry is a declarative description of what the graphic
// should show at that step — NOT how to draw it. graphic.js reads these fields
// and renders accordingly. To reorder, insert, or cut a beat in the narrative,
// edit this array (and the matching copy in content/steps.js).
//
// The graphic has three persistent zones, stacked top to bottom:
//   INPUT (text / tokens)  →  MODEL (a node map: input, hidden, output layers)  →  OUTPUT
// Most scenes change what one zone shows; a few (browser, scaling, compute,
// usage, summary) replace the pipeline with a full-graphic view of their own.
//
// Fields (all optional unless noted):
//   id        – stable name for the beat (required)
//   focus     – what owns the graphic (required): 'none' (cleared, for a
//               section break) | 'pipeline' (the three zones) |
//               'browser' | 'sampling' | 'attention' | 'embedding' | 'meaning' |
//               'stages' | 'assistant' |
//               'feedback' | 'scaling' | 'frozen' | 'compute' | 'usage' |
//               'summary'
//               (full-graphic views)
//   dim       – pipeline zones to fade back: ['model', 'output']
//   prompt    – key into data.prompts: the text shown in the input zone
//   prefix    – show the prompt and its context collapsed into one block
//               before the tokens
//   plain     – show the text as ordinary text rather than token chips
//   generated – style the reply text as model-written (as in the write step)
//   embed     – show each token chip's strip of numbers underneath it
//   output    – what the output zone shows: 'reply' (the text written so far) |
//               'bars' (next-token probabilities) |
//               'examples' (training examples cut from one sentence)
//   picked    – also show this many reply tokens after the prediction point
//               (e.g. the ones a previous scene picked and appended)
//   write     – write the whole reply (prompt.tokens + prompt.continuation),
//               token by token, into the output and back into the input
//   append    – number of picked tokens that fly up and join the text
//   dataset   – slide along the sentence, listing training examples
//   training  – 'forward' (one forward pass) | 'backprop' (repeated passes,
//               reweighting in between) — uses prompt.training
//   window    – size of the context frame, in tokens; earlier tokens (and the
//               collapsed prompt) fade out
//   predictions – which list of next-token predictions to use: a key in the
//               prompt's data (default 'next')
//   flag      – 'unchecked': mark the chosen bar as likely ≠ true
//   scaling   – { models: keys into data.scaling.models, gains: label the
//                 error drop per 10× more data }
//   compute   – { rates: keys into data.compute.usageRates to step through }
//   usage     – {} (the token-usage view takes its numbers from data.usage)
export const scenes = [
  // ---- Intro: no graphic yet ----
  {
    id: 'intro',
    focus: 'none',
  },

  // ---- How it works: the example first, then the mechanics ----
  {
    // Section break.
    id: 'how-it-works',
    focus: 'none',
  },
  {
    // The task: Sam's email in a browser, the request in an AI chat panel.
    id: 'brief',
    focus: 'browser',
  },
  {
    id: 'example',
    focus: 'pipeline',
    prompt: 'email',
    prefix: true,
    plain: true,
    output: 'reply',
    write: true,
  },
  {
    id: 'next-token',
    focus: 'pipeline',
    prompt: 'email',
    prefix: true,
    plain: true, // same look as the write step: running text, model-written in orange
    generated: true,
    output: 'bars',
    append: 8, // ' Friday, ahead of the board meeting?' — one prediction per token
  },
  {
    // The "plan by" prediction reshaped by temperature, then five sampled runs.
    id: 'sampling',
    focus: 'sampling',
  },
  {
    // Same input as next-token (the step before), but a small context window: the prompt and
    // Sam's email (with Friday's board meeting) fall outside it.
    id: 'context',
    focus: 'pipeline',
    prompt: 'email',
    prefix: true,
    plain: true,
    generated: true,
    window: 12,
    output: 'bars',
    predictions: 'windowed',
  },
  {
    // Which earlier tokens the model attends to when predicting after "plan by".
    id: 'attention',
    focus: 'attention',
  },

  // ---- Building a Model: tokens, then training, then scale ----
  {
    // Section break: just the group heading, graphic cleared.
    id: 'building-a-model',
    focus: 'none',
  },
  {
    // One phrase from the reply: text → tokens → token IDs → grid of numbers.
    id: 'tokens',
    focus: 'embedding',
  },
  {
    // Embeddings as a map: random positions settle into clusters of meaning.
    id: 'meaning',
    focus: 'meaning',
  },

  // ---- How models are trained: the big picture, then each stage ----
  {
    // The training pipeline: data → pre-training → base model → fine-tuning →
    // feedback → assistant.
    id: 'stages',
    focus: 'stages',
  },
  {
    id: 'dataset',
    focus: 'pipeline',
    dim: ['model'],
    prompt: 'email',
    output: 'examples',
    dataset: true,
  },
  {
    id: 'backprop',
    focus: 'pipeline',
    prompt: 'email',
    output: 'bars',
    training: 'backprop',
  },
  {
    // Same request: a base model continues the pattern; an assistant answers.
    id: 'assistant',
    focus: 'assistant',
  },
  {
    // Two candidate replies; the reviewer prefers one.
    id: 'feedback',
    focus: 'feedback',
  },
  {
    id: 'scaling',
    focus: 'scaling',
    scaling: { models: ['small', 'large'], gains: true },
  },
  {
    // Timeline: training data → cutoff → release → your chat; knows vs sees.
    id: 'frozen',
    focus: 'frozen',
  },

  // ---- Limits, costs, and the big picture ----
  {
    id: 'confidently-wrong',
    focus: 'pipeline',
    prompt: 'trap', // the token split is the explanation: 'str' 'aw' 'berry'
    output: 'bars',
    append: 1,
    flag: 'unchecked',
  },
  {
    id: 'compute',
    focus: 'compute',
    compute: { rates: ['modest', 'popular'] },
  },
  {
    id: 'token-costs',
    focus: 'usage',
    usage: {},
  },
  {
    // Low priority — more content may be added before this beat.
    id: 'summary',
    focus: 'summary',
  },
];
