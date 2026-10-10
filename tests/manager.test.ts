import { describe, expect, it } from 'vitest';
import { careerOf } from '../src/engine/club/career';
import { acceptJobOffer, bestXI, careerBlurb, declineJobOffer, jobOffers, managerOf, maybeJobOffer, teamTrophies } from '../src/engine/club/manager';
import { boardOf } from '../src/engine/club/chairman';
import { Rng } from '../src/engine/rng';
import { playToSeasonEnd, playWeek } from '../src/engine/season/season';
import { completeTransfer } from '../src/engine/transfers/market';
import { divisionOf, squadOf } from '../src/engine/world';
import { testGame } from './helpers';

describe('the manager record', () => {
  it('counts every game, goal and transfer', () => {
    const game = testGame('eng', 901);
    for (let i = 0; i < 6; i++) playWeek(game);
    const m = managerOf(game);
    expect(m.games).toBeGreaterThanOrEqual(6);
    expect(m.won + m.drawn + m.lost).toBe(m.games);
    expect(m.goalsFor + m.goalsAgainst).toBeGreaterThan(0);
    expect(Object.values(m.formations).reduce((a, b) => a + b, 0)).toBe(m.games);

    const rival = divisionOf(game, game.userClubId).clubIds.find((id) => id !== game.userClubId)!;
    const target = squadOf(game, rival)[0];
    completeTransfer(game, target, game.userClubId, 20_000, target.wage, 2);
    const cheap = squadOf(game, rival)[0];
    completeTransfer(game, cheap, game.userClubId, 5_000, cheap.wage, 2);
    const sold = squadOf(game, game.userClubId)[0];
    completeTransfer(game, sold, rival, 8_000, sold.wage, 2);
    expect(m.feesOut).toBe(25_000);
    expect(m.feesIn).toBe(8_000);
    expect(m.biggestSigning).toMatchObject({ fee: 20_000 });
    expect(m.cheapestSigning).toMatchObject({ fee: 5_000 });
    expect(m.biggestSale).toMatchObject({ fee: 8_000 });
    expect(careerBlurb(game)).toMatch(/1 club/);
  });

  it('a season builds a best XI and the trophy room', () => {
    const game = testGame('eng', 902, { topFlight: true });
    playToSeasonEnd(game);
    const xi = bestXI(game);
    expect(xi.length).toBeGreaterThan(8);
    expect(xi.length).toBeLessThanOrEqual(11);
    const m = managerOf(game);
    const champions = game.lastSummary!.champions[divisionOf(game, game.userClubId).def.id] === game.userClubId;
    if (champions) expect(m.honours.some((h) => /Manager of the Season/.test(h.name))).toBe(true);
    for (const t of teamTrophies(game)) expect(t.clubName).toBe(game.clubs[game.userClubId].name);
    expect(m.honours.every((h) => h.clubName && h.season)).toBe(true);
  });
});

describe('job offers while in work', () => {
  it('a bigger club asks; accept and you move, keeping your record', () => {
    const game = testGame('eng', 903);
    for (let i = 0; i < 8; i++) playWeek(game);
    const old = game.userClubId;
    const before = managerOf(game).games;
    maybeJobOffer(game, new Rng(1), 1);
    const [offer] = jobOffers(game);
    expect(offer).toBeDefined();
    expect(divisionOf(game, offer.clubId).def.level).toBeLessThanOrEqual(divisionOf(game, old).def.level);
    expect(acceptJobOffer(game, offer.clubId)).toBeNull();
    expect(game.userClubId).toBe(offer.clubId);
    expect(game.clubs[old].isUser).toBe(false);
    expect(careerOf(game).map((s) => s.left)).toEqual(['moved', undefined]);
    expect(managerOf(game).games).toBe(before);
    playWeek(game);
    expect(managerOf(game).games).toBeGreaterThan(before);
  });

  it('turning an offer down pleases the board', () => {
    const game = testGame('eng', 904);
    for (let i = 0; i < 8; i++) playWeek(game);
    maybeJobOffer(game, new Rng(2), 1);
    const [offer] = jobOffers(game);
    const conf = boardOf(game.clubs[game.userClubId]).confidence;
    declineJobOffer(game, offer.clubId);
    expect(jobOffers(game)).toHaveLength(0);
    expect(boardOf(game.clubs[game.userClubId]).confidence).toBeGreaterThan(conf);
  });

  it('no offers during a challenge', () => {
    const game = testGame('eng', 905, { challenge: 'kids' });
    for (let i = 0; i < 8; i++) playWeek(game);
    maybeJobOffer(game, new Rng(3), 1);
    expect(jobOffers(game)).toHaveLength(0);
  });
});
