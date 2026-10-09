import { describe, expect, it } from 'vitest';
import { judge, boardOf } from '../src/engine/club/chairman';
import { createRelegationBattle, kidsWindowClosed, relegationLeagues } from '../src/engine/club/challenge';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import { divisionTable } from '../src/engine/season/table';
import { cannotLoan, endLoan, loanIn, loansIn, MAX_LOANS } from '../src/engine/transfers/loans';
import { cannotBuy, transferWindow } from '../src/engine/transfers/market';
import type { ChallengeId, Player } from '../src/engine/types';
import { divisionOf, squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

const challengeGame = (challenge: ChallengeId, seed = 120) => testGame('eng', seed, { challenge });

/** A player at an AI club in the user's league who matches. */
function find(game: ReturnType<typeof testGame>, test: (p: Player) => boolean): Player {
  const div = divisionOf(game, game.userClubId);
  const p = div.clubIds.filter((id) => id !== game.userClubId).flatMap((id) => squadOf(game, id)).find(test);
  if (!p) throw new Error('no such player');
  return p;
}

describe("You Can't Win Anything With Kids", () => {
  it('starts with a squad of under-22s and only signs under-22s', () => {
    const g = challengeGame('kids');
    expect(squadOf(g, g.userClubId).every((p) => p.age <= 21)).toBe(true);
    expect(transferWindow(g).open).toBe(true);
    expect(cannotBuy(g, find(g, (p) => p.age >= 25))).toMatch(/21 or under/);
    expect(cannotBuy(g, find(g, (p) => p.age <= 21))).toBeNull();
  });

  it('three points off for each over-age player still here when a window closes', () => {
    const g = challengeGame('kids', 121);
    const [a, b] = squadOf(g, g.userClubId);
    a.age = 22;
    b.age = 23;
    kidsWindowClosed(g);
    const div = divisionOf(g, g.userClubId).def.id;
    const row = divisionTable(g, div).find((r) => r.clubId === g.userClubId)!;
    expect(row.deducted).toBe(6);
    expect(row.points).toBe(-6);
    expect(g.inbox!.some((i) => i.subject === '6-point deduction')).toBe(true);
  });

  it('warns at the start of a season and the deduction happens when the summer window shuts', () => {
    const g = challengeGame('kids', 122);
    playToSeasonEnd(g);
    for (const p of squadOf(g, g.userClubId).slice(0, 2)) p.age = 21; // they'll be 22 after the summer
    startNextSeason(g);
    expect(g.inbox!.some((i) => i.subject === 'Over-age players')).toBe(true);
    while (transferWindow(g).open) playWeek(g);
    expect(g.deductions![g.userClubId]).toBeGreaterThanOrEqual(6);
  });
});

describe('Old But Gold', () => {
  it('only signs players aged 30 or over', () => {
    const g = challengeGame('old', 123);
    expect(cannotBuy(g, find(g, (p) => p.age < 30))).toMatch(/30 or over/);
    expect(cannotBuy(g, find(g, (p) => p.age >= 30))).toBeNull();
  });
});

describe('Transfer Embargo', () => {
  it('no fees: free agents and loans only', () => {
    const g = challengeGame('embargo', 124);
    expect(cannotBuy(g, find(g, () => true))).toMatch(/embargo/);
    const free = Object.values(g.players).find((p) => !p.clubId)!;
    expect(cannotBuy(g, free)).toBeNull();
  });

  it('every bid for your players is accepted', () => {
    const g = challengeGame('embargo', 125);
    const squad = squadOf(g, g.userClubId);
    for (const p of squad.slice(0, 4)) p.listed = true;
    const before = new Set(g.clubs[g.userClubId].playerIds);
    for (let i = 0; i < 4 && transferWindow(g).open; i++) playWeek(g);
    const gone = [...before].filter((id) => !g.clubs[g.userClubId].playerIds.includes(id));
    expect(gone.length).toBeGreaterThan(0);
    expect(g.inbox!.some((i) => /Transfer embargo: we had to accept/.test(i.text))).toBe(true);
    expect(g.inbox!.some((i) => i.kind === 'bid')).toBe(false);
  });
});

describe('Avoid the Sack', () => {
  it('is always hard, and the sack ends the challenge (no second job)', () => {
    const g = challengeGame('sack', 126);
    expect(g.settings!.difficulty).toBe('hard');
    g.startSeason = g.season - 1;
    boardOf(userClub(g)).confidence = 5;
    judge(g, false);
    expect(g.challenge!.status).toBe('lost');
    expect(g.challenge!.result).toMatch(/Sacked/);
    expect(g.unemployed).toBeUndefined();
  });
});

describe('Relegation Battlers', () => {
  for (const country of ['eng', 'sco'] as const) {
    it(`${country}: second from bottom with 10 to play, decided on the final table`, () => {
      const league = relegationLeagues(country)[0];
      const g = createRelegationBattle(127, country, league.id);
      const user = g.userClubId;
      expect(divisionOf(g, user).def.id).toBe(league.id);
      const table = divisionTable(g, league.id);
      expect(table[table.length - 2].clubId).toBe(user);
      const left = g.fixtures.filter((f) => f.divisionId === league.id && !f.result && (f.homeId === user || f.awayId === user)).length;
      expect(left).toBeGreaterThanOrEqual(9);
      expect(left).toBeLessThanOrEqual(11);
      expect(g.challenge).toMatchObject({ id: 'relegation', status: 'active' });
      expect(g.inbox!.some((i) => i.subject === 'Relegation Battlers')).toBe(true);
      playToSeasonEnd(g);
      const relegated = g.lastSummary!.relegated[league.id].includes(user);
      expect(g.challenge!.status).toBe(relegated ? 'lost' : 'won');
    });
  }
});

describe('loans', () => {
  it('borrow a fringe player for the season; he goes back in the summer', () => {
    const g = testGame('eng', 128);
    const parent = divisionOf(g, g.userClubId).clubIds.find((id) => id !== g.userClubId)!;
    const fringe = squadOf(g, parent).sort((a, b) => a.overall - b.overall)[0];
    expect(cannotLoan(g, fringe)).toBeNull();
    expect(loanIn(g, fringe)).toBeNull();
    expect(fringe.clubId).toBe(g.userClubId);
    expect(fringe.loanFrom).toBe(parent);
    expect(loansIn(g)).toContain(fringe);
    expect(g.clubs[parent].playerIds).not.toContain(fringe.id);
    playToSeasonEnd(g);
    startNextSeason(g);
    expect(fringe.clubId).toBe(parent);
    expect(fringe.loanFrom).toBeUndefined();
  });

  it("clubs won't lend first-teamers, and there's a limit", () => {
    const g = testGame('eng', 129);
    const others = divisionOf(g, g.userClubId).clubIds.filter((id) => id !== g.userClubId);
    const star = squadOf(g, others[0]).filter((p) => p.age > 21).sort((a, b) => b.overall - a.overall)[0];
    expect(cannotLoan(g, star)).toMatch(/first team/);
    g.clubs[g.userClubId].budgets!.wage = 1e9;
    let n = 0;
    for (const id of others) {
      const p = squadOf(g, id).sort((a, b) => a.overall - b.overall)[0];
      if (n < MAX_LOANS) {
        expect(loanIn(g, p)).toBeNull();
        n++;
      } else {
        expect(cannotLoan(g, p)).toMatch(/only have/);
        break;
      }
    }
    // Sending one back frees a place.
    endLoan(g, loansIn(g)[0]);
    expect(loansIn(g)).toHaveLength(MAX_LOANS - 1);
  });
});
