import type { AttributeKey, Attributes, Player, Position, PositionGroup } from '../types';

type Weights = Partial<Record<AttributeKey, number>>;

/** How much each attribute matters for each position. Normalised on use. */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: { handling: 35, reflexes: 35, positioning: 15, composure: 10, strength: 5 },
  DC: { tackling: 25, heading: 20, positioning: 20, strength: 15, pace: 10, composure: 10 },
  DR: { tackling: 20, pace: 20, positioning: 15, passing: 15, stamina: 15, dribbling: 15 },
  DL: { tackling: 20, pace: 20, positioning: 15, passing: 15, stamina: 15, dribbling: 15 },
  DMC: { tackling: 25, passing: 20, positioning: 20, workRate: 15, stamina: 10, strength: 10 },
  MC: { passing: 25, vision: 20, workRate: 15, stamina: 15, dribbling: 10, tackling: 10, composure: 5 },
  MR: { pace: 20, dribbling: 20, passing: 20, stamina: 15, vision: 15, workRate: 10 },
  ML: { pace: 20, dribbling: 20, passing: 20, stamina: 15, vision: 15, workRate: 10 },
  AMC: { vision: 25, passing: 20, dribbling: 20, finishing: 15, composure: 15, pace: 5 },
  ST: { finishing: 30, composure: 15, heading: 15, pace: 15, dribbling: 10, strength: 10, positioning: 5 },
};

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: 'GK',
  DC: 'DEF',
  DR: 'DEF',
  DL: 'DEF',
  DMC: 'MID',
  MC: 'MID',
  MR: 'MID',
  ML: 'MID',
  AMC: 'ATT',
  ST: 'ATT',
};

export const POSITION_ORDER: Position[] = ['GK', 'DR', 'DC', 'DL', 'DMC', 'MR', 'MC', 'ML', 'AMC', 'ST'];

export function ratingAt(attributes: Attributes, position: Position): number {
  const w = POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const key in w) {
    const k = key as AttributeKey;
    sum += attributes[k] * w[k]!;
    total += w[k]!;
  }
  return Math.round(sum / total);
}

export function computeOverall(p: Pick<Player, 'attributes' | 'position'>): number {
  return ratingAt(p.attributes, p.position);
}

/** 0–1 multiplier for playing a player out of position. */
export function positionFit(natural: Position, slot: Position): number {
  if (natural === slot) return 1;
  if (natural === 'GK' || slot === 'GK') return 0.3;
  const pair = (a: Position, b: Position) =>
    (natural === a && slot === b) || (natural === b && slot === a);
  if (pair('DR', 'DL') || pair('MR', 'ML') || pair('DMC', 'MC') || pair('AMC', 'ST') || pair('AMC', 'MC')) return 0.92;
  if (POSITION_GROUP[natural] === POSITION_GROUP[slot]) return 0.85;
  return 0.7;
}

/** Effective rating of a player in a slot, including fitness and morale. */
export function effectiveRating(p: Player, slot: Position, energy = p.fitness): number {
  const base = ratingAt(p.attributes, slot) * positionFit(p.position, slot);
  const fitness = 0.75 + 0.25 * (energy / 100);
  const morale = 0.95 + 0.1 * (p.morale / 100);
  return base * fitness * morale;
}

export function playerValue(overall: number, age: number, potential: number): number {
  const ageMult = age <= 21 ? 1.5 : age <= 24 ? 1.3 : age <= 29 ? 1 : age <= 32 ? 0.6 : 0.3;
  const potMult = 1 + Math.max(0, potential - overall) / 40;
  // Exponential through the leagues, flattening out among the elite.
  const base = 300 * Math.exp((Math.min(overall, 84) - 40) / 4.2) * (1 + Math.max(0, overall - 84) * 0.08);
  return roundMoney(base * ageMult * potMult);
}

export function playerWage(overall: number): number {
  const base = 30 * Math.exp((Math.min(overall, 80) - 40) / 4.6) * (1 + Math.max(0, overall - 80) * 0.05);
  return roundMoney(base);
}

export function roundMoney(n: number): number {
  if (n < 1000) return Math.max(10, Math.round(n / 10) * 10);
  if (n < 100_000) return Math.round(n / 500) * 500;
  if (n < 1_000_000) return Math.round(n / 5000) * 5000;
  return Math.round(n / 50_000) * 50_000;
}
