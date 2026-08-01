import { select, line, area, axisBottom, axisLeft, curveMonotoneX } from 'd3';
import { makeScales, margin } from './scales.js';
import { scenes } from './scenes.js';
import { drawPath, fade, DURATION } from 'scrolly-core/transitions.js';

// Factory: create the graphic once, then drive it with renderScene(i).
// The chart is never rebuilt on scroll — it only transitions between states.
export function createGraphic(container, data) {
  const el = select(container);
  const series = data.series;

  let width = 0;
  let height = 0;
  let x, y;
  let current = -1;

  // Persistent selections, created once in build().
  let svg, gAxisX, gAxisY, areaPath, linePath, highlightRect, targetPath, annotation;

  const lineGen = line()
    .x((d) => x(d.date))
    .y((d) => y(d.value))
    .curve(curveMonotoneX);

  const areaGen = area()
    .x((d) => x(d.date))
    .y0(() => y.range()[0])
    .y1((d) => y(d.value))
    .curve(curveMonotoneX);

  const targetGen = line()
    .x((d) => x(d.date))
    .y((d) => y(d.target));

  function measure() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  function build() {
    measure();
    ({ x, y } = makeScales(series, width, height));

    svg = el
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img');

    // Order matters: highlight band sits behind everything data-related.
    highlightRect = svg
      .append('rect')
      .attr('class', 'highlight-band')
      .attr('y', margin.top)
      .attr('height', Math.max(0, height - margin.top - margin.bottom))
      .style('opacity', 0);

    gAxisX = svg
      .append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(axisBottom(x).ticks(6).tickSizeOuter(0));

    gAxisY = svg
      .append('g')
      .attr('class', 'axis axis-y')
      .attr('transform', `translate(${margin.left},0)`)
      .call(axisLeft(y).ticks(5).tickSizeOuter(0));

    areaPath = svg
      .append('path')
      .datum(series)
      .attr('class', 'area')
      .attr('d', areaGen)
      .style('opacity', 0);

    targetPath = svg
      .append('path')
      .datum(series)
      .attr('class', 'target-line')
      .attr('d', targetGen)
      .style('opacity', 0);

    linePath = svg
      .append('path')
      .datum(series)
      .attr('class', 'value-line')
      .attr('d', lineGen);

    annotation = svg.append('g').attr('class', 'annotation').style('opacity', 0);
    const last = series[series.length - 1];
    annotation
      .append('circle')
      .attr('class', 'annotation-dot')
      .attr('cx', x(last.date))
      .attr('cy', y(last.value))
      .attr('r', 5);
    annotation
      .append('text')
      .attr('class', 'annotation-label')
      .attr('x', x(last.date) - 8)
      .attr('y', y(last.value) - 12)
      .attr('text-anchor', 'end')
      .text(`${last.value.toFixed(1)}${data.meta.label.includes('%') ? '%' : ''}`);
  }

  function applyScene(i) {
    const s = scenes[i];
    if (!s) return;

    // Line: draw it in the first time we reach a line scene, otherwise keep it.
    if (s.drawLine && current < 0) drawPath(linePath);

    fade(areaPath, s.showArea ? 1 : 0);
    fade(targetPath, s.showTarget ? 1 : 0);
    fade(annotation, s.annotate === 'last' ? 1 : 0);

    if (s.highlight) {
      const x0 = x(new Date(s.highlight.from));
      const x1 = x(new Date(s.highlight.to));
      highlightRect.attr('x', x0).attr('width', Math.max(0, x1 - x0));
      fade(highlightRect, 1);
    } else {
      fade(highlightRect, 0);
    }
  }

  // Public: recompute scales/paths on container resize, preserving the scene.
  function resize() {
    if (!svg) return;
    measure();
    ({ x, y } = makeScales(series, width, height));

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
    gAxisX.attr('transform', `translate(0,${height - margin.bottom})`).call(axisBottom(x).ticks(6).tickSizeOuter(0));
    gAxisY.call(axisLeft(y).ticks(5).tickSizeOuter(0));
    highlightRect.attr('height', Math.max(0, height - margin.top - margin.bottom));
    areaPath.attr('d', areaGen);
    targetPath.attr('d', targetGen);
    linePath.attr('stroke-dasharray', null).attr('d', lineGen);

    const last = series[series.length - 1];
    annotation.select('.annotation-dot').attr('cx', x(last.date)).attr('cy', y(last.value));
    annotation.select('.annotation-label').attr('x', x(last.date) - 8).attr('y', y(last.value) - 12);

    const scene = current;
    current = -2; // force re-apply without re-triggering the intro draw
    if (scene >= 0) {
      current = 0;
      applyScene(scene);
      current = scene;
    }
  }

  return {
    init() {
      build();
      return this;
    },
    renderScene(i) {
      applyScene(i);
      current = i;
    },
    resize,
  };
}
