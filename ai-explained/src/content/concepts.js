// Key concepts: terms the page relies on, defined once here. Mark a term in
// any step's body as {{key}} — or {{key|text to show}} to show different
// wording, e.g. {{prompt|prompts}} — and it's underlined with a tooltip
// showing this definition. Matching ignores case, so write each key as it
// should appear mid-sentence (e.g. 'token ID'). Every term here is also listed,
// A–Z, in the "Key concepts" section at the end of the page.
export const concepts = {
  prompt: 'The instruction you give the model: what you want it to do.',
  context: 'The information the model needs to do it well, such as documents, earlier messages and files.',
  model: 'The AI system that does the work: a very large set of numbers, learned from examples, that turns an input into an output.',
  input: 'Everything the model reads before it responds: your prompt, the context, and anything it has already written.',
  output: 'What the model produces in response, written one token at a time.',
  token: 'The unit a model reads and writes: usually a word, part of a word or a punctuation mark. “November” might be two tokens, “Nov” + “ember”.',
  vocabulary: 'The fixed list of every token a model knows, typically tens of thousands to a few hundred thousand. Each one has its own token ID.',
  'token ID': 'A token’s number in the model’s vocabulary, like an index entry. The same token always has the same ID.',
  embedding: 'The list of numbers a token ID is turned into, learned during training. Real models use thousands of numbers per token, and tokens used in similar ways end up with similar numbers.',
  training: 'How a model learns: its numbers start out random and are nudged, over billions of examples, until its predictions match real text.',
  dataset: 'A collection of examples used for training. For a language model, a huge body of text: books, websites, code and more.',
  'pre-training': 'The first and largest stage of training: the model learns to predict the next token across a huge dataset, picking up language and general knowledge along the way.',
  'base model': 'The model straight after pre-training: very good at continuing text, but not yet trained to follow requests or hold a conversation.',
  'forward propagation': 'Running an input through the model’s layers, from input to output, to produce a prediction.',
  backpropagation: 'Working backwards from the error in a prediction to see how much each of the model’s numbers contributed, so each can be adjusted to do better next time.',
  'fine-tuning': 'Further training on a smaller, carefully chosen set of examples, such as requests paired with good responses, to shape how the model behaves.',
  'learning from feedback': 'Training that nudges a model towards the answers people (or a guiding AI) rate as better. Often called RLHF: reinforcement learning from human feedback.',
  'knowledge cutoff': 'The date the model’s training data ends. It has no built-in knowledge of anything after that, only what it’s given as context.',
  sampling: 'Picking the next token at random, weighted by the model’s probabilities, rather than always taking the single most likely one.',
  temperature: 'A setting that controls how adventurous sampling is. Low temperature sticks to the most likely tokens; high temperature gives less likely ones more of a chance.',
  attention: 'How a model decides which earlier tokens matter most for the next prediction, weighing every token in its context window.',
  transformer: 'The type of model behind today’s AI assistants, built around attention. The “T” in GPT stands for transformer.',
  'context window': 'How much text the model can take in at once: everything it can “see” when it predicts the next token. Anything outside the window is invisible to it.',
  'probabilistic method': 'Working by likelihood rather than fixed rules: the model gives every possible next token a probability, then picks one, usually among the most likely. That’s why the same prompt can give different replies.',
};
