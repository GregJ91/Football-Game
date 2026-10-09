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
    expect(careerTotals(p)).toMatchObject({ games: before.games + season.apps, goals: before.goals + season.goals, assists: before.assists + season.assists });
  });
});

describe('clean sheets and the Golden Glove', () => {
  it('keepers collect clean sheets; each league, cup and European competition crowns a Golden Glove', () => {
    const game = testGame('eng', 602, { topFlight: true });
    const keeper = squadOf(game, game.userClubId).filter((p) => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0];
    const career = careerTotals(keeper).cleanSheets;
    expect(career).toBeGreaterThan(0);
    playToSeasonEnd(game);
    const s = game.lastSummary!;
    const top = game.divisions[0].def.id;
    const glove = s.awards![top].goldenGlove!;
    expect(glove.value).toBeGreaterThan(5);
    // The winner has the most clean sheets in the league.
    expect(Math.max(...Object.values(game.cleanSheets![top]))).toBe(glove.value);
    expect(Object.keys(s.cupGloves!).length).toBeGreaterThanOrEqual(3);
    expect(s.cupGloves!.ucl).toBeDefined();
    const season = keeper.seasonStats.cleanSheets ?? 0;
    expect(season).toBeGreaterThan(0);
    startNextSeason(game);
    expect(careerTotals(keeper).cleanSheets).toBe(career + season);
    expect(game.cleanSheets).toEqual({});
  });
});

describe('the rating scale tops out at 100', () => {
  it('unscouted ranges, ratings and potential never pass 100', async () => {
    const { ratingRange } = await import('../src/engine/transfers/market');
    const { ratingAt } = await import('../src/engine/players/ratings');
    const game = testGame('eng', 801, { topFlight: true });
    const all = [...Object.values(game.players), ...Object.values(game.europe!.players)];
    for (const p of all) {
      expect(p.overall).toBeLessThanOrEqual(100);
      expect(p.potential).toBeLessThanOrEqual(100);
      const [lo, hi] = ratingRange(p);
      expect(hi).toBeLessThanOrEqual(100);
      expect(lo <= p.overall && p.overall <= hi).toBe(true);
    }
    // A 97-rated player's range still contains him and stops at 100.
    const star = { ...all[0], id: 'x0', overall: 97 };
    expect(ratingRange(star)[1]).toBeLessThanOrEqual(100);
    // Every attribute at 20 is exactly 100.
    const maxed = Object.fromEntries(Object.keys(all[0].attributes).map((k) => [k, 20])) as typeof all[0]['attributes'];
    expect(ratingAt(maxed, 'ST')).toBe(100);
  });
});
