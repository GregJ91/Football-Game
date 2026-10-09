import { simulateMatch, type TeamSheet } from '../match/engine';
import { pickTeam } from '../match/selection';
import { rolloverPlayers } from '../players/development';
import type { Rng } from '../rng';
import type {
  Club, Division, Fixture, GameState, MatchResult, PlayoffTie, Region, SeasonSummary,
} from '../types';
import { newId, squadOf, withRng } from '../world';
import { matchdayCount, roundRobin, weekForMatchday } from './fixtures';
import { buildTable } from './table';

export function scheduleSeason(game: GameState) {
  game.totalWeeks = Math.max(...game.divisions.map((d) => matchdayCount(d.clubIds.length, d.def.rounds)));
  game.fixtures = [];
  withRng(game, (rng) => {
    for (const div of game.divisions) {
      const days = roundRobin(div.clubIds, div.def.rounds, rng);
      days.forEach((pairs, md) => {
        const week = weekForMatchday(md, days.length, game.totalWeeks);
        for (const [homeId, awayId] of pairs) {
          game.fixtures.push({ id: newId(game, 'f'), divisionId: div.def.id, week, homeId, awayId, result: null });
        }
      });
    }
  });
}

export function teamSheet(game: GameState, club: Club): TeamSheet {
  return {
    selection: pickTeam(squadOf(game, club.id), club.tactics.formation),
    mentality: club.tactics.mentality,
  };
}

function crowdFill(club: Club): number {
  return Math.min(1, 0.3 + club.reputation / 120);
}

export function playMatch(
  game: GameState,
  rng: Rng,
  homeId: string,
  awayId: string,
  opts: { neutral?: boolean; knockout?: boolean } = {},
): MatchResult {
  const home = game.clubs[homeId];
  const away = game.clubs[awayId];
  const result = simulateMatch(rng, teamSheet(game, home), teamSheet(game, away), {
    ...opts,
    capacity: opts.neutral ? Math.max(home.capacity, away.capacity) * 2 : home.capacity,
    crowdFill: crowdFill(home),
  });
  applyMatchToPlayers(game, rng, result, home, away);
  return result;
}

export function applyMatchToPlayers(game: GameState, rng: Rng, result: MatchResult, home: Club, away: Club) {
  const sides = [
    { club: home, used: result.homeXI, scored: result.homeGoals, conceded: result.awayGoals },
    { club: away, used: result.awayXI, scored: result.awayGoals, conceded: result.homeGoals },
  ];
  for (const { club, used, scored, conceded } of sides) {
    const usedSet = new Set(used);
    const moraleShift = scored > conceded ? 4 : scored < conceded ? -4 : 0;
    for (const id of club.playerIds) {
      const p = game.players[id];
      if (!usedSet.has(id)) {
        // Serving a ban: this match counts towards it.
        if (p.suspendedMatches > 0) p.suspendedMatches--;
        continue;
      }
      const rating = result.ratings[id] ?? 6;
      p.seasonStats.apps++;
      p.seasonStats.ratingSum += rating;
      p.form = Math.round((p.form * 0.7 + rating * 0.3) * 10) / 10;
      p.fitness = Math.max(40, p.fitness - (24 - p.attributes.stamina / 10));
      p.morale = Math.max(0, Math.min(100, p.morale + moraleShift + (rating >= 7.5 ? 2 : rating < 5.5 ? -2 : 0)));
    }
  }
  for (const e of result.events) {
    const p = game.players[e.playerId];
    if (!p) continue;
    if (e.type === 'goal') {
      p.seasonStats.goals++;
      if (e.assistId && game.players[e.assistId]) game.players[e.assistId].seasonStats.assists++;
    } else if (e.type === 'red') p.suspendedMatches = 1;
    else if (e.type === 'injury') p.injuryWeeks = rng.int(2, 7);
  }
}

function weeklyRecovery(game: GameState) {
  for (const id in game.players) {
    const p = game.players[id];
    p.fitness = Math.min(100, p.fitness + 14 + p.attributes.stamina / 20);
    if (p.injuryWeeks > 0) p.injuryWeeks--;
  }
}

export function fixturesForWeek(game: GameState, week: number): Fixture[] {
  return game.fixtures.filter((f) => f.week === week);
}

/** Play every fixture in the current week across the whole pyramid. */
export function playWeek(game: GameState): Fixture[] {
  if (game.phase !== 'season') return [];
  const fixtures = fixturesForWeek(game, game.week).filter((f) => !f.result);
  withRng(game, (rng) => {
    for (const f of fixtures) f.result = playMatch(game, rng, f.homeId, f.awayId);
  });
  weeklyRecovery(game);
  game.week++;
  if (game.week >= game.totalWeeks) endSeason(game);
  return fixtures;
}

/** Sim straight to the end of the regular season. */
export function playToSeasonEnd(game: GameState) {
  while (game.phase === 'season') playWeek(game);
}

function playKnockout(game: GameState, rng: Rng, divisionId: string, round: PlayoffTie['round'], homeId: string, awayId: string): PlayoffTie {
  const result = playMatch(game, rng, homeId, awayId, { knockout: true, neutral: round === 'final' });
  let winnerId: string;
  if (result.homeGoals !== result.awayGoals) winnerId = result.homeGoals > result.awayGoals ? homeId : awayId;
  else winnerId = result.penalties!.home > result.penalties!.away ? homeId : awayId;
  return { divisionId, round, homeId, awayId, result, winnerId };
}

export function endSeason(game: GameState) {
  const summary: SeasonSummary = {
    season: game.season,
    champions: {},
    promoted: {},
    relegated: {},
    playoffs: [],
    finalTables: {},
  };
  withRng(game, (rng) => {
    for (const div of game.divisions) {
      const id = div.def.id;
      const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === id));
      summary.finalTables[id] = table;
      summary.champions[id] = table[0].clubId;
      const promo = div.def.promotion;
      const promoted: string[] = [];
      if (promo) {
        promoted.push(...table.slice(0, promo.auto).map((r) => r.clubId));
        if (promo.playoff) {
          const [from, to] = promo.playoff;
          const seeds = table.slice(from - 1, to).map((r) => r.clubId);
          const semi1 = playKnockout(game, rng, id, 'semi', seeds[0], seeds[3]);
          const semi2 = playKnockout(game, rng, id, 'semi', seeds[1], seeds[2]);
          const final = playKnockout(game, rng, id, 'final', semi1.winnerId, semi2.winnerId);
          summary.playoffs.push(semi1, semi2, final);
          promoted.push(final.winnerId);
        }
      }
      summary.promoted[id] = promoted;
      summary.relegated[id] = div.def.relegation > 0 ? table.slice(-div.def.relegation).map((r) => r.clubId) : [];
    }
  });

  for (const div of game.divisions) {
    const id = div.def.id;
    summary.finalTables[id].forEach((row, i) => {
      const outcome =
        i === 0 && (div.def.level === 1 || summary.promoted[id].includes(row.clubId)) ? 'champions'
          : summary.promoted[id].includes(row.clubId) ? 'promoted'
            : summary.relegated[id].includes(row.clubId) ? 'relegated'
              : 'stayed';
      game.clubs[row.clubId].history.push({ season: game.season, divisionId: id, position: i + 1, outcome });
    });
  }

  game.lastSummary = summary;
  game.phase = 'seasonEnd';
}

/** Distribute clubs into divisions, honouring each target's quota and preferring a regional match. */
function assign(clubs: Club[], targets: { div: Division; quota: number }[]): Map<string, Division> {
  const out = new Map<string, Division>();
  const remaining = targets.map((t) => ({ ...t }));
  const pending: Club[] = [];
  for (const c of clubs) {
    const t = remaining.find((r) => r.quota > 0 && r.div.def.region === c.region);
    if (t) {
      t.quota--;
      out.set(c.id, t.div);
    } else pending.push(c);
  }
  for (const c of pending) {
    const t = remaining.find((r) => r.quota > 0);
    if (!t) throw new Error('Promotion/relegation quotas do not balance');
    t.quota--;
    out.set(c.id, t.div);
    // A club moved into another region's league adopts that region.
    if (t.div.def.region) c.region = t.div.def.region as Region;
  }
  return out;
}

export function applyMovements(game: GameState, summary: SeasonSummary) {
  const levels = [...new Set(game.divisions.map((d) => d.def.level))].sort((a, b) => a - b);
  const moves = new Map<string, { from: Division; to: Division }>();
  for (let i = 0; i < levels.length - 1; i++) {
    const upper = game.divisions.filter((d) => d.def.level === levels[i]);
    const lower = game.divisions.filter((d) => d.def.level === levels[i + 1]);
    const down = upper.flatMap((d) => summary.relegated[d.def.id].map((id) => ({ club: game.clubs[id], from: d })));
    const up = lower.flatMap((d) => summary.promoted[d.def.id].map((id) => ({ club: game.clubs[id], from: d })));
    const downTo = assign(down.map((x) => x.club), lower.map((d) => ({ div: d, quota: summary.promoted[d.def.id].length })));
    const upTo = assign(up.map((x) => x.club), upper.map((d) => ({ div: d, quota: summary.relegated[d.def.id].length })));
    for (const { club, from } of down) moves.set(club.id, { from, to: downTo.get(club.id)! });
    for (const { club, from } of up) moves.set(club.id, { from, to: upTo.get(club.id)! });
  }
  for (const [clubId, { from, to }] of moves) {
    from.clubIds = from.clubIds.filter((id) => id !== clubId);
    to.clubIds.push(clubId);
    const club = game.clubs[clubId];
    club.reputation += to.def.level < from.def.level ? 4 : -4;
  }
  return moves;
}

/** Promotion/relegation, player ageing and a fresh fixture list. */
export function startNextSeason(game: GameState) {
  if (game.phase !== 'seasonEnd' || !game.lastSummary) return;
  const moves = applyMovements(game, game.lastSummary);
  withRng(game, (rng) => rolloverPlayers(game, rng, new Set(moves.keys())));
  game.season++;
  game.week = 0;
  game.phase = 'season';
  scheduleSeason(game);
}
