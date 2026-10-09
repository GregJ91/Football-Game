import { describe, expect, it } from 'vitest';
import { commercialUpgrade, foodLevel, vipLevel } from '../src/engine/club/matchday';
import { floodlightOption, standOptions, startCommercialWork, startStadiumWork } from '../src/engine/club/stadium';
import { startFacilityUpgrade } from '../src/engine/club/facilities';
import { playerValue } from '../src/engine/players/ratings';
import { roundRobin } from '../src/engine/season/fixtures';
import { playWeek } from '../src/engine/season/season';
import { renewalDemand } from '../src/engine/transfers/market';
import { Rng } from '../src/engine/rng';
import { squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

describe('fixtures', () => {
  it('home and away games alternate: no long runs, and a balanced split', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `t${i}`);
    const days = roundRobin(ids, 2, new Rng(3));
    for (const t of ids) {
      const seq = days.map((d) => d.find((p) => p.includes(t))!).map((p) => (p[0] === t ? 'H' : 'A')).join('');
      expect(Math.max(...seq.match(/H+|A+/g)!.map((r) => r.length))).toBeLessThanOrEqual(3);
      expect([...seq].filter((c) => c === 'H').length).toBe(23);
    }
  });
});

describe('wages and values', () => {
  it("a good player's renewal is based on his pay, not capped by the league", () => {
    const game = testGame('eng', 401);
    const p = squadOf(game, game.userClubId)[0];
    p.wage = 5000;
    expect(renewalDemand(game, p).wage).toBeGreaterThanOrEqual(5000);
  });

  it('world-class players are worth tens of millions', () => {
    expect(playerValue(90, 27, 90)).toBeGreaterThan(60_000_000);
    expect(playerValue(94, 27, 94)).toBeGreaterThan(playerValue(90, 27, 90));
    expect(playerValue(50, 27, 50)).toBeLessThan(20_000);
  });
});

describe('matchday money', () => {
  it('season tickets are sold up front, and holders do not pay again at home league games', () => {
    const game = testGame('eng', 402);
    const club = userClub(game);
    expect(club.seasonTickets?.holders).toBeGreaterThan(0);
    expect(club.ledger?.seasonTickets).toBe(club.seasonTickets!.revenue);
    for (let i = 0; i < 6; i++) playWeek(game);
    expect(club.ledger?.merch).toBeGreaterThan(0);
    expect(club.ledger?.food).toBeGreaterThan(0);
  });

  it('food and VIP are built in steps, VIP needs a big enough ground', () => {
    const game = testGame('eng', 403);
    const club = userClub(game);
    club.balance = 1_000_000;
    expect(startCommercialWork(game, club, 'food')).toBeNull();
    expect(startCommercialWork(game, club, 'food')).toMatch(/already/);
    // Food and VIP can be built at the same time.
    expect(startCommercialWork(game, club, 'vip')).toBeNull();
    for (let i = 0; i < 3; i++) playWeek(game);
    expect(foodLevel(club)).toBe(1);
    expect(vipLevel(club)).toBe(1);
    expect(commercialUpgrade(game, club, 'vip')!.blocked).toMatch(/Needs a ground/);
    const bank = club.balance;
    playWeek(game);
    expect(club.ledger!.hospitality ?? 0).toBeGreaterThanOrEqual(0);
    expect(club.balance).not.toBe(bank);
  });

  it('several stands, the floodlights, a facility, food and VIP can all be built at once', () => {
    const game = testGame('eng', 405);
    const club = userClub(game);
    club.balance = 5_000_000;
    const ext = (i: number) => standOptions(game, club, i).find((o) => o.kind === 'extend')!;
    expect(startStadiumWork(club, ext(0))).toBeNull();
    expect(startStadiumWork(club, ext(1))).toBeNull();
    expect(startStadiumWork(club, ext(0))).toMatch(/already working on that stand/);
    expect(startStadiumWork(club, floodlightOption(game))).toBeNull();
    expect(startFacilityUpgrade(game, club, 'training')).toBeNull();
    expect(startFacilityUpgrade(game, club, 'youth')).toBeNull();
    expect(startFacilityUpgrade(game, club, 'training')).toMatch(/already/);
    expect(startCommercialWork(game, club, 'food')).toBeNull();
    expect(startCommercialWork(game, club, 'vip')).toBeNull();
    expect(club.stadium!.builds).toHaveLength(7);
  });

  it('building is cheaper at the bottom of the pyramid', () => {
    const low = testGame('eng', 404);
    const high = testGame('eng', 404, { topFlight: true });
    expect(floodlightOption(low).cost).toBeLessThan(floodlightOption(high).cost / 2);
  });
});
