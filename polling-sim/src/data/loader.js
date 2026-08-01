import { json } from 'd3';
import { PARTIES } from '../viz/parties.js';

// Loads the synthetic voter poll and groups it by party, in the fixed
// PARTIES order — see viz/parties.js for why that order is load-bearing.
export async function loadData() {
  const url = `${import.meta.env.BASE_URL}data/voters.json`;
  const raw = await json(url);

  const byParty = new Map(PARTIES.map((p) => [p.key, []]));
  for (const voter of raw.voters) {
    byParty.get(voter.voteIntention)?.push(voter);
  }

  const parties = PARTIES.map((p) => {
    const voters = byParty.get(p.key) ?? [];
    return { ...p, voters, count: voters.length, share: voters.length / raw.voters.length };
  });

  return { meta: raw.meta, voters: raw.voters, parties };
}
