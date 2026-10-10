import { ledgerOf } from '../economy/finance';
import type { Club, GameState, TrainingPart } from '../types';
import { buildScale, cannotBuild, stadiumOf } from './stadium';

/**
 * The training ground, part by part. The main complex (pitches and
 * buildings) is the Training ground facility; these are the extras built
 * around it, each with a real effect on the squad.
 */

export interface PartLevel {
  name: string;
  about: string;
  cost: number;
  weeks: number;
  upkeep: number;
}

export interface PartDef {
  name: string;
  /** What it does, for the screen. */
  effect: string;
  levels: PartLevel[];
}

const none = (about: string): PartLevel => ({ name: 'None', about, cost: 0, weeks: 0, upkeep: 0 });

export const TRAINING_PARTS: Record<TrainingPart, PartDef> = {
  gym: {
    name: 'Gym',
    effect: 'Stronger, fitter players: physical attributes grow faster and fewer knocks in training.',
    levels: [
      none('The players lift weights in a portakabin.'),
      { name: 'Basic gym', about: 'Weights, bikes and a treadmill.', cost: 10_000, weeks: 3, upkeep: 50 },
      { name: 'Strength and conditioning centre', about: 'A proper gym with coaches on hand.', cost: 60_000, weeks: 6, upkeep: 250 },
      { name: 'Elite performance gym', about: 'Altitude room, anti-gravity treadmills, the lot.', cost: 250_000, weeks: 10, upkeep: 900 },
    ],
  },
  science: {
    name: 'Sports science',
    effect: 'Players recover their fitness faster between games.',
    levels: [
      none('Nobody measures anything.'),
      { name: 'Fitness testing', about: 'Bleep tests and heart-rate monitors.', cost: 15_000, weeks: 3, upkeep: 70 },
      { name: 'Sports science lab', about: 'Blood tests, nutrition and load planning.', cost: 90_000, weeks: 8, upkeep: 350 },
      { name: 'GPS and data lab', about: 'Every run tracked; nobody is ever overworked.', cost: 300_000, weeks: 12, upkeep: 1_100 },
    ],
  },
  recovery: {
    name: 'Recovery and rehab',
    effect: 'Injured players come back sooner.',
    levels: [
      none('A bucket of ice and a magic sponge.'),
      { name: 'Ice baths', about: 'Cold tubs after every session.', cost: 8_000, weeks: 2, upkeep: 40 },
      { name: 'Hydrotherapy pool', about: 'Rehab in the water, easy on the joints.', cost: 70_000, weeks: 8, upkeep: 300 },
      { name: 'Cryotherapy and rehab centre', about: 'Cryo chambers and a full rehab team.', cost: 280_000, weeks: 12, upkeep: 1_000 },
    ],
  },
  dome: {
    name: 'All-weather pitches',
    effect: 'Training never stops for the weather: better development and fewer knocks on bad pitches.',
    levels: [
      none('Training is off whenever it rains hard.'),
      { name: 'All-weather pitch', about: 'A floodlit artificial pitch.', cost: 40_000, weeks: 5, upkeep: 150 },
      { name: 'Indoor dome', about: 'A full-size indoor pitch.', cost: 220_000, weeks: 14, upkeep: 800 },
    ],
  },
  analysis: {
    name: 'Video analysis',
    effect: 'Players know the opposition inside out: a small edge in every match.',
    levels: [
      none('The manager watches the opposition on his laptop.'),
      { name: 'Video room', about: 'A screen and a projector for team meetings.', cost: 5_000, weeks: 2, upkeep: 30 },
      { name: 'Analysis suite', about: 'Analysts clip every game and every opponent.', cost: 50_000, weeks: 5, upkeep: 250 },
      { name: 'Data and opposition hub', about: 'Data scientists and set-piece analysts.', cost: 200_000, weeks: 8, upkeep: 800 },
    ],
  },
};

export const PART_ORDER: TrainingPart[] = ['gym', 'science', 'recovery', 'dome', 'analysis'];

export function partLevel(club: Club, part: TrainingPart): number {
  return club.trainingGround?.[part] ?? 0;
}

/** The next level of a part, with today's cost (cheaper lower down the pyramid), or null at the top. */
export function partUpgrade(game: GameState, club: Club, part: TrainingPart) {
  const def = TRAINING_PARTS[part];
  const next = partLevel(club, part) + 1;
  if (next >= def.levels.length) return null;
  const l = def.levels[next];
  return { part, level: next, name: l.name, about: l.about, cost: Math.round(l.cost * buildScale(game)), weeks: l.weeks, upkeep: l.upkeep };
}

export function partBusy(club: Club, part: TrainingPart): boolean {
  return stadiumOf(club).builds.some((b) => b.kind === 'tg' && b.part === part);
}

export function startPartWork(game: GameState, club: Club, part: TrainingPart): string | null {
  const opt = partUpgrade(game, club, part);
  if (!opt) return 'Already at the top level.';
  if (partBusy(club, part)) return `The ${TRAINING_PARTS[part].name.toLowerCase()} is already being built.`;
  const problem = cannotBuild(club, opt.cost);
  if (problem) return problem;
  stadiumOf(club).builds.push({ kind: 'tg', part, level: opt.level, weeksLeft: opt.weeks, totalWeeks: opt.weeks, cost: opt.cost });
  club.balance -= opt.cost;
  const l = ledgerOf(club);
  l.building = (l.building ?? 0) + opt.cost;
  return null;
}

/** A finished training-ground job. Returns a line for the inbox. */
export function completePartWork(club: Club, part: TrainingPart, level: number): string {
  club.trainingGround = { ...club.trainingGround, [part]: level };
  return `The ${TRAINING_PARTS[part].levels[level].name.toLowerCase()} is ready at the training ground.`;
}

/** Weekly running costs of everything built at the training ground. */
export function trainingGroundUpkeep(club: Club): number {
  return PART_ORDER.reduce((n, p) => n + TRAINING_PARTS[p].levels[partLevel(club, p)].upkeep, 0);
}

// ---------------------------------------------------------------- effects (user's club only)

/** Extra development support from the dome (training never stops) and the gym. */
export function partDevelopment(club: Club): number {
  if (!club.isUser) return 0;
  return partLevel(club, 'dome') * 0.12 + partLevel(club, 'gym') * 0.04;
}

/** Faster fitness recovery from sports science. */
export function partRecovery(club: Club): number {
  return club.isUser ? 1 + partLevel(club, 'science') * 0.06 : 1;
}

/** Fewer training knocks with a gym and all-weather pitches. */
export function partKnocks(club: Club): number {
  return club.isUser ? Math.max(0.6, 1 - partLevel(club, 'gym') * 0.07 - partLevel(club, 'dome') * 0.06) : 1;
}

/** Shorter injuries from recovery and rehab, and undersoil heating. */
export function partInjuries(club: Club): number {
  if (!club.isUser) return 1;
  return (1 - partLevel(club, 'recovery') * 0.07) * (club.stadium?.heating ? 0.92 : 1);
}

/** A small edge in matches from video analysis. */
export function partMatchEdge(club: Club): number {
  return club.isUser ? 1 + partLevel(club, 'analysis') * 0.006 : 1;
}
