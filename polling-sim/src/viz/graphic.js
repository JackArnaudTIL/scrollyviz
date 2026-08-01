import { select } from 'd3';
import { PARTIES } from './parties.js';

// A horizontal dot-matrix ("unit chart") bar chart: one dot per voter,
// packed left-to-right into a fixed-thickness band per party — bar LENGTH
// (rightward) encodes the vote count, exactly like a horizontal bar chart,
// just built from the individual units it represents.
//
// Nothing — not the chart, not the legend — is visible on load (see
// .dotchart's opacity in main.css). It reveals, then renderScene builds it,
// lazily, the first time the reader scrolls to the step — see scroller.js.
// Each dot then slides in on its own schedule as a function of scroll
// progress (renderProgress), staggered by how far into its bar it sits, not
// a fixed timer and not all 5,000 moving as one block. A dot is invisible
// until the instant it starts moving (no "waiting cluster" at the entry
// point), and every dot finishes well before the step's scroll ends —
// ENTRY_END_FRAC — leaving a settled pause to look at the finished chart
// before the reader scrolls on.
const DOT_DIAMETER = 5;
const DOT_SPACING = 7; // center-to-center — the fixed "1 voter" unit
const ROW_GAP = 10;
const TOP_PAD = 8;
const LEFT_LABEL_WIDTH = 100;
const RIGHT_PAD = 44; // room for the tip label past the longest bar
const SLIDE_MARGIN = 40; // how far past the visible edge dots start from
const ENTRY_DURATION_FRAC = 0.05; // how much of the scroll each dot's own slide takes
const ENTRY_END_FRAC = 0.3; // all dots finish by 70% through the step, leaving a pause to review

export function createGraphic(container, data) {
  const { parties } = data;

  let width = 0;
  let height = 0;
  let current = -1;
  let lastProgress = 0;
  let maxCountOverall = 1;

  let root, scrollWrap, svg, gDots, gLabels, tooltip, dotSelection;

  function build() {
    root = select(container).append('div').attr('class', 'dotchart');

    buildLegend();

    scrollWrap = root.append('div').attr('class', 'dotchart-scroll');
    svg = scrollWrap.append('svg').attr('role', 'img').attr('aria-label', 'Voting intention, one dot per surveyed voter');
    gDots = svg.append('g').attr('class', 'dots');
    gLabels = svg.append('g').attr('class', 'row-labels');

    buildTable();

    tooltip = root.append('div').attr('class', 'dot-tooltip').attr('role', 'status').attr('hidden', true);

    measure();

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') hideTooltip();
    });
  }

  function buildLegend() {
    const legend = root.append('div').attr('class', 'legend').attr('role', 'list');
    const items = legend.selectAll('.legend-item').data(parties).join('span').attr('class', 'legend-item').attr('role', 'listitem');
    items.append('span').attr('class', (d) => `legend-swatch dot-${d.key}`);
    items.append('span').attr('class', 'legend-label').text((d) => d.short);
  }

  function buildTable() {
    const total = parties.reduce((sum, p) => sum + p.count, 0);
    const details = root.append('details').attr('class', 'data-table');
    details.append('summary').text('View as table');
    const table = details.append('table');
    const thead = table.append('thead').append('tr');
    thead.append('th').text('Party');
    thead.append('th').text('Voters');
    thead.append('th').text('Share');
    const tbody = table.append('tbody');
    const rows = tbody.selectAll('tr').data(parties).join('tr');
    rows.append('td').text((d) => d.name);
    rows.append('td').attr('class', 'num').text((d) => d.count.toLocaleString());
    rows.append('td').attr('class', 'num').text((d) => `${((d.count / total) * 100).toFixed(1)}%`);
  }

  function measure() {
    // Deliberately NOT container's rect: the SVG lives inside
    // .dotchart-scroll, which is smaller than the outer figure because the
    // legend and table share the same flex column above/below it. Sizing
    // the SVG off the figure's full height left it taller than its actual
    // box, and the last row(s) got clipped by .dotchart-scroll's
    // overflow-y: hidden — looked like empty space, was actually cut-off
    // content.
    const rect = scrollWrap.node().getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  // Thickness (dots stacked per band) is solved from the HEIGHT budget —
  // the bounded dimension — and kept uniform across parties, same "unit
  // never changes size" rule as the rest of the chart. Bar LENGTH is
  // unbounded: a party with more voters just extends further right, and the
  // chart scrolls horizontally (.dotchart-scroll) rather than compress or
  // clip a real count.
  function computeLayout() {
    const n = parties.length;
    const bandBudget = (height - 2 * TOP_PAD - (n - 1) * ROW_GAP) / n;
    const bandThickness = Math.max(1, Math.floor(bandBudget / DOT_SPACING));
    const bandHeight = bandThickness * DOT_SPACING;
    const baselineX = LEFT_LABEL_WIDTH;

    let maxCols = 1;
    maxCountOverall = Math.max(1, ...parties.map((p) => p.count));

    parties.forEach((p, r) => {
      const rowTop = TOP_PAD + r * (bandHeight + ROW_GAP);
      const cols = Math.max(1, Math.ceil(p.count / bandThickness));
      maxCols = Math.max(maxCols, cols);

      p._rowCenterY = rowTop + bandHeight / 2;
      p._barEndX = baselineX + cols * DOT_SPACING;
      p._dotPositions = p.voters.map((voter, i) => {
        const subcol = Math.floor(i / bandThickness);
        const subrow = i % bandThickness;
        return {
          voter,
          party: p,
          // i (this voter's raw position in the party, not the column it
          // lands in) drives entry timing — every dot gets its own delay,
          // not just its column. Normalizing by the largest PARTY'S count
          // (not column count) keeps the earlier story intact: a small
          // party's few dots all land in a quick early burst, the biggest
          // bar's ~1,300 dots spread individually across the whole scroll.
          entryIndex: i,
          finalX: baselineX + subcol * DOT_SPACING + DOT_SPACING / 2,
          finalY: rowTop + subrow * DOT_SPACING + DOT_SPACING / 2,
        };
      });
    });

    const contentWidth = Math.max(width, baselineX + maxCols * DOT_SPACING + RIGHT_PAD);
    return { baselineX, contentWidth };
  }

  function renderRowLabels() {
    const total = parties.reduce((sum, p) => sum + p.count, 0);
    const groups = gLabels
      .selectAll('g.row-label-group')
      .data(parties, (d) => d.key)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'row-label-group').attr('tabindex', 0);
        g.append('text').attr('class', 'row-label').attr('x', 0).attr('text-anchor', 'start');
        g.append('text').attr('class', 'row-value').attr('text-anchor', 'start');
        return g;
      })
      .attr('aria-label', (d) => `${d.name}: ${d.count.toLocaleString()} voters, ${((d.count / total) * 100).toFixed(1)} per cent`);

    groups.select('.row-label').attr('y', (d) => d._rowCenterY).attr('dy', '0.32em').text((d) => d.short);
    groups.select('.row-value').attr('x', (d) => d._barEndX + 8).attr('y', (d) => d._rowCenterY).attr('dy', '0.32em').text((d) => `${d.count.toLocaleString()} · ${((d.count / total) * 100).toFixed(1)}%`);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Where a single dot sits in its own entrance (0 = hasn't started, 1 =
  // fully arrived), given overall scroll progress p.
  function localProgress(d, p) {
    const delay = (d.entryIndex / maxCountOverall) * (ENTRY_END_FRAC - ENTRY_DURATION_FRAC);
    return Math.min(1, Math.max(0, (p - delay) / ENTRY_DURATION_FRAC));
  }

  // Every dot slides on the SAME scroll timeline, but not in lockstep: a dot
  // further into its bar gets a later start, so a small party's few dots pop
  // in almost together near the start of the scroll while a big party's bar
  // visibly builds, dot by dot. All dots finish by ENTRY_END_FRAC, not at
  // progress 1 — the remaining scroll through the step is a deliberate
  // pause, chart fully settled, before the reader scrolls on.
  function applyProgress(progress) {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !dotSelection) return;
    const startX = width + SLIDE_MARGIN;
    const p = Math.min(1, Math.max(0, progress));

    dotSelection
      .attr('cx', (d) => {
        const local = localProgress(d, p);
        return startX + (d.finalX - startX) * easeOutCubic(local);
      })
      // A dot that hasn't started yet (local === 0) stays invisible instead
      // of sitting off to the side as a visible "waiting" cluster — it only
      // appears once it's actually moving, fading in as it slides.
      .style('opacity', (d) => localProgress(d, p));
  }

  function buildDots() {
    root.classed('is-revealed', true);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const { contentWidth } = computeLayout();

    svg.attr('width', contentWidth).attr('height', height).attr('viewBox', `0 0 ${contentWidth} ${height}`);
    renderRowLabels();

    const dotsData = parties.flatMap((p) => p._dotPositions);
    const startX = width + SLIDE_MARGIN;

    dotSelection = gDots
      .selectAll('circle')
      .data(dotsData, (d) => d.voter.id)
      .join('circle')
      .attr('class', (d) => `dot dot-${d.party.key}`)
      .attr('r', DOT_DIAMETER / 2)
      .attr('cy', (d) => d.finalY)
      .attr('cx', reduceMotion ? (d) => d.finalX : startX)
      .style('opacity', reduceMotion ? 1 : 0)
      .on('pointerenter', (event, d) => showTooltip(event, d))
      .on('pointermove', (event, d) => showTooltip(event, d))
      .on('pointerleave', hideTooltip);

    lastProgress = reduceMotion ? 1 : 0;
  }

  function showTooltip(event, d) {
    const { voter, party } = d;
    const rect = container.getBoundingClientRect();

    tooltip.selectAll('*').remove();
    tooltip.append('strong').text(party.name);
    tooltip.append('span').text(`${voter.age}, ${voter.gender.toLowerCase()} · ${voter.region}`);
    tooltip.append('span').text(`2019 vote: ${voter.vote2019}`);

    tooltip
      .style('left', `${event.clientX - rect.left + 12}px`)
      .style('top', `${event.clientY - rect.top + 12}px`)
      .attr('hidden', null);
  }

  function hideTooltip() {
    tooltip.attr('hidden', true);
  }

  function resize() {
    if (!svg || current < 0) return;
    measure();
    const { contentWidth } = computeLayout();
    svg.attr('width', contentWidth).attr('height', height).attr('viewBox', `0 0 ${contentWidth} ${height}`);
    renderRowLabels();

    const dotsData = parties.flatMap((p) => p._dotPositions);
    dotSelection = gDots.selectAll('circle').data(dotsData, (d) => d.voter.id).attr('cy', (d) => d.finalY);
    applyProgress(lastProgress);
  }

  return {
    init() {
      build();
      return this;
    },
    // Fires once, lazily, the first time the reader scrolls to this step —
    // nothing above exists in visible form before this runs.
    renderScene(i) {
      if (current < 0) buildDots();
      current = i;
    },
    // Fires continuously as the reader scrolls through the step; scrubs the
    // dots in from the right rather than playing a fixed-duration animation.
    renderProgress(i, progress) {
      if (current < 0) return;
      lastProgress = progress;
      applyProgress(progress);
    },
    resize,
  };
}
