import type { Attributes, GameState, Player } from '../types';
import { computeOverall } from './ratings';

/** Saves from before CM-style attributes stored 14 attributes on a 1–100 scale. */
type OldAttributes = Record<
  'finishing' | 'passing' | 'dribbling' | 'tackling' | 'heading' | 'positioning' | 'vision' | 'workRate' | 'composure' | 'pace' | 'strength' | 'stamina' | 'handling' | 'reflexes',
  number
>;

const to20 = (n: number) => Math.max(1, Math.min(20, Math.round(n / 5)));

function convert(o: OldAttributes): Attributes {
  return {
    crossing: to20(o.passing),
    dribbling: to20(o.dribbling),
    finishing: to20(o.finishing),
    heading: to20(o.heading),
    longShots: to20((o.finishing + o.passing) / 2),
    marking: to20(o.tackling),
    passing: to20(o.passing),
    tackling: to20(o.tackling),
    technique: to20((o.dribbling + o.passing) / 2),
    aggression: to20((o.strength + o.tackling) / 2),
    anticipation: to20(o.positioning),
    bravery: to20(o.composure),
    creativity: to20(o.vision),
    decisions: to20((o.composure + o.vision) / 2),
    determination: to20(o.workRate),
    flair: to20(o.dribbling),
    offTheBall: to20(o.positioning),
    positioning: to20(o.positioning),
    teamwork: to20(o.workRate),
    workRate: to20(o.workRate),
    acceleration: to20(o.pace),
    agility: to20(o.pace),
    jumping: to20(o.heading),
    pace: to20(o.pace),
    stamina: to20(o.stamina),
    strength: to20(o.strength),
    handling: to20(o.handling),
    reflexes: to20(o.reflexes),
    oneOnOnes: to20(o.reflexes),
    aerialAbility: to20(o.handling),
    kicking: to20(o.passing),
    communication: to20(o.positioning),
  };
}

function migratePlayer(p: Player) {
  p.positions ??= [p.position];
  const a = p.attributes as unknown as Record<string, number>;
  if ('vision' in a || 'composure' in a) {
    p.attributes = convert(a as unknown as OldAttributes);
    p.overall = computeOverall(p);
    p.potential = Math.max(p.potential, p.overall);
  }
}

/** Bring an older save up to date. */
export function migratePlayers(game: GameState) {
  for (const p of Object.values(game.players)) migratePlayer(p);
}
