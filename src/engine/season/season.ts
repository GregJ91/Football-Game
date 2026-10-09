import { createLiveMatch, finishMatch, simulateMatch, type LiveMatch, type TeamSheet } from '../match/engine';
import { recommendTactics } from '../match/preview';
import { isAvailable, pickTeam, remapLineup, selectionFromLineup, type LineupSelection } from '../match/selection';
import { addGate, moneyPw, resetLedgers, setBoardBudgets, weeklyFinances } from '../economy/finance';
import { rolloverPlayers } from '../players/development';
import {
  SCOUT_REPORTS_PER_WEEK, addInbox, expiringUserContracts, handleContractExpiries, maintainFreeAgents, marketWeek, transferWindow, trimAiSquads,
} from '../transfers/market';
import { Rng } from '../rng';
import type {
  Club, Division, Fixture, Formation, GameState, MatchResult, Mentality, PlayoffTie, Region, SeasonSummary, Tactics,
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

/** Quick strength estimate: the average of the best eleven available players. */
function xiStrength(game: GameState, club: Club): number {
  const best = squadOf(game, club.id)
    .filter(isAvailable)
    .map((p) => p.overall)
    .sort((a, b) => b - a)
    .slice(0, 11);
  return best.reduce((s, x) => s + x, 0) / Math.max(1, best.length);
}

/** AI managers keep their shape but set their mentality by the opposition. */
export function aiTactics(game: GameState, club: Club, opponent: Club): Tactics {
  const gap = xiStrength(game, club) - xiStrength(game, opponent);
  const mentality: Mentality = gap > 3 ? 'attacking' : gap < -3 ? 'defensive' : 'balanced';
  return { formation: club.tactics.formation, pressing: club.tactics.pressing ?? 'medium', mentality };
}

/** The user's XI for a formation: their saved lineup if they have one, else the best XI. */
export function userSelection(game: GameState, formation = game.clubs[game.userClubId].tactics.formation): LineupSelection {
  const club = game.clubs[game.userClubId];
  const squad = squadOf(game, club.id);
  if (!club.lineup) return { selection: pickTeam(squad, formation), covers: [] };
  const lineup = formation === club.tactics.formation ? club.lineup : remapLineup(squad, club.lineup, formation);
  return selectionFromLineup(squad, formation, lineup);
}

export function teamSheet(game: GameState, club: Club, opponent: Club, opts: { live?: boolean; home?: boolean } = {}): TeamSheet {
  if (!club.isUser) {
    const tactics = aiTactics(game, club, opponent);
    return { selection: pickTeam(squadOf(game, club.id), tactics.formation), tactics };
  }
  // Optionally delegate simmed matches to the assistant manager.
  if (!opts.live && game.settings?.assistantTactics) {
    const oppSheet = teamSheet(game, opponent, club);
    const select = (f: Formation) => userSelection(game, f).selection;
    const { tactics } = recommendTactics(squadOf(game, club.id), oppSheet, opts.home ? 'home' : 'away', false, select);
    return { selection: select(tactics.formation), tactics };
  }
  const tactics = { ...club.tactics, pressing: club.tactics.pressing ?? 'medium' };
  return { selection: userSelection(game).selection, tactics };
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
  const result = simulateMatch(rng, teamSheet(game, home, away, { home: true }), teamSheet(game, away, home), {
    ...opts,
    capacity: opts.neutral ? Math.max(home.capacity, away.capacity) * 2 : home.capacity,
    crowdFill: crowdFill(home),
  });
  applyMatchToPlayers(game, rng, result, home, away);
  if (opts.neutral) {
    addGate(game, home, result.attendance / 2);
    addGate(game, away, result.attendance / 2);
  } else addGate(game, home, result.attendance);
  return result;
}

export function userFixtureNext(game: GameState): Fixture | undefined {
  return game.fixtures.find((f) => !f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
}

/** Play every week before the user's next fixture; returns that fixture (or nothing at season end). */
export function advanceToUserMatch(game: GameState): Fixture | undefined {
  let next = userFixtureNext(game);
  while (game.phase === 'season' && next && next.week > game.week) {
    playWeek(game);
    next = userFixtureNext(game);
  }
  return game.phase === 'season' ? next : undefined;
}

/** A live, steppable match for the user's fixture, with the user's side managed by hand. */
export function startUserMatch(game: GameState, fixture: Fixture): LiveMatch {
  const home = game.clubs[fixture.homeId];
  const away = game.clubs[fixture.awayId];
  const seed = withRng(game, (rng) => rng.int(0, 2 ** 31));
  return createLiveMatch(new Rng(seed), teamSheet(game, home, away, { live: true }), teamSheet(game, away, home, { live: true }), {
    capacity: home.capacity,
    crowdFill: crowdFill(home),
    commentary: true,
    manual: { home: home.isUser, away: away.isUser },
  });
}

/** Record the user's finished match, then play the rest of that week. */
export function completeUserMatch(game: GameState, fixture: Fixture, live: LiveMatch): MatchResult {
  const result = finishMatch(live);
  fixture.result = result;
  withRng(game, (rng) => applyMatchToPlayers(game, rng, result, game.clubs[fixture.homeId], game.clubs[fixture.awayId]));
  addGate(game, game.clubs[fixture.homeId], result.attendance);
  playWeek(game);
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
  weeklyFinances(game);
  withRng(game, (rng) => marketWeek(game, rng));
  const wasOpen = transferWindow(game).open;
  game.week++;
  if (game.week >= game.totalWeeks) endSeason(game);
  const now = transferWindow(game);
  if (!wasOpen && now.open) addInbox(game, 'info', `The ${now.name} transfer window is open for ${now.weeksLeft} weeks.`);
  if (wasOpen && !now.open && game.phase === 'season') addInbox(game, 'info', 'The transfer window has closed. Free agents can still be signed.');
  if (game.phase === 'season' && game.week === Math.floor(game.totalWeeks * 0.6)) {
    const expiring = expiringUserContracts(game);
    if (expiring.length) {
      addInbox(game, 'contract', `Contracts ending this summer: ${expiring.map((p) => p.lastName).join(', ')}. Renew them from the Squad screen or they will leave.`);
    }
  }
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
  withRng(game, (rng) => {
    handleContractExpiries(game, rng);
    rolloverPlayers(game, rng, new Set(moves.keys()));
    trimAiSquads(game);
    maintainFreeAgents(game, rng);
  });
  resetLedgers(game);
  game.season++;
  game.week = 0;
  game.phase = 'season';
  game.scoutReportsLeft = SCOUT_REPORTS_PER_WEEK;
  scheduleSeason(game);
  announceBudgets(game);
  addInbox(game, 'info', `The summer transfer window is open for ${transferWindow(game).weeksLeft} weeks.`);
}

/** The board sets the user's budgets for the new season and says so. */
export function announceBudgets(game: GameState) {
  const club = game.clubs[game.userClubId];
  const b = setBoardBudgets(game, club);
  addInbox(game, 'info', `The board has set your budgets: ${money(b.transfer)} for transfers and ${moneyPw(b.wage)} for wages.`);
}

function money(n: number) {
  return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
}
