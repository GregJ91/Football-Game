import { describe, expect, it } from 'vitest';
import { boardOf, chooseSponsor, loanOptions, takeLoan } from '../src/engine/club/chairman';
import { facilitiesOf, startFacilityUpgrade } from '../src/engine/club/facilities';
import { checkGrading, effectiveCapacity, stadiumOf, standOptions, startStadiumWork, totalCapacity } from '../src/engine/club/stadium';
import { crowdFill, guideTicketPrice } from '../src/engine/economy/finance';
import { computeOverall } from '../src/engine/players/ratings';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import { ATTRIBUTE_KEYS } from '../src/engine/types';
import { divisionOf, squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

function makeUserDominant(game: ReturnType<typeof testGame>) {
  for (const p of squadOf(game, game.userClubId)) {
    for (const k of ATTRIBUTE_KEYS) p.attributes[k] = Math.max(p.attributes[k], 85);
    p.overall = computeOverall(p);
  }
}

describe('starting a club', () => {
  it('starts with a small ground, no floodlights, a target and sponsor offers', () => {
    const game = testGame('eng', 21);
    const club = userClub(game);
    expect(totalCapacity(stadiumOf(club))).toBe(500);
    expect(club.capacity).toBe(500);
    expect(stadiumOf(club).floodlights).toBe(false);
    expect(boardOf(club).target).toBeDefined();
    expect(club.sponsorOffers).toHaveLength(3);
  });
});

describe('stadium building', () => {
  it('takes the money, halves the stand while working, then adds the places', () => {
    const game = testGame('eng', 22);
    const club = userClub(game);
    club.balance = 100_000;
    const opt = standOptions(game, club, 1).find((o) => o.kind === 'extend' && o.size === 250)!;
    const bank = club.balance;
    expect(startStadiumWork(club, opt)).toBeNull();
    expect(club.balance).toBe(bank - opt.cost);
    expect(effectiveCapacity(stadiumOf(club))).toBe(450);
    expect(startStadiumWork(club, opt)).toMatch(/one project at a time/i);
    for (let i = 0; i < opt.weeks; i++) playWeek(game);
    expect(totalCapacity(stadiumOf(club))).toBe(750);
    expect(club.capacity).toBe(750);
    expect(stadiumOf(club).builds).toHaveLength(0);
  });
});

describe('ground grading', () => {
  it('denies promotion when the ground fails, and the next club goes up', () => {
    const game = testGame('eng', 23);
    makeUserDominant(game);
    const div = divisionOf(game, game.userClubId).def.id;
    playToSeasonEnd(game);
    const s = game.lastSummary!;
    expect(s.finalTables[div][0].clubId).toBe(game.userClubId);
    expect(s.deniedPromotion?.clubId).toBe(game.userClubId);
    expect(s.promoted[div]).not.toContain(game.userClubId);
    expect(s.promoted[div]).toContain(s.deniedPromotion!.replacementId);
    startNextSeason(game);
    expect(divisionOf(game, game.userClubId).def.id).toBe(div);
  });

  it('promotes when the ground meets the rules', () => {
    const game = testGame('eng', 23);
    makeUserDominant(game);
    const club = userClub(game);
    const st = stadiumOf(club);
    st.floodlights = true;
    st.stands[1].capacity = 1000;
    st.stands[1].seats = 300;
    expect(checkGrading(game, club, 6)!.ok).toBe(true);
    playToSeasonEnd(game);
    expect(game.lastSummary!.deniedPromotion).toBeUndefined();
    startNextSeason(game);
    expect(divisionOf(game, game.userClubId).def.level).toBe(6);
  });
});

describe('facilities, tickets, sponsors and loans', () => {
  it('upgrades a facility over time and charges upkeep', () => {
    const game = testGame('eng', 24);
    const club = userClub(game);
    club.balance = 100_000;
    expect(startFacilityUpgrade(game, club, 'training')).toBeNull();
    const bank = club.balance;
    for (let i = 0; i < 8; i++) playWeek(game);
    expect(facilitiesOf(club).training).toBe(2);
    playWeek(game); // upkeep starts the week after it opens
    expect(club.ledger!.upkeep).toBeGreaterThan(0);
    expect(club.balance).not.toBe(bank);
  });

  it('dearer tickets mean smaller crowds', () => {
    const game = testGame('eng', 25);
    const club = userClub(game);
    const normal = crowdFill(game, club);
    club.ticketPrice = guideTicketPrice(game, club) * 2;
    expect(crowdFill(game, club)).toBeLessThan(normal);
  });

  it('an upfront sponsor pays at once; an unchosen offer is picked for you', () => {
    const game = testGame('eng', 26);
    const club = userClub(game);
    const offer = club.sponsorOffers![1];
    const bank = club.balance;
    chooseSponsor(game, 1);
    expect(club.balance).toBe(bank + offer.upfront);
    expect(club.sponsorOffers).toBeUndefined();

    const other = testGame('eng', 27);
    for (let i = 0; i < 6; i++) playWeek(other);
    expect(userClub(other).sponsor?.style).toBe('steady');
  });

  it('a loan pays out and is repaid weekly', () => {
    const game = testGame('eng', 28);
    const club = userClub(game);
    const opts = loanOptions(game, club);
    expect(takeLoan(game, opts[0].amount)).toBeNull();
    const owed = club.loan!.remaining;
    playWeek(game);
    expect(club.loan!.remaining).toBe(owed - club.loan!.weekly);
    expect(takeLoan(game, opts[0].amount)).toMatch(/Pay off/);
  });
});

describe('season payouts and the board', () => {
  it('pays prize money and the board reviews the season', () => {
    const game = testGame('eng', 29);
    const before = boardOf(userClub(game)).confidence;
    playToSeasonEnd(game);
    for (const c of Object.values(game.clubs)) expect(c.ledger?.prize ?? 0).toBeGreaterThan(0);
    expect(boardOf(userClub(game)).confidence).not.toBe(before);
    expect((game.inbox ?? []).some((i) => /board is (pleased|disappointed)/.test(i.text))).toBe(true);
  });
});
