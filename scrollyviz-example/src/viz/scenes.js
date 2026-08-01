// The storyboard. Each entry is a declarative description of what the graphic
// should show at that step — NOT how to draw it. graphic.js reads these flags
// and renders accordingly. To reorder, insert, or cut a beat in the narrative,
// edit this array (and the matching copy in content/steps.js). You should rarely
// need to touch the rendering code to change the story.
//
// Available flags (all optional):
//   drawLine   – reveal the primary line
//   showArea   – fill under the primary line
//   highlight  – { from: Date-ish, to: Date-ish } shaded emphasis band
//   showTarget – reveal the dashed reference line
//   annotate   – 'last' to call out the final data point
export const scenes = [
  {
    id: 0,
    drawLine: true,
  },
  {
    id: 1,
    drawLine: true,
    showArea: true,
    highlight: { from: '2019-01-01', to: '2022-01-01' },
  },
  {
    id: 2,
    drawLine: true,
    showArea: true,
    showTarget: true,
  },
  {
    id: 3,
    drawLine: true,
    showArea: true,
    showTarget: true,
    annotate: 'last',
  },
];
