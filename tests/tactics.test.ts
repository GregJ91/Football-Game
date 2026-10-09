import { describe, expect, it } from 'vitest';
import { simulateMatch, type TeamSheet } from '../src/engine/match/engine';
import { previewMatch, recommendTactics } from '../src/engine/match/preview';
import { pickTeam } from '../src/engine/match/selection';
import { tacticalModifiers } from '../src/engine/match/tactics';
import { SQUAD_TEMPLATE, generatePlayer } from '../src/engine/players/generate';
import { Rng } from '../src/engine/rng';
import type { Formation, Player, Tactics } from '../src/engine/types';

const T = (formation: Formation, mentality: Tactics['mentality'] = 'balanced', pressing: Tactics['pressing'] = 'medium'): Tactics => ({
  formation, mentality, pressing,
});
const ctx = { ourDefPace: 60, theirAttPace: 60 };

function squad(rng: Rng, quality: number, tag: string): Player[] {
  return SQUAD_TEMPLATE.map((position, i) =>
    generatePlayer(rng, { id: `${tag}${i}`, position, quality, clubId: tag, season: 2026, age: 26 }),
  );
}

function winRate(home: (s: Player[], opp: TeamSheet) => Tactics, away: Tactics, n = 1200, qHome = 60, qAway = 60) {
  const rng = new Rng(77);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const awaySheet = { selection: pickTeam(squad(rng, qAway, 'a'), away.formation), tactics: away };
    const hs = squad(rng, qHome, 'h');
    const t = home(hs, awaySheet);
    const r = simulateMatch(rng, { selection: pickTeam(hs, t.formation), tactics: t }, awaySheet, { capacity: 1000, crowdFill: 0.8 });
    if (r.homeGoals > r.awayGoals) wins++;
  }
  return wins / n;
}

describe('tactical match-ups', () => {
  it('a midfield three beats a midfield two in the middle', () => {
    const m = tacticalModifiers(T('4-3-3'), T('4-4-2'), ctx);
    expect(m.mid).toBeGreaterThan(1);
    expect(m.notes.some((n) => n.effect > 0 && /midfield/i.test(n.text))).toBe(true);
  });

  it('a lone striker struggles against a back three', () => {
    expect(tacticalModifiers(T('4-2-3-1'), T('5-3-2'), ctx).att).toBeLessThan(1);
  });

  it('a high line is risky against quicker forwards', () => {
    const slow = tacticalModifiers(T('4-4-2', 'balanced', 'high'), T('4-4-2'), { ourDefPace: 50, theirAttPace: 65 });
    const fine = tacticalModifiers(T('4-4-2', 'balanced', 'high'), T('4-4-2'), { ourDefPace: 65, theirAttPace: 60 });
    expect(slow.def).toBeLessThan(fine.def);
  });

  it('a low block counters an attacking side', () => {
    expect(tacticalModifiers(T('4-4-2', 'balanced', 'low'), T('4-4-2', 'attacking'), ctx).att).toBeGreaterThan(1);
  });

  it('effects stay bounded so strength still matters most', () => {
    for (const a of ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'] as Formation[]) {
      for (const b of ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'] as Formation[]) {
        const m = tacticalModifiers(T(a, 'balanced', 'high'), T(b, 'attacking'), { ourDefPace: 40, theirAttPace: 80 });
        for (const z of [m.def, m.mid, m.att]) {
          expect(z).toBeGreaterThanOrEqual(0.85);
          expect(z).toBeLessThanOrEqual(1.15);
        }
      }
    }
  });

  it('a favourable shape wins noticeably more often than a mirror match', () => {
    const mirror = winRate(() => T('4-4-2'), T('4-4-2'));
    const overload = winRate(() => T('4-3-3'), T('4-4-2'));
    expect(overload - mirror).toBeGreaterThan(0.04);
  });

  it("following the assistant's advice helps a weaker side", () => {
    const naive = winRate(() => T('4-4-2'), T('3-5-2', 'attacking'), 800, 57, 60);
    const advised = winRate((s, opp) => recommendTactics(s, opp, 'home').tactics, T('3-5-2', 'attacking'), 800, 57, 60);
    expect(advised).toBeGreaterThan(naive + 0.04);
  });

  it('the preview reports squad fit and expected goals', () => {
    const rng = new Rng(3);
    const s = squad(rng, 60, 'h');
    const home = { selection: pickTeam(s, '4-4-2'), tactics: T('4-4-2') };
    const away = { selection: pickTeam(squad(rng, 60, 'a'), '4-4-2'), tactics: T('4-4-2') };
    const p = previewMatch(home, away, 'home');
    expect(p.squadFit).toBeGreaterThan(0.95);
    expect(p.xgHome).toBeGreaterThan(0.5);
    expect(p.xgHome).toBeLessThan(3);
  });
});
