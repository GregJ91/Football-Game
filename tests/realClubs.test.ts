import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/data/pyramids';
import { NATIONS } from '../src/data/europe';
import { REAL_DIVISIONS, REAL_FOREIGN, realDivision, realForeign } from '../src/data/realClubs';
import { domesticClubs, squadOf } from '../src/engine/world';
import { testGame } from './helpers';

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('real club data', () => {
  it('has enough clubs for every division and nation, with no repeats', () => {
    for (const c of Object.values(COUNTRIES)) for (const d of c.divisions) expect(realDivision(d.id).length).toBeGreaterThanOrEqual(d.size);
    for (const n of NATIONS) expect(realForeign(n.code).length).toBeGreaterThanOrEqual(n.clubs);
    const names = [...Object.values(REAL_DIVISIONS), ...Object.values(REAL_FOREIGN)].flat().map((l) => l.split('|')[0]);
    expect(new Set(names).size).toBe(names.length);
    for (const l of [...Object.values(REAL_DIVISIONS), ...Object.values(REAL_FOREIGN)].flat()) {
      const [, short, p, s] = l.split('|');
      expect(short).toMatch(/^[A-Z0-9]{3}$/);
      expect(p).toMatch(/^#[0-9A-F]{6}$/i);
      expect(s).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('a game with real names', () => {
  it('puts real clubs in their leagues, the giants strongest', () => {
    const game = testGame('eng', 301, { realNames: true });
    const pl = game.divisions.find((d) => d.def.level === 1)!.clubIds.map((id) => game.clubs[id]);
    expect(pl.map((c) => c.name)).toContain('Arsenal');
    const strength = (name: string) => avg(squadOf(game, pl.find((c) => c.name === name)!.id).map((p) => p.overall).sort((a, b) => b - a).slice(0, 11));
    expect(strength('Arsenal')).toBeGreaterThan(strength('Burnley'));
    expect(game.clubs[pl.find((c) => c.name === 'Manchester United')!.id].stadiumName).toBe('Old Trafford');
    // The user's club takes the weakest club's place at the bottom.
    const bottom = game.divisions.find((d) => d.clubIds.includes(game.userClubId))!;
    expect(bottom.clubIds.map((id) => game.clubs[id].name)).not.toContain('Hebburn Town');
    expect(domesticClubs(game).length).toBe(Object.values(COUNTRIES.eng.divisions).reduce((n, d) => n + d.size, 0));
  });

  it('meets real clubs in Europe; Scottish games meet the English giants', () => {
    const eng = testGame('eng', 302, { realNames: true });
    const foreign = Object.values(eng.clubs).filter((c) => c.foreign).map((c) => c.name);
    expect(foreign).toEqual(expect.arrayContaining(['Real Madrid', 'Bayern Munich', 'Celtic']));
    const sco = testGame('sco', 303, { realNames: true });
    expect(Object.values(sco.clubs).filter((c) => c.foreign).map((c) => c.name)).toContain('Liverpool');
    expect(sco.divisions[0].clubIds.map((id) => sco.clubs[id].name)).toContain('Rangers');
  });

  it('without the option, names stay made up', () => {
    const game = testGame('eng', 304);
    expect(Object.values(game.clubs).map((c) => c.name)).not.toContain('Arsenal');
  });
});
