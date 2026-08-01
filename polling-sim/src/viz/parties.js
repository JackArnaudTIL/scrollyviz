// Single source of truth for the party list: identity, display order, and
// color. This array's OWN order is what parties.js was validated against —
// see the comment below before reordering it — but graphic.js's chart/legend
// no longer render in this order verbatim: it re-sorts by count, with
// isResidual entries forced to the bottom regardless of their count (see
// displayParties in graphic.js). The CSV export is the one thing that still
// uses this array's raw order, untouched.
//
// Colors are the dataviz skill's documented default categorical palette
// (references/palette.md), reassigned by real-world party brand association
// (Labour=red, Conservative=blue, SNP=yellow, etc.) rather than hand-picked.
// Party brand colors themselves fail the palette's CVD/contrast checks in
// several adjacent pairings (red/orange, orange/yellow), so THIS ORDER was
// chosen specifically to keep every warm hue (red, orange, yellow) separated
// by a cool one — validated both light and dark with
// dataviz/scripts/validate_palette.js. Reordering these entries can
// reintroduce a failing adjacent pair; re-run the validator if you do.
//
// "Don't know" is deliberately NOT part of that 8-hue categorical set — a
// 9th hue would mean re-validating the whole palette from scratch, and more
// to the point, undecided isn't a party identity to encode alongside the
// real ones. It gets --ink-muted instead: the same neutral used for
// secondary UI text everywhere else, reading as "no answer" rather than
// competing for hue-identity against Labour/Reform/etc.
export const PARTIES = [
  {
    key: 'labour',
    name: 'Labour',
    short: 'Labour',
    color: { light: '#e34948', dark: '#e66767' },
  },
  {
    key: 'conservative',
    name: 'Conservative',
    short: 'Conservative',
    color: { light: '#2a78d6', dark: '#3987e5' },
  },
  {
    key: 'libdem',
    name: 'Liberal Democrat',
    short: 'Lib Dem',
    color: { light: '#eb6834', dark: '#d95926' },
  },
  {
    key: 'reform',
    name: 'Reform UK',
    short: 'Reform UK',
    color: { light: '#1baf7a', dark: '#199e70' },
  },
  {
    key: 'snp',
    name: 'Scottish National Party',
    short: 'SNP',
    color: { light: '#eda100', dark: '#c98500' },
  },
  {
    key: 'green',
    name: 'Green',
    short: 'Green',
    color: { light: '#008300', dark: '#008300' },
  },
  {
    key: 'plaid',
    name: 'Plaid Cymru',
    short: 'Plaid Cymru',
    color: { light: '#4a3aa7', dark: '#9085e9' },
  },
  {
    key: 'other',
    name: 'Other',
    short: 'Other',
    color: { light: '#e87ba4', dark: '#d55181' },
    isResidual: true, // always sorts last in the chart/legend — see graphic.js
  },
  {
    key: 'dontknow',
    name: 'Don’t know',
    short: 'Don’t know',
    color: { light: '#898781', dark: '#898781' }, // --ink-muted, not a categorical hue — see the file-top comment
    isResidual: true,
  },
];

export const partyByKey = Object.fromEntries(PARTIES.map((p) => [p.key, p]));
