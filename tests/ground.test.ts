import { describe, expect, it } from 'vitest';
import { chairmanWeek } from '../src/engine/club/chairman';
import { injuryFactor, trainingBonus } from '../src/engine/club/facilities';
import { fanVerdict, playerVerdict } from '../src/engine/club/feedback';
import { weeklyCorporate } from '../src/engine/club/matchday';
import {
  MAX_GROUND, completeStadiumWork, groundOptions, groundUpkeep, stadiumOf, standOptions, startCommercialWork, startStadiumWork, totalCapacity,
} from '../src/engine/club/stadium';
import { partUpgrade, startPartWork, trainingGroundUpkeep } from '../src/engine/club/trainingGround';
import { crowdFill, spareWeeklyIncome } from '../src/engine/economy/finance';
import { matchPrepBoost, trainingKnocks, trainingRecovery } from '../src/engine/players/training';
import { Rng } from '../src/engine/rng';
import { userClub } from '../src/engine/world';
import { testGame } from './helpers';

function rich() {
  const game = testGame('eng', 77);
  const club = userClub(game);
  club.balance = 50_000_000;
  return { game, club };
}

function finishBuilds(game: ReturnType<typeof testGame>) {
  for (let i = 0; i < 30 && stadiumOf(userClub(game)).builds.length; i++) chairmanWeek(game, new Rng(i));
}

describe('ground: corners, seats and the 150k limit', () => {
  it('a new ground has four sides and four empty corners', () => {
    const { club } = rich();
    const s = stadiumOf(club);
    expect(s.stands).toHaveLength(8);
    expect(s.stands.filter((x) => x.corner).every((x) => x.capacity === 0)).toBe(true);
  });

  it('extensions are all seated, corners included', () => {
    const { game, club } = rich();
    const corner = stadiumOf(club).stands.findIndex((x) => x.corner);
    const opt = standOptions(game, club, corner).find((o) => o.kind === 'extend')!;
    expect(opt.label).toMatch(/corner/);
    expect(startStadiumWork(club, opt)).toBeNull();
    finishBuilds(game);
    const c = stadiumOf(club).stands[corner];
    expect(c.capacity).toBe(opt.size);
    expect(c.seats).toBe(c.capacity);
  });

  it('the whole ground tops out at 150,000', () => {
    const { game, club } = rich();
    const s = stadiumOf(club);
    for (const [i, st] of s.stands.entries()) {
      st.capacity = st.seats = st.corner ? 7_500 : 30_000;
      expect(standOptions(game, club, i).some((o) => o.kind === 'extend')).toBe(false);
    }
    expect(MAX_GROUND).toBe(150_000);
    expect(totalCapacity(s)).toBe(150_000);
  });

  it('a full roof covers every stand, and later stands come roofed', () => {
    const { game, club } = rich();
    const opt = groundOptions(game, club).find((o) => o.kind === 'fullRoof')!;
    expect(startStadiumWork(club, opt)).toBeNull();
    finishBuilds(game);
    const s = stadiumOf(club);
    expect(s.fullRoof).toBe(true);
    expect(s.stands.filter((x) => x.capacity > 0).every((x) => x.roof)).toBe(true);
    const corner = s.stands.findIndex((x) => x.corner);
    completeStadiumWork(club, { kind: 'extend', stand: corner, size: 250, weeksLeft: 0, totalWeeks: 1, cost: 0 });
    expect(s.stands[corner].roof).toBe(true);
    expect(groundOptions(game, club).some((o) => o.kind === 'fullRoof')).toBe(false);
  });

  it('undersoil heating costs upkeep and shortens injuries', () => {
    const { game, club } = rich();
    const before = { upkeep: groundUpkeep(game, club), injuries: injuryFactor(club) };
    expect(startStadiumWork(club, groundOptions(game, club).find((o) => o.kind === 'heating')!)).toBeNull();
    finishBuilds(game);
    expect(stadiumOf(club).heating).toBe(true);
    expect(groundUpkeep(game, club)).toBeGreaterThan(before.upkeep);
    expect(injuryFactor(club)).toBeLessThan(before.injuries);
  });

  it('corporate rooms bring in money every week', () => {
    const { game, club } = rich();
    expect(weeklyCorporate(game, club)).toBe(0);
    expect(startCommercialWork(game, club, 'corporate')).toBeNull();
    finishBuilds(game);
    expect(weeklyCorporate(game, club)).toBeGreaterThan(0);
    const bank = club.balance;
    const ledger = club.ledger!.corporate ?? 0;
    chairmanWeek(game, new Rng(99));
    expect(club.ledger!.corporate).toBeGreaterThan(ledger);
    expect(club.balance).not.toBe(bank);
  });
});

describe('training ground parts', () => {
  it('each part costs money, takes weeks and adds upkeep', () => {
    const { game, club } = rich();
    const opt = partUpgrade(game, club, 'gym')!;
    const bank = club.balance;
    expect(startPartWork(game, club, 'gym')).toBeNull();
    expect(club.balance).toBe(bank - opt.cost);
    expect(startPartWork(game, club, 'gym')).toMatch(/already/);
    finishBuilds(game);
    expect(club.trainingGround?.gym).toBe(1);
    expect(trainingGroundUpkeep(club)).toBe(opt.upkeep);
  });

  it('parts help development, fitness, injuries and matches', () => {
    const { game, club } = rich();
    const before = { dev: trainingBonus(club), rec: trainingRecovery(club), knocks: trainingKnocks(club), inj: injuryFactor(club), edge: matchPrepBoost(club) };
    club.trainingGround = { gym: 3, science: 3, recovery: 3, dome: 2, analysis: 3 };
    expect(trainingBonus(club)).toBeGreaterThan(before.dev);
    expect(trainingRecovery(club)).toBeGreaterThan(before.rec);
    expect(trainingKnocks(club)).toBeLessThan(before.knocks);
    expect(injuryFactor(club)).toBeLessThan(before.inj);
    expect(matchPrepBoost(club)).toBeGreaterThan(before.edge);
    // Running costs come off the board's spare income.
    const spare = spareWeeklyIncome(game, club);
    club.trainingGround = {};
    expect(spareWeeklyIncome(game, club)).toBeGreaterThanOrEqual(spare);
  });
});

describe('verdicts', () => {
  it('fans like a covered, seated ground with good food and fair prices, and turn up more', () => {
    const { game, club } = rich();
    const poor = fanVerdict(game, club);
    const fillBefore = crowdFill(game, club);
    const s = stadiumOf(club);
    for (const st of s.stands) {
      st.capacity = st.corner ? 250 : 1000;
      st.seats = st.capacity;
      st.roof = true;
    }
    s.fullRoof = true;
    s.heating = true;
    s.floodlights = true;
    s.food = 3;
    club.ticketPrice = 1;
    const good = fanVerdict(game, club);
    expect(good.score).toBeGreaterThan(poor.score);
    expect(good.stars).toBeGreaterThanOrEqual(4);
    expect(good.quotes.length).toBeGreaterThan(0);
    expect(crowdFill(game, club)).toBeGreaterThan(fillBefore);
  });

  it('players rate a well-equipped training ground higher', () => {
    const { game, club } = rich();
    const before = playerVerdict(game, club);
    club.trainingGround = { gym: 3, science: 3, recovery: 3, dome: 2, analysis: 3 };
    club.facilities = { training: 5, youth: 1, medical: 1 };
    const after = playerVerdict(game, club);
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.stars).toBe(5);
    expect(after.quotes.every((q) => q.good)).toBe(true);
  });
});
