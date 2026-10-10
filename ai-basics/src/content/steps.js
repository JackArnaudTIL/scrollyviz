// DRAFT outline — a first pass at the story beats, not final copy. Reorder,
// cut, or rewrite freely; the chart for each beat isn't designed yet.
// Same shape as scrollyviz-example: one entry per step, index aligns with scenes.js.
export const steps = [
  {
    title: 'A model is a function learned from examples',
    body: 'Instead of writing rules by hand, we show a program lots of examples and let it adjust itself until its answers match. The result — the model — is just a very large set of numbers.',
  },
  {
    title: 'Training: guess, check, nudge',
    body: 'During training the model makes a guess, measures how wrong it was, and nudges its numbers slightly to be less wrong next time. Repeat billions of times.',
  },
  {
    title: 'Text becomes tokens',
    body: 'Language models don’t read letters or whole words. Text is split into tokens — common chunks of words — and each token is turned into a list of numbers.',
  },
  {
    title: 'Predicting the next token',
    body: 'At its core, a language model does one thing: given the tokens so far, it scores every possible next token. Pick one, append it, and repeat — that’s how a reply is written.',
  },
  {
    title: 'Context is its working memory',
    body: 'The model only “sees” what’s in its context window: your prompt, the conversation so far, and any documents provided. Anything outside it, it doesn’t know about in that moment.',
  },
  {
    title: 'Why it can be confidently wrong',
    body: 'The model produces what is likely, not what is checked. That’s why answers can sound fluent yet be incorrect — and why verifying important facts still matters.',
  },
];
