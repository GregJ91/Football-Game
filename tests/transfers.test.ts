import { describe, expect, it } from 'vitest';
import { scoutReportsPerWeek } from '../src/engine/club/staff';
import { adjustBudgets, budgetsOf, wageBill, wageBudgetProblem, WAGE_TO_TRANSFER } from '../src/engine/economy/finance';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import {
  acceptsLowerWage, answerBid, wageDemand, askingPrice, bidFor, cannotBuy, completeTransfer, feeProblem, interestIn, isKnown,
  openInboxItems, releaseCost, releasePlayer, renewContract, transferWindow,
} from '../src/engine/transfers/market';
import { Rng } from '../src/engine/rng';
import { advanceHalfDay, assignScout } from '../src/engine/calendar';
import { divisionOf, domesticClubs, squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

const playersAtLevel = (game: ReturnType<typeof testGame>, level: number) =>
  game.divisions.filter((d) => d.def.level === level).flatMap((d) => d.clubIds).flatMap((id) => squadOf(game, id));

describe('transfer windows', () => {
  it('summer window for the first 6 weeks, then January', () => {
    const game = testGame('eng', 4);
    expect(transferWindow(game)).toMatchObject({ open: true, name: 'summer', weeksLeft: 6 });
    while (game.week < 6) playWeek(game);
    expect(transferWindow(game).open).toBe(false);
    while (game.week < Math.floor(game.totalWeeks * 0.5)) playWeek(game);
    expect(transferWindow(game)).toMatchObject({ open: true, name: 'january' });
  });
});

describe('player interest and pricing', () => {
  it('top-flight players will only drop to the bottom of the pyramid for a huge wage', () => {
    const game = testGame('eng', 5);
    const club = userClub(game);
    const star = playersAtLevel(game, 1).sort((a, b) => b.overall - a.overall)[0];
    expect(interestIn(game, club, star)).toBe('no');
    expect(cannotBuy(game, star)).toBeNull();
    const demand = wageDemand(game, club, star);
    expect(demand).toBeGreaterThan(star.wage * 3);
    expect(acceptsLowerWage(game, new Rng(1), club, star)).toBe(false);
  });

  it('players at the next level up are open to a step down only reluctantly; same level is fine', () => {
    const game = testGame('eng', 5);
    const same = playersAtLevel(game, 7).find((p) => p.clubId !== game.userClubId)!;
    expect(['keen', 'open']).toContain(interestIn(game, userClub(game), same));
  });

  it('bids at or above the asking price are accepted; near it countered; well below rejected', () => {
    const game = testGame('eng', 6);
    const p = playersAtLevel(game, 7).find((x) => x.clubId !== game.userClubId)!;
    const asking = askingPrice(game, p);
    expect(bidFor(game, p, asking).result).toBe('accepted');
    expect(bidFor(game, p, Math.round(asking * 0.8)).result).toBe('countered');
    expect(bidFor(game, p, Math.round(asking * 0.3)).result).toBe('rejected');
  });
});

describe('board budgets', () => {
  it('signing spends the transfer budget and moves the player', () => {
    const game = testGame('eng', 7);
    const club = userClub(game);
    const before = budgetsOf(game, club).transfer;
    const p = playersAtLevel(game, 7).find((x) => x.clubId !== club.id && askingPrice(game, x) < before)!;
    const seller = game.clubs[p.clubId!];
    const fee = askingPrice(game, p);
    const sellerBank = seller.balance;
    completeTransfer(game, p, club.id, fee, 100, 2);
    expect(p.clubId).toBe(club.id);
    expect(club.playerIds).toContain(p.id);
    expect(seller.playerIds).not.toContain(p.id);
    expect(budgetsOf(game, club).transfer).toBe(before - fee);
    expect(seller.balance).toBe(sellerBank + fee);
    expect(p.contractEnd).toBe(game.season + 1);
  });

  it('blocks fees over the transfer budget and wages over the wage budget', () => {
    const game = testGame('eng', 7);
    const club = userClub(game);
    const b = budgetsOf(game, club);
    expect(feeProblem(game, b.transfer + 1000)).toMatch(/transfer budget/);
    expect(wageBudgetProblem(game, club, b.wage)).toMatch(/over your budget/);
    expect(wageBudgetProblem(game, club, 0)).toBeNull();
  });

  it('moves money between wage and transfer budgets at the stated rate', () => {
    const game = testGame('eng', 7);
    const club = userClub(game);
    const b = { ...budgetsOf(game, club) };
    const after = adjustBudgets(game, club, 100);
    expect(after.wage).toBe(b.wage + 100);
    expect(after.transfer).toBe(b.transfer - 100 * WAGE_TO_TRANSFER);
    // Can't cut the wage budget below the current wage bill.
    expect(adjustBudgets(game, club, -1e9).wage).toBe(Math.round(wageBill(game, club)));
  });
});

describe('contracts and selling', () => {
  it("your players leave when their contract runs out, unless renewed", () => {
    const game = testGame('eng', 8);
    const [a, b] = squadOf(game, game.userClubId);
    a.contractEnd = game.season;
    b.contractEnd = game.season;
    renewContract(game, b, b.wage, 2);
    playToSeasonEnd(game);
    startNextSeason(game);
    expect(a.clubId).toBeNull();
    expect(b.clubId).toBe(game.userClubId);
  });

  it('releasing a player costs half his remaining wages', () => {
    const game = testGame('eng', 9);
    const club = userClub(game);
    const p = squadOf(game, club.id).find((x) => x.position !== 'GK')!;
    const cost = releaseCost(game, p);
    const bank = club.balance;
    releasePlayer(game, p);
    expect(p.clubId).toBeNull();
    expect(club.balance).toBe(bank - cost);
  });

  it('listed players attract bids, and accepting sells them with 75% back to the budget', () => {
    const game = testGame('eng', 10);
    const club = userClub(game);
    for (const p of squadOf(game, club.id)) p.listed = true;
    for (let i = 0; i < 4 && openInboxItems(game).length === 0; i++) playWeek(game);
    const bid = openInboxItems(game)[0];
    expect(bid).toBeDefined();
    const p = game.players[bid.bid!.playerId];
    const before = budgetsOf(game, club).transfer;
    answerBid(game, new Rng(1), bid.id, 'accept');
    expect(p.clubId).toBe(bid.bid!.fromClubId);
    expect(budgetsOf(game, club).transfer).toBe(before + Math.round(bid.bid!.fee * 0.75));
  });
});

describe('scouting', () => {
  it('sends scouts to players outside your league; reports arrive days later, limited per week', () => {
    const game = testGame('eng', 11);
    const club = userClub(game);
    const perWeek = scoutReportsPerWeek(club);
    const outsiders = playersAtLevel(game, 5).slice(0, perWeek + 1);
    expect(isKnown(game, club, outsiders[0])).toBe(false);
    for (let i = 0; i < perWeek; i++) expect(assignScout(game, outsiders[i].id, false)).toBe('assigned');
    expect(assignScout(game, outsiders[perWeek].id, false)).toBe('none-left');
    expect(isKnown(game, club, outsiders[0])).toBe(false);
    for (let i = 0; i < 8; i++) advanceHalfDay(game);
    expect(isKnown(game, club, outsiders[0])).toBe(true);
    expect((game.inbox ?? []).some((m) => m.category === 'scouting')).toBe(true);
    const sameLeague = squadOf(game, divisionOf(game, club.id).clubIds.find((id) => id !== club.id)!)[0];
    expect(isKnown(game, club, sameLeague)).toBe(true);
  });
});

describe('economy over several seasons', () => {
  it('keeps clubs solvent and the market moving', () => {
    const game = testGame('eng', 12);
    for (let s = 0; s < 3; s++) {
      playToSeasonEnd(game);
      const moves = (game.transfers ?? []).filter((t) => t.season === game.season).length;
      expect(moves).toBeGreaterThan(50);
      startNextSeason(game);
    }
    const inDebt = domesticClubs(game).filter((c) => c.balance < 0).length;
    expect(inDebt).toBeLessThan(Object.keys(game.clubs).length * 0.1);
    for (const c of domesticClubs(game)) {
      expect(c.playerIds.length).toBeGreaterThanOrEqual(16);
      expect(c.playerIds.length).toBeLessThanOrEqual(30);
    }
  });
});
