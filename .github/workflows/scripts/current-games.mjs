// Drops leftover games from the previous season that the Dynasty API's /schedule still returns
// after the year rolls over (e.g. last season's National Championship, week 21, marked played,
// sitting next to the new season's Week 0-3 games). Without this, "latest played week" jumps to 21.
//
// A played game is a leftover when its week is past the first week that is still mostly unplayed.
// (A single orphaned unplayed game can't trigger this: the week must be at least half unplayed.)
export function currentGames(games = [], curSeason = null) {
  let gs = games;
  const seasons = new Set(gs.map((g) => g.season).filter(Boolean));
  if (curSeason && seasons.size > 1 && seasons.has(curSeason)) gs = gs.filter((g) => !g.season || g.season === curSeason);
  const byWeek = new Map();
  for (const g of gs) { const b = byWeek.get(g.week) || { n: 0, open: 0 }; b.n++; if (!g.played) b.open++; byWeek.set(g.week, b); }
  const openWeeks = [...byWeek].filter(([, b]) => b.open * 2 >= b.n).map(([w]) => w);
  if (!openWeeks.length) return gs;
  const firstOpen = Math.min(...openWeeks);
  return gs.filter((g) => !g.played || g.week <= firstOpen);
}
