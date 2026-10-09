import { describe, expect, it } from 'vitest';
import { INTENSITY, matchPrepBoost, retrainWeeks, startRetraining, trainingKnocks, trainingRecovery, weeklyTraining } from '../src/engine/players/training';
import { Rng } from '../src/engine/rng';
import type { TrainingSettings } from '../src/engine/types';
import { squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

/** Total attribute points gained by the squad over a number of training weeks. */
function gains(settings: TrainingSettings, weeks = 30, seed = 181) {
  const game = testGame('eng', seed);
  const club = userClub(game);
  club.training = settings;
  const before = squadOf(game, club.id).reduce((n, p) => n + Object.values(p.attributes).reduce((a, b) => a + b, 0), 0);
  const rng = new Rng(7);
  for (let i = 0; i < weeks; i++) weeklyTraining(game, rng);
  const after = squadOf(game, club.id).reduce((n, p) => n + Object.values(p.attributes).reduce((a, b) => a + b, 0), 0);
  return { gained: after - before, log: club.trainingLog ?? [] };
}

describe('training', () => {
  it('intense training brings more progress than light; match preparation brings none', () => {
    const light = gains({ focus: 'balanced', intensity: 'light' });
    const intense = gains({ focus: 'balanced', intensity: 'intense' });
    const prep = gains({ focus: 'matchPrep', intensity: 'normal' });
    expect(intense.gained).toBeGreaterThan(light.gained);
    expect(light.gained).toBeGreaterThan(0);
    // Only the keepers keep working (on goalkeeping) during match preparation.
    expect(prep.log.every((g) => ['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'].includes(String(g.attribute)))).toBe(true);
  });

  it('a team focus trains its own attributes', () => {
    const { log } = gains({ focus: 'attacking', intensity: 'intense' });
    const outfield = log.filter((g) => !['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'].includes(String(g.attribute)));
    expect(outfield.length).toBeGreaterThan(0);
    expect(outfield.every((g) => ['finishing', 'dribbling', 'crossing', 'offTheBall', 'longShots', 'technique', 'passing', 'creativity', 'flair'].includes(String(g.attribute)))).toBe(true);
  });

  it('intensity changes recovery and knocks; match preparation sharpens the team', () => {
    const game = testGame('eng', 182);
    const club = userClub(game);
    club.training = { focus: 'matchPrep', intensity: 'light' };
    expect(trainingRecovery(club)).toBe(INTENSITY.light.recovery);
    expect(trainingKnocks(club)).toBeLessThan(1);
    expect(matchPrepBoost(club)).toBeGreaterThan(1);
    club.training = { focus: 'physical', intensity: 'intense' };
    expect(trainingKnocks(club)).toBeGreaterThan(1);
    expect(matchPrepBoost(club)).toBe(1);
  });

  it('a player can learn a new position', () => {
    const game = testGame('eng', 183);
    const club = userClub(game);
    const p = squadOf(game, club.id).find((x) => x.position === 'MC' && !x.positions.includes('AMC'))!;
    startRetraining(p, 'AMC');
    const rng = new Rng(3);
    for (let i = 0; i < retrainWeeks(p) + 6; i++) weeklyTraining(game, rng);
    expect(p.positions).toContain('AMC');
    expect(p.retrain).toBeUndefined();
    expect(game.inbox!.some((i) => /can now play AMC/.test(i.text))).toBe(true);
  });
});
