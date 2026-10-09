import { describe, expect, it } from 'vitest';
import { MATCHDAY, advanceHalfDay, dateOf, formatDate, isMatchdayMorning, userFixtureThisWeek } from '../src/engine/calendar';
import { advanceToUserMatch, playWeek } from '../src/engine/season/season';
import { testGame } from './helpers';

describe('calendar', () => {
  it('starts on a Monday morning before the first Saturday of August', () => {
    const game = testGame('eng', 41);
    const d = dateOf(game);
    expect(d.getUTCDay()).toBe(1);
    expect(game.half).toBe('am');
    expect(dateOf(game, 0, MATCHDAY).getUTCMonth()).toBe(7); // first matchday in August
    expect(formatDate(d)).toMatch(/^Mon/);
  });

  it('Continue goes AM to PM to the next morning', () => {
    const game = testGame('eng', 41);
    advanceHalfDay(game);
    expect([game.day, game.half]).toEqual([1, 'pm']);
    advanceHalfDay(game);
    expect([game.day, game.half]).toEqual([2, 'am']);
  });

  it('stops on matchday morning until the match is played, then moves to Saturday evening', () => {
    const game = testGame('eng', 41);
    while (!isMatchdayMorning(game)) advanceHalfDay(game);
    expect(game.day).toBe(MATCHDAY);
    const week = game.week;
    expect(advanceHalfDay(game)).toBe('matchday');
    expect(game.week).toBe(week);
    const saturday = formatDate(dateOf(game));
    playWeek(game);
    expect(game.half).toBe('pm');
    expect(formatDate(dateOf(game))).toBe(saturday); // still the same Saturday, now evening
    expect(game.week).toBe(week + 1);
    advanceHalfDay(game);
    expect([game.day, game.half]).toEqual([0, 'am']);
  });

  it('sends a training report on Friday evening', () => {
    const game = testGame('eng', 42);
    while (!(game.day === 5 && game.half === 'pm')) advanceHalfDay(game);
    expect((game.inbox ?? []).some((m) => m.category === 'training' && m.subject === 'Weekly training report')).toBe(true);
  });

  it('skipping to the next match lands on matchday morning with the fixture ready', () => {
    const game = testGame('eng', 43);
    const f = advanceToUserMatch(game)!;
    expect(isMatchdayMorning(game)).toBe(true);
    expect(userFixtureThisWeek(game)).toBe(f);
  });
});
