import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedAchievements } from '../src/engine/achievements';
import { stadiumOf } from '../src/engine/club/stadium';
import { computeOverall } from '../src/engine/players/ratings';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import { ATTRIBUTE_KEYS } from '../src/engine/types';
import { squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

function dominant(game: ReturnType<typeof testGame>) {
  for (const p of squadOf(game, game.userClubId)) {
    for (const k of ATTRIBUTE_KEYS) p.attributes[k] = 18;
    p.overall = computeOverall(p);
  }
}

describe('achievements', () => {
  it('every achievement has a unique id, a name and a description', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.name && a.description).toBeTruthy();
  });

  it('a new game has none; winning a game unlocks the first', () => {
    const game = testGame('eng', 1001);
    expect(earnedAchievements(game)).toEqual([]);
    dominant(game);
    for (let i = 0; i < 3; i++) playWeek(game);
    expect(earnedAchievements(game)).toContain('first-win');
  });

  it('a title and promotion unlock Champions, Silverware and Going up', () => {
    const game = testGame('eng', 1002);
    dominant(game);
    const st = stadiumOf(userClub(game));
    st.floodlights = true;
    st.stands[1].capacity = 1000;
    st.stands[1].seats = 300;
    playToSeasonEnd(game);
    startNextSeason(game);
    const got = earnedAchievements(game);
    expect(got).toEqual(expect.arrayContaining(['first-trophy', 'champions', 'promoted']));
    expect(got).not.toContain('top-flight');
  });

  it('testing aids earn nothing', () => {
    const giant = testGame('eng', 1003, { topFlight: true });
    for (let i = 0; i < 3; i++) playWeek(giant);
    expect(earnedAchievements(giant)).toEqual([]);
    const rich = testGame('eng', 1004);
    rich.settings = { ...rich.settings!, unlimitedMoney: true };
    dominant(rich);
    for (let i = 0; i < 3; i++) playWeek(rich);
    expect(earnedAchievements(rich)).toEqual([]);
  });
});
