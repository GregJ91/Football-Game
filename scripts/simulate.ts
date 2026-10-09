/**
 * Headless soak test: sims several seasons and reports on the health of the
 * world. Usage: npm run sim -- [seasons] [country] [seed] [assist]
 * Pass `assist` to let the assistant manager pick the user club's tactics.
 */
import { COUNTRIES } from '../src/data/pyramids';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import type { CountryId } from '../src/engine/types';
import { createGame, divisionOf, domesticClubs, userClub } from '../src/engine/world';

const seasons = Number(process.argv[2] ?? 10);
const country = (process.argv[3] ?? 'eng') as CountryId;
const seed = Number(process.argv[4] ?? 2026);
const assist = process.argv[5] === 'assist';

const game = createGame({
  seed,
  country,
  region: 'N',
  clubName: 'Ashford Rovers',
  shortName: 'ASR',
  stadiumName: 'The Meadow',
  colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'stripes' },
});
game.settings = { assistantTactics: assist };

const fmt = (n: number) =>
  Math.abs(n) >= 1e6 ? `£${(n / 1e6).toFixed(1)}m` : Math.abs(n) >= 1e3 ? `£${Math.round(n / 1e3)}k` : `£${Math.round(n)}`;

const avgOverall = (divId: string) => {
  const div = game.divisions.find((d) => d.def.id === divId)!;
  const xs = div.clubIds.flatMap((c) => game.clubs[c].playerIds.map((p) => game.players[p].overall));
  return (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1);
};

console.log(`Simulating ${seasons} seasons of ${COUNTRIES[country].name} (seed ${seed})${assist ? ', assistant picks tactics' : ''}`);
const t0 = performance.now();
for (let s = 0; s < seasons; s++) {
  const t = performance.now();
  playToSeasonEnd(game);
  const summary = game.lastSummary!;
  const div = divisionOf(game, game.userClubId);
  const pos = summary.finalTables[div.def.id].findIndex((r) => r.clubId === game.userClubId) + 1;
  const goalsPerGame =
    game.fixtures.reduce((n, f) => n + f.result!.homeGoals + f.result!.awayGoals, 0) / game.fixtures.length;
  console.log(
    `${game.season}/${(game.season + 1) % 100}  ${userClub(game).name}: ${div.def.name} ${pos}/${div.clubIds.length}` +
      `  | goals/game ${goalsPerGame.toFixed(2)} | players ${Object.keys(game.players).length}` +
      ` | avg OVR top ${avgOverall(game.divisions[0].def.id)} bottom ${avgOverall(game.divisions.at(-1)!.def.id)}` +
      ` | ${(performance.now() - t).toFixed(0)}ms`,
  );
  const moneyByLevel = [...new Set(game.divisions.map((d) => d.def.level))].map((level) => {
    const bal = game.divisions
      .filter((d) => d.def.level === level)
      .flatMap((d) => d.clubIds.map((id) => game.clubs[id].balance))
      .sort((x, y) => x - y);
    return `L${level} ${fmt(bal[Math.floor(bal.length / 2)])}`;
  });
  const broke = domesticClubs(game).filter((c) => c.balance < 0).length;
  const moves = (game.transfers ?? []).filter((t) => t.season === game.season);
  const free = Object.values(game.players).filter((p) => !p.clubId).length;
  console.log(
    `         median bank: ${moneyByLevel.join(' ')} | in debt ${broke} | transfers ${moves.length}` +
      ` (fees ${fmt(moves.reduce((n, t) => n + t.fee, 0))}) | free agents ${free} | user bank ${fmt(userClub(game).balance)}`,
  );
  startNextSeason(game);
  for (const d of game.divisions) {
    if (d.clubIds.length !== d.def.size) throw new Error(`${d.def.name} has ${d.clubIds.length} clubs`);
  }
  for (const c of domesticClubs(game)) {
    if (c.playerIds.length < 18) throw new Error(`${c.name} squad down to ${c.playerIds.length}`);
  }
}
const bytes = JSON.stringify(game).length;
console.log(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s. Save size ~${(bytes / 1024 / 1024).toFixed(1)} MB`);
