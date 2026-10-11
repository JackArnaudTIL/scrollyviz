// The narrative copy. One entry per step; index aligns with viz/scenes.js.
// Running example throughout: a reply to a work email. All probabilities and
// token splits shown on the page are illustrative — see public/data/story.json.
//
// Each step: { title, body }. A section break between groups is a step of its
// own: { section: 'Group name', body? } — shown as a plain heading with the
// graphic cleared (pair it with a { focus: 'none' } scene). `body` is a string, or a list of strings for
// several paragraphs; lines starting with '•' become a bulleted list. Mark a
// key concept as {{prompt}} (defined in content/concepts.js) to underline it
// with a definition tooltip.
export const steps = [
  // ---- Intro ----
  {
    title: 'About This Guide',
    body: [
      'This guide explains how the AI assistants you might use at work actually produce their answers, following one everyday example from start to finish. No maths or coding needed.',
      'Scroll at your own pace and the graphic alongside updates as you go. Underlined words are key concepts: hover over or tap them for a definition, or find them all at the end.',
      'To jump between sections, use the rail on the right of the screen (or the Contents button on a phone).'
    ],
  },

  // ---- How it works ----
  {
    section: 'How It Works',
  },
  {
    title: 'Use Case - Drafting a Reply',
    body: [
      'Sam has sent over a detailed Q3 report on company performance, with a few areas of concern.', 
      'You ask an AI assistant to “draft a reply to Sam, suggesting a timeline for handling the issues raised.”',
      '   • Your request is the {{prompt}} - your instructions to the AI.',
      '   • Sam’s email is {{context}} - further information the AI model references to provide a relevant response.',
      'Together, they form the {{input}} the {{model}} uses to draft the reply, or {{output}}.'
      ],
  },
  {
    title: 'Choosing the Right Words',
    body: [
    'The {{model}} takes the {{input}} and writes a draft reply, shown here as the {{output}}. It looks like typing, but every "piece" is a separate prediction.',
    'The model predicts the first {{token}}, or set number of characters, based on the sentence so far. The model returns a token, before adding this newly-predicted token to the input used to predict the next part of the reply.'
    ],
  },
  {
    title: 'Predicting the Next Token',
    body: [
    'These predictions rely on a {{probabilistic method}} - selecting the most likely next {{token}}, based on the {{context}}.',
    'In order to get a numeric prediction for the next character in a sentence, {{model|models}} have to find a way to reduce languages to some form of mathematical pattern.'
    ]
  },
  {
    title: 'Choosing a Token',
    body: [
      'The bars show how likely each token is, but something still has to pick one. The model uses {{sampling}}: it usually picks a likely token, and occasionally a less likely one.',
      'A setting called {{temperature}} controls how adventurous that choice is. Low temperature almost always picks the top token; high temperature spreads the chances out, giving more varied (and sometimes stranger) replies.',
      'This is the main reason the same prompt can give different answers each time.'
    ],
  },
  {
    title: 'Context for the Model',
    body: [
      'The {{model}} only “sees” what fits in its {{context window}}, which is either a full or partial version of the {{input}}. Partial context is a useful way of reducing the resources needed to run an AI model in complex cases.',
      'In the example seen here, {{context}} is only the last 12 {{token|tokens}} of the {{input}}, however this is unrealistic. Context can comprise millions of tokens of context in complex models.',
      ' Different contexts will provide different probabilities for the {{output}} value, introducing a level of "randomness" to AI outputs.'
    ]
    },
  {
    title: 'Paying Attention',
    body: [
      'Before predicting each token, the model works out which earlier tokens matter most. This is called {{attention}}, and it’s the key idea behind the {{transformer}} models used by today’s AI assistants.',
      'Here, about to write the word after “plan by”, it focuses most on “Friday’s board meeting” in Sam’s email, along with “plan” and “Scotland”. That’s why “Friday” scored 46% with the full context, and only 18% when the email fell outside the window.'
    ],
  },

  // ---- Building a Model ----
  {
    section: 'Building a Model',
  },
  {
    title: 'Text to Numbers',
    body: [
      'A {{model}} turns text into numbers using three steps, shown here for “for mid-November.”',
      '   • The text is split into {{token|tokens}}: whole words, parts of words (“Nov” + “ember”) and punctuation.',
      '   • Each token is looked up in the model’s {{vocabulary}} (the list of tokens it recognises from training) and swapped for its {{token ID}}, a fixed number for that token.',
      '   • Each ID is swapped for a long list of numbers, its {{embedding}}. Tokens used in similar ways end up with similar numbers, like “Nov” and “ember” here.',
      'This grid of numbers is the {{input}} the model actually works with.'
    ],
  },
  {
    title: 'What the Numbers Mean',
    body: [
      'An {{embedding}} works like a position on a map of meaning. Tokens used in similar ways sit close together: days of the week cluster, as do months and work words like “report” and “meeting”.',
      'Real embeddings have thousands of numbers, so the real map has thousands of directions. Here it’s flattened to two so it can be drawn.',
      'Every number starts out random, and is learned during {{training}}. So how does a model learn how to group these {{token|tokens}} together?'
    ],
  },

  {
    title: 'How Models Are Trained',
    body: [
      'Training happens in stages, and each one changes what the model can do:',
      '   • {{pre-training|Pre-training}} on a huge amount of text produces a {{base model}}: a powerful autocomplete.',
      '   • {{fine-tuning|Fine-tuning}} on examples of good answers turns it into an assistant that follows requests.',
      '   • {{learning from feedback|Learning from feedback}} steers it towards the answers people prefer.',
      'Then the model is frozen and released. The next few steps look at each stage.'
    ],
  },
  {
    title: 'Pre-training: Learning from Text',
    body: [
      'Pre-training is where a model learns language and most of what it “knows”. It reads a {{dataset}} of text so large it’s measured in trillions of tokens: books, websites, code and more.',
      'No one has to label it: the text is its own answer key. Every position becomes a question (“given the text so far, what comes next?”) and the real next token is the answer. One sentence gives dozens of examples.'
    ],
  },
  {
    title: 'Learning by Guessing',
    body: [
      'For each example, the model makes a guess ({{forward propagation}}) and checks it against the real next token. It then works out how much each of its numbers contributed to the mistake ({{backpropagation}}), and nudges every one, embeddings included, towards a better guess.',
      'Repeated trillions of times, “Friday” climbs from 1% to 46%. It never reaches 100%, because “Monday” or “the end of the month” would be fine answers too. Pre-training a large model this way takes weeks to months on thousands of specialised chips.'
    ],
  },
  {
    title: 'From Autocomplete to Assistant',
    body: [
      'A {{base model}} only continues text. Give it our request and it may carry on with more requests in the same pattern, because that’s what often follows text like this.',
      '{{fine-tuning|Fine-tuning}} trains it further on examples of requests paired with good responses, written or checked by people. It uses far less data than pre-training, but it changes how the model behaves: it now answers requests instead of continuing them.'
    ],
  },
  {
    title: 'Learning from Feedback',
    body: [
      'Even a fine-tuned model can give many plausible answers, and some are better than others. In {{learning from feedback}}, people compare pairs of answers and pick the better one: clearer, more accurate, more helpful, safer.',
      'The model is then nudged so preferred answers become more likely. Some methods also use feedback from another AI, guided by written principles.'
    ],
  },
  {
    title: 'More data helps — but less each time',
    body: 'Train on more text and the error keeps falling, but each 10× more data buys a smaller improvement than the last. A bigger model can make more of the same data, which is why data and model size tend to grow together. Quality matters as much as quantity.',
  },
  {
    title: 'Frozen After Training',
    body: [
      'Once training ends, the model’s numbers are fixed. Everything it “knows” comes from data up to its {{knowledge cutoff}}; anything newer, it can only work with if it’s given as {{context}}.',
      'It also doesn’t learn from your conversations. It only sees them through its {{context window}}, and when the conversation ends, the model is unchanged. Assistants with “memory” work by saving notes and adding them back into the context, not by retraining.'
    ],
  },

  // ---- Limits, costs, and the big picture ----
  {
    title: 'Why it can be confidently wrong',
    body: 'The model produces what is likely, not what has been checked — so answers can sound fluent and still be wrong. Counting letters is a classic trap: the model sees tokens, not letters. Newer models have learned to handle this one, but as models change, old traps disappear and new ones emerge. Verify anything that matters.',
  },
  {
    title: 'Training vs using: where the computing goes',
    body: 'Training is a huge one-off cost — roughly the same computing as writing out three times all the text the model learned from. Using the model costs a tiny amount per token, but it’s paid on every answer, for every user. At the scale of a popular service, usage overtakes training in weeks.',
  },
  {
    title: 'Tokens are also how usage is counted',
    body: 'Because the computing happens token by token, tokens are the natural unit for measuring — and pricing — AI use. Input tokens are everything the model reads: your message, the conversation so far, attached documents. Output tokens are what it writes, and usually cost more each. Every turn re-reads the whole conversation, so long chats and big documents add up quickly.',
  },
  {
    title: 'Putting it together',
    body: 'Text becomes tokens, the model scores what comes next, one token is picked and added, and the loop repeats. Everything the model “knows” was set during training; everything it can see is in its context window.',
  },
];
