import { EURO_COMPS } from '../../data/europe';
import { MATCHDAY, dateIn } from '../calendar';
import { boardOf } from '../club/chairman';
import { playerName } from '../players/generate';
import { canPlay } from '../players/ratings';
import type { AwardWinner, BallonDorPlace, DivisionAwards, GameState, MatchResult, MonthlyAwards, Player, Position, SeasonSummary, YearAwards } from '../types';
import { addInbox } from '../transfers/market';
import { squadOf, withRng } from '../world';
import { nationOf } from './europe';

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

function awardsOf(game: GameState) {
  game.awards ??= { monthly: [], history: [] };
  return game.awards;
}

// ---------------------------------------------------------------- monthly

const monthOf = (game: GameState, week: number) => dateIn(game.season, week, MATCHDAY).getUTCMonth();

/** Is this week's matchday the last of its calendar month (or of the season)? */
export function monthEnds(game: GameState): boolean {
  return game.week >= game.totalWeeks - 1 || monthOf(game, game.week) !== monthOf(game, game.week + 1);
}

const monthAvg = (p: Player) => (p.monthStats?.apps ? p.monthStats.ratingSum / p.monthStats.apps : 0);
/** Form over the month: average rating, plus a little for goals and assists. */
const monthScore = (p: Player) => monthAvg(p) + (p.monthStats?.goals ?? 0) * 0.08 + (p.monthStats?.assists ?? 0) * 0.04;

/**
 * End of a calendar month: Player, Young Player and Manager of the Month in
 * every division. Then everyone's monthly stats start again.
 */
export function monthlyAwards(game: GameState) {
  const awards = awardsOf(game);
  if (game.week === 0 || awards.monthly.some((m) => m.season !== game.season)) awards.monthly = awards.monthly.filter((m) => m.season === game.season);
  const month = dateIn(game.season, game.week, MATCHDAY).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthIdx = monthOf(game, game.week);
  const user = game.userClubId;
  const news: string[] = [];
  for (const div of game.divisions) {
    const players = divisionPlayers(game, div.clubIds).filter(({ p }) => (p.monthStats?.apps ?? 0) >= 2);
    if (!players.length) continue;
    const best = (list: typeof players) => [...list].sort((a, b) => monthScore(b.p) - monthScore(a.p))[0];
    const entry: MonthlyAwards = { season: game.season, month, divisionId: div.def.id };
    const pom = best(players);
    if (pom) entry.player = winner(pom.p, pom.clubId, monthAvg(pom.p));
    const young = best(players.filter(({ p }) => p.age <= 21));
    if (young) entry.young = winner(young.p, young.clubId, monthAvg(young.p));
    // Manager of the Month: most league points this month (then goal difference).
    const table = new Map<string, { points: number; played: number; gd: number }>();
    for (const f of game.fixtures) {
      if (f.divisionId !== div.def.id || !f.result || monthOf(game, f.week) !== monthIdx || f.week > game.week) continue;
      const { homeGoals: h, awayGoals: a } = f.result;
      for (const [id, us, them] of [[f.homeId, h, a], [f.awayId, a, h]] as const) {
        const row = table.get(id) ?? { points: 0, played: 0, gd: 0 };
        row.played++;
        row.gd += us - them;
        row.points += us > them ? 3 : us === them ? 1 : 0;
        table.set(id, row);
      }
    }
    const top = [...table.entries()].sort((a, b) => b[1].points - a[1].points || b[1].gd - a[1].gd)[0];
    if (top) entry.manager = { clubId: top[0], clubName: game.clubs[top[0]].name, points: top[1].points, played: top[1].played };
    awards.monthly.push(entry);

    if (entry.manager?.clubId === user && !game.unemployed) {
      news.push(`you're Manager of the Month (${entry.manager.points} points from ${entry.manager.played} games)`);
      const board = boardOf(game.clubs[user]);
      board.confidence = Math.min(100, board.confidence + 2);
      board.fans = Math.min(100, board.fans + 2);
    }
    if (entry.player?.clubId === user) news.push(`${entry.player.name} is Player of the Month`);
    if (entry.young?.clubId === user && entry.young.playerId !== entry.player?.playerId) news.push(`${entry.young.name} is Young Player of the Month`);
  }
  if (news.length) addInbox(game, 'info', `${month} awards: ${news.join(', and ')}.`, { category: 'club', subject: `${month.split(' ')[0]} awards` });
  for (const id in game.players) game.players[id].monthStats = undefined;
}

// ---------------------------------------------------------------- the year's big awards

/** Season form for the big awards: average rating with a little for goals and assists. */
const seasonScore = (p: Player) => avg(p) + p.seasonStats.goals * 0.03 + p.seasonStats.assists * 0.015;

/**
 * The Ballon d'Or: the best players in the country's top flight against the
 * stars of the leading foreign clubs, judged on ability, form, goals and
 * what their clubs won.
 */
function ballonDor(game: GameState, summary: SeasonSummary): BallonDorPlace[] {
  const top = game.divisions.find((d) => d.def.level === 1)!;
  const comps = game.europe?.comps ?? [];
  const euroBonus = (clubId: string) => {
    let bonus = 0;
    for (const c of comps) {
      const weight = c.id === EURO_COMPS[0].id ? 1 : c.id === EURO_COMPS[1].id ? 0.4 : 0.2;
      const final = c.rounds.at(-1)?.ties[0];
      if (c.winnerId === clubId) bonus += 6 * weight;
      else if (final && (final.homeId === clubId || final.awayId === clubId)) bonus += 2 * weight;
    }
    return bonus;
  };
  const places: BallonDorPlace[] = [];
  // Home-grown candidates: the top flight's best regulars.
  for (const clubId of top.clubIds) {
    for (const p of squadOf(game, clubId)) {
      if (p.seasonStats.apps < 15 || p.overall < 75) continue;
      const domestic = summary.champions[top.def.id] === clubId ? 3 : 0;
      const score = p.overall + (avg(p) - 6.5) * 6 + p.seasonStats.goals * 0.12 + p.seasonStats.assists * 0.06 + domestic + euroBonus(clubId);
      places.push({ playerId: p.id, name: playerName(p), clubId, clubName: game.clubs[clubId].name, nation: nationOf(game, clubId), score });
    }
  }
  // Abroad: the stars of the strongest foreign clubs and anyone who reached a European final.
  const foreign = (game.europe?.foreignIds ?? [])
    .map((id) => game.clubs[id])
    .sort((a, b) => b.foreign!.strength - a.foreign!.strength);
  const finalists = new Set(comps.flatMap((c) => (c.rounds.at(-1)?.ties ?? []).flatMap((t) => [t.homeId, t.awayId])));
  const contenders = [...new Set([...foreign.slice(0, 12), ...foreign.filter((c) => finalists.has(c.id))])];
  withRng(game, (rng) => {
    for (const club of contenders) {
      const champions = foreign.find((c) => c.foreign!.nation === club.foreign!.nation) === club ? 3 : 0;
      for (const p of squadOf(game, club.id).sort((a, b) => b.overall - a.overall).slice(0, 3)) {
        const attacking = p.position === 'ST' || p.position === 'AMC';
        const goals = attacking ? Math.max(0, Math.round((p.overall - 70) * 1.3 + rng.normal() * 4)) : Math.round(rng.next() * 6);
        const form = (p.overall - 78) * 0.04 + rng.normal() * 0.25;
        const score = p.overall + form * 6 + goals * 0.12 + champions + euroBonus(club.id);
        places.push({ playerId: p.id, name: playerName(p), clubId: club.id, clubName: club.name, nation: club.foreign!.nation, score });
      }
    }
  });
  return places.sort((a, b) => b.score - a.score).slice(0, 10).map((p) => ({ ...p, score: Math.round(p.score * 10) / 10 }));
}

/** Player and Young Player of the Year, and the Golden Boot: the top flight's best. */
function yearAwards(game: GameState, summary: SeasonSummary): YearAwards {
  const top = game.divisions.find((d) => d.def.level === 1)!;
  const leagueGames = (top.clubIds.length - 1) * top.def.rounds;
  const regulars = divisionPlayers(game, top.clubIds).filter(({ p }) => p.seasonStats.apps >= leagueGames * 0.5);
  const best = (list: typeof regulars) => [...list].sort((a, b) => seasonScore(b.p) - seasonScore(a.p))[0];
  const poy = best(regulars);
  const ypoy = best(regulars.filter(({ p }) => p.age <= 21));
  return {
    season: game.season,
    ballonDor: ballonDor(game, summary),
    playerOfYear: poy && winner(poy.p, poy.clubId, avg(poy.p)),
    youngPlayerOfYear: ypoy && winner(ypoy.p, ypoy.clubId, avg(ypoy.p)),
    goldenBoot: summary.awards?.[top.def.id]?.topScorer,
  };
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
  const year = yearAwards(game, summary);
  awardsOf(game).history.push(year);
  const yearNote = (label: string, w?: AwardWinner) => {
    if (w?.clubId === user) honours.push(`${w.name}: ${label}`);
  };
  yearNote("Players' Player of the Year", year.playerOfYear);
  yearNote("Young Players' Player of the Year", year.youngPlayerOfYear);
  if (honours.length) addInbox(game, 'info', `Awards for our players: ${honours.join('; ')}.`, { category: 'club', subject: 'Season awards' });
  const [first, second, third] = year.ballonDor;
  if (first) {
    const ours = year.ballonDor.findIndex((b) => b.clubId === user);
    addInbox(game, 'info', `Ballon d'Or: ${first.name} (${first.clubName}) wins, ahead of ${second?.name ?? '–'} and ${third?.name ?? '–'}.${ours >= 0 ? ` Our ${year.ballonDor[ours].name} finished ${ours + 1}${['st', 'nd', 'rd'][ours] ?? 'th'}!` : ''}`, {
      category: 'club',
      subject: "Ballon d'Or",
    });
  }
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
