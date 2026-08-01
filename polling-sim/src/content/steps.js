// `body` is an array of paragraphs, not a single string — main.js's
// buildSteps() renders one <p> per entry, so a step can carry more than one
// text block. A single string still works too (buildSteps() wraps it in an
// array), for a step that only needs one paragraph.
export const steps = [
  {
    title: 'Each dot is a vote',
    body: [
      'This is a theoretical poll of 5,000 UK voters. Every dot is one person — hover any of them to see who they are. Stacked together, the dots become a bar: taller means more voters chose that party.',
      'To see how these groups break down by common characteristics, click on the filters below.',
    ],
  },
];
