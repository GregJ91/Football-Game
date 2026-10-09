import { CUPS, cupDef } from '../../data/cups';
import { euroDef, isEuroId } from '../../data/europe';
import { dateIn, formatDate } from '../calendar';
import { crowdFill } from '../economy/finance';
import type { SimOptions } from '../match/engine';
import { ledgerOf } from '../economy/finance';
import { roundMoney } from '../players/ratings';
import { recoverTo } from '../players/squad';
import type { Rng } from '../rng';
import type { CupDef, CupRound, CupState, CupTie, GameState } from '../types';
import { addInbox, levelOf } from '../transfers/market';
import { leagueNameOf, newId, withRng } from '../world';
import { completeUserEuroTie, euroMatchOptions, playEuroRound } from './europe';
import { playMatch } from './season';

function entrants(game: GameState, def: CupDef, round: number): string[] {
  return game.divisions.filter((d) => def.entries[d.def.level] === round).flatMap((d) => d.clubIds);
}

/** How many rounds a cup needs, given who joins when. */
function roundCount(game: GameState, def: CupDef): number {
  const lastEntry = Math.max(...Object.values(def.entries));
  let alive = 0;
  let rounds = 0;
  for (let r = 0; ; r++) {
    alive += entrants(game, def, r).length;
    if (r >= lastEntry && alive <= 1) return rounds;
    alive = Math.ceil(alive / 2);
    rounds++;
  }
}

const ORDINAL_ROUNDS = ['First Round', 'Second Round', 'Third Round', 'Fourth Round', 'Fifth Round', 'Sixth Round', 'Seventh Round'];

function roundName(def: CupDef, teams: number, index: number): string {
  if (teams <= 2) return 'Final';
  if (teams <= 4) return 'Semi-final';
  if (teams <= 8) return 'Quarter-final';
  return def.roundNames?.[index] ?? ORDINAL_ROUNDS[index] ?? `Round ${index + 1}`;
}

/** "in the Second Qualifying Round" / "in the semi-final" */
export function inRound(name: string): string {
  return /^(Final|Semi-final|Quarter-final)$/.test(name) ? `in the ${name.toLowerCase()}` : `in the ${name}`;
}

export function cupName(game: GameState, cupId: string) {
  return isEuroId(cupId) ? euroDef(cupId).name : cupDef(game.country, cupId).name;
}

/** Short label for fixture lists, e.g. FAC or UCL. */
export function cupShort(game: GameState, cupId: string) {
  return isEuroId(cupId) ? euroDef(cupId).short : cupDef(game.country, cupId).short;
}

/** Domestic cups and European competitions together. */
export function allCups(game: GameState): CupState[] {
  return [...(game.cups ?? []), ...(game.europe?.comps ?? [])];
}

/** Match options for any cup tie: knockout rules, venue and crowd. */
export function tieMatchOptions(game: GameState, tie: CupTie): SimOptions {
  if (isEuroId(tie.cupId)) return euroMatchOptions(game, tie);
  const home = game.clubs[tie.homeId];
  const away = game.clubs[tie.awayId];
  return {
    knockout: true,
    neutral: tie.neutral,
    capacity: tie.neutral ? Math.max(home.capacity, away.capacity) * 2 : home.capacity,
    crowdFill: crowdFill(game, home),
  };
}

/** Create this season's cups with their round dates, and make the first draws. */
export function setupCups(game: GameState) {
  const previousCups = game.cups ?? [];
  // European nights are fixed first; a domestic round that clashes moves to another midweek day.
  const euro = new Set((game.europe?.comps ?? []).flatMap((c) => c.rounds.map((r) => `${r.week}:${r.day}`)));
  const taken = new Set(euro);
  const freeDay = (week: number, day: number) => {
    if (!euro.has(`${week}:${day}`)) return day;
    return [2, 3, 1, 4, 5].find((d) => !taken.has(`${week}:${d}`)) ?? day;
  };
  game.cups = CUPS[game.country].map((def) => {
    const count = roundCount(game, def);
    const start = Math.round(game.totalWeeks * def.window[0]);
    const end = Math.round(game.totalWeeks * def.window[1]);
    const rounds: CupRound[] = Array.from({ length: count }, (_, i) => {
      const week = count > 1 ? start + Math.round((i * (end - start)) / (count - 1)) : start;
      return { name: '', week, day: freeDay(week, def.day), ties: [], byes: [], drawn: false, played: false };
    });
    for (const r of rounds) taken.add(`${r.week}:${r.day}`);
    return { id: def.id, season: game.season, rounds };
  });
  withRng(game, (rng) => {
    for (const cup of game.cups!) drawRound(game, rng, cup, 0, []);
    // The season's curtain-raisers: one match each, at a neutral ground.
    for (const { id, pair, week } of showpieceMatches(game, previousCups)) {
      const cup: CupState = { id, season: game.season, rounds: [{ name: 'Final', week, day: freeDay(week, 3), ties: [], byes: [], drawn: false, played: false }] };
      taken.add(`${week}:${cup.rounds[0].day}`);
      game.cups!.push(cup);
      drawRound(game, rng, cup, 0, pair);
    }
  });
}

/**
 * Who plays in the Community Shield (England: league champions v FA Cup
 * winners, or the runners-up if one club won both) and the UEFA Super Cup
 * (Champions League v Europa League winners). Before any season has been
 * played, the biggest clubs stand in.
 */
function showpieceMatches(game: GameState, previousCups: CupState[]): { id: string; pair: string[]; week: number }[] {
  const out: { id: string; pair: string[]; week: number }[] = [];
  const summary = game.lastSummary;
  const top = game.divisions.find((d) => d.def.level === 1)!;
  if (game.country === 'eng') {
    const table = summary?.finalTables[top.def.id]?.map((r) => r.clubId);
    const byRep = [...top.clubIds].sort((a, b) => game.clubs[b].reputation - game.clubs[a].reputation);
    const champions = table?.[0] ?? byRep[0];
    const cupWinner = previousCups.find((c) => c.id === 'fa-cup')?.winnerId;
    const opponent = cupWinner && cupWinner !== champions ? cupWinner : (table ?? byRep).find((id) => id !== champions);
    if (champions && opponent && game.clubs[champions] && game.clubs[opponent]) out.push({ id: 'community-shield', pair: [champions, opponent], week: 0 });
  }
  const euroWinners = summary?.europe?.winners;
  const ucl = euroWinners?.find((w) => w.compId === 'ucl')?.clubId;
  const uel = euroWinners?.find((w) => w.compId === 'uel')?.clubId;
  if (ucl && uel && ucl !== uel) out.push({ id: 'super-cup', pair: [ucl, uel], week: 2 });
  else if (!summary && game.europe) {
    // First season: the strongest club in Europe against a strong outsider.
    const foreign = game.europe.foreignIds.map((id) => game.clubs[id]).sort((a, b) => b.foreign!.strength - a.foreign!.strength);
    if (foreign.length > 8) out.push({ id: 'super-cup', pair: [foreign[0].id, foreign[7].id], week: 2 });
  }
  return out;
}

function drawRound(game: GameState, rng: Rng, cup: CupState, r: number, through: string[]) {
  const def = cupDef(game.country, cup.id);
  if (!cup.rounds[r]) {
    const prev = cup.rounds[r - 1];
    cup.rounds[r] = { name: '', week: Math.min(game.totalWeeks - 1, prev.week + 1), day: def.day, ties: [], byes: [], drawn: false, played: false };
  }
  const round = cup.rounds[r];
  const pool = rng.shuffle([...through, ...entrants(game, def, r)]);
  round.name = roundName(def, pool.length, r);
  if (pool.length % 2 === 1) round.byes.push(pool.pop()!);
  const neutral = pool.length <= 2 || (def.neutralSemis && pool.length <= 4);
  for (let i = 0; i < pool.length; i += 2) {
    round.ties.push({
      id: newId(game, 'cup'),
      divisionId: cup.id,
      cupId: cup.id,
      round: r,
      week: round.week,
      homeId: pool[i],
      awayId: pool[i + 1],
      neutral,
      result: null,
    });
  }
  round.drawn = true;

  const user = game.userClubId;
  const milestone = def.milestones?.[r];
  if (milestone && through.includes(user)) {
    // Reaching a famous round lifts the fans.
    const board = (game.clubs[user].board ??= { confidence: 60, fans: 60 });
    board.fans = Math.min(100, board.fans + 4);
    addInbox(game, 'info', milestone, { category: 'match', subject: `${def.name}: ${round.name}` });
  }
  const tie = round.ties.find((t) => t.homeId === user || t.awayId === user);
  if (tie) {
    const opp = game.clubs[tie.homeId === user ? tie.awayId : tie.homeId];
    const where = tie.neutral ? 'at a neutral ground' : tie.homeId === user ? 'at home' : 'away';
    const when = formatDate(dateIn(game.season, round.week, round.day));
    if (def.showpiece) {
      addInbox(game, 'info', `We're in the ${def.name}: ${opp.name} (${leagueNameOf(game, opp.id)}), ${where}, on ${when}. A trophy to start the season.`, {
        category: 'match',
        subject: def.name,
      });
    } else {
      addInbox(game, 'info', `${def.name} ${round.name} draw: ${opp.name} (${leagueNameOf(game, opp.id)}), ${where}, on ${when}.`, {
        category: 'match',
        subject: `${def.name}: ${round.name} draw`,
      });
    }
  } else if (round.byes.includes(user)) {
    addInbox(game, 'info', `You have a bye ${inRound(round.name)} of the ${def.name}.`, { category: 'match', subject: `${def.name}: bye` });
  }
}

/** Winner, prize money and reactions for a finished tie. */
function settleTie(game: GameState, cup: CupState, tie: CupTie) {
  const r = tie.result!;
  const homeWon = r.homeGoals !== r.awayGoals ? r.homeGoals > r.awayGoals : r.penalties!.home > r.penalties!.away;
  tie.winnerId = homeWon ? tie.homeId : tie.awayId;
  const loserId = homeWon ? tie.awayId : tie.homeId;
  const def = cupDef(game.country, cup.id);
  const prize = roundMoney(def.prize * Math.pow(2, tie.round));
  const winner = game.clubs[tie.winnerId];
  winner.balance += prize;
  const l = ledgerOf(winner);
  l.prize = (l.prize ?? 0) + prize;

  const user = game.clubs[game.userClubId];
  if (tie.winnerId === user.id || loserId === user.id) {
    const opp = game.clubs[tie.winnerId === user.id ? loserId : tie.winnerId];
    const round = cup.rounds[tie.round];
    const giantKilling = !def.showpiece && levelOf(game, opp.id) < levelOf(game, user.id);
    const board = (user.board ??= { confidence: 60, fans: 60 });
    if (tie.winnerId === user.id) {
      board.fans = Math.min(100, board.fans + (giantKilling ? 6 : 3));
      board.confidence = Math.min(100, board.confidence + (giantKilling ? 3 : 1));
      if (round.name !== 'Final') {
        addInbox(game, 'info', `${giantKilling ? 'Giant-killing! ' : ''}Through in the ${def.name}: you beat ${opp.name} ${inRound(round.name)}. Prize money ${formatMoney(prize)}.`, {
          category: 'match',
          subject: `${def.name}: through`,
        });
      }
    } else {
      board.fans = Math.max(0, board.fans - 1);
      addInbox(game, 'info', `Out of the ${def.name}: beaten by ${opp.name} ${inRound(round.name)}.`, {
        category: 'match',
        subject: `${def.name}: knocked out`,
      });
    }
  }
}

function formatMoney(n: number) {
  return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
}

/** Close a round: draw the next one, or crown the winner. */
function finishRound(game: GameState, rng: Rng, cup: CupState, r: number) {
  const round = cup.rounds[r];
  round.played = true;
  const through = [...round.ties.map((t) => t.winnerId!), ...round.byes];
  if (through.length === 1) {
    cup.winnerId = through[0];
    const name = cupName(game, cup.id);
    const club = game.clubs[cup.winnerId];
    (club.trophies ??= []).push({ season: game.season, name });
    if (club.isUser) {
      const board = (club.board ??= { confidence: 60, fans: 60 });
      board.fans = Math.min(100, board.fans + 10);
      board.confidence = Math.min(100, board.confidence + 8);
      addInbox(game, 'info', `Cup winners! You've won the ${name}.`, { category: 'match', subject: `${name} winners` });
    }
    return;
  }
  drawRound(game, rng, cup, r + 1, through);
}

/** Play every unplayed tie in a round (the user's included), then move the cup on. */
export function playCupRound(game: GameState, rng: Rng, cup: CupState, r: number) {
  if (isEuroId(cup.id)) return playEuroRound(game, rng, cup, r);
  const round = cup.rounds[r];
  for (const tie of round.ties) {
    if (tie.result) continue;
    tie.result = playMatch(game, rng, tie.homeId, tie.awayId, { knockout: true, neutral: tie.neutral, compId: cup.id });
    settleTie(game, cup, tie);
  }
  finishRound(game, rng, cup, r);
}

/** Rounds that are due on or before the given week and day, earliest first. */
function dueRounds(game: GameState, week: number, day: number) {
  const due: { cup: CupState; r: number; round: CupRound }[] = [];
  for (const cup of allCups(game)) {
    cup.rounds.forEach((round, r) => {
      if (round.drawn && !round.played && (round.week < week || (round.week === week && round.day <= day))) due.push({ cup, r, round });
    });
  }
  return due.sort((a, b) => a.round.week - b.round.week || a.round.day - b.round.day);
}

/** Catch up on any cup rounds that are due (used when skipping through days). */
export function playDueCupRounds(game: GameState, week: number, day: number) {
  withRng(game, (rng) => {
    for (let guard = 0; guard < 50; guard++) {
      const next = dueRounds(game, week, day)[0];
      if (!next) return;
      recoverTo(game, next.round.week * 7 + next.round.day);
      playCupRound(game, rng, next.cup, next.r);
    }
  });
}

/** Today's cup rounds (by the calendar), not yet played. */
export function cupRoundsToday(game: GameState) {
  return dueRounds(game, game.week, game.day ?? 0).filter((x) => x.round.week === game.week && x.round.day === game.day);
}

export function userTieToday(game: GameState): CupTie | undefined {
  for (const { round } of cupRoundsToday(game)) {
    const tie = round.ties.find((t) => !t.result && (t.homeId === game.userClubId || t.awayId === game.userClubId));
    if (tie) return tie;
  }
  return undefined;
}

/** All of the user's cup ties this season, drawn so far. */
export function userCupTies(game: GameState): CupTie[] {
  return allCups(game).flatMap((c) => c.rounds.flatMap((r) => r.ties)).filter((t) => t.homeId === game.userClubId || t.awayId === game.userClubId);
}

export function isCupTie(f: { divisionId: string } | CupTie): f is CupTie {
  return 'cupId' in f;
}

/** After the user's tie is played live: the rest of the round, then the next draw. */
export function completeUserCupTie(game: GameState, tie: CupTie) {
  if (isEuroId(tie.cupId)) return completeUserEuroTie(game, tie);
  const cup = game.cups!.find((c) => c.id === tie.cupId)!;
  settleTie(game, cup, tie);
  withRng(game, (rng) => playCupRound(game, rng, cup, tie.round));
}

export function roundOf(game: GameState, tie: CupTie): CupRound {
  return allCups(game).find((c) => c.id === tie.cupId)!.rounds[tie.round];
}

/** League champions add their title to the trophy cabinet. */
export function awardLeagueTitles(game: GameState, champions: Record<string, string>) {
  for (const div of game.divisions) {
    const club = game.clubs[champions[div.def.id]];
    (club.trophies ??= []).push({ season: game.season, name: div.def.name });
  }
}
