import type { AttributeKey, Attributes, Player, Position, PositionGroup } from '../types';

type Weights = Partial<Record<AttributeKey, number>>;

const FULL_BACK: Weights = { tackling: 15, marking: 12, pace: 15, acceleration: 8, crossing: 12, positioning: 12, stamina: 10, workRate: 8, dribbling: 8 };
const WINGER: Weights = { crossing: 18, dribbling: 15, pace: 15, acceleration: 10, passing: 12, stamina: 10, technique: 10, workRate: 5, offTheBall: 5 };

/** How much each attribute matters for each position. Normalised on use. */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: { handling: 25, reflexes: 25, oneOnOnes: 15, aerialAbility: 15, communication: 8, positioning: 7, kicking: 5 },
  DC: { tackling: 20, marking: 20, heading: 15, positioning: 15, strength: 10, jumping: 8, anticipation: 7, bravery: 5 },
  DR: FULL_BACK,
  DL: FULL_BACK,
  DMC: { tackling: 20, positioning: 15, passing: 15, marking: 10, anticipation: 10, workRate: 10, stamina: 10, decisions: 10 },
  MC: { passing: 20, creativity: 12, decisions: 12, technique: 10, workRate: 10, stamina: 10, tackling: 8, teamwork: 8, longShots: 5, anticipation: 5 },
  MR: WINGER,
  ML: WINGER,
  AMC: { creativity: 20, passing: 15, technique: 15, dribbling: 12, flair: 10, offTheBall: 10, finishing: 10, longShots: 8 },
  ST: { finishing: 25, offTheBall: 15, heading: 10, pace: 12, acceleration: 10, dribbling: 8, decisions: 8, strength: 7, anticipation: 5 },
};

/** An attribute on the 1–100 scale the match engine works in. */
export function attr100(p: Player, key: AttributeKey): number {
  return p.attributes[key] * 5;
}

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

/** Ability in a position on a 1–100 scale (attributes are 1–20). */
export function ratingAt(attributes: Attributes, position: Position): number {
  const w = POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const key in w) {
    const k = key as AttributeKey;
    sum += attributes[k] * w[k]!;
    total += w[k]!;
  }
  return Math.round((sum / total) * 5);
}

export function computeOverall(p: Pick<Player, 'attributes' | 'position'>): number {
  return ratingAt(p.attributes, p.position);
}

export function positionsOf(p: Pick<Player, 'position' | 'positions'>): Position[] {
  return p.positions?.length ? p.positions : [p.position];
}

/** Can he play this position (one of his listed positions)? */
export function canPlay(p: Pick<Player, 'position' | 'positions'>, slot: Position): boolean {
  return positionsOf(p).includes(slot);
}

/** CM-style position label, e.g. "DC/DMC". */
export function positionsLabel(p: Pick<Player, 'position' | 'positions'>): string {
  return positionsOf(p).join('/');
}

/** 0–1 multiplier for playing in a slot: 1 in any of his positions, less elsewhere. */
export function positionFit(positions: Position | Position[], slot: Position): number {
  const list = Array.isArray(positions) ? positions : [positions];
  if (list.includes(slot)) return 1;
  return Math.max(...list.map((natural) => pairFit(natural, slot)));
}

function pairFit(natural: Position, slot: Position): number {
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
  const base = ratingAt(p.attributes, slot) * positionFit(positionsOf(p), slot);
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
