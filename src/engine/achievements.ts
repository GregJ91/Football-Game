import { COUNTRIES } from '../data/pyramids';
import { careerOf } from './club/career';
import { seasonsSurvived } from './club/challenge';
import { MAX_FACILITY, facilitiesOf } from './club/facilities';
import { managerOf, teamTrophies } from './club/manager';
import { foodLevel, vipLevel } from './club/matchday';
import { stadiumOf, totalCapacity } from './club/stadium';
import type { GameState } from './types';

/**
 * Achievements: milestones across every career, kept on the device (not in
 * the save), shown on the home screen. Testing aids don't earn them.
 */

export type AchievementCategory = 'Career' | 'Climbing the pyramid' | 'Silverware' | 'Europe' | 'Big moments' | 'Players and transfers' | 'Chairman' | 'Challenges';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
}

/** One season of the user's, at whichever club he was managing. */
interface CareerSeason {
  clubId: string;
  season: number;
  level: number;
  position: number;
  outcome: 'champions' | 'promoted' | 'relegated' | 'stayed';
}

interface Ctx {
  game: GameState;
  seasons: CareerSeason[];
  trophies: { season: number; name: string; clubName: string }[];
  promotions: number;
}

const levelOfDivision = (game: GameState, id: string) => COUNTRIES[game.country].divisions.find((d) => d.id === id)?.level ?? 99;

function careerSeasons(game: GameState): CareerSeason[] {
  const out: CareerSeason[] = [];
  for (const s of careerOf(game)) {
    const club = game.clubs[s.clubId];
    if (!club) continue;
    for (const h of club.history) {
      if (h.season < s.from || (s.to !== undefined && h.season > s.to)) continue;
      out.push({ clubId: s.clubId, season: h.season, level: levelOfDivision(game, h.divisionId), position: h.position, outcome: h.outcome });
    }
  }
  return out.sort((a, b) => a.season - b.season);
}

/** Seasons that ended with the club going up a level (the next season one level higher). */
function promotionSeasons(game: GameState, seasons: CareerSeason[]): number[] {
  const out: number[] = [];
  for (const s of seasons) {
    const next = seasons.find((x) => x.clubId === s.clubId && x.season === s.season + 1);
    const nowHigher = next ? next.level < s.level : game.userClubId === s.clubId && game.season === s.season + 1 && currentLevel(game) < s.level;
    if (nowHigher) out.push(s.season);
  }
  return out;
}

function currentLevel(game: GameState): number {
  if (game.unemployed) return 99;
  const div = game.divisions.find((d) => d.clubIds.includes(game.userClubId));
  return div?.def.level ?? 99;
}

const has = (c: Ctx, f: (t: { name: string }) => boolean) => c.trophies.some(f);
const honour = (c: Ctx, f: (name: string) => boolean) => managerOf(c.game).honours.some((h) => f(h.name));
const topName = (game: GameState) => COUNTRIES[game.country].divisions.find((d) => d.level === 1)!.name;
const nationalCup = (game: GameState) => (game.country === 'eng' ? 'FA Cup' : 'Scottish Cup');
const leagueNames = (game: GameState) => new Set(COUNTRIES[game.country].divisions.map((d) => d.name));

/** The user's last finished league season, if it's the one just played. */
function lastLeagueRow(game: GameState) {
  const s = game.lastSummary;
  if (!s || game.unemployed) return null;
  for (const [, table] of Object.entries(s.finalTables)) {
    const row = table.find((r) => r.clubId === game.userClubId);
    if (row) return row;
  }
  return null;
}

/** Trophies won together in one season. */
function sameSeason(c: Ctx, names: ((n: string) => boolean)[]) {
  const seasons = new Set(c.trophies.map((t) => t.season));
  return [...seasons].some((season) => names.every((f) => c.trophies.some((t) => t.season === season && f(t.name))));
}

const DEFS: (Achievement & { check: (c: Ctx) => boolean })[] = [
  // Career
  { id: 'first-win', category: 'Career', name: 'Off the mark', description: 'Win your first game as a manager.', check: (c) => managerOf(c.game).won >= 1 },
  { id: 'wins-50', category: 'Career', name: 'Half-century', description: 'Win 50 games.', check: (c) => managerOf(c.game).won >= 50 },
  { id: 'wins-250', category: 'Career', name: 'Serial winner', description: 'Win 250 games.', check: (c) => managerOf(c.game).won >= 250 },
  { id: 'games-500', category: 'Career', name: 'Long service', description: 'Manage 500 games.', check: (c) => managerOf(c.game).games >= 500 },
  { id: 'motm', category: 'Career', name: 'Manager of the Month', description: 'Be named Manager of the Month.', check: (c) => honour(c, (n) => n.startsWith('Manager of the Month')) },
  { id: 'mots', category: 'Career', name: 'Manager of the Season', description: 'Win your league and be named Manager of the Season.', check: (c) => honour(c, (n) => n.startsWith('Manager of the Season')) },
  { id: 'head-hunted', category: 'Career', name: 'Head-hunted', description: 'Take a job offer from another club.', check: (c) => careerOf(c.game).some((s) => s.left === 'moved') },
  { id: 'comeback', category: 'Career', name: 'Second chance', description: 'Get sacked, then find another job.', check: (c) => !c.game.unemployed && careerOf(c.game).some((s) => s.left === 'sacked') },

  // Climbing the pyramid
  { id: 'promoted', category: 'Climbing the pyramid', name: 'Going up', description: 'Win promotion.', check: (c) => c.promotions >= 1 },
  { id: 'promoted-3', category: 'Climbing the pyramid', name: 'On the rise', description: 'Win promotion three times.', check: (c) => c.promotions >= 3 },
  { id: 'back-to-back', category: 'Climbing the pyramid', name: 'Back-to-back', description: 'Win promotion in two seasons running.', check: (c) => { const p = promotionSeasons(c.game, c.seasons); return p.some((s) => p.includes(s + 1)); } },
  { id: 'league-two', category: 'Climbing the pyramid', name: 'Senior football', description: 'Reach League Two (level 4).', check: (c) => currentLevel(c.game) <= 4 || c.seasons.some((s) => s.level <= 4) },
  { id: 'top-flight', category: 'Climbing the pyramid', name: 'The big time', description: 'Reach the top flight.', check: (c) => currentLevel(c.game) === 1 || c.seasons.some((s) => s.level === 1) },
  { id: 'bottom-to-top', category: 'Climbing the pyramid', name: 'From the bottom', description: 'Start at the bottom of the pyramid and reach the top flight with the same club.', check: (c) => {
    const bottom = Math.max(...COUNTRIES[c.game.country].divisions.map((d) => d.level));
    const first = c.seasons[0];
    return !!first && first.level === bottom && (c.seasons.some((s) => s.clubId === first.clubId && s.level === 1) || (c.game.userClubId === first.clubId && currentLevel(c.game) === 1));
  } },

  // Silverware
  { id: 'first-trophy', category: 'Silverware', name: 'Silverware', description: 'Win a trophy.', check: (c) => c.trophies.length >= 1 },
  { id: 'champions', category: 'Silverware', name: 'Champions', description: 'Win a league title.', check: (c) => has(c, (t) => leagueNames(c.game).has(t.name)) },
  { id: 'top-title', category: 'Silverware', name: 'Top of the pyramid', description: 'Win the top-flight title.', check: (c) => has(c, (t) => t.name === topName(c.game)) },
  { id: 'national-cup', category: 'Silverware', name: 'Cup final hero', description: 'Win the FA Cup or the Scottish Cup.', check: (c) => has(c, (t) => t.name === nationalCup(c.game)) },
  { id: 'double', category: 'Silverware', name: 'The Double', description: 'Win the top-flight title and the national cup in the same season.', check: (c) => sameSeason(c, [(n) => n === topName(c.game), (n) => n === nationalCup(c.game)]) },
  { id: 'treble', category: 'Silverware', name: 'The Treble', description: 'Win the top-flight title, the national cup and the Champions League in the same season.', check: (c) => sameSeason(c, [(n) => n === topName(c.game), (n) => n === nationalCup(c.game), (n) => n === 'Champions League']) },
  { id: 'trophies-10', category: 'Silverware', name: 'Trophy cabinet', description: 'Win 10 trophies.', check: (c) => c.trophies.length >= 10 },

  // Europe
  { id: 'europe', category: 'Europe', name: 'European nights', description: 'Qualify for a European competition.', check: (c) => !c.game.unemployed && !!c.game.europe?.entries.some((e) => e.clubId === c.game.userClubId) },
  { id: 'ucl', category: 'Europe', name: 'Champions of Europe', description: 'Win the Champions League.', check: (c) => has(c, (t) => t.name === 'Champions League') },
  { id: 'uel', category: 'Europe', name: 'Europa League winners', description: 'Win the Europa League.', check: (c) => has(c, (t) => t.name === 'Europa League') },
  { id: 'uecl', category: 'Europe', name: 'Conference League winners', description: 'Win the Conference League.', check: (c) => has(c, (t) => t.name === 'Conference League') },
  { id: 'super-cup', category: 'Europe', name: 'Super Cup', description: 'Win the UEFA Super Cup.', check: (c) => has(c, (t) => t.name === 'UEFA Super Cup') },

  // Big moments
  { id: 'thrashing', category: 'Big moments', name: 'Thrashing', description: 'Win a game by six goals or more.', check: (c) => careerOf(c.game).some((s) => (c.game.clubs[s.clubId]?.records?.biggestWin?.margin ?? 0) >= 6) },
  { id: 'invincibles', category: 'Big moments', name: 'Invincibles', description: 'Go a whole league season unbeaten.', check: (c) => { const r = lastLeagueRow(c.game); return !!r && r.played >= 20 && r.lost === 0; } },
  { id: 'centurions', category: 'Big moments', name: 'Centurions', description: 'Score 100 points in a league season.', check: (c) => (lastLeagueRow(c.game)?.points ?? 0) >= 100 },

  // Players and transfers
  { id: 'million-signing', category: 'Players and transfers', name: 'Seven figures', description: 'Pay £1m or more for a player.', check: (c) => (managerOf(c.game).biggestSigning?.fee ?? 0) >= 1_000_000 },
  { id: 'big-spender', category: 'Players and transfers', name: 'Big spender', description: 'Pay £50m or more for a player.', check: (c) => (managerOf(c.game).biggestSigning?.fee ?? 0) >= 50_000_000 },
  { id: 'sell-high', category: 'Players and transfers', name: 'Sell high', description: 'Sell a player for £10m or more.', check: (c) => (managerOf(c.game).biggestSale?.fee ?? 0) >= 10_000_000 },
  { id: 'golden-boot', category: 'Players and transfers', name: 'Golden Boot', description: 'One of your players wins a Golden Boot.', check: (c) => honour(c, (n) => n === 'Golden Boot') },
  { id: 'golden-glove', category: 'Players and transfers', name: 'Golden Glove', description: 'One of your keepers wins a Golden Glove.', check: (c) => honour(c, (n) => n.startsWith('Golden Glove')) },
  { id: 'ballon', category: 'Players and transfers', name: "Ballon d'Or", description: "One of your players wins the Ballon d'Or.", check: (c) => honour(c, (n) => n === "Ballon d'Or") },

  // Chairman
  { id: 'ground-5k', category: 'Chairman', name: 'Growing ground', description: 'Build your ground up to 5,000.', check: (c) => userCapacity(c.game) >= 5_000 },
  { id: 'ground-25k', category: 'Chairman', name: 'Big ground', description: 'Build your ground up to 25,000.', check: (c) => userCapacity(c.game) >= 25_000 },
  { id: 'ground-50k', category: 'Chairman', name: 'Cathedral of football', description: 'Build your ground up to 50,000.', check: (c) => userCapacity(c.game) >= 50_000 },
  { id: 'facilities', category: 'Chairman', name: 'State of the art', description: 'Get the training ground, youth academy and medical centre to the top level.', check: (c) => { const f = userFacilities(c.game); return !!f && f.training >= MAX_FACILITY && f.youth >= MAX_FACILITY && f.medical >= MAX_FACILITY; } },
  { id: 'hospitality', category: 'Chairman', name: 'Five-star', description: 'Build bars and restaurants and premium lounges.', check: (c) => { const club = c.game.unemployed ? null : c.game.clubs[c.game.userClubId]; return !!club && foodLevel(club) >= 4 && vipLevel(club) >= 4; } },
  { id: 'millionaire', category: 'Chairman', name: 'Millionaire', description: 'Have £1m in the bank.', check: (c) => !c.game.unemployed && c.game.clubs[c.game.userClubId].balance >= 1_000_000 },

  // Challenges
  { id: 'ch-relegation', category: 'Challenges', name: 'The great escape', description: 'Win Relegation Battlers.', check: (c) => c.game.challenge?.id === 'relegation' && c.game.challenge.status === 'won' },
  { id: 'ch-sack', category: 'Challenges', name: 'Survivor', description: 'Last three seasons in Avoid the Sack.', check: (c) => c.game.challenge?.id === 'sack' && seasonsSurvived(c.game) >= 3 },
  { id: 'ch-kids', category: 'Challenges', name: 'You can win things with kids', description: 'Win promotion in the Kids challenge.', check: (c) => c.game.challenge?.id === 'kids' && c.promotions >= 1 },
  { id: 'ch-embargo', category: 'Challenges', name: 'Against the odds', description: 'Win promotion under a transfer embargo.', check: (c) => c.game.challenge?.id === 'embargo' && c.promotions >= 1 },
  { id: 'ch-old', category: 'Challenges', name: 'Old but gold', description: 'Win promotion in Old But Gold.', check: (c) => c.game.challenge?.id === 'old' && c.promotions >= 1 },
];

function userCapacity(game: GameState) {
  return game.unemployed ? 0 : totalCapacity(stadiumOf(game.clubs[game.userClubId]));
}

function userFacilities(game: GameState) {
  return game.unemployed ? null : facilitiesOf(game.clubs[game.userClubId]);
}

export const ACHIEVEMENTS: Achievement[] = DEFS.map(({ check: _check, ...a }) => a);

/** Testing aids (a top-flight giant, unlimited money, everyone interested) don't earn achievements. */
export function earnsAchievements(game: GameState): boolean {
  return !game.testingStart && !game.settings?.unlimitedMoney && !game.settings?.allInterested;
}

/** Every achievement this game has earned (ids). */
export function earnedAchievements(game: GameState): string[] {
  if (!earnsAchievements(game)) return [];
  const seasons = careerSeasons(game);
  const ctx: Ctx = { game, seasons, trophies: teamTrophies(game), promotions: promotionSeasons(game, seasons).length };
  return DEFS.filter((d) => {
    try {
      return d.check(ctx);
    } catch {
      return false;
    }
  }).map((d) => d.id);
}
