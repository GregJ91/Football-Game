import { createLiveMatch, finishMatch, simulateMatch, type LiveMatch, type TeamSheet } from '../match/engine';
import { monthEnds, monthlyAwards, recordLegends, seasonAwards, updateClubRecords } from './awards';
import { assistantMorale, scoutReportsPerWeek } from '../club/staff';
import { challengeSeasonEnd, kidsWindowClosed, kidsWindowOpened } from '../club/challenge';
import { returnLoans } from '../transfers/loans';
import { recommendTactics } from '../match/preview';
import { isAvailable, pickTeam, remapLineup, selectionFromLineup, type LineupSelection } from '../match/selection';
import { addGate, crowdFill, moneyPw, resetLedgers, setBoardBudgets, weeklyFinances } from '../economy/finance';
import { MATCHDAY, SEASON_START_DAY, advanceHalfDay, deliverScoutReports, isMatchdayMorning, todaysUserMatch } from '../calendar';
import { awardLeagueTitles, completeUserCupTie, isCupTie, playDueCupRounds, setupCups, tieMatchOptions } from './cups';
import { europeSeasonEnd, setupEurope } from './europe';
import { boardCheck, chairmanWeek, gradingWarning, judge, makeSponsorOffers, moodAfterMatch, seasonPayouts, seasonReview, setSeasonTarget } from '../club/chairman';
import { injuryFactor } from '../club/facilities';
import { checkGrading } from '../club/stadium';
import { rolloverPlayers } from '../players/development';
import { attr100 } from '../players/ratings';
import { assignRoles, playingTimeCheck, recoverTo, restTired, withBench } from '../players/squad';
import {
  addInbox, sellUpStars, expiringUserContracts, handleContractExpiries, maintainFreeAgents, marketWeek, transferWindow, trimAiSquads,
} from '../transfers/market';
import { Rng } from '../rng';
import { isEuroId } from '../../data/europe';
import type {
  Club, Division, Fixture, Formation, GameState, MatchResult, Mentality, PlayoffTie, Region, SeasonSummary, Tactics,
} from '../types';
import { divisionOf, newId, squadOf, withRng } from '../world';
import { matchdayCount, roundRobin, weekForMatchday } from './fixtures';
import { divisionTable } from './table';

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
export function xiStrength(game: GameState, club: Club): number {
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

/**
 * The user's XI and bench for a formation: their saved lineup if they have
 * one, else the best XI (which already allows for tiredness). With `rotate`,
 * tired picks in a saved lineup are rested for fresher players.
 */
export function userSelection(game: GameState, formation = game.clubs[game.userClubId].tactics.formation, rotate = false): LineupSelection {
  const club = game.clubs[game.userClubId];
  const squad = squadOf(game, club.id);
  if (!club.lineup) return { selection: withBench(pickTeam(squad, formation), squad, club.bench), covers: [] };
  let lineup = formation === club.tactics.formation ? club.lineup : remapLineup(squad, club.lineup, formation);
  if (rotate) lineup = restTired(squad, formation, lineup).lineup;
  const picked = selectionFromLineup(squad, formation, lineup);
  return { ...picked, selection: withBench(picked.selection, squad, club.bench) };
}

/** Does the assistant rest tired players in simmed matches? (On unless switched off.) */
export function autoRotates(game: GameState): boolean {
  return game.settings?.autoRotate ?? true;
}

export function teamSheet(game: GameState, club: Club, opponent: Club, opts: { live?: boolean; home?: boolean } = {}): TeamSheet {
  if (!club.isUser) {
    const tactics = aiTactics(game, club, opponent);
    return { selection: pickTeam(squadOf(game, club.id), tactics.formation), tactics };
  }
  // Optionally delegate simmed matches to the assistant manager.
  const rotate = !opts.live && autoRotates(game);
  if (!opts.live && game.settings?.assistantTactics) {
    const oppSheet = teamSheet(game, opponent, club);
    const select = (f: Formation) => userSelection(game, f, rotate).selection;
    const { tactics } = recommendTactics(squadOf(game, club.id), oppSheet, opts.home ? 'home' : 'away', false, select);
    return { selection: select(tactics.formation), tactics };
  }
  const tactics = { ...club.tactics, pressing: club.tactics.pressing ?? 'medium' };
  return { selection: userSelection(game, undefined, rotate).selection, tactics };
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
    crowdFill: crowdFill(game, home),
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

/**
 * Move through the days to the morning of the user's next match; returns
 * that fixture (or nothing at season end). Daily events still happen.
 */
export function advanceToUserMatch(game: GameState): Fixture | undefined {
  while (game.phase === 'season') {
    if (isMatchdayMorning(game)) return todaysUserMatch(game);
    if (advanceHalfDay(game) === 'seasonEnd') break;
  }
  return undefined;
}

/** Sim the user's match today (and the rest of that day's or week's games). */
export function simUserMatchToday(game: GameState): Fixture | undefined {
  const match = todaysUserMatch(game);
  if (!match) return undefined;
  if (isCupTie(match)) {
    playDueCupRounds(game, game.week, game.day ?? MATCHDAY);
    game.half = 'pm';
  } else playWeek(game);
  return match;
}

/** A live, steppable match for the user's fixture, with the user's side managed by hand. */
export function startUserMatch(game: GameState, fixture: Fixture): LiveMatch {
  const home = game.clubs[fixture.homeId];
  const away = game.clubs[fixture.awayId];
  recoverTo(game, game.week * 7 + (game.day ?? MATCHDAY));
  const seed = withRng(game, (rng) => rng.int(0, 2 ** 31));
  const opts = isCupTie(fixture) ? tieMatchOptions(game, fixture) : { capacity: home.capacity, crowdFill: crowdFill(game, home) };
  return createLiveMatch(new Rng(seed), teamSheet(game, home, away, { live: true }), teamSheet(game, away, home, { live: true }), {
    ...opts,
    commentary: true,
    manual: { home: home.isUser, away: away.isUser },
  });
}

/** Record the user's finished match, then play the rest of that week. */
export function completeUserMatch(game: GameState, fixture: Fixture, live: LiveMatch): MatchResult {
  const result = finishMatch(live);
  fixture.result = result;
  withRng(game, (rng) => applyMatchToPlayers(game, rng, result, game.clubs[fixture.homeId], game.clubs[fixture.awayId]));
  if (isCupTie(fixture)) {
    if (isEuroId(fixture.cupId)) {
      // European gates (and foreign grounds) are handled with the tie.
    } else if (fixture.neutral) {
      addGate(game, game.clubs[fixture.homeId], result.attendance / 2);
      addGate(game, game.clubs[fixture.awayId], result.attendance / 2);
    } else addGate(game, game.clubs[fixture.homeId], result.attendance);
    completeUserCupTie(game, fixture);
    // Any other competition's games on the same day.
    playDueCupRounds(game, game.week, game.day ?? MATCHDAY);
    game.half = 'pm';
    return result;
  }
  addGate(game, game.clubs[fixture.homeId], result.attendance);
  playWeek(game);
  return result;
}

export function applyMatchToPlayers(game: GameState, rng: Rng, result: MatchResult, home: Club, away: Club) {
  const sides = [
    { club: home, used: result.homeXI, scored: result.homeGoals, conceded: result.awayGoals },
    { club: away, used: result.awayXI, scored: result.awayGoals, conceded: result.homeGoals },
  ];
  if (!game.unemployed) updateClubRecords(game, home.id, away.id, result);
  for (const { club, used, scored, conceded } of sides) {
    club.seasonGames = (club.seasonGames ?? 0) + 1;
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
      const m = (p.monthStats ??= { apps: 0, goals: 0, assists: 0, ratingSum: 0 });
      m.apps++;
      m.ratingSum += rating;
      p.form = Math.round((p.form * 0.7 + rating * 0.3) * 10) / 10;
      p.fitness = Math.max(40, p.fitness - (24 - attr100(p, 'stamina') / 10));
      p.morale = Math.max(0, Math.min(100, p.morale + moraleShift + (rating >= 7.5 ? 2 : rating < 5.5 ? -2 : 0)));
    }
  }
  for (const e of result.events) {
    const p = game.players[e.playerId];
    if (!p) continue;
    if (e.type === 'goal') {
      p.seasonStats.goals++;
      if (p.monthStats) p.monthStats.goals++;
      const assister = e.assistId ? game.players[e.assistId] : undefined;
      if (assister) {
        assister.seasonStats.assists++;
        if (assister.monthStats) assister.monthStats.assists++;
      }
    } else if (e.type === 'red') p.suspendedMatches = 1;
    else if (e.type === 'injury') {
      const club = p.clubId ? game.clubs[p.clubId] : null;
      p.injuryWeeks = Math.max(1, Math.round(rng.int(2, 7) * (club ? injuryFactor(club) : 1)));
      if (club?.isUser) {
        const opp = club.id === home.id ? away : home;
        addInbox(game, 'info', `${p.firstName} ${p.lastName} was injured against ${opp.name} and will be out for about ${p.injuryWeeks} weeks.`, {
          category: 'medical',
          subject: `${p.lastName} injured`,
        });
      }
    }
  }
}

/** Injuries heal a week at a time (fitness recovers daily: see recoverTo). */
function weeklyRecovery(game: GameState) {
  for (const id in game.players) {
    const p = game.players[id];
    if (p.injuryWeeks > 0) p.injuryWeeks--;
  }
}

export function fixturesForWeek(game: GameState, week: number): Fixture[] {
  return game.fixtures.filter((f) => f.week === week);
}

/** Play every fixture in the current week across the whole pyramid. */
export function playWeek(game: GameState): Fixture[] {
  if (game.phase !== 'season') return [];
  // Any cup rounds earlier in the week that were skipped over.
  playDueCupRounds(game, game.week, MATCHDAY);
  // It's matchday: messages from today's games and business carry Saturday's date.
  game.day = MATCHDAY;
  recoverTo(game, game.week * 7 + MATCHDAY);
  const fixtures = fixturesForWeek(game, game.week).filter((f) => !f.result);
  withRng(game, (rng) => {
    for (const f of fixtures) f.result = playMatch(game, rng, f.homeId, f.awayId);
  });
  weeklyRecovery(game);
  weeklyFinances(game);
  withRng(game, (rng) => {
    chairmanWeek(game, rng);
    marketWeek(game, rng);
  });
  userMatchMood(game, fixtures);
  // The assistant manager's touch on squad morale.
  if (!game.unemployed) {
    const user = game.clubs[game.userClubId];
    const lift = assistantMorale(user);
    for (const p of squadOf(game, user.id)) p.morale = Math.max(0, Math.min(100, p.morale + lift));
  }
  if (!game.unemployed && game.week >= 6 && game.week % 4 === 0) playingTimeCheck(game);
  if (monthEnds(game)) monthlyAwards(game);
  // Once a month the board takes stock; on hard it may sack you.
  if (game.week >= 8 && game.week % 4 === 2) boardCheck(game);
  const wasOpen = transferWindow(game).open;
  game.week++;
  // Saturday evening: day -1 of the new week is the Saturday just gone,
  // and Continue goes on to Sunday.
  game.day = MATCHDAY - 7;
  game.half = 'pm';
  if (game.week >= game.totalWeeks) endSeason(game);
  const now = transferWindow(game);
  if (!wasOpen && now.open) {
    addInbox(game, 'info', `The ${now.name} transfer window is open for ${now.weeksLeft} weeks.`, { category: 'transfers', subject: 'Window open' });
    kidsWindowOpened(game);
  }
  if (wasOpen && !now.open && game.phase === 'season') {
    addInbox(game, 'info', 'The transfer window has closed. Free agents can still be signed.', { category: 'transfers', subject: 'Window closed' });
    kidsWindowClosed(game);
  }
  if (game.phase === 'season' && game.week === Math.floor(game.totalWeeks * 0.6)) {
    const expiring = expiringUserContracts(game);
    if (expiring.length) {
      addInbox(game, 'contract', `Contracts ending this summer: ${expiring.map((p) => p.lastName).join(', ')}. Renew them from the Squad screen or they will leave.`, { category: 'transfers', subject: 'Contracts ending' });
    }
  }
  return fixtures;
}

/** Fans and board react to the user's result this week; ground warning later in the season. */
function userMatchMood(game: GameState, fixtures: Fixture[]) {
  const all = [...fixtures, ...fixturesForWeek(game, game.week).filter((f) => f.result && !fixtures.includes(f))];
  const f = all.find((x) => x.result && (x.homeId === game.userClubId || x.awayId === game.userClubId));
  if (f?.result) {
    const home = f.homeId === game.userClubId;
    moodAfterMatch(game, home ? f.result.homeGoals : f.result.awayGoals, home ? f.result.awayGoals : f.result.homeGoals, home);
  }
  if (game.week >= game.totalWeeks * 0.5) {
    const div = divisionOf(game, game.userClubId);
    const table = divisionTable(game, div.def.id);
    gradingWarning(game, table.findIndex((r) => r.clubId === game.userClubId) + 1);
  }
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
      const table = divisionTable(game, id);
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

  denyPromotionIfGroundFails(game, summary);

  for (const div of game.divisions) {
    const id = div.def.id;
    summary.finalTables[id].forEach((row, i) => {
      const outcome =
        i === 0 ? 'champions'
          : summary.promoted[id].includes(row.clubId) ? 'promoted'
            : summary.relegated[id].includes(row.clubId) ? 'relegated'
              : 'stayed';
      game.clubs[row.clubId].history.push({ season: game.season, divisionId: id, position: i + 1, outcome });
    });
  }

  // Play-off games come after the last monthly awards.
  for (const id in game.players) game.players[id].monthStats = undefined;
  awardLeagueTitles(game, summary.champions);
  if (!game.unemployed) {
    recordLegends(game);
  }
  seasonAwards(game, summary);
  europeSeasonEnd(game, summary);
  challengeSeasonEnd(game, summary);
  seasonPayouts(game, summary);
  seasonReview(game, summary);
  game.lastSummary = summary;
  game.phase = 'seasonEnd';
  judge(game, true);
}

/** No promotion without a ground that meets the next level's rules; the next club goes up instead. */
function denyPromotionIfGroundFails(game: GameState, summary: SeasonSummary) {
  if (game.unemployed) return;
  const user = game.clubs[game.userClubId];
  const div = divisionOf(game, user.id);
  const promoted = summary.promoted[div.def.id];
  if (!promoted.includes(user.id)) return;
  const check = checkGrading(game, user, div.def.level - 1);
  if (!check || check.ok) return;
  const final = summary.playoffs.find((t) => t.divisionId === div.def.id && t.round === 'final');
  const replacementId =
    final && final.winnerId === user.id
      ? final.homeId === user.id ? final.awayId : final.homeId
      : summary.finalTables[div.def.id].map((r) => r.clubId).find((id) => !promoted.includes(id))!;
  summary.promoted[div.def.id] = promoted.map((id) => (id === user.id ? replacementId : id));
  summary.deniedPromotion = { clubId: user.id, replacementId };
  addInbox(game, 'contract', `Promotion denied: the ground doesn't meet the rules for the next level. ${game.clubs[replacementId].name} go up instead.`, { subject: 'Promotion denied' });
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
  deliverScoutReports(game, true);
  // Loans end with the season; deductions don't carry over.
  returnLoans(game);
  game.deductions = {};
  const userLevel = divisionOf(game, game.userClubId).def.level;
  const moves = applyMovements(game, game.lastSummary);
  // A new level has a different going rate for tickets.
  if (divisionOf(game, game.userClubId).def.level !== userLevel) game.clubs[game.userClubId].ticketPrice = undefined;
  withRng(game, (rng) => {
    handleContractExpiries(game, rng);
    sellUpStars(game, rng, moves);
    rolloverPlayers(game, rng, new Set(moves.keys()));
    trimAiSquads(game);
    maintainFreeAgents(game, rng);
  });
  resetLedgers(game);
  game.season++;
  game.week = 0;
  game.day = SEASON_START_DAY;
  game.half = 'am';
  game.phase = 'season';
  game.scoutReportsLeft = scoutReportsPerWeek(game.clubs[game.userClubId]);
  game.recoveredTo = undefined;
  assignRoles(game, game.clubs[game.userClubId]);
  scheduleSeason(game);
  setupEurope(game);
  setupCups(game);
  startOfSeasonBusiness(game);
}

/** Board target, sponsor offers, budgets and the window opening. */
export function startOfSeasonBusiness(game: GameState) {
  setSeasonTarget(game);
  withRng(game, (rng) => makeSponsorOffers(game, rng));
  announceBudgets(game);
  addInbox(game, 'info', `The summer transfer window is open for ${transferWindow(game).weeksLeft} weeks.`, { category: 'transfers', subject: 'Window open' });
  kidsWindowOpened(game);
}

/** The board sets the user's budgets for the new season and says so. */
export function announceBudgets(game: GameState) {
  const club = game.clubs[game.userClubId];
  const b = setBoardBudgets(game, club);
  addInbox(game, 'info', `The board has set your budgets: ${money(b.transfer)} for transfers and ${moneyPw(b.wage)} for wages.`, { subject: 'Budgets set' });
}

function money(n: number) {
  return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
}
