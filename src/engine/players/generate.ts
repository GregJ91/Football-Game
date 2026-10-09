import { FIRST_NAMES, LAST_NAMES } from '../../data/names';
import type { Rng } from '../rng';
import { ATTRIBUTE_KEYS, type Attributes, type Player, type Position } from '../types';
import { POSITION_WEIGHTS, computeOverall, playerValue, playerWage } from './ratings';

/** A balanced 22-man squad. */
export const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK',
  'DR', 'DR', 'DC', 'DC', 'DC', 'DC', 'DL', 'DL',
  'DMC', 'DMC', 'MC', 'MC', 'MC', 'MR', 'ML',
  'AMC', 'AMC', 'ST', 'ST', 'ST',
];

const clamp = (n: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));

export interface GenerateOptions {
  id: string;
  position: Position;
  /** Target overall the player should come out around. */
  quality: number;
  age?: number;
  clubId: string | null;
  season: number;
}

export function generateAttributes(rng: Rng, position: Position, target: number): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const attrs = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const isKey = weights[key] !== undefined;
    const isGkSkill = key === 'handling' || key === 'reflexes';
    if (isKey) attrs[key] = clamp(target + rng.normal() * 5);
    else if (isGkSkill) attrs[key] = clamp(10 + rng.normal() * 5);
    else attrs[key] = clamp(target - 12 + rng.normal() * 8);
  }
  return attrs;
}

export function generatePlayer(rng: Rng, opts: GenerateOptions): Player {
  const age = opts.age ?? clamp(rng.int(17, 34) + rng.normal() * 2, 16, 37);
  const attributes = generateAttributes(rng, opts.position, opts.quality);
  const overall = computeOverall({ attributes, position: opts.position });
  const headroom = age <= 19 ? rng.int(5, 25) : age <= 22 ? rng.int(2, 15) : age <= 26 ? rng.int(0, 7) : rng.int(0, 2);
  const potential = clamp(overall + headroom);
  return {
    id: opts.id,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    position: opts.position,
    attributes,
    overall,
    potential,
    clubId: opts.clubId,
    wage: playerWage(overall),
    value: playerValue(overall, age, potential),
    contractEnd: opts.season + rng.int(1, 4),
    morale: 70,
    fitness: 100,
    form: 6.5,
    injuryWeeks: 0,
    suspendedMatches: 0,
    ambition: rng.int(1, 20),
    loyalty: rng.int(1, 20),
    seasonStats: { apps: 0, goals: 0, assists: 0, ratingSum: 0 },
  };
}

export function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function shortName(p: Player): string {
  return `${p.firstName[0]}. ${p.lastName}`;
}
