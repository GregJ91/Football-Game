import { partDevelopment, partKnocks, partMatchEdge, partRecovery } from '../club/trainingGround';
import type { Rng } from '../rng';
import { coachBonus } from '../club/staff';
import { facilitiesOf } from '../club/facilities';
import {
  GOALKEEPING, MENTAL, PHYSICAL, TECHNICAL, type AttributeKey, type Club, type GameState, type IndividualFocus, type Player,
  type Position, type TeamFocus, type TrainingIntensity, type TrainingSettings,
} from '../types';
import { addInbox } from '../transfers/market';
import { squadOf } from '../world';
import { playerName } from './generate';
import { computeOverall, playerValue } from './ratings';

export const TEAM_FOCUS: Record<TeamFocus, { name: string; effect: string; attrs: readonly AttributeKey[] }> = {
  balanced: { name: 'Balanced', effect: 'A bit of everything.', attrs: [...TECHNICAL, ...MENTAL, ...PHYSICAL] },
  attacking: {
    name: 'Attacking',
    effect: 'Finishing, dribbling, crossing and movement.',
    attrs: ['finishing', 'dribbling', 'crossing', 'offTheBall', 'longShots', 'technique', 'passing', 'creativity', 'flair'],
  },
  defending: {
    name: 'Defending',
    effect: 'Marking, tackling, positioning and heading.',
    attrs: ['marking', 'tackling', 'positioning', 'heading', 'anticipation', 'bravery', 'strength', 'jumping'],
  },
  physical: {
    name: 'Physical',
    effect: 'Pace, stamina and strength; players also recover a little quicker.',
    attrs: PHYSICAL,
  },
  tactical: {
    name: 'Tactical',
    effect: 'Decisions, teamwork, work rate and reading the game.',
    attrs: ['decisions', 'teamwork', 'workRate', 'anticipation', 'positioning', 'creativity', 'passing'],
  },
  matchPrep: {
    name: 'Match preparation',
    effect: 'Work on the next opponent: sharper on match days, but nobody improves.',
    attrs: [],
  },
};

export const INDIVIDUAL_FOCUS: Record<IndividualFocus, { name: string; attrs: readonly AttributeKey[] }> = {
  technical: { name: 'Technical', attrs: TECHNICAL },
  mental: { name: 'Mental', attrs: MENTAL },
  physical: { name: 'Physical', attrs: PHYSICAL },
  goalkeeping: { name: 'Goalkeeping', attrs: GOALKEEPING },
};

export const INTENSITY: Record<TrainingIntensity, { name: string; effect: string; growth: number; knocks: number; recovery: number; morale: number }> = {
  light: { name: 'Light', effect: 'Fresher legs and happier players, slower progress, fewer knocks.', growth: 0.6, knocks: 0.6, recovery: 1.2, morale: 0.5 },
  normal: { name: 'Normal', effect: 'The usual week.', growth: 1, knocks: 1, recovery: 1, morale: 0 },
  intense: { name: 'Intense', effect: 'Faster progress, but more knocks, slower recovery and some grumbling.', growth: 1.5, knocks: 1.6, recovery: 0.85, morale: -0.5 },
};

export function trainingOf(club: Club): TrainingSettings {
  return club.training ?? { focus: 'balanced', intensity: 'normal' };
}

/** Match-day boost from match preparation. */
export function matchPrepBoost(club: Club): number {
  return (club.isUser && trainingOf(club).focus === 'matchPrep' ? 1.02 : 1) * partMatchEdge(club);
}

/** Daily recovery multiplier from the training load (user's club only). */
export function trainingRecovery(club: Club): number {
  if (!club.isUser) return 1;
  const t = trainingOf(club);
  return INTENSITY[t.intensity].recovery * (t.focus === 'physical' ? 1.1 : 1) * partRecovery(club);
}

/** Training-knock multiplier from the intensity. */
export function trainingKnocks(club: Club): number {
  return INTENSITY[trainingOf(club).intensity].knocks * partKnocks(club);
}

/** The attributes a player works on this week. */
export function focusAttributes(club: Club, p: Player): readonly AttributeKey[] {
  if (p.trainingFocus) return INDIVIDUAL_FOCUS[p.trainingFocus].attrs;
  // Keepers do their own work whatever the team focus.
  if (p.position === 'GK') return GOALKEEPING;
  return TEAM_FOCUS[trainingOf(club).focus].attrs;
}

/** Weeks to learn a new position, roughly. */
export function retrainWeeks(p: Player): number {
  return Math.round(100 / retrainRate(p));
}

function retrainRate(p: Player): number {
  return p.age <= 21 ? 8 : p.age <= 25 ? 6.5 : p.age <= 29 ? 5 : 4;
}

export function startRetraining(p: Player, position: Position | null) {
  p.retrain = position && !p.positions.includes(position) ? { position, progress: 0 } : undefined;
}

/**
 * A week on the training ground for the user's squad. Young players with
 * room to grow are most likely to improve an attribute in their focus; the
 * coach, the training ground and the intensity all help. Players learning a
 * new position move closer to it.
 */
export function weeklyTraining(game: GameState, rng: Rng) {
  const club = game.clubs[game.userClubId];
  const t = trainingOf(club);
  const intensity = INTENSITY[t.intensity];
  const support = 1 + coachBonus(club) * 0.5 + (facilitiesOf(club).training - 1) * 0.08 + partDevelopment(club) * 0.3;
  const log = club.trainingLog ?? [];
  for (const p of squadOf(game, club.id)) {
    if (p.injuryWeeks > 0) continue;
    p.morale = Math.max(0, Math.min(100, p.morale + intensity.morale));

    if (p.retrain) {
      p.retrain.progress = Math.min(100, p.retrain.progress + retrainRate(p) * intensity.growth * support);
      if (p.retrain.progress >= 100) {
        p.positions = [...p.positions, p.retrain.position];
        log.unshift({ season: game.season, week: game.week, playerId: p.id, name: playerName(p), attribute: 'position', value: p.retrain.position });
        addInbox(game, 'info', `${playerName(p)} can now play ${p.retrain.position}.`, { category: 'training', subject: `${p.lastName}: new position` });
        p.retrain = undefined;
      }
    }

    const attrs = focusAttributes(club, p);
    if (!attrs.length) continue;
    const gap = p.potential - p.overall;
    const age = p.age <= 21 ? 1.5 : p.age <= 25 ? 1 : p.age <= 29 ? 0.6 : 0.3;
    const chance = 0.07 * intensity.growth * support * age * (gap > 0 ? 1 : 0.25);
    if (!rng.chance(chance)) continue;
    const growable = attrs.filter((k) => p.attributes[k] < 20);
    if (!growable.length) continue;
    const k = rng.pick(growable);
    p.attributes[k]++;
    p.overall = computeOverall(p);
    p.potential = Math.max(p.potential, p.overall);
    p.value = playerValue(p.overall, p.age, p.potential);
    log.unshift({ season: game.season, week: game.week, playerId: p.id, name: playerName(p), attribute: k, value: p.attributes[k] });
  }
  club.trainingLog = log.filter((g) => g.season === game.season).slice(0, 30);
}
