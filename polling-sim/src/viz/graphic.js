import { select } from 'd3';
import { PARTIES } from './parties.js';
import { CATEGORY_DOMAINS, CATEGORY_DEFS, shortValueLabel } from '../data/categories.js';
import { DURATION } from 'scrolly-core/transitions.js';

// Deterministic (seeded) RNG — same sequence every call for a given seed,
// so re-laying-out on resize doesn't re-randomize dots already mid-entrance
// or already arrived.
function mulberry32(seed) {
  let a = seed | 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// A horizontal dot-matrix ("unit chart") bar chart: one dot per voter,
// packed left-to-right into a fixed-thickness band per party — bar LENGTH
// (rightward) encodes the vote count, exactly like a horizontal bar chart,
// just built from the individual units it represents.
//
// The whole reveal is one strict sequence, all measured against a single
// 0→1 timeline that starts counting from the moment the sticky chart
// actually LOCKS into its pinned position (see isPinned) — not from when
// Scrollama first considers the step "entered", which can happen while the
// chart is still visibly sliding into place:
//   1. axis/legend fade in — scroll-driven like everything else (not a
//      fixed-duration CSS transition, which a fast scroller can outrun,
//      making this phase and the next blur together)
//   2. row NAMES (party names) fade in AS the dots start — not a fully
//      separate beat first, the two begin together (PHASE.namesStart ===
//      PHASE.dotsStart)
//   3. dots fill each bar — random order, but every bar finishes together
//      regardless of size (see localProgress)
//   4. row VALUES (count · %) fade in once the dots are done — the exact
//      answer, revealed after the reader has watched the bars build
//   5. the step's narrative text fades/slides in (see main.css's
//      .steps .step > * rule, driven by --chart-progress, which scroller.js
//      sets from this file's return value)
//   6. a short settled pause, then normal scrolling carries on to the outro
// Nothing in steps 1–5 is visible before its turn — see PHASE below and
// .dotchart's opacity in main.css.
const DOT_DIAMETER = 5;
const DOT_SPACING = 7; // center-to-center — the fixed "1 voter" unit
const ROW_GAP = 10;
const TOP_PAD = 8;
const LEFT_LABEL_WIDTH = 100;
const RIGHT_PAD = 44; // room for the tip label past the longest bar
const SLIDE_MARGIN = 40; // how far past the visible edge dots start from

// The post-story matrix explorer: same rows (parties), dots regroup into
// column-cells by a reader-chosen category. See computeMatrixLayout().
const HEADER_RESERVE = 20; // permanent gutter for column headers, folded into computeLayout()'s own height math
const MIN_MATRIX_PITCH = 3; // below this a cell's dots would be sub-pixel — the whole matrix falls back to bars
const MATRIX_CELL_PAD = 6; // gap between adjacent column-cells
const MATRIX_BAR_HEIGHT = 12; // bars-mode fallback mark height

// Fractions of the pin-rebased 0→1 timeline. Each phase's own span leaves a
// small gap before the next one starts, so beats read as sequential rather
// than blurring together.
//
// Kept well under 1.0: measured empirically, Scrollama's raw step-progress
// for a step this tall stops advancing (and .onStepProgress stops firing
// updates) somewhere around 0.85–0.9 of the nominal 0→1 range, regardless of
// how much trailing content/outro exists below it — that's a property of
// its own progress geometry for a very tall step, not a page-height
// shortfall. textEnd leaves real margin under that ceiling rather than
// targeting it exactly.
const PHASE = {
  axisEnd: 0.05, // axis/legend fully faded in by here — scroll-driven, not a fixed timer
  namesStart: 0.01, // row NAMES — start at the SAME point dots do (dotsStart), not a fully separate beat first
  namesEnd: 0.05,
  dotsStart: 0.07,
  dotsDuration: 0.04, // how long each individual dot's own slide takes
  dotsEnd: 0.35, // every bar finishes by here
  valuesStart: 0.27, // row VALUES (count · %) — only once the dots are done
  valuesEnd: 0.35,
  // The text itself is NOT sticky — .steps .step's padding-top (see
  // main.css) places it at a fixed document position, so it scrolls through
  // the viewport in a fixed-width window of its own, independent of PHASE:
  // roughly p 0.52-0.73 (~1 viewport-height of scroll out of the step's
  // 4.8x-viewport-height total — a ratio that holds regardless of actual
  // viewport size, since both scale with vh together). textStart/textEnd
  // must fit INSIDE that window with margin on both sides, or the text
  // scrolls out of view before finishing its own reveal — measured
  // empirically (see the .step h2 rect while scrolling), same caveat as
  // the padding-top comment: recheck this window if PHASE or step
  // min-height changes.
  textStart: 0.57, // consumed by main.css via --chart-progress, not here
  textEnd: 0.68,
};

// Largest party first, not `parties`' own order — `parties` keeps parties.js's
// fixed order (see its own comment on why: colors were validated against THAT
// specific adjacency, and the CSV export deliberately stays in it too,
// independent of whatever the count happens to be for a given dataset).
//
// isResidual (Other, Don't know) always sorts last regardless of count —
// they're not real party identities, so ranking them by size would mix
// "a smaller party" with "no substantive answer" as if they were the same
// kind of thing. Currently Other (146) outnumbers Plaid Cymru (22) and would
// otherwise rank above it. Within the residual pair itself, count doesn't
// drive order either (Array.sort is stable, so returning 0 here just keeps
// parties.js's own Other-then-Don't-know order) — arbitrarily reordering two
// "no substantive answer" rows by a count difference isn't meaningful the way
// it is for actual parties.
//
// Exported (not a graphic.js-local closure) so the splits explorer can put
// every panel's rows in the exact same order as this chart's — same
// function, not a second copy that could quietly drift out of sync.
export function sortDisplayParties(parties) {
  return [...parties].sort((a, b) => {
    if (!!a.isResidual !== !!b.isResidual) return a.isResidual ? 1 : -1;
    if (a.isResidual && b.isResidual) return 0;
    return b.count - a.count;
  });
}

export function createGraphic(container, data) {
  const { parties } = data;
  const displayParties = sortDisplayParties(parties);

  let width = 0;
  let height = 0;
  let current = -1;
  let lastProgress = 0;
  let maxCountOverall = 1;
  let dotRadius = DOT_DIAMETER / 2; // actual radius used, solved per render — see computeLayout
  let pinProgress = null; // raw step-progress at the moment the chart first locked into place
  let bandBudget = 0; // per-row height, solved in computeLayout — hoisted so computeMatrixLayout reuses the exact same row height
  let matrixMode = null; // null = normal bar chart; else a CATEGORY_DEFS key
  let matrixDotRadius = 0; // solved per computeMatrixLayout call, like dotRadius is per computeLayout
  let postStoryReady = false; // the matrix controls only exist once the scroll-driven reveal has fully played out

  let root, scrollWrap, svg, gDots, gLabels, gMatrixBars, gMatrixHeaders, gMatrixPercents, tooltip, dotSelection, downloadLink, matrixControls, matrixButtonsWrap;
  let scrollySection; // main.scrolly — matrix mode toggles a class here (see transitionToMatrix) to spread .graphic across the full grid width and hide .step-content

  function build() {
    scrollySection = container.closest('main.scrolly');
    root = select(container).append('div').attr('class', 'dotchart');

    // Legend and buttons render AFTER the chart in DOM order — .dotchart is
    // a flex column, so this is what actually puts them at the bottom;
    // nothing about measure()'s own rect (read off scrollWrap directly)
    // depends on where in that column it sits.
    scrollWrap = root.append('div').attr('class', 'dotchart-scroll');
    svg = scrollWrap.append('svg').attr('role', 'img').attr('aria-label', 'Voting intention, one dot per surveyed voter');
    gDots = svg.append('g').attr('class', 'dots');
    gLabels = svg.append('g').attr('class', 'row-labels');
    gMatrixBars = svg.append('g').attr('class', 'matrix-bars');
    gMatrixHeaders = svg.append('g').attr('class', 'matrix-headers');
    gMatrixPercents = svg.append('g').attr('class', 'matrix-percents'); // last — paints on top of dots/bars/headers

    buildLegend();
    buildMatrixButtons();
    buildDownload();

    tooltip = root.append('div').attr('class', 'dot-tooltip').attr('role', 'status').attr('hidden', true);

    measure();

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') hideTooltip();
    });
  }

  function buildLegend() {
    const legend = root.append('div').attr('class', 'legend').attr('role', 'list');
    const items = legend.selectAll('.legend-item').data(displayParties).join('span').attr('class', 'legend-item').attr('role', 'listitem');
    items.append('span').attr('class', (d) => `legend-swatch dot-${d.key}`);
    items.append('span').attr('class', 'legend-label').text((d) => d.short);
  }

  // Always present in the DOM (never inserted/removed), just invisible and
  // disabled until showMatrixControls() runs — so measure()'s rect never
  // changes size when they appear, which would otherwise shift every row's
  // bandBudget mid-interaction.
  function buildMatrixButtons() {
    matrixControls = root.append('div').attr('class', 'matrix-controls');
    matrixButtonsWrap = matrixControls
      .append('div')
      .attr('class', 'matrix-buttons')
      .attr('role', 'group')
      .attr('aria-label', 'Split each party by a category');
    matrixButtonsWrap
      .selectAll('button')
      .data(CATEGORY_DEFS)
      .join('button')
      .attr('class', 'matrix-button')
      .attr('type', 'button')
      .attr('aria-pressed', 'false')
      .attr('disabled', true)
      .text((d) => d.label)
      .on('click', (event, d) => toggleMatrix(d.key));
  }

  // The matrix explorer only becomes available once the scroll-driven reveal
  // has fully played out — see applyProgress's postStoryReady check. Kept
  // idempotent (no-op if already in the target state) since applyProgress
  // calls these every frame the ready/not-ready boundary is crossed.
  function showMatrixControls() {
    if (postStoryReady) return;
    postStoryReady = true;
    matrixControls.classed('is-visible', true);
    matrixButtonsWrap.selectAll('button').attr('disabled', null);
  }

  // Reversible, matching this chart's own reversible-on-scroll-up design
  // elsewhere: if the reader scrolls back up far enough that the reveal is
  // no longer complete, the controls disappear again AND matrix mode (if
  // active) snaps back to the normal bar layout — otherwise matrix-mode dots
  // would sit frozen while the rest of the chart visibly reverses under them.
  function hideMatrixControls() {
    if (!postStoryReady) return;
    postStoryReady = false;
    matrixControls.classed('is-visible', false);
    matrixButtonsWrap.selectAll('button').attr('disabled', true).classed('is-active', false).attr('aria-pressed', 'false');
    if (matrixMode) {
      matrixMode = null;
      // Instant, not animated: this fires mid-scroll, and an animated D3
      // transition here would just get interrupted a frame later anyway by
      // applyProgress's own per-frame dot update resuming — see
      // transitionToMatrix's `instant` param.
      transitionToMatrix(null, true);
    }
  }

  function updateMatrixButtons() {
    matrixButtonsWrap
      .selectAll('button')
      .classed('is-active', (d) => d.key === matrixMode)
      .attr('aria-pressed', (d) => String(d.key === matrixMode));
  }

  // The accessibility relief channel: one row per DOT, not just the party
  // totals — a screen reader or any non-visual consumer gets the same
  // individual-voter granularity the chart itself is built from, not a
  // pre-aggregated summary. ~5,000 rows is too big for a data: URI (the
  // whole CSV would sit inline in the DOM attribute); a Blob URL keeps that
  // text out of the DOM and is the standard way to hand the browser a
  // generated file. Built once from the already-loaded data — nothing here
  // changes after load, so there's no need to regenerate it per click.
  //
  // Its own reveal beat, not just inherited from root's axis-phase opacity:
  // it's the exact data behind the row VALUES (count · %), so it appears
  // alongside them (rowValueOpacity) rather than with the axis/legend at
  // the very start, before there's anything to download yet.
  function buildDownload() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const header = ['Voter ID', 'Party', 'Age', 'Age band', 'Gender', 'Region', 'Country', 'Education', '2019 vote', 'Turnout likelihood (1-10)'];
    const rows = parties.flatMap((p) =>
      p.voters.map((v) => [v.id, p.name, v.age, v.ageBand, v.gender, v.region, v.country, v.education, v.vote2019, v.turnoutLikelihood])
    );
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));

    downloadLink = root
      .append('a')
      .attr('class', 'data-download')
      .attr('href', href)
      .attr('download', 'voting-intention-voters.csv')
      .text('Download the data (CSV, one row per voter)')
      .style('opacity', reduceMotion ? 1 : 0);
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

  // Every party gets the SAME thickness (same dot count stacked = same bar
  // height) — no more per-party variation. Two constraints, both must hold
  // exactly:
  //   1. No white space: 8 equal bands must fill the available height with
  //      nothing left over. Since thickness (a dot COUNT) is necessarily an
  //      integer, that's solved by letting the per-dot PITCH stretch to
  //      bandBudget / thickness instead of staying pinned to the nominal
  //      DOT_SPACING — thickness * pitch === bandBudget exactly, always,
  //      whatever thickness ends up being.
  //   2. No horizontal scroll: the biggest party's bar, at that thickness,
  //      must fit the available width. Start from the height-driven
  //      thickness and grow it — thicker rows mean fewer columns AND a
  //      tighter pitch, both of which only ever shrink the widest bar — so
  //      this loop always converges.
  function computeLayout() {
    const n = displayParties.length;
    const baselineX = LEFT_LABEL_WIDTH;
    const plotWidth = Math.max(1, width - baselineX - RIGHT_PAD);
    // HEADER_RESERVE is a permanent gutter, not conditional on matrix mode
    // ever being used — folded in symmetrically with TOP_PAD so the
    // contentHeight === height invariant (see below) still holds exactly.
    bandBudget = Math.max(1, (height - 2 * TOP_PAD - HEADER_RESERVE - (n - 1) * ROW_GAP) / n);

    maxCountOverall = Math.max(1, ...displayParties.map((p) => p.count));

    let thickness = Math.max(1, Math.round(bandBudget / DOT_SPACING));
    let pitch = bandBudget / thickness;
    let widestCols = Math.ceil(maxCountOverall / thickness);
    while (baselineX + widestCols * pitch + RIGHT_PAD > width && thickness < maxCountOverall) {
      thickness += 1;
      pitch = bandBudget / thickness;
      widestCols = Math.ceil(maxCountOverall / thickness);
    }
    dotRadius = (DOT_DIAMETER / DOT_SPACING) * pitch * 0.5;

    let rowTop = TOP_PAD + HEADER_RESERVE;
    displayParties.forEach((p) => {
      const cols = Math.max(1, Math.ceil(p.count / thickness));

      p._rowTop = rowTop; // needed by computeMatrixLayout to place cells — _rowCenterY alone isn't enough
      p._rowCenterY = rowTop + (thickness * pitch) / 2;
      p._barEndX = baselineX + cols * pitch;

      // Final RESTING position is always by original index (i) — the bar
      // fills left-to-right the same way every time. Entry TIMING follows
      // that same left-to-right order overall (the row still visibly
      // grows/fills as you scroll), but with random jitter layered on top
      // — like marbles settling into a cup: a clear rising trend, not a
      // perfectly mechanical raster scan. Jitter is seeded per party so
      // it's stable across resize/rebuild.
      const rand = mulberry32(hashSeed(p.key));
      const jitterRange = thickness * 3;

      p._dotPositions = p.voters.map((voter, i) => {
        const subcol = Math.floor(i / thickness);
        const subrow = i % thickness;
        const jitter = (rand() - 0.5) * jitterRange;
        return {
          voter,
          party: p,
          // Raw index (jittered) within THIS party — localProgress divides
          // by the party's own count, so every bar's dots spread across
          // the same delay range and finish together, whatever their count.
          entryIndex: Math.min(p.count - 1, Math.max(0, i + jitter)),
          finalX: baselineX + subcol * pitch + pitch / 2,
          finalY: rowTop + subrow * pitch + pitch / 2,
        };
      });

      rowTop += thickness * pitch + ROW_GAP;
    });

    // rowTop is now exactly `height` above TOP_PAD + one trailing ROW_GAP —
    // see the comment block above: thickness * pitch === bandBudget by
    // construction, and bandBudget was derived from height (with
    // HEADER_RESERVE subtracted out up front) in the first place, so this
    // always resolves to height itself, not an approximation of it.
    const contentHeight = rowTop - ROW_GAP + TOP_PAD;
    return { baselineX, contentHeight };
  }

  // Equal-width columns, not per-column max-width: fits the available width
  // by construction (no second nested solve needed), and reads as a uniform
  // grid of boxes rather than a variable-width table. One shared
  // thickness/pitch for the WHOLE matrix (not solved per cell) — same
  // "one shared scale, driven by the single worst case" shape computeLayout()
  // itself already uses, just bounded by one column's width instead of the
  // whole plot's width, and by the worst single CELL count instead of the
  // worst PARTY count. A category whose own-party loyalty dominates every
  // other cell (2019 vote, in this dataset) can legitimately push the shared
  // pitch below MIN_MATRIX_PITCH — the whole matrix then falls back to bars,
  // which is a better read for that story than near-invisible dots anyway.
  function computeMatrixLayout(categoryField) {
    const domain = CATEGORY_DOMAINS[categoryField];
    const baselineX = LEFT_LABEL_WIDTH;
    const plotWidth = Math.max(1, width - baselineX - RIGHT_PAD);
    const columnWidth = plotWidth / domain.length;
    const cellWidth = Math.max(1, columnWidth - MATRIX_CELL_PAD);

    // Group each party's ALREADY-SOLVED dot positions by category value —
    // not raw voters — so the grouping and the objects about to be
    // repositioned are literally the same objects, never two parallel
    // representations that could drift apart.
    const grouped = new Map(); // partyKey -> Map(categoryValue -> dotPosition[])
    const columnTotals = new Map(domain.map((v) => [v, 0])); // categoryValue -> voters across ALL parties, for the per-cell % (each column's cells sum to 100%)
    let maxCellCount = 1;
    displayParties.forEach((p) => {
      const byValue = new Map(domain.map((v) => [v, []]));
      p._dotPositions.forEach((dp) => byValue.get(dp.voter[categoryField])?.push(dp));
      grouped.set(p.key, byValue);
      byValue.forEach((arr, value) => {
        maxCellCount = Math.max(maxCellCount, arr.length);
        columnTotals.set(value, columnTotals.get(value) + arr.length);
      });
    });

    let thickness = Math.max(1, Math.round(bandBudget / DOT_SPACING));
    let pitch = bandBudget / thickness;
    let widestCols = Math.ceil(maxCellCount / thickness);
    while (widestCols * pitch > cellWidth && thickness < maxCellCount) {
      thickness += 1;
      pitch = bandBudget / thickness;
      widestCols = Math.ceil(maxCellCount / thickness);
    }

    const mode = pitch >= MIN_MATRIX_PITCH ? 'dots' : 'bars';
    matrixDotRadius = (DOT_DIAMETER / DOT_SPACING) * pitch * 0.5;

    const cells = []; // only populated/used when mode === 'bars'
    // Percent labels are independent of dots-vs-bars mode — every non-empty
    // cell gets one regardless, so this is built unconditionally, not just
    // alongside `cells`. Column-normalized (count / that column's total
    // across all parties): "what share of London is Labour," not "what
    // share of Labour is London" — the cross-tab question this whole matrix
    // exists to answer.
    const percentCells = [];
    displayParties.forEach((p) => {
      const byValue = grouped.get(p.key);
      domain.forEach((value, colIndex) => {
        const cellX = baselineX + colIndex * columnWidth + MATRIX_CELL_PAD / 2;
        const dots = byValue.get(value);
        dots.forEach((dp, i) => {
          const subcol = Math.floor(i / thickness);
          const subrow = i % thickness;
          dp.matrixX = cellX + subcol * pitch + pitch / 2;
          dp.matrixY = p._rowTop + subrow * pitch + pitch / 2;
        });
        if (mode === 'bars' && dots.length) {
          cells.push({
            partyKey: p.key,
            partyName: p.name,
            value,
            count: dots.length,
            x: cellX,
            y: p._rowCenterY - MATRIX_BAR_HEIGHT / 2,
            width: Math.max(2, (dots.length / maxCellCount) * cellWidth),
          });
        }
        const columnTotal = columnTotals.get(value);
        if (dots.length && columnTotal) {
          percentCells.push({
            partyKey: p.key,
            value,
            share: dots.length / columnTotal,
            x: cellX + columnWidth / 2 - MATRIX_CELL_PAD / 2,
            y: p._rowCenterY,
          });
        }
      });
    });

    const headers = domain.map((value, i) => ({
      value,
      label: shortValueLabel(categoryField, value),
      x: baselineX + i * columnWidth + columnWidth / 2,
    }));

    return { mode, headers, cells, percentCells };
  }

  function renderRowLabels() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const total = displayParties.reduce((sum, p) => sum + p.count, 0);
    const groups = gLabels
      .selectAll('g.row-label-group')
      .data(displayParties, (d) => d.key)
      .join((enter) => {
        // .row-label (name) and .row-value (count · %) start invisible and
        // fade in on SEPARATE beats — phase 2 and phase 4 respectively, see
        // applyProgress's rowNameOpacity()/rowValueOpacity(). Only the
        // newly-entering selection gets the initial opacity: on resize,
        // existing elements keep whatever opacity they've already reached.
        const g = enter.append('g').attr('class', 'row-label-group').attr('tabindex', 0);
        g.append('text').attr('class', 'row-label').attr('x', 0).attr('text-anchor', 'start').style('opacity', reduceMotion ? 1 : 0);
        g.append('text').attr('class', 'row-value').attr('text-anchor', 'start').style('opacity', reduceMotion ? 1 : 0);
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
  // fully arrived), given overall scroll progress p. No dot's delay is ever
  // less than PHASE.dotsStart — that opening stretch belongs to the
  // axis/legend alone, before the first dot starts sliding.
  //
  // Normalized by the dot's OWN party's count, not the largest party's —
  // every bar spans the same delay range and finishes together, regardless
  // of size. (A global normalization, by contrast, would have a small
  // party's few dots land in a quick early burst while only the biggest
  // bar used the full window — the earlier design, deliberately changed.)
  function localProgress(d, p) {
    const span = PHASE.dotsEnd - PHASE.dotsStart - PHASE.dotsDuration;
    const delay = PHASE.dotsStart + (d.entryIndex / d.party.count) * span;
    return Math.min(1, Math.max(0, (p - delay) / PHASE.dotsDuration));
  }

  // Row names (party names) — starts at the same point the dots do
  // (PHASE.namesStart === PHASE.dotsStart), fading in alongside the fill
  // rather than fully resolving first.
  function rowNameOpacity(p) {
    return Math.min(1, Math.max(0, (p - PHASE.namesStart) / (PHASE.namesEnd - PHASE.namesStart)));
  }

  // Row values (count · %) — a separate, later beat: only once every bar
  // has finished filling.
  function rowValueOpacity(p) {
    return Math.min(1, Math.max(0, (p - PHASE.valuesStart) / (PHASE.valuesEnd - PHASE.valuesStart)));
  }

  // Axis/legend fade in first, fully resolved before the first dot moves —
  // scroll-driven so it can't be outrun by a fast scroller the way a fixed
  // CSS transition could.
  function axisOpacity(p) {
    return Math.min(1, Math.max(0, p / PHASE.axisEnd));
  }

  // position: sticky has no native "just became stuck" event — the
  // reliable way to ask is comparing the element's own live rect.top
  // against the CSS `top: 0` it sticks to. Before that, the figure is
  // still in normal flow, visually sliding up the page into position.
  function isPinned() {
    return container.getBoundingClientRect().top <= 0.5;
  }

  // Only one category active at a time — clicking the already-active button
  // again turns it back off (null), same as clicking any other button turns
  // this one off.
  function toggleMatrix(key) {
    matrixMode = matrixMode === key ? null : key;
    updateMatrixButtons();
    transitionToMatrix(matrixMode);
  }

  // Animates dotSelection's cx/cy/r/opacity from wherever they currently are
  // to the new target — reuses the exact same keyed selection (see
  // buildDots's `d.voter.id` key), no rebuild, genuine D3 object constancy.
  // `instant` skips the transition (used by hideMatrixControls, which fires
  // mid-scroll — see its own comment for why an animated transition there
  // would just get cut short a frame later anyway).
  function transitionToMatrix(key, instant = false) {
    hideTooltip();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = instant || reduceMotion ? 0 : DURATION;

    // .graphic visually overflows into .steps' column while matrix-active —
    // see main.css's comment on why this is a JS-measured explicit width
    // rather than a CSS grid-column/grid-template-columns change: both of
    // those alternatives resize or reassign .steps itself, which broke
    // either the chart's own sticky pin or Scrollama's tracking of .step
    // (both empirically confirmed, not assumed). .steps' geometry is never
    // touched here — only container's own width.
    if (scrollySection) {
      const stepsEl = scrollySection.querySelector('.steps');
      if (key && stepsEl) {
        const gap = parseFloat(getComputedStyle(scrollySection).columnGap) || 0;
        const expandBy = stepsEl.getBoundingClientRect().width + gap;
        container.style.width = `calc(100% + ${expandBy}px)`;
      } else {
        container.style.width = '';
      }
      scrollySection.classList.toggle('matrix-active', !!key);
    }
    // Re-measure before solving anything against `width` below, or
    // computeMatrixLayout would size columns for the OLD (narrower or wider)
    // box the browser hasn't actually laid out this frame — reading
    // getBoundingClientRect() right after a style/class change forces the
    // browser to flush layout first, so this is accurate, not a race.
    measure();
    // Always refresh, not just on exit: contentHeight is width-independent
    // (see computeLayout's own comment) so this is never wrong to call, and
    // it guarantees finalX/dotRadius are correct for the current width
    // whenever matrix mode next exits — including after a window resize that
    // happened while it was active, which would otherwise leave them solved
    // for a width that's no longer current.
    const { contentHeight } = computeLayout();
    svg.attr('width', width).attr('height', contentHeight).attr('viewBox', `0 0 ${width} ${contentHeight}`);
    renderRowLabels(); // refreshes row-value x (._barEndX) for the current width — stays hidden until key is null, but must not be stale once it reappears

    // computeLayout() just replaced every party's _dotPositions with fresh
    // objects (new finalX/finalY, no matrixX/matrixY yet) — dotSelection is
    // still bound to the PREVIOUS objects until re-joined. Same key
    // (d.voter.id) as buildDots/resize, so this matches each fresh datum
    // back to its existing <circle> — no rebuild, object constancy at the
    // DOM level is preserved even though the bound data objects themselves
    // are new.
    dotSelection = gDots.selectAll('circle').data(
      parties.flatMap((p) => p._dotPositions),
      (d) => d.voter.id
    );

    const layout = key ? computeMatrixLayout(key) : null;
    const bars = layout && layout.mode === 'bars';

    const def = key ? CATEGORY_DEFS.find((c) => c.key === key) : null;
    svg.attr(
      'aria-label',
      def ? `Voting intention split by ${def.label}, one dot per surveyed voter` : 'Voting intention, one dot per surveyed voter'
    );

    dotSelection
      .transition()
      .duration(duration)
      .attr('cx', (d) => (key ? d.matrixX : d.finalX))
      .attr('cy', (d) => (key ? d.matrixY : d.finalY))
      .attr('r', () => (bars ? 0 : key ? matrixDotRadius : dotRadius))
      .style('opacity', () => (bars ? 0 : 1));

    renderMatrixHeaders(layout ? layout.headers : [], duration);
    renderMatrixBars(bars ? layout.cells : [], duration);
    renderMatrixPercents(layout ? layout.percentCells : [], duration);

    // No single bar-end to anchor row values to once a category splits each
    // row into columns — the per-cell tooltip (see showCellTooltip) becomes
    // the source of exact numbers instead. Only ever toggled once the reveal
    // is fully complete (postStoryReady), so "back to 1" is always correct
    // here, not just "whatever rowValueOpacity(p) currently is."
    gLabels.selectAll('.row-value').transition().duration(duration).style('opacity', key ? 0 : 1);
  }

  // Column header labels, one per category value, aligned with that
  // column's x — join-by-key so entering/exiting headers (switching between
  // categories, or leaving matrix mode) cross-fade rather than jump-cut.
  function renderMatrixHeaders(headers, duration) {
    const join = gMatrixHeaders.selectAll('text.matrix-col-header').data(headers, (d) => d.value);

    join.exit().transition().duration(duration).style('opacity', 0).remove();

    const entered = join
      .enter()
      .append('text')
      .attr('class', 'matrix-col-header')
      .attr('text-anchor', 'middle')
      .attr('y', HEADER_RESERVE / 2 + TOP_PAD / 2)
      .attr('dy', '0.32em')
      .style('opacity', 0);

    entered
      .merge(join)
      .attr('x', (d) => d.x)
      .text((d) => d.label)
      .transition()
      .duration(duration)
      .style('opacity', 1);
  }

  // The dots-too-dense-for-a-cell fallback: one <rect> per non-empty
  // (party, category value) cell, keyed so the same bar animates rather than
  // rebuilding when switching between two categories that both land in bars
  // mode. Width is relative to maxCellCount across the WHOLE active
  // category (see computeMatrixLayout) — one shared scale, so a bar's length
  // means the same thing in every row and every column.
  function renderMatrixBars(cells, duration) {
    const join = gMatrixBars.selectAll('rect.matrix-bar').data(cells, (d) => `${d.partyKey}:${d.value}`);

    join.exit().transition().duration(duration).style('opacity', 0).remove();

    const entered = join
      .enter()
      .append('rect')
      .attr('class', (d) => `matrix-bar dot-${d.partyKey}`)
      .attr('height', MATRIX_BAR_HEIGHT)
      .attr('tabindex', 0)
      .style('opacity', 0)
      .on('pointerenter', (event, d) => showCellTooltip(event, d))
      .on('pointermove', (event, d) => showCellTooltip(event, d))
      .on('pointerleave', hideTooltip)
      .on('focus', (event, d) => showCellTooltip(event, d))
      .on('blur', hideTooltip);

    entered
      .merge(join)
      .attr('aria-label', (d) => `${d.partyName}: ${d.count.toLocaleString()}, ${d.value}`)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width)
      .transition()
      .duration(duration)
      .style('opacity', 1);
  }

  // One percentage label per non-empty cell, regardless of dots-vs-bars mode
  // — column-normalized (share of that category value's own total, see
  // computeMatrixLayout), floated over the marks with a solid background box
  // so it stays legible against whatever color/density sits beneath it.
  // Whole-number, not one-decimal: cells run as narrow as ~46px at the
  // densest categories, no room for "34.8%".
  function renderMatrixPercents(cells, duration) {
    const join = gMatrixPercents.selectAll('g.matrix-percent').data(cells, (d) => `${d.partyKey}:${d.value}`);

    join.exit().transition().duration(duration).style('opacity', 0).remove();

    const entered = join.enter().append('g').attr('class', 'matrix-percent').style('opacity', 0);
    entered.append('rect').attr('class', 'matrix-percent-bg');
    entered.append('text').attr('class', 'matrix-percent-label').attr('text-anchor', 'middle').attr('dy', '0.32em');

    const merged = entered.merge(join);
    merged.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
    merged.select('text').text((d) => `${Math.round(d.share * 100)}%`);
    // The background box is sized to the text's own rendered extent (via
    // getBBox, only available once the text is actually in the DOM with its
    // final content) rather than a guessed fixed size — exact fit at every
    // font size/zoom level, no fudge factor to keep in sync by hand.
    merged.each(function () {
      const g = select(this);
      const bbox = g.select('text').node().getBBox();
      g.select('rect')
        .attr('x', bbox.x - 3)
        .attr('y', bbox.y - 1)
        .attr('width', bbox.width + 6)
        .attr('height', bbox.height + 2);
    });

    merged.transition().duration(duration).style('opacity', 1);
  }

  // Same dual pointer/keyboard-focus positioning as showTooltip below, for
  // the bars-mode fallback marks instead of individual dots.
  function showCellTooltip(event, d) {
    const rect = container.getBoundingClientRect();
    let left, top;
    if (event.type === 'focus') {
      const target = event.currentTarget.getBoundingClientRect();
      left = target.left - rect.left + target.width / 2;
      top = target.top - rect.top + target.height + 8;
    } else {
      left = event.clientX - rect.left + 12;
      top = event.clientY - rect.top + 12;
    }

    tooltip.selectAll('*').remove();
    tooltip.append('strong').text(d.partyName);
    tooltip.append('span').text(d.value);
    tooltip.append('span').text(`${d.count.toLocaleString()} voters`);

    tooltip.style('left', `${left}px`).style('top', `${top}px`).attr('hidden', null);
  }

  // Drives every phase off ONE rebased progress value and returns it, so
  // scroller.js can forward it to CSS (--chart-progress) for the text beat
  // — see the file-top comment for the full 1→5 sequence.
  function applyProgress(progress) {
    // Scrolling moves dots out from under a stationary cursor without any
    // pointer event firing — the browser only re-hit-tests on actual
    // pointer movement, not on content moving via scroll — so a tooltip
    // shown before a scroll started would otherwise stay stuck open,
    // pointing at whatever used to be under the mouse. Any scroll tick
    // invalidates it; it'll reappear on the next real hover.
    if (tooltip) hideTooltip();

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion already shows everything at rest (buildDots, below) —
    // main.css's own reduced-motion override handles the text beat too, so
    // there's nothing left for this function to drive.
    if (reduceMotion || !dotSelection) return 1;

    const startX = width + SLIDE_MARGIN;
    // Scrollama's step progress can start ticking before the sticky chart
    // has actually finished sliding into its pinned position — treat that
    // window as progress 0 so nothing moves while the chart itself is still
    // visibly settling on screen. Once pinned, re-base progress to start
    // counting from THAT point (not from step-entry) — otherwise the whole
    // PHASE timeline is already partly or fully consumed by the time we
    // start honoring it, and everything just snaps to its finished state
    // instead of animating.
    // isPinned() only decides WHEN to capture that baseline — once captured,
    // p must stay a continuous function of progress alone. Gating p to 0
    // whenever isPinned() is momentarily false (e.g. a fast scroll can cross
    // the pin/unpin boundary in a single tick) made the reveal snap instead
    // of fade when scrolling back up quickly.
    if (isPinned() && pinProgress === null) pinProgress = progress;
    const p = pinProgress === null ? 0 : Math.min(1, Math.max(0, progress - pinProgress));

    root.style('opacity', axisOpacity(p)); // phase 1: axis/legend

    gLabels.selectAll('.row-label').style('opacity', rowNameOpacity(p)); // phase 2: row names

    // Matrix mode takes over dot cx/cy/r/opacity entirely once active (see
    // transitionToMatrix) — without this guard, every further scroll tick
    // would force dots straight back to finalX/opacity-1 (p stays clamped at
    // 1 once the reveal completes), fighting whatever the matrix transition
    // just animated them to the instant the reader scrolls at all.
    if (!matrixMode) {
      dotSelection // phase 3: dots
        .attr('cx', (d) => {
          const local = localProgress(d, p);
          return startX + (d.finalX - startX) * easeOutCubic(local);
        })
        // A dot that hasn't started yet (local === 0) stays invisible instead
        // of sitting off to the side as a visible "waiting" cluster — it only
        // appears once it's actually moving, fading in as it slides.
        .style('opacity', (d) => localProgress(d, p));
    }

    gLabels.selectAll('.row-value').style('opacity', matrixMode ? 0 : rowValueOpacity(p)); // phase 4: row values
    downloadLink.style('opacity', rowValueOpacity(p)); // phase 4: same beat as row values — it's their data

    // The matrix explorer is a post-story mode, available once the reveal
    // has fully played out — and taken away again if the reader scrolls back
    // up far enough that it's no longer complete, matching this chart's own
    // reversible-on-scroll-up design everywhere else (see showMatrixControls/
    // hideMatrixControls).
    const ready = rowValueOpacity(p) >= 1;
    if (ready && !postStoryReady) showMatrixControls();
    else if (!ready && postStoryReady) hideMatrixControls();

    return p; // phase 5 (text) is driven from this by scroller.js/main.css
  }

  function buildDots() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Normal motion: the axis fades in via axisOpacity() inside
    // applyProgress (phase 1). Reduced motion skips the whole sequence and
    // shows everything at rest immediately, same as the dots/labels below —
    // including the matrix controls: applyProgress returns early for
    // reduced-motion (see above) before its own postStoryReady check ever
    // runs, so without this call those readers would never see them at all.
    if (reduceMotion) {
      root.style('opacity', 1);
      showMatrixControls();
    }
    const { contentHeight } = computeLayout();

    svg.attr('width', width).attr('height', contentHeight).attr('viewBox', `0 0 ${width} ${contentHeight}`);
    renderRowLabels();

    const dotsData = parties.flatMap((p) => p._dotPositions);
    const startX = width + SLIDE_MARGIN;

    dotSelection = gDots
      .selectAll('circle')
      .data(dotsData, (d) => d.voter.id)
      .join('circle')
      .attr('class', (d) => `dot dot-${d.party.key}`)
      .attr('r', dotRadius)
      .attr('cy', (d) => d.finalY)
      .attr('cx', reduceMotion ? (d) => d.finalX : startX)
      .style('opacity', reduceMotion ? 1 : 0)
      .on('pointerenter', (event, d) => showTooltip(event, d))
      .on('pointermove', (event, d) => showTooltip(event, d))
      .on('pointerleave', hideTooltip);

    // A single dot's own pointerleave is not reliable at this size (~2px
    // radius) once you factor in the constant repositioning during scroll —
    // this delegated check on the whole SVG is the backstop: any move that
    // isn't currently over a .dot hides the tooltip, regardless of whether
    // the dot's own leave event fired.
    svg.on('pointermove', (event) => {
      if (!event.target.classList?.contains('dot')) hideTooltip();
    });
    svg.on('pointerleave', hideTooltip);

    lastProgress = reduceMotion ? 1 : 0;
  }

  function showTooltip(event, d) {
    const { voter, party } = d;
    const rect = container.getBoundingClientRect();

    tooltip.selectAll('*').remove();
    tooltip.append('strong').text(party.name);
    tooltip.append('span').text(`${voter.age}, ${voter.gender.toLowerCase()} · ${voter.region}`);
    tooltip.append('span').text(`2019 vote: ${voter.vote2019}`);
    if (matrixMode) {
      // matrixMode's key already equals the voter property name — see
      // categories.js — so this works directly, no separate field lookup.
      const def = CATEGORY_DEFS.find((c) => c.key === matrixMode);
      tooltip.append('span').text(`${def.label}: ${voter[matrixMode]}`);
    }

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
    const { contentHeight } = computeLayout(); // always runs first — matrix layout below builds on its bandBudget/_rowTop
    svg.attr('width', width).attr('height', contentHeight).attr('viewBox', `0 0 ${width} ${contentHeight}`);
    renderRowLabels();

    const dotsData = parties.flatMap((p) => p._dotPositions);
    dotSelection = gDots.selectAll('circle').data(dotsData, (d) => d.voter.id);

    if (matrixMode) {
      // No transition (duration 0) — same non-animated-reflow convention
      // resize already used before matrix mode existed.
      const layout = computeMatrixLayout(matrixMode);
      const bars = layout.mode === 'bars';
      dotSelection
        .attr('cx', (d) => d.matrixX)
        .attr('cy', (d) => d.matrixY)
        .attr('r', bars ? 0 : matrixDotRadius)
        .style('opacity', bars ? 0 : 1);
      renderMatrixHeaders(layout.headers, 0);
      renderMatrixBars(bars ? layout.cells : [], 0);
      renderMatrixPercents(layout.percentCells, 0);
      gLabels.selectAll('.row-value').style('opacity', 0);
    } else {
      dotSelection.attr('cy', (d) => d.finalY).attr('r', dotRadius);
      applyProgress(lastProgress);
    }
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
    // Fires continuously as the reader scrolls through the step. Drives
    // phases 1–3 directly and returns the same pin-rebased progress value
    // so scroller.js can expose it to CSS (--chart-progress) for phase 4,
    // the text.
    renderProgress(i, progress) {
      if (current < 0) return undefined;
      lastProgress = progress;
      return applyProgress(progress);
    },
    resize,
  };
}
