// Motion lives here, apart from the static drawing in graphic.js. When you want
// to retune easing, duration, or the reveal style, this is the only file to edit.

export const DURATION = 900;

// Animate an SVG <path> drawing itself left-to-right using the stroke-dash trick.
export function drawPath(path, duration = DURATION) {
  const node = path.node();
  if (!node) return;
  const length = node.getTotalLength();
  path
    .attr('stroke-dasharray', `${length} ${length}`)
    .attr('stroke-dashoffset', length)
    .transition()
    .duration(duration)
    .ease(easeInOutCubic)
    .attr('stroke-dashoffset', 0)
    // Clear the dash array afterwards so responsive resizes don't clip the line.
    .on('end', () => path.attr('stroke-dasharray', null));
}

// Fade any selection in or out.
export function fade(selection, opacity, duration = DURATION * 0.6) {
  selection.transition().duration(duration).style('opacity', opacity);
}

// Cubic ease-in-out as a plain function so we don't depend on d3-ease naming.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
