import { staffRating } from '../club/staff';
import { challengeSigningRule } from '../club/challenge';
import { playerName } from '../players/generate';
import type { Rng } from '../rng';
import type { GameState, Player, ScoutMission, ScoutRegion, ScoutReport, ScoutVerdict } from '../types';
import { leagueNameOf, newId, playerById, squadOf } from '../world';
import { addInbox, askingPrice, interestIn, potentialStars } from './market';

/** Most scouting missions out at once. */
export const MAX_MISSIONS = 2;

export const VERDICT_TEXT: Record<ScoutVerdict, string> = {
  star: 'Would walk into your first team.',
  starter: 'Would challenge for a starting place.',
  squad: 'A useful squad player.',
  no: 'Not good enough for us right now.',
};

export const INTEREST_TEXT = {
  keen: 'He would be keen to join.',
  open: 'He is open to a move.',
  reluctant: 'He would be reluctant to join.',
  no: 'He would only drop to our level for a very big wage.',
} as const;

export const REGION_LABEL: Record<ScoutRegion, string> = {
  any: 'Anywhere',
  home: 'Home leagues',
  abroad: 'Abroad',
  free: 'Free agents',
};

function today(game: GameState) {
  return game.week * 7 + (game.day ?? 1);
}

/** How a player compares with the best you have in his position. */
export function verdictOf(game: GameState, p: Player): ScoutVerdict {
  const best = Math.max(0, ...squadOf(game, game.userClubId).filter((x) => x.position === p.position).map((x) => x.overall));
  const diff = p.overall - best;
  if (diff >= 4) return 'star';
  if (diff >= -1) return 'starter';
  if (diff >= -6) return 'squad';
  return 'no';
}

/** File a report on a player: he's now known, and the report is kept. */
export function recordReport(game: GameState, p: Player, mission?: string): ScoutReport {
  const club = game.clubs[game.userClubId];
  const report: ScoutReport = {
    season: game.season,
    week: game.week,
    ability: p.overall,
    potential: potentialStars(p),
    verdict: verdictOf(game, p),
    interest: interestIn(game, club, p),
    price: p.clubId ? askingPrice(game, p) : 0,
    mission,
  };
  club.scouted = { ...club.scouted, [p.id]: true };
  club.scoutReports = { ...club.scoutReports, [p.id]: report };
  return report;
}

/** One line on a report, for the inbox. */
export function reportText(game: GameState, p: Player, r: ScoutReport): string {
  const where = p.clubId ? `${game.clubs[p.clubId].name} (${leagueNameOf(game, p.clubId)})` : 'a free agent';
  const price = r.price ? ` Expect to pay around £${Math.round(r.price / 1000)}k.` : '';
  return `${playerName(p)}, ${p.age}, ${p.position} at ${where}. Ability ${r.ability}, potential ${'★'.repeat(r.potential)}. ${VERDICT_TEXT[r.verdict]} ${INTEREST_TEXT[r.interest]}${price}`;
}

/** Every report the club holds, newest first, for players still in the game. */
export function scoutReports(game: GameState): { p: Player; r: ScoutReport }[] {
  const club = game.clubs[game.userClubId];
  return Object.entries(club.scoutReports ?? {})
    .map(([id, r]) => ({ p: playerById(game, id), r }))
    .filter((x): x is { p: Player; r: ScoutReport } => !!x.p && x.p.clubId !== club.id)
    .sort((a, b) => b.r.season - a.r.season || b.r.week - a.r.week || b.r.ability - a.r.ability);
}

// ---------------------------------------------------------------- missions

/** Days a mission takes: about a week, less with a good scout. */
export function missionDays(game: GameState): number {
  const r = staffRating(game.clubs[game.userClubId], 'scout');
  return 6 + (r >= 15 ? -2 : r >= 10 ? -1 : r <= 5 ? 1 : 0);
}

/** How many players a mission comes back with (4 to 6). */
export function missionFinds(game: GameState): number {
  return 3 + Math.ceil(staffRating(game.clubs[game.userClubId], 'scout') / 7);
}

export type MissionBrief = Omit<ScoutMission, 'id' | 'dueDay'>;

/** Why a mission can't go out, or null. */
export function cannotSendMission(game: GameState): string | null {
  if ((game.scoutMissions ?? []).length >= MAX_MISSIONS) return `Your scouts are already on ${MAX_MISSIONS} missions.`;
  if ((game.scoutReportsLeft ?? 0) <= 0) return 'No scouts free this week.';
  return null;
}

/** Send the scouts out on a brief. Uses one of the week's reports. */
export function sendMission(game: GameState, brief: MissionBrief): string | null {
  const problem = cannotSendMission(game);
  if (problem) return problem;
  game.scoutReportsLeft = (game.scoutReportsLeft ?? 0) - 1;
  const id = newId(game, 'm');
  (game.scoutMissions ??= []).push({ ...brief, id, dueDay: today(game) + missionDays(game) });
  return null;
}

export function missionLabel(m: MissionBrief): string {
  const pos = m.position === 'ANY' ? 'Players' : m.position === 'GK' ? 'Goalkeepers' : `${m.position}s`;
  const age = m.maxAge < 99 ? ` aged ${m.maxAge} or under` : '';
  const value = m.maxValue ? ` worth up to £${m.maxValue >= 1e6 ? `${m.maxValue / 1e6}m` : `${m.maxValue / 1000}k`}` : '';
  return `${pos}${age}${value} · ${REGION_LABEL[m.region]}`;
}

function inRegion(game: GameState, p: Player, region: ScoutRegion): boolean {
  if (region === 'any') return true;
  if (region === 'free') return !p.clubId;
  const abroad = !!p.clubId && !!game.clubs[p.clubId].foreign;
  return region === 'abroad' ? abroad : !!p.clubId && !abroad;
}

/**
 * Who the scouts come back with: the best players who fit the brief and
 * might actually come. A poor scout's judgement is rougher, so he sometimes
 * misses the best man and brings back a lesser one.
 */
export function missionShortlist(game: GameState, rng: Rng, m: MissionBrief, count: number): Player[] {
  const club = game.clubs[game.userClubId];
  const noise = Math.max(0.5, (20 - staffRating(club, 'scout')) / 4);
  const pool: { p: Player; score: number }[] = [];
  for (const p of [...Object.values(game.players), ...Object.values(game.europe?.players ?? {})]) {
    if (p.clubId === club.id || club.scoutReports?.[p.id]) continue;
    if (m.position !== 'ANY' && !p.positions.includes(m.position)) continue;
    if (p.age > m.maxAge) continue;
    if (m.maxValue && p.value > m.maxValue) continue;
    if (!inRegion(game, p, m.region)) continue;
    if (challengeSigningRule(game, p)) continue;
    const growth = p.age <= 21 ? Math.max(0, p.potential - p.overall) * 0.35 : 0;
    pool.push({ p, score: p.overall + growth + rng.normal() * noise });
  }
  pool.sort((a, b) => b.score - a.score);
  const out: Player[] = [];
  for (const { p } of pool) {
    if (out.length >= count) break;
    // No point reporting on a player who would never come.
    if (interestIn(game, club, p) === 'no') continue;
    if (m.maxValue && p.clubId && askingPrice(game, p) > m.maxValue * 1.5) continue;
    out.push(p);
  }
  return out;
}

/** Missions that are due come back with their reports. */
export function deliverMissions(game: GameState, rng: Rng, all = false) {
  const now = today(game);
  const due = (game.scoutMissions ?? []).filter((m) => all || m.dueDay <= now);
  if (!due.length) return;
  game.scoutMissions = (game.scoutMissions ?? []).filter((m) => !due.includes(m));
  for (const m of due) {
      const found = missionShortlist(game, rng, m, missionFinds(game));
      const lines = found.map((p) => {
        const r = recordReport(game, p, m.id);
        return `${playerName(p)} (${p.age}, ${p.position}, ${p.clubId ? game.clubs[p.clubId].name : 'free agent'}): ability ${r.ability}, ${'★'.repeat(r.potential)}`;
      });
      addInbox(
        game,
        'info',
        found.length
          ? `Mission done: ${missionLabel(m)}. We watched ${found.length}: ${lines.join('; ')}. Full reports are in Transfers → Scouting.`
          : `Mission done: ${missionLabel(m)}. Nobody fits that brief who would come to us. Try a wider search.`,
        { category: 'scouting', subject: `Scouting mission: ${found.length} found` },
      );
  }
}

// ---------------------------------------------------------------- shortlist

export function isShortlisted(game: GameState, playerId: string): boolean {
  return !!game.clubs[game.userClubId].shortlist?.includes(playerId);
}

export function toggleShortlist(game: GameState, playerId: string) {
  const club = game.clubs[game.userClubId];
  const list = club.shortlist ?? [];
  club.shortlist = list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId];
}

/** The shortlist, dropping anyone who has retired or joined you. */
export function shortlistPlayers(game: GameState): Player[] {
  const club = game.clubs[game.userClubId];
  return (club.shortlist ?? []).map((id) => playerById(game, id)).filter((p): p is Player => !!p && p.clubId !== club.id);
}
