import { describe, expect, it } from 'vitest';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import { cannotLoan } from '../src/engine/transfers/loans';
import { askingPrice, cannotBuy, completeTransfer, interestIn, isKnown, levelOf } from '../src/engine/transfers/market';
import { playerById, squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

describe('players abroad', () => {
  it('every foreign club has a squad from the start, English clubs included in a Scottish game', () => {
    const g = testGame('sco', 161);
    const eu = g.europe!;
    for (const id of eu.foreignIds) expect(squadOf(g, id)).toHaveLength(22);
    const english = eu.foreignIds.filter((id) => g.clubs[id].foreign!.nation === 'ENG');
    expect(english.length).toBeGreaterThan(0);
    expect(Object.keys(eu.players).length).toBeGreaterThan(2000);
  });

  it('can be scouted and bought, and join the main player database', () => {
    const g = testGame('sco', 162);
    const club = userClub(g);
    const eu = g.europe!;
    const p = eu.players[eu.squads[eu.foreignIds[20]][5]];
    expect(isKnown(g, club, p)).toBe(false);
    expect(cannotBuy(g, p)).toBeNull();
    expect(cannotLoan(g, p)).toMatch(/abroad/);
    expect(askingPrice(g, p)).toBeGreaterThan(0);
    expect(['keen', 'open', 'reluctant', 'no']).toContain(interestIn(g, club, p));
    completeTransfer(g, p, club.id, askingPrice(g, p), p.wage, 3);
    expect(p.clubId).toBe(club.id);
    expect(g.players[p.id]).toBe(p);
    expect(eu.players[p.id]).toBeUndefined();
    expect(playerById(g, p.id)).toBe(p);
    expect(squadOf(g, eu.foreignIds[20])).toHaveLength(21);
  });

  it('foreign clubs rank by strength against the pyramid; squads age and are topped up each summer', () => {
    const g = testGame('eng', 163);
    const eu = g.europe!;
    const elite = eu.foreignIds.reduce((a, b) => (g.clubs[a].foreign!.strength > g.clubs[b].foreign!.strength ? a : b));
    expect(levelOf(g, elite)).toBeLessThanOrEqual(1);
    const minnow = eu.foreignIds.reduce((a, b) => (g.clubs[a].foreign!.strength < g.clubs[b].foreign!.strength ? a : b));
    expect(levelOf(g, minnow)).toBeGreaterThanOrEqual(3);
    const id = eu.foreignIds[3];
    const first = squadOf(g, id)[0];
    const age = first.age;
    const sold = squadOf(g, id)[1];
    completeTransfer(g, sold, g.userClubId, 0, sold.wage, 2);
    playToSeasonEnd(g);
    startNextSeason(g);
    const now = squadOf(g, id);
    expect(now).toHaveLength(22);
    const same = now.find((p) => p.id === first.id);
    if (same) expect(same.age).toBe(age + 1);
  });
});
