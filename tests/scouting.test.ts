import { describe, expect, it } from 'vitest';
import { advanceHalfDay, assignScout } from '../src/engine/calendar';
import { playWeek } from '../src/engine/season/season';
import { isKnown } from '../src/engine/transfers/market';
import {
  MAX_MISSIONS, cannotSendMission, isShortlisted, scoutReports, sendMission, shortlistPlayers, toggleShortlist,
} from '../src/engine/transfers/scouting';
import { playerById, userClub } from '../src/engine/world';
import { testGame } from './helpers';

const days = (game: ReturnType<typeof testGame>, n: number) => {
  // On a matchday, play the week (the user's match included) and carry on.
  for (let i = 0; i < n * 2; i++) if (advanceHalfDay(game) === 'matchday') playWeek(game);
};

describe('scouting missions', () => {
  it('a mission comes back with reports on players who fit the brief', () => {
    const game = testGame('eng', 201);
    const club = userClub(game);
    const left = game.scoutReportsLeft!;
    expect(sendMission(game, { position: 'DC', maxAge: 24, maxValue: 0, region: 'any' })).toBeNull();
    expect(game.scoutReportsLeft).toBe(left - 1);
    expect(game.scoutMissions).toHaveLength(1);
    days(game, 9);
    expect(game.scoutMissions).toHaveLength(0);
    const reports = scoutReports(game);
    expect(reports.length).toBeGreaterThanOrEqual(3);
    for (const { p, r } of reports) {
      expect(p.positions).toContain('DC');
      expect(p.age).toBeLessThanOrEqual(25); // may have had a birthday since
      expect(p.clubId).not.toBe(club.id);
      expect(r.interest).not.toBe('no');
      expect(isKnown(game, club, p)).toBe(true);
    }
    expect((game.inbox ?? []).some((m) => m.subject?.startsWith('Scouting mission'))).toBe(true);
  });

  it('abroad and free-agent briefs stay in their region', () => {
    const game = testGame('eng', 202, { topFlight: true });
    sendMission(game, { position: 'ANY', maxAge: 99, maxValue: 0, region: 'abroad' });
    sendMission(game, { position: 'ANY', maxAge: 99, maxValue: 0, region: 'free' });
    days(game, 9);
    const all = scoutReports(game);
    const abroad = all.filter(({ r }) => r.mission === all.find((x) => x.p.clubId && game.clubs[x.p.clubId].foreign)?.r.mission);
    expect(abroad.length).toBeGreaterThan(0);
    expect(abroad.every(({ p }) => p.clubId && game.clubs[p.clubId].foreign)).toBe(true);
    expect(all.some(({ p }) => !p.clubId)).toBe(true);
  });

  it('only a couple of missions at once, and each uses a weekly report', () => {
    const game = testGame('eng', 203);
    for (let i = 0; i < MAX_MISSIONS; i++) expect(sendMission(game, { position: 'ST', maxAge: 99, maxValue: 0, region: 'home' })).toBeNull();
    expect(cannotSendMission(game)).toMatch(/already/);
    game.scoutMissions = [];
    game.scoutReportsLeft = 0;
    expect(cannotSendMission(game)).toMatch(/No scouts/);
  });

  it('single-player reports are kept too', () => {
    const game = testGame('eng', 204);
    const club = userClub(game);
    const p = Object.values(game.players).find((x) => x.clubId && !isKnown(game, club, x))!;
    expect(assignScout(game, p.id, false)).toBe('assigned');
    days(game, 5);
    expect(club.scoutReports?.[p.id]).toMatchObject({ ability: p.overall });
  });
});

describe('shortlist', () => {
  it('stars and unstars players', () => {
    const game = testGame('eng', 205);
    const p = Object.values(game.players).find((x) => x.clubId && x.clubId !== game.userClubId)!;
    toggleShortlist(game, p.id);
    expect(isShortlisted(game, p.id)).toBe(true);
    expect(shortlistPlayers(game)).toEqual([playerById(game, p.id)]);
    toggleShortlist(game, p.id);
    expect(shortlistPlayers(game)).toHaveLength(0);
  });
});
