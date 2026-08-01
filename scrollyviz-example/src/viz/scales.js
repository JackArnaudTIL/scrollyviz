import { scaleTime, scaleLinear, extent, max } from 'd3';

export const margin = { top: 24, right: 24, bottom: 36, left: 44 };

// Build x/y scales for a given pixel size. Kept separate so every scene shares
// one consistent coordinate system — scenes change what's shown, never the axes.
export function makeScales(series, width, height) {
  const x = scaleTime()
    .domain(extent(series, (d) => d.date))
    .range([margin.left, width - margin.right]);

  const yMax = max(series, (d) => Math.max(d.value, d.target)) * 1.08;
  const y = scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([height - margin.bottom, margin.top]);

  return { x, y };
}
