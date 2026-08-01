// Generates a synthetic, theoretical UK general-election poll: ~5000 voters
// with demographics and a current voting intention, illustrative only — not
// real polling data. Deterministic (seeded RNG) so the dataset is stable
// until someone deliberately reseeds it.
//
// Run: node scripts/generate-voters.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PARTIES } from '../src/viz/parties.js';

const N = 5000;
const SEED = 20260801;

// ---- seeded RNG (mulberry32) -----------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

function weightedPick(rand, entries) {
  // entries: [[value, weight], …]
  const total = entries.reduce((sum, [, w]) => sum + Math.max(w, 0), 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= Math.max(w, 0);
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function randInt(rand, min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ---- demographic axes -------------------------------------------------------
const AGE_BANDS = [
  ['18-24', 0.1, 18, 24],
  ['25-34', 0.17, 25, 34],
  ['35-44', 0.16, 35, 44],
  ['45-54', 0.17, 45, 54],
  ['55-64', 0.15, 55, 64],
  ['65-74', 0.13, 65, 74],
  ['75+', 0.12, 75, 90],
];

const REGIONS = [
  ['North East', 0.04, 'England'],
  ['North West', 0.11, 'England'],
  ['Yorkshire and the Humber', 0.08, 'England'],
  ['East Midlands', 0.07, 'England'],
  ['West Midlands', 0.09, 'England'],
  ['East of England', 0.09, 'England'],
  ['London', 0.13, 'England'],
  ['South East', 0.14, 'England'],
  ['South West', 0.09, 'England'],
  ['Wales', 0.05, 'Wales'],
  ['Scotland', 0.11, 'Scotland'],
];

const EDUCATION = ['No formal qualifications', 'GCSE or equivalent', 'A-level or equivalent', 'Degree or above'];
// Degree share rises in younger bands, falls in older ones.
const EDUCATION_WEIGHTS_BY_AGE = {
  '18-24': [0.1, 0.28, 0.32, 0.3],
  '25-34': [0.12, 0.22, 0.24, 0.42],
  '35-44': [0.15, 0.24, 0.24, 0.37],
  '45-54': [0.18, 0.27, 0.25, 0.3],
  '55-64': [0.22, 0.3, 0.25, 0.23],
  '65-74': [0.26, 0.32, 0.24, 0.18],
  '75+': [0.32, 0.34, 0.2, 0.14],
};

const VOTE_2019 = ['Conservative', 'Labour', 'Liberal Democrat', 'SNP', 'Green', 'Plaid Cymru', 'Brexit Party', 'Other', 'Did not vote'];

// ---- current-intention model ------------------------------------------------
// National baseline (a theoretical scenario: Reform surging near Labour,
// Conservative depressed), sums to 100.
const BASE_SHARE = {
  labour: 24,
  conservative: 19,
  libdem: 13,
  reform: 23,
  snp: 4,
  green: 8,
  plaid: 1,
  other: 8,
};

const AGE_MULT = {
  '18-24': { labour: 1.5, conservative: 0.4, libdem: 1.3, reform: 0.5, green: 2.2, other: 1.3 },
  '25-34': { labour: 1.3, conservative: 0.6, libdem: 1.1, reform: 0.6, green: 1.6, other: 1.1 },
  '35-44': { labour: 1.1, conservative: 0.8, libdem: 1.0, reform: 0.9, green: 1.1, other: 1.0 },
  '45-54': { labour: 1.0, conservative: 1.0, libdem: 1.0, reform: 1.1, green: 0.9, other: 1.0 },
  '55-64': { labour: 0.85, conservative: 1.2, libdem: 0.9, reform: 1.3, green: 0.6, other: 0.9 },
  '65-74': { labour: 0.7, conservative: 1.4, libdem: 0.9, reform: 1.5, green: 0.4, other: 0.8 },
  '75+': { labour: 0.6, conservative: 1.5, libdem: 0.8, reform: 1.4, green: 0.3, other: 0.8 },
};

const EDU_MULT = {
  'No formal qualifications': { reform: 1.5, conservative: 1.2, labour: 0.9, green: 0.4, libdem: 0.7 },
  'GCSE or equivalent': { reform: 1.2, conservative: 1.0, labour: 1.0, green: 0.7, libdem: 0.8 },
  'A-level or equivalent': { reform: 1.0, conservative: 1.0, labour: 1.0, green: 1.0, libdem: 1.0 },
  'Degree or above': { reform: 0.5, conservative: 0.8, labour: 1.2, green: 1.8, libdem: 1.3 },
};

const REGION_MULT = {
  Scotland: { snp: 9, labour: 1.1, conservative: 0.7, reform: 0.6, libdem: 0.8 },
  Wales: { plaid: 9, labour: 1.2, conservative: 0.8 },
  London: { labour: 1.3, green: 1.3, libdem: 1.1, conservative: 0.8, reform: 0.5 },
  'South East': { conservative: 1.2, libdem: 1.2, labour: 0.8 },
  'South West': { conservative: 1.2, libdem: 1.3, labour: 0.8 },
  'East of England': { conservative: 1.2, libdem: 1.1, labour: 0.8 },
  'North East': { reform: 1.3, labour: 1.15, conservative: 0.8 },
  'North West': { reform: 1.2, labour: 1.15, conservative: 0.85 },
  'Yorkshire and the Humber': { reform: 1.3, labour: 1.1, conservative: 0.85 },
  'West Midlands': { reform: 1.25, labour: 1.05, conservative: 0.9 },
  'East Midlands': { reform: 1.25, labour: 1.0, conservative: 0.95 },
};

const PAST_VOTE_MULT = {
  Conservative: { conservative: 2.5, reform: 2.0, libdem: 0.8, labour: 0.4, green: 0.3 },
  Labour: { labour: 2.5, green: 1.3, libdem: 0.9, reform: 0.5, conservative: 0.3 },
  'Liberal Democrat': { libdem: 2.5, labour: 1.1, green: 1.1, conservative: 0.6 },
  SNP: { snp: 3.0, labour: 1.1 },
  Green: { green: 3.0, labour: 1.2 },
  'Plaid Cymru': { plaid: 3.0, labour: 1.1 },
  'Brexit Party': { reform: 3.0, conservative: 1.3, labour: 0.5 },
  Other: { other: 1.6 },
  'Did not vote': { other: 1.8, labour: 0.9, conservative: 0.9 },
};

// SNP/Plaid are only on the ballot the voter would actually consider outside
// their nation in a "none of the above" sense — zero them out elsewhere so
// the national totals stay plausible.
function regionGate(partyKey, region) {
  if (partyKey === 'snp') return region === 'Scotland' ? 1 : 0.02;
  if (partyKey === 'plaid') return region === 'Wales' ? 1 : 0.02;
  return 1;
}

function pickIntention(rand, { ageBand, education, region, vote2019 }) {
  const entries = PARTIES.map(({ key }) => {
    let w = BASE_SHARE[key];
    w *= (AGE_MULT[ageBand] || {})[key] ?? 1;
    w *= (EDU_MULT[education] || {})[key] ?? 1;
    w *= (REGION_MULT[region] || {})[key] ?? 1;
    w *= (PAST_VOTE_MULT[vote2019] || {})[key] ?? 1;
    w *= regionGate(key, region);
    return [key, w];
  });
  return weightedPick(rand, entries);
}

function pickVote2019(rand, { region }) {
  const base = [
    ['Conservative', 30],
    ['Labour', 22],
    ['Liberal Democrat', 7.5],
    ['SNP', region === 'Scotland' ? 25 : 0.3],
    ['Green', 1.7],
    ['Plaid Cymru', region === 'Wales' ? 15 : 0.1],
    ['Brexit Party', 2],
    ['Other', 1.4],
    ['Did not vote', 30],
  ];
  return weightedPick(rand, base);
}

function generateVoter(rand, id) {
  const [ageBand, , ageMin, ageMax] = weightedPick(
    rand,
    AGE_BANDS.map((b) => [b, b[1]])
  );
  const age = randInt(rand, ageMin, ageMax);

  const [regionName, , country] = weightedPick(
    rand,
    REGIONS.map((r) => [r, r[1]])
  );

  const eduWeights = EDUCATION_WEIGHTS_BY_AGE[ageBand];
  const education = weightedPick(
    rand,
    EDUCATION.map((e, i) => [e, eduWeights[i]])
  );

  const gender = weightedPick(rand, [
    ['Female', 0.51],
    ['Male', 0.49],
  ]);

  const vote2019 = pickVote2019(rand, { region: regionName });
  const intentionKey = pickIntention(rand, { ageBand, education, region: regionName, vote2019 });

  // Older + previously-voted respondents report higher turnout certainty.
  const baseCertainty = vote2019 === 'Did not vote' ? 4 : 7;
  const ageBonus = { '18-24': -2, '25-34': -1, '35-44': 0, '45-54': 0, '55-64': 1, '65-74': 1, '75+': 1 }[ageBand];
  const turnoutLikelihood = Math.min(10, Math.max(1, baseCertainty + ageBonus + randInt(rand, -1, 1)));

  return {
    id,
    age,
    ageBand,
    gender,
    region: regionName,
    country,
    education,
    vote2019,
    voteIntention: intentionKey,
    turnoutLikelihood,
  };
}

function main() {
  const voters = Array.from({ length: N }, (_, i) => generateVoter(rand, i + 1));

  const counts = Object.fromEntries(PARTIES.map((p) => [p.key, 0]));
  for (const v of voters) counts[v.voteIntention]++;

  const summary = PARTIES.map((p) => ({
    key: p.key,
    name: p.name,
    count: counts[p.key],
    share: counts[p.key] / voters.length,
  }));

  const payload = {
    meta: {
      note: 'Synthetic, theoretical UK general-election poll — illustrative only, not real polling data.',
      generated: new Date().toISOString().slice(0, 10),
      seed: SEED,
      n: voters.length,
      summary,
    },
    voters,
  };

  return payload;
}

const outPath = fileURLToPath(new URL('../public/data/voters.json', import.meta.url));

const payload = main();
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload, null, 2));

console.log(`Wrote ${payload.voters.length} voters to ${outPath}`);
console.table(payload.meta.summary.map((s) => ({ party: s.name, count: s.count, share: `${(s.share * 100).toFixed(1)}%` })));
