import { select } from 'd3';

// Placeholder graphic. Only job right now: prove the scrolly-core scroller
// can drive *some* object with init()/renderScene(i)/resize(). Replace the
// body of build()/applyScene() once the chart type for this story is chosen —
// see scrollyviz-example/src/viz/graphic.js for the shape to follow.
export function createGraphic(container, data) {
  const el = select(container);
  let label;

  function build() {
    const svg = el.append('svg').attr('width', '100%').attr('height', '100%');
    label = svg
      .append('text')
      .attr('class', 'placeholder-label')
      .attr('x', '50%')
      .attr('y', '50%')
      .attr('text-anchor', 'middle');
  }

  return {
    init() {
      build();
      return this;
    },
    renderScene(i) {
      label.text(`chart TODO — scene ${i}`);
    },
    resize() {},
  };
}
