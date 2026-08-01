import { json } from 'd3';

// Loads the static dataset from /public. BASE_URL is injected by Vite and
// resolves to '/scrolly-viz/' in production and '/' in dev, so the fetch works
// in both places without hardcoding the repo path.
export async function loadData() {
  const url = `${import.meta.env.BASE_URL}data/series.json`;
  const raw = await json(url);

  // Shape once, here, so the rest of the app receives clean, typed rows.
  const series = raw.series.map((d) => ({
    date: new Date(d.date),
    value: +d.value,
    target: +d.target,
  }));

  return { meta: raw.meta, series };
}
