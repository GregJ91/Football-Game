import { partDevelopment, partInjuries } from './trainingGround';
import { ledgerOf } from '../economy/finance';
import { coachBonus, physioFactor } from './staff';
import type { Club, FacilityKind, GameState } from '../types';
import { cannotBuild, stadiumOf } from './stadium';

export const MAX_FACILITY = 5;

export const FACILITY_INFO: Record<FacilityKind, { name: string; effect: string }> = {
  training: { name: 'Training ground', effect: 'Young players develop faster.' },
  youth: { name: 'Youth academy', effect: 'Better and more youngsters each summer.' },
  medical: { name: 'Medical centre', effect: 'Injured players recover sooner.' },
};

/** What the training ground actually is at each level. */
export const TRAINING_LEVEL_NAMES = [
  '',
  'A council pitch, hired two nights a week',
  'Our own training pitch',
  'A proper training ground',
  'A training centre with several pitches',
  'An elite training complex',
];

export function facilitiesOf(club: Club): Record<FacilityKind, number> {
  club.facilities ??= { training: 1, youth: 1, medical: 1 };
  return club.facilities;
}

export function facilityUpgrade(game: GameState, level: number) {
  const k = game.country === 'eng' ? 1 : 0.6;
  return { cost: Math.round(8000 * level * level * k), weeks: 4 + 2 * level, upkeep: facilityUpkeep(level) };
}

/** Weekly running cost of a facility at `level`. */
export function facilityUpkeep(level: number) {
  return 80 * (level - 1) * (level - 1);
}

export function totalUpkeep(club: Club) {
  const f = facilitiesOf(club);
  return facilityUpkeep(f.training) + facilityUpkeep(f.youth) + facilityUpkeep(f.medical);
}

/** This facility is already being upgraded (others can be upgraded alongside). */
export function facilityBusy(club: Club, kind: FacilityKind) {
  return stadiumOf(club).builds.some((b) => b.kind === 'facility' && b.facility === kind);
}

export function startFacilityUpgrade(game: GameState, club: Club, kind: FacilityKind): string | null {
  const level = facilitiesOf(club)[kind];
  if (level >= MAX_FACILITY) return 'Already at the top level.';
  if (facilityBusy(club, kind)) return 'That facility is already being upgraded.';
  const { cost, weeks } = facilityUpgrade(game, level + 1);
  const problem = cannotBuild(club, cost);
  if (problem) return problem;
  stadiumOf(club).builds.push({ kind: 'facility', facility: kind, weeksLeft: weeks, totalWeeks: weeks, cost });
  club.balance -= cost;
  const l = ledgerOf(club);
  l.building = (l.building ?? 0) + cost;
  return null;
}

/** Extra yearly development for the user's young players (AI clubs are the baseline). */
export function trainingBonus(club: Club): number {
  return club.isUser ? (facilitiesOf(club).training - 1) * 0.35 + coachBonus(club) + partDevelopment(club) : 0;
}

/** Fewer weeks out injured with a better medical centre. */
export function injuryFactor(club: Club): number {
  return club.isUser ? (1 - (facilitiesOf(club).medical - 1) * 0.12) * physioFactor(club) * partInjuries(club) : 1;
}

/** Youth intake each summer for the user's club. */
export function youthIntake(club: Club) {
  const level = facilitiesOf(club).youth;
  return { count: 1 + Math.floor(level / 2), qualityBonus: (level - 1) * 2.5, potentialBonus: (level - 1) * 2 };
}
