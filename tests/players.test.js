import { describe, expect, it } from 'vitest';
import { pickTeam } from '../src/engine/match/selection';
import { SQUAD_TEMPLATE, generatePlayer } from '../src/engine/players/generate';
import { migratePlayers } from '../src/engine/players/migrate';
import { canPlay, computeOverall } from '../src/engine/players/ratings';
import { Rng } from '../src/engine/rng';
import { ATTRIBUTE_KEYS } from '../src/engine/types';
const squad = (seed, quality = 60) => {
    const rng = new Rng(seed);
    return SQUAD_TEMPLATE.map((position, i) => generatePlayer(rng, { id: `p${i}`, position, quality, clubId: 'c', season: 2026, age: 25 }));
};
describe('CM-style players', () => {
    it('have every CM attribute on a 1–20 scale and an overall near the target', () => {
        const players = squad(1, 60);
        for (const p of players) {
            for (const k of ATTRIBUTE_KEYS) {
                expect(p.attributes[k]).toBeGreaterThanOrEqual(1);
                expect(p.attributes[k]).toBeLessThanOrEqual(20);
                expect(Number.isInteger(p.attributes[k])).toBe(true);
            }
        }
        const avg = players.reduce((n, p) => n + p.overall, 0) / players.length;
        expect(avg).toBeGreaterThan(55);
        expect(avg).toBeLessThan(65);
    });
    it('can play several positions, main position first', () => {
        const players = Array.from({ length: 20 }, (_, i) => squad(100 + i)).flat();
        expect(players.every((p) => p.positions[0] === p.position)).toBe(true);
        expect(players.some((p) => p.positions.length > 1)).toBe(true);
        expect(players.filter((p) => p.position === 'GK').every((p) => p.positions.length === 1)).toBe(true);
    });
});
describe('best XI', () => {
    it('puts players who can play each position there, not the best player anywhere', () => {
        const players = squad(3, 50);
        // A brilliant midfielder who can't play centre-back.
        const star = players.find((p) => p.position === 'MC');
        for (const k of ATTRIBUTE_KEYS)
            star.attributes[k] = 20;
        star.positions = ['MC'];
        star.overall = computeOverall(star);
        const sel = pickTeam(players, '4-4-2');
        sel.slots.forEach((slot, i) => expect(canPlay(sel.xi[i], slot)).toBe(true));
        expect(sel.slots[sel.xi.indexOf(star)]).toBe('MC');
    });
    it('only plays someone out of position when nobody who plays there is fit', () => {
        const players = squad(4, 50);
        for (const p of players)
            if (p.positions.includes('DR'))
                p.injuryWeeks = 3;
        const sel = pickTeam(players, '4-4-2');
        const i = sel.slots.indexOf('DR');
        expect(sel.xi[i]).toBeDefined();
        expect(canPlay(sel.xi[i], 'DR')).toBe(false);
    });
});
describe('old saves', () => {
    it('convert 1–100 attributes to the CM set and add positions', () => {
        const p = squad(5)[0];
        const old = { finishing: 40, passing: 50, dribbling: 45, tackling: 30, heading: 35, positioning: 60, vision: 40, workRate: 55, composure: 50, pace: 45, strength: 50, stamina: 60, handling: 70, reflexes: 75 };
        const legacy = { ...p, attributes: old, positions: undefined };
        const game = { players: { [p.id]: legacy } };
        migratePlayers(game);
        expect(legacy.positions).toEqual([legacy.position]);
        expect(legacy.attributes.reflexes).toBe(15);
        expect(legacy.attributes.oneOnOnes).toBe(15);
        expect('vision' in legacy.attributes).toBe(false);
        expect(legacy.overall).toBe(computeOverall(legacy));
    });
});
