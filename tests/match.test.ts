import { describe, expect, it } from 'vitest';
import { simulateMatch } from '../src/engine/match/engine';
import { pickTeam } from '../src/engine/match/selection';
import { SQUAD_TEMPLATE, generatePlayer } from '../src/engine/players/generate';
import { Rng } from '../src/engine/rng';
import type { Player } from '../src/engine/types';

function squad(rng: Rng, quality: number, tag: string): Player[] {
  return SQUAD_TEMPLATE.map((position, i) =>
    generatePlayer(rng, { id: `${tag}${i}`, position, quality, clubId: tag, season: 2026, age: 26 }),
  );
}

function run(qHome: number, qAway: number, n: number, seed = 5) {
  const rng = new Rng(seed);
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (let i = 0; i < n; i++) {
    const home = pickTeam(squad(rng, qHome, 'h'), '4-4-2');
    const away = pickTeam(squad(rng, qAway, 'a'), '4-4-2');
    const r = simulateMatch(rng, { selection: home, mentality: 'balanced' }, { selection: away, mentality: 'balanced' }, { capacity: 1000, crowdFill: 0.8 });
    goals += r.homeGoals + r.awayGoals;
    if (r.homeGoals > r.awayGoals) homeWins++;
    else if (r.homeGoals < r.awayGoals) awayWins++;
    else draws++;
  }
  return { avgGoals: goals / n, home: homeWins / n, draw: draws / n, away: awayWins / n };
}

describe('match engine calibration', () => {
  it('evenly matched sides: realistic goals and home advantage', () => {
    const s = run(60, 60, 1500);
    expect(s.avgGoals).toBeGreaterThan(2.3);
    expect(s.avgGoals).toBeLessThan(3.0);
    expect(s.home).toBeGreaterThan(s.away);
    expect(s.draw).toBeGreaterThan(0.18);
    expect(s.draw).toBeLessThan(0.34);
  });

  it('a clearly stronger side wins most of the time', () => {
    const s = run(66, 58, 800, 9);
    expect(s.home).toBeGreaterThan(0.6);
    expect(s.home).toBeLessThan(0.85);
  });

  it('is deterministic for a seed', () => {
    expect(run(60, 58, 50, 3)).toEqual(run(60, 58, 50, 3));
  });

  it('picks a goalkeeper in goal and eleven players', () => {
    const sel = pickTeam(squad(new Rng(1), 60, 'x'), '4-3-3');
    expect(sel.xi).toHaveLength(11);
    expect(sel.xi[0].position).toBe('GK');
    expect(sel.bench.some((p) => p.position === 'GK')).toBe(true);
  });

  it('knockout ties always produce a winner', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 100; i++) {
      const r = simulateMatch(
        rng,
        { selection: pickTeam(squad(rng, 55, 'h'), '4-4-2'), mentality: 'balanced' },
        { selection: pickTeam(squad(rng, 55, 'a'), '4-4-2'), mentality: 'balanced' },
        { capacity: 1000, crowdFill: 1, knockout: true, neutral: true },
      );
      if (r.homeGoals === r.awayGoals) {
        expect(r.penalties).toBeDefined();
        expect(r.penalties!.home).not.toBe(r.penalties!.away);
      }
    }
  });
});
