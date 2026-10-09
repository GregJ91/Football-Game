import { describe, expect, it } from 'vitest';
import { advanceHalfDay, isMatchdayMorning, todaysUserMatch } from '../src/engine/calendar';
import { runToEnd } from '../src/engine/match/engine';
import { isCupTie, userCupTies } from '../src/engine/season/cups';
import { advanceToUserMatch, completeUserMatch, playToSeasonEnd, simUserMatchToday, startNextSeason, startUserMatch } from '../src/engine/season/season';
import { divisionOf } from '../src/engine/world';
import { testGame } from './helpers';

describe('cup set-up', () => {
  it('England has four cups, first rounds drawn, big clubs joining later', () => {
    const game = testGame('eng', 51);
    expect(game.cups!.map((c) => c.id)).toEqual(['fa-cup', 'league-cup', 'fa-trophy', 'fa-vase']);
    const fa = game.cups![0];
    expect(fa.rounds[0].drawn).toBe(true);
    const r0 = fa.rounds[0].ties.flatMap((t) => [t.homeId, t.awayId]).concat(fa.rounds[0].byes);
    expect(r0.every((id) => divisionOf(game, id).def.level >= 6)).toBe(true);
    for (const cup of game.cups!) {
      for (const r of cup.rounds) expect(r.week).toBeLessThan(game.totalWeeks);
    }
  });

  it('the user is in the FA Cup and FA Vase from the bottom tier', () => {
    const game = testGame('eng', 51);
    const ties = userCupTies(game);
    expect(ties.map((t) => t.cupId).sort()).toEqual(['fa-cup', 'fa-vase']);
  });
});

describe('a full season of cups', () => {
  for (const country of ['eng', 'sco'] as const) {
    it(`${country}: every cup is played to a winner, who gets the trophy`, () => {
      const game = testGame(country, 52);
      playToSeasonEnd(game);
      for (const cup of game.cups!) {
        expect(cup.winnerId).toBeDefined();
        expect(cup.rounds.every((r) => r.played && r.ties.every((t) => t.result && t.winnerId))).toBe(true);
        expect(game.clubs[cup.winnerId!].trophies!.some((t) => t.season === game.season)).toBe(true);
      }
      // League champions get their titles too.
      for (const div of game.divisions) {
        const champ = game.clubs[game.lastSummary!.champions[div.def.id]];
        expect(champ.trophies!.some((t) => t.name === div.def.name)).toBe(true);
      }
      startNextSeason(game);
      expect(game.cups!.every((c) => c.season === game.season && !c.winnerId)).toBe(true);
    });
  }
});

describe('cup days in the calendar', () => {
  it('Continue stops on the morning of a cup tie; simming it moves the cup on', () => {
    const game = testGame('eng', 53);
    let match = advanceToUserMatch(game);
    while (match && !isCupTie(match)) {
      simUserMatchToday(game);
      match = advanceToUserMatch(game);
    }
    expect(match && isCupTie(match)).toBe(true);
    expect(isMatchdayMorning(game)).toBe(true);
    expect(advanceHalfDay(game)).toBe('matchday');
    const tie = match as NonNullable<typeof match> & { cupId: string; round: number };
    simUserMatchToday(game);
    expect(tie.result).not.toBeNull();
    expect(game.half).toBe('pm');
    const cup = game.cups!.find((c) => c.id === tie.cupId)!;
    expect(cup.rounds[tie.round].played).toBe(true);
    expect(cup.winnerId || cup.rounds[tie.round + 1]?.drawn).toBeTruthy();
  });

  it('a cup tie played live always has a winner and moves the cup on', () => {
    const game = testGame('eng', 54);
    let match = advanceToUserMatch(game);
    while (match && !isCupTie(match)) {
      simUserMatchToday(game);
      match = advanceToUserMatch(game);
    }
    const live = startUserMatch(game, match!);
    expect(live.opts.knockout).toBe(true);
    runToEnd(live);
    completeUserMatch(game, match!, live);
    expect(isCupTie(match!) && match.winnerId).toBeTruthy();
    expect(todaysUserMatch(game)).toBeUndefined();
  });
});
