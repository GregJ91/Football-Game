import { FIRST_NAMES, LAST_NAMES } from '../../data/names';
import type { Rng } from '../rng';
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes, type Player, type Position } from '../types';
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

const clamp20 = (n: number) => Math.max(1, Math.min(20, Math.round(n)));
const GK_SKILLS: AttributeKey[] = ['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'];

/** CM-style 1–20 attributes centred on a 1–100 quality target for the position. */
export function generateAttributes(rng: Rng, position: Position, target: number, alsoPlays: Position[] = []): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const t = target / 5;
  const attrs = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const isKey = weights[key] !== undefined;
    if (isKey) attrs[key] = clamp20(t + rng.normal() * 1.1);
    else if (GK_SKILLS.includes(key)) attrs[key] = clamp20(position === 'GK' ? t - 2 + rng.normal() * 1.5 : 2 + rng.normal());
    else attrs[key] = clamp20(t - 2.4 + rng.normal() * 1.7);
  }
  // He's listed at his other positions because he can do the job there.
  for (const other of alsoPlays) {
    for (const key in POSITION_WEIGHTS[other]) {
      const k = key as AttributeKey;
      attrs[k] = Math.max(attrs[k], clamp20(t - 0.8 + rng.normal() * 0.8));
    }
  }
  return attrs;
}

/** Other positions a player can also play, CM style (e.g. DC/DMC, AMC/ST). */
const ALSO_PLAYS: Record<Position, [Position, number][]> = {
  GK: [],
  DR: [['DL', 0.3], ['MR', 0.15], ['DC', 0.1]],
  DL: [['DR', 0.3], ['ML', 0.15], ['DC', 0.1]],
  DC: [['DMC', 0.25], ['DR', 0.08], ['DL', 0.08]],
  DMC: [['MC', 0.45], ['DC', 0.25]],
  MC: [['DMC', 0.35], ['AMC', 0.3]],
  MR: [['ML', 0.35], ['AMC', 0.15], ['DR', 0.12]],
  ML: [['MR', 0.35], ['AMC', 0.15], ['DL', 0.12]],
  AMC: [['MC', 0.4], ['ST', 0.3], ['MR', 0.1], ['ML', 0.1]],
  ST: [['AMC', 0.3]],
};

export function generatePositions(rng: Rng, primary: Position): Position[] {
  const out: Position[] = [primary];
  for (const [pos, chance] of ALSO_PLAYS[primary]) if (rng.chance(chance)) out.push(pos);
  return out;
}

export function generatePlayer(rng: Rng, opts: GenerateOptions): Player {
  const age = opts.age ?? clamp(rng.int(17, 34) + rng.normal() * 2, 16, 37);
  const positions = generatePositions(rng, opts.position);
  const attributes = generateAttributes(rng, opts.position, opts.quality, positions.slice(1));
  const overall = computeOverall({ attributes, position: opts.position });
  const headroom = age <= 19 ? rng.int(5, 25) : age <= 22 ? rng.int(2, 15) : age <= 26 ? rng.int(0, 7) : rng.int(0, 2);
  // Potential above 85 is rare: the higher it would reach, the harder it gets.
  const raw = clamp(overall + headroom);
  const potential = Math.max(overall, raw > 85 ? Math.round(85 + (raw - 85) * 0.45) : raw);
  return {
    id: opts.id,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    position: opts.position,
    positions,
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
    careerStats: pastCareer(opts.id, age, opts.position),
  };
}

/** Goals and assists per game by position, for a believable past career. */
const PER_GAME: Record<Position, [number, number]> = {
  GK: [0, 0.005], DC: [0.04, 0.02], DR: [0.03, 0.08], DL: [0.03, 0.08], DMC: [0.05, 0.06],
  MC: [0.1, 0.12], MR: [0.15, 0.18], ML: [0.15, 0.18], AMC: [0.25, 0.2], ST: [0.38, 0.12],
};

/**
 * Games, goals and assists before the game began: about 20–38 games a season
 * from 18. Seeded from the player's id so it doesn't disturb the random
 * stream (and so the same player always gets the same past).
 */
export function pastCareer(id: string, age: number, position: Position): [number, number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const r = (k: number) => ((Math.imul(h ^ k, 2654435761) >>> 0) % 1000) / 1000;
  const seasons = Math.max(0, age - 18 + r(1));
  const games = Math.round(seasons * (20 + r(2) * 18));
  const [g, a] = PER_GAME[position];
  // Keepers keep a clean sheet in roughly a quarter to two-fifths of their games.
  const cleanSheets = position === 'GK' ? Math.round(games * (0.25 + r(5) * 0.15)) : 0;
  return [games, Math.round(games * g * (0.6 + r(3) * 0.8)), Math.round(games * a * (0.6 + r(4) * 0.8)), cleanSheets];
}

/** Career games, goals and assists including this season so far. */
export function careerTotals(p: Player): { games: number; goals: number; assists: number; cleanSheets: number } {
  const c = p.careerStats ?? pastCareer(p.id, p.age, p.position);
  const pastCs = c[3] ?? (p.position === 'GK' ? pastCareer(p.id, p.age, p.position)[3] : 0);
  return { games: c[0] + p.seasonStats.apps, goals: c[1] + p.seasonStats.goals, assists: c[2] + p.seasonStats.assists, cleanSheets: pastCs + (p.seasonStats.cleanSheets ?? 0) };
}

/** End of season: add the season's games, goals and assists to the career totals. */
export function bankSeasonStats(p: Player) {
  const t = careerTotals(p);
  p.careerStats = [t.games, t.goals, t.assists, t.cleanSheets];
  p.seasonStats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
}

/**
 * Turn a young player into a wonderkid: potential in the high 80s or 90s,
 * well beyond what normal youngsters can reach.
 */
export function makeWonderkid(rng: Rng, p: Player): Player {
  p.potential = Math.max(p.overall + 10, Math.min(97, rng.int(88, 96)));
  p.value = playerValue(p.overall, p.age, p.potential);
  return p;
}

export function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function shortName(p: Player): string {
  return `${p.firstName[0]}. ${p.lastName}`;
}
