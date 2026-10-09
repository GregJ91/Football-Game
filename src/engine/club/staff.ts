import { COUNTRIES } from '../../data/pyramids';
import { FIRST_NAMES, LAST_NAMES } from '../../data/names';
import { roundMoney } from '../players/ratings';
import { Rng } from '../rng';
import type { Club, GameState, StaffMember, StaffRole } from '../types';
import { divisionOf } from '../world';

export const STAFF_ROLES: StaffRole[] = ['assistant', 'coach', 'scout', 'physio'];

export const STAFF_INFO: Record<StaffRole, { name: string; effect: string }> = {
  assistant: { name: 'Assistant manager', effect: 'Keeps the squad happy: better morale, fewer grumbles about playing time.' },
  coach: { name: 'Coach', effect: 'Players develop faster.' },
  scout: { name: 'Chief scout', effect: 'More scout reports each week, and they come back sooner.' },
  physio: { name: 'Physio', effect: 'Shorter injuries and fewer knocks in training.' },
};

/** A neutral rating: no better or worse than an AI club's backroom. */
const NEUTRAL = 10;

/** A staff member's rating, or neutral if the post is empty or it's an AI club. */
export function staffRating(club: Club, role: StaffRole): number {
  if (!club.isUser) return NEUTRAL;
  return club.staff?.[role]?.rating ?? 5;
}

/** Typical staff rating at a level: the top flight hires the best. */
function levelRating(level: number) {
  return 6 + (8 - level) * 1.5;
}

/**
 * The English level whose staff pay a division matches, by how good the
 * league is: the Highland League pays like England's bottom level, not like
 * the National League that shares its level number.
 */
function payLevel(game: GameState, level: number): number {
  if (game.country === 'eng') return level;
  const quality = COUNTRIES[game.country].divisions.find((d) => d.level === level)?.quality ?? 45;
  return COUNTRIES.eng.divisions.reduce((best, d) => (Math.abs(d.quality - quality) < Math.abs(best.quality - quality) ? d : best)).level;
}

/** What a member of staff of this rating costs at this level, per week. */
export function staffWage(rating: number, level: number): number {
  // Part-time staff in non-league: much cheaper.
  const scale = [0, 4, 2, 1.4, 1, 0.5, 0.25, 0.15][level] ?? 0.15;
  return roundMoney(120 * Math.pow(1.25, rating) * scale);
}

function person(rng: Rng, rating: number, level: number): StaffMember {
  const r = Math.max(1, Math.min(20, Math.round(rating)));
  return { name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, rating: r, wage: staffWage(r, level) };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A backroom team typical of the club's level (new games and new jobs). */
export function hireInitialStaff(game: GameState, club: Club) {
  const level = divisionOf(game, club.id).def.level;
  const rng = new Rng(hash(`${game.seed}:${club.id}:staff`));
  club.staff = Object.fromEntries(STAFF_ROLES.map((role) => [role, person(rng, levelRating(level) - 1 + rng.normal() * 1.5, payLevel(game, level))]));
}

/** This month's shortlist for a post: four candidates, the same all month. */
export function staffCandidates(game: GameState, role: StaffRole): StaffMember[] {
  const club = game.clubs[game.userClubId];
  const level = divisionOf(game, club.id).def.level;
  const rng = new Rng(hash(`${game.seed}:${game.season}:${Math.floor(game.week / 4)}:${role}`));
  const base = levelRating(level);
  // One bargain, a couple at the level, and one ambitious (and pricey) option.
  return [base - 3, base, base + 1, base + 4]
    .map((r) => person(rng, r + rng.normal() * 1.5, payLevel(game, level)))
    .sort((a, b) => b.rating - a.rating);
}

/** Hire a candidate from the shortlist; whoever held the post leaves. */
export function hireStaff(game: GameState, role: StaffRole, index: number): string | null {
  const club = game.clubs[game.userClubId];
  const pick = staffCandidates(game, role)[index];
  if (!pick) return 'That candidate is no longer available.';
  if (club.staff?.[role]?.name === pick.name) return 'He already works for you.';
  club.staff = { ...club.staff, [role]: pick };
  return null;
}

export function staffWages(club: Club): number {
  return STAFF_ROLES.reduce((n, r) => n + (club.staff?.[r]?.wage ?? 0), 0);
}

// ---------------------------------------------------------------- effects

/** Extra yearly development from the coach (−0.7 to +0.8). */
export function coachBonus(club: Club): number {
  return club.isUser ? (staffRating(club, 'coach') - NEUTRAL) * 0.08 : 0;
}

/** Injury length and training-knock multiplier from the physio (1.2 to 0.75). */
export function physioFactor(club: Club): number {
  return club.isUser ? 1 - (staffRating(club, 'physio') - NEUTRAL) * 0.025 : 1;
}

/** Scout reports per week: 5 with a modest scout, up to 8 with the best. */
export function scoutReportsPerWeek(club: Club): number {
  return 4 + Math.ceil(staffRating(club, 'scout') / 5);
}

/** Days a scout report takes: quicker with a good scout. */
export function scoutDays(club: Club, playerId: string): number {
  const base = 2 + (playerId.charCodeAt(playerId.length - 1) % 3);
  const r = staffRating(club, 'scout');
  return Math.max(1, base + (r >= 15 ? -1 : r <= 6 ? 1 : 0));
}

/** The assistant's weekly lift (or drag) on squad morale. */
export function assistantMorale(club: Club): number {
  return (staffRating(club, 'assistant') - NEUTRAL) * 0.15;
}

/** How hard playing-time grievances bite (0.6 with a great assistant, 1.36 with a poor one). */
export function grievanceFactor(club: Club): number {
  return 1 - (staffRating(club, 'assistant') - NEUTRAL) * 0.04;
}
