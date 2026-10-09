import { describe, expect, it } from 'vitest';
import { careerTotals } from '../src/engine/players/generate';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import { squadOf } from '../src/engine/world';
import { testGame } from './helpers';

describe('career totals', () => {
  it('older players have a past; each season adds to the totals', () => {
    const game = testGame('eng', 601);
    const squad = squadOf(game, game.userClubId);
    const vet = squad.filter((p) => p.age >= 28)[0];
    expect(careerTotals(vet).games).toBeGreaterThan(100);
    const p = [...squad].sort((a, b) => b.overall - a.overall)[0];
    const before = careerTotals(p);
    playToSeasonEnd(game);
    const season = { ...p.seasonStats };
    expect(season.apps).toBeGreaterThan(10);
    startNextSeason(game);
    expect(p.seasonStats.apps).toBe(0);
    expect(careerTotals(p)).toEqual({ games: before.games + season.apps, goals: before.goals + season.goals, assists: before.assists + season.assists });
  });
});
