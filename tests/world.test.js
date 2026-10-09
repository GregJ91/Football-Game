import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../src/data/pyramids';
import { Rng } from '../src/engine/rng';
import { divisionOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';
describe('Rng', () => {
    it('is deterministic for a seed and resumable from its state', () => {
        const a = new Rng(42);
        const seq = [a.next(), a.next(), a.next()];
        const b = new Rng(42);
        expect([b.next(), b.next(), b.next()]).toEqual(seq);
        const c = new Rng(42);
        c.next();
        const resumed = new Rng(c.state);
        expect([resumed.next(), resumed.next()]).toEqual(seq.slice(1));
    });
});
describe('pyramid definitions', () => {
    for (const country of Object.values(COUNTRIES)) {
        it(`${country.name}: relegation places match promotion places at every boundary`, () => {
            const levels = [...new Set(country.divisions.map((d) => d.level))].sort();
            for (let i = 0; i < levels.length - 1; i++) {
                const down = country.divisions.filter((d) => d.level === levels[i]).reduce((s, d) => s + d.relegation, 0);
                const up = country.divisions
                    .filter((d) => d.level === levels[i + 1])
                    .reduce((s, d) => s + (d.promotion ? d.promotion.auto + (d.promotion.playoff ? 1 : 0) : 0), 0);
                expect(up, `level ${levels[i + 1]} -> ${levels[i]}`).toBe(down);
            }
            for (const d of country.divisions) {
                if (d.promotion?.playoff)
                    expect(d.promotion.playoff[1] - d.promotion.playoff[0] + 1).toBe(4);
            }
        });
    }
});
describe('createGame', () => {
    it('builds every division at full size with 22-man squads', () => {
        const game = testGame('eng');
        for (const div of game.divisions) {
            expect(div.clubIds).toHaveLength(div.def.size);
            for (const id of div.clubIds)
                expect(game.clubs[id].playerIds).toHaveLength(22);
        }
    });
    it('puts the user club in the chosen bottom-tier division', () => {
        const north = testGame('eng', 1, { region: 'N' });
        expect(divisionOf(north, north.userClubId).def.id).toBe('eng-7n');
        const south = testGame('eng', 1, { region: 'S' });
        expect(divisionOf(south, south.userClubId).def.id).toBe('eng-7s');
        const sco = testGame('sco', 1, { region: 'S' });
        expect(divisionOf(sco, sco.userClubId).def.id).toBe('sco-5s');
        expect(userClub(sco).name).toBe('Ashford Rovers');
    });
    it('makes higher divisions stronger', () => {
        const game = testGame('eng');
        const avg = (divId) => {
            const div = game.divisions.find((d) => d.def.id === divId);
            const ps = div.clubIds.flatMap((c) => game.clubs[c].playerIds.map((p) => game.players[p].overall));
            return ps.reduce((s, x) => s + x, 0) / ps.length;
        };
        expect(avg('eng-1')).toBeGreaterThan(avg('eng-3'));
        expect(avg('eng-3')).toBeGreaterThan(avg('eng-7n'));
    });
    it('is reproducible from the seed', () => {
        const a = testGame('eng', 99);
        const b = testGame('eng', 99);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});
