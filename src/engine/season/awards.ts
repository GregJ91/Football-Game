import { playerName } from '../players/generate';
import { canPlay } from '../players/ratings';
import type { AwardWinner, DivisionAwards, GameState, MatchResult, Player, Position, SeasonSummary } from '../types';
import { addInbox } from '../transfers/market';
import { squadOf } from '../world';

const TEAM_SLOTS: Position[] = ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'];

const avg = (p: Player) => (p.seasonStats.apps ? p.seasonStats.ratingSum / p.seasonStats.apps : 0);

function winner(p: Player, clubId: string, value: number, position?: Position): AwardWinner {
  return { playerId: p.id, name: playerName(p), clubId, value: Math.round(value * 100) / 100, position };
}

/** Everyone who played in a division this season, with the club he finished at. */
function divisionPlayers(game: GameState, clubIds: string[]) {
  return clubIds.flatMap((clubId) => squadOf(game, clubId).map((p) => ({ p, clubId })));
}

/**
 * Awards for one division: Player and Young Player of the Season (best
 * average rating, with enough games), the Golden Boot, most assists and a
 * Team of the Season in a 4-4-2.
 */
export function divisionAwards(game: GameState, clubIds: string[], leagueGames: number): DivisionAwards {
  const all = divisionPlayers(game, clubIds);
  const regulars = all.filter(({ p }) => p.seasonStats.apps >= Math.max(5, leagueGames * 0.5));
  const best = (list: typeof all) => [...list].sort((a, b) => avg(b.p) - avg(a.p))[0];
  const most = (key: 'goals' | 'assists') => [...all].sort((a, b) => b.p.seasonStats[key] - a.p.seasonStats[key] || avg(b.p) - avg(a.p))[0];

  const out: DivisionAwards = { team: [] };
  const pots = best(regulars);
  if (pots) out.player = winner(pots.p, pots.clubId, avg(pots.p));
  const young = best(regulars.filter(({ p }) => p.age <= 21));
  if (young) out.young = winner(young.p, young.clubId, avg(young.p));
  const boot = most('goals');
  if (boot && boot.p.seasonStats.goals > 0) out.topScorer = winner(boot.p, boot.clubId, boot.p.seasonStats.goals);
  const assists = most('assists');
  if (assists && assists.p.seasonStats.assists > 0) out.topAssists = winner(assists.p, assists.clubId, assists.p.seasonStats.assists);

  const used = new Set<string>();
  for (const slot of TEAM_SLOTS) {
    const pick = regulars
      .filter(({ p }) => !used.has(p.id) && canPlay(p, slot))
      .sort((a, b) => avg(b.p) - avg(a.p))[0];
    if (!pick) continue;
    used.add(pick.p.id);
    out.team.push(winner(pick.p, pick.clubId, avg(pick.p), slot));
  }
  return out;
}

/** Season end: awards for every division, and the user's players get the news. */
export function seasonAwards(game: GameState, summary: SeasonSummary) {
  summary.awards = {};
  for (const div of game.divisions) {
    const leagueGames = (div.clubIds.length - 1) * div.def.rounds;
    summary.awards[div.def.id] = divisionAwards(game, div.clubIds, leagueGames);
  }
  const user = game.userClubId;
  const mine = summary.awards[game.divisions.find((d) => d.clubIds.includes(user))!.def.id];
  const honours: string[] = [];
  const note = (label: string, w?: AwardWinner) => {
    if (w?.clubId !== user) return;
    honours.push(`${w.name}: ${label}`);
    const p = game.players[w.playerId];
    if (p) p.morale = Math.min(100, p.morale + 10);
    const legend = game.clubs[user].legends?.[w.playerId];
    if (legend) (legend.awards ??= []).push(`${label} ${summary.season}`);
  };
  note('Player of the Season', mine.player);
  note('Young Player of the Season', mine.young);
  note('Golden Boot', mine.topScorer);
  for (const t of mine.team) if (t.clubId === user) honours.push(`${t.name}: Team of the Season`);
  if (honours.length) addInbox(game, 'info', `Awards for our players: ${honours.join('; ')}.`, { category: 'club', subject: 'Season awards' });
}

/** Season end: add this season's appearances and goals to the club's all-time records. */
export function recordLegends(game: GameState) {
  const club = game.clubs[game.userClubId];
  club.legends ??= {};
  for (const p of squadOf(game, club.id)) {
    if (!p.seasonStats.apps || p.loanFrom) continue;
    const l = (club.legends[p.id] ??= { name: playerName(p), position: p.position, apps: 0, goals: 0, from: game.season, to: game.season });
    l.apps += p.seasonStats.apps;
    l.goals += p.seasonStats.goals;
    l.to = game.season;
  }
}

/** After each of the user's matches: biggest win, heaviest defeat, record crowd. */
export function updateClubRecords(game: GameState, homeId: string, awayId: string, r: MatchResult) {
  const user = game.userClubId;
  if (homeId !== user && awayId !== user) return;
  const club = game.clubs[user];
  const records = (club.records ??= {});
  const home = homeId === user;
  const opponent = game.clubs[home ? awayId : homeId].name;
  const us = home ? r.homeGoals : r.awayGoals;
  const them = home ? r.awayGoals : r.homeGoals;
  const margin = us - them;
  const score = `${us}–${them}`;
  if (margin > 0 && (!records.biggestWin || margin > records.biggestWin.margin)) records.biggestWin = { season: game.season, opponent, score, margin };
  if (margin < 0 && (!records.heaviestDefeat || -margin > records.heaviestDefeat.margin)) records.heaviestDefeat = { season: game.season, opponent, score, margin: -margin };
  if (home && (!records.recordAttendance || r.attendance > records.recordAttendance.attendance)) records.recordAttendance = { season: game.season, opponent, attendance: r.attendance };
}

/** The current top scorers in a division (for the League screen). */
export function topScorers(game: GameState, clubIds: string[], count = 10) {
  return divisionPlayers(game, clubIds)
    .filter(({ p }) => p.seasonStats.goals > 0)
    .sort((a, b) => b.p.seasonStats.goals - a.p.seasonStats.goals || a.p.seasonStats.apps - b.p.seasonStats.apps)
    .slice(0, count);
}
