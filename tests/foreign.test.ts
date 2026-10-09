import { describe, expect, it } from 'vitest';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import { cannotLoan, loanIn } from '../src/engine/transfers/loans';
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

  it('foreign clubs lend fringe players, who go home in the summer', () => {
    const g = testGame('sco', 164);
    const eu = g.europe!;
    const parent = eu.foreignIds[10];
    const fringe = squadOf(g, parent).sort((a, b) => a.overall - b.overall)[0];
    g.clubs[g.userClubId].budgets!.wage = 1e9;
    g.settings = { ...g.settings!, allInterested: true };
    expect(cannotLoan(g, fringe)).toBeNull();
    expect(loanIn(g, fringe)).toBeNull();
    expect(fringe.clubId).toBe(g.userClubId);
    expect(g.players[fringe.id]).toBe(fringe);
    expect(squadOf(g, parent)).not.toContain(fringe);
    playToSeasonEnd(g);
    startNextSeason(g);
    expect(fringe.clubId).toBe(parent);
    expect(g.players[fringe.id]).toBeUndefined();
    expect(squadOf(g, parent)).toContain(fringe);
  });

  it('some foreign players leave on free transfers each summer', () => {
    const g = testGame('eng', 165);
    const before = new Set(Object.keys(g.europe!.players));
    playToSeasonEnd(g);
    startNextSeason(g);
    const freed = Object.values(g.players).filter((p) => !p.clubId && before.has(p.id));
    expect(freed.length).toBeGreaterThan(5);
  });
});

describe('world-class players and wonderkids', () => {
  it('there are 90-rated stars and 90-potential youngsters from the start', () => {
    const g = testGame('eng', 166);
    const everyone = [...Object.values(g.players), ...Object.values(g.europe!.players)];
    expect(everyone.filter((p) => p.overall >= 90).length).toBeGreaterThanOrEqual(3);
    const kids = everyone.filter((p) => p.age <= 20 && p.potential >= 90);
    expect(kids.length).toBeGreaterThanOrEqual(10);
  });
});
