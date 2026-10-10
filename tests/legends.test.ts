import { describe, expect, it } from 'vitest';
import {
  LEGENDS_SEASONS, LEGENDS_SQUAD, autoPick, clubOnTheClock, createLegendsGame, draftPool, legendsPool, legendsStandings, makePick,
  startSummerDraft,
} from '../src/engine/legends';
import { playToSeasonEnd } from '../src/engine/season/season';
import type { GameState } from '../src/engine/types';
import { squadOf } from '../src/engine/world';

function newLegends(difficulty: 'easy' | 'medium' | 'hard' = 'medium', seed = 7) {
  const game = createLegendsGame({
    seed,
    teamName: 'Dream XI',
    shortName: 'DXI',
    colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'plain' },
    difficulty,
  });
  return game;
}

/** The human takes the AI's suggestion every time. */
function draftThrough(game: GameState) {
  for (let i = 0; i < 1000 && game.legends!.draft; i++) {
    const d = game.legends!.draft!;
    if (clubOnTheClock(d) === 'L0') expect(autoPick(game, 'L0')).toBeNull();
    else throw new Error('AI should have picked');
  }
}

describe('legends', () => {
  it('real players, all 20 at their peak, unique names', () => {
    const pool = legendsPool();
    expect(pool.length).toBeGreaterThan(500);
    expect(new Set(pool.map((p) => p.name)).size).toBe(pool.length);
    const game = newLegends();
    const messi = Object.values(game.players).find((p) => p.lastName === 'Messi')!;
    expect(messi.overall).toBe(99);
    expect(messi.age).toBe(20);
    const ronaldinho = Object.values(game.players).find((p) => p.lastName === 'Ronaldinho')!;
    expect(ronaldinho.firstName).toBe('');
    // Ratings land on the real peak.
    const off = Object.values(game.players).filter((p) => Math.abs(p.overall - pool[Number(p.id.slice(2))].rating) > 1);
    expect(off.length).toBeLessThan(5);
  });

  it('the opening draft is a 23-round snake, and the human picks on their turn', () => {
    const game = newLegends();
    const d = game.legends!.draft!;
    expect(d.rounds).toBe(LEGENDS_SQUAD);
    // AI clubs ahead of us have already picked.
    expect(clubOnTheClock(d)).toBe('L0');
    expect(makePick(game, 'L1', draftPool(game)[0].id)).toMatch(/isn't your pick/);
    const target = draftPool(game)[0];
    expect(makePick(game, 'L0', target.id)).toBeNull();
    expect(target.clubId).toBe('L0');
    draftThrough(game);
    for (const club of Object.values(game.clubs)) {
      const squad = squadOf(game, club.id);
      expect(squad).toHaveLength(LEGENDS_SQUAD);
      expect(squad.filter((p) => p.position === 'GK').length).toBeGreaterThanOrEqual(2);
    }
    // Snake: round two runs backwards.
    const r1 = d.picks.filter((p) => p.round === 1).map((p) => p.clubId);
    const r2 = d.picks.filter((p) => p.round === 2).map((p) => p.clubId);
    expect(r2).toEqual([...r1].reverse());
    expect(game.cups!.map((c) => c.id).sort()).toEqual(['legends-fa-cup', 'legends-league-cup', 'legends-super-cup']);
  });

  it('harder AI drafts stronger squads', () => {
    const strength = (difficulty: 'easy' | 'hard') => {
      let total = 0;
      for (const seed of [1, 2, 3]) {
        const game = newLegends(difficulty, seed);
        draftThrough(game);
        const ai = Object.values(game.clubs).filter((c) => !c.isUser);
        total += ai.reduce((n, c) => n + c.reputation, 0) / ai.length;
      }
      return total / 3;
    };
    expect(strength('hard')).toBeGreaterThan(strength('easy'));
  });

  it('ten seasons: league, three cups, a summer draft in table order, then it ends', () => {
    const game = newLegends('medium', 11);
    draftThrough(game);
    for (let s = 0; s < LEGENDS_SEASONS; s++) {
      playToSeasonEnd(game);
      expect(game.phase).toBe('seasonEnd');
      const roll = game.legends!.roll.at(-1)!;
      expect(roll.cups.map((c) => c.id).sort()).toEqual(['legends-fa-cup', 'legends-league-cup', 'legends-super-cup']);
      if (s < LEGENDS_SEASONS - 1) {
        const table = game.lastSummary!.finalTables['legends-league'].map((r) => r.clubId);
        startSummerDraft(game);
        draftThrough(game);
        const summer = game.legends!.lastDraft!;
        expect(summer.kind).toBe('summer');
        expect(summer.picks.slice(0, 20).map((p) => p.clubId)).toEqual(table);
        expect(summer.picks.slice(20, 40).map((p) => p.clubId)).toEqual(table);
        for (const c of Object.values(game.clubs)) expect(c.playerIds).toHaveLength(LEGENDS_SQUAD);
        expect(game.phase).toBe('season');
        // Nobody ages or loses their peak.
        expect(Object.values(game.players).every((p) => p.age === 20)).toBe(true);
      }
    }
    expect(game.legends!.finished).toBe(true);
    startSummerDraft(game);
    expect(game.legends!.draft).toBeNull();
    const standings = legendsStandings(game);
    expect(standings[0].trophies).toBeGreaterThan(0);
    expect(standings.reduce((n, s) => n + s.titles, 0)).toBe(LEGENDS_SEASONS);
  }, 120_000);
});
