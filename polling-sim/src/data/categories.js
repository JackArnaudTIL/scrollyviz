// Fixed per-category domain AND order — mirrors scripts/generate-voters.mjs's
// own AGE_BANDS/REGIONS/EDUCATION/VOTE_2019 arrays exactly (duplicated
// deliberately: that script is node-only, not part of this browser bundle).
// Matrix columns are ordered by this fixed domain, not resorted by count —
// geographic/logical order stays legible and stable across reloads.
export const CATEGORY_DOMAINS = {
  gender: ['Female', 'Male'],
  ageBand: ['18-24', '25-34', '35-44', '45-54', '55-64', '65-74', '75+'],
  education: ['No formal qualifications', 'GCSE or equivalent', 'A-level or equivalent', 'Degree or above'],
  region: [
    'North East',
    'North West',
    'Yorkshire and the Humber',
    'East Midlands',
    'West Midlands',
    'East of England',
    'London',
    'South East',
    'South West',
    'Wales',
    'Scotland',
  ],
  vote2019: ['Conservative', 'Labour', 'Liberal Democrat', 'SNP', 'Green', 'Plaid Cymru', 'Brexit Party', 'Other', 'Did not vote'],
};

// key doubles as the voter property name (voter[key]) for every entry here —
// deliberately, so graphic.js never needs a separate field-name lookup.
export const CATEGORY_DEFS = [
  { key: 'gender', label: 'Gender' },
  { key: 'ageBand', label: 'Age band' },
  { key: 'education', label: 'Education' },
  { key: 'region', label: 'Region' },
  { key: 'vote2019', label: '2019 vote' },
];

// Column-header display only — full value is still used everywhere else
// (tooltips, aria-labels). Equal-width columns leave very little room per
// header (as few as ~46px at 11 columns) — measured against real rendered
// text width, not guessed: every region name overflowed its column at that
// width, not just the obviously-long ones, so this covers the full domain
// for region/education/vote2019 rather than spot-fixing the worst offender.
const SHORT_VALUE_LABELS = {
  region: {
    'North East': 'NE',
    'North West': 'NW',
    'Yorkshire and the Humber': 'Yorks',
    'East Midlands': 'E Mids',
    'West Midlands': 'W Mids',
    'East of England': 'E Eng',
    'South East': 'SE',
    'South West': 'SW',
  },
  education: {
    'No formal qualifications': 'No quals',
    'GCSE or equivalent': 'GCSE',
    'A-level or equivalent': 'A-level',
    'Degree or above': 'Degree+',
  },
  vote2019: {
    Conservative: 'Con',
    Labour: 'Lab',
    'Liberal Democrat': 'Lib Dem',
    'Plaid Cymru': 'Plaid',
    'Brexit Party': 'Brexit',
    'Did not vote': 'No vote',
  },
};
export function shortValueLabel(field, value) {
  return SHORT_VALUE_LABELS[field]?.[value] ?? value;
}
