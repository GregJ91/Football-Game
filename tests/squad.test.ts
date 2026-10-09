import { describe, expect, it } from 'vitest';
import { FORMATIONS, autoLineup, pickTeam } from '../src/engine/match/selection';
import {
  BENCH_SIZE, ROLE_SHARE, assignToBench, dailyRecovery, playingTimeCheck, recoverTo, restTired, roleOf, setRole, withBench,
} from '../src/engine/players/squad';
import { userSelection } from '../src/engine/season/season';
import { squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

describe('fitness', () => {
  it('players recover a little each day, more with stamina', () => {
    const game = testGame('eng', 81);
    const [a, b] = squadOf(game, game.userClubId);
    a.fitness = 50;
    b.fitness = 50;
    game.recoveredTo = 10;
    recoverTo(game, 13);
    expect(a.fitness).toBeCloseTo(Math.min(100, 50 + 3 * dailyRecovery(a)));
    expect(dailyRecovery(a)).toBeGreaterThanOrEqual(3);
    expect(dailyRecovery(a)).toBeLessThanOrEqual(5);
    // Going back in time does nothing.
    const before = a.fitness;
    recoverTo(game, 11);
    expect(a.fitness).toBe(before);
  });
});

describe('rotation', () => {
  it('rests a tired starter for a fresh player who plays there', () => {
    const game = testGame('eng', 82);
    const club = userClub(game);
    const squad = squadOf(game, club.id);
    const lineup = autoLineup(squad, club.tactics.formation);
    const starter = squad.find((p) => p.id === lineup[1])!; // a defender
    starter.fitness = 40;
    const { lineup: rested, swaps } = restTired(squad, club.tactics.formation, lineup);
    expect(swaps.map((s) => s.outId)).toContain(starter.id);
    const inn = squad.find((p) => p.id === rested[1])!;
    expect(inn.fitness).toBeGreaterThanOrEqual(85);
    expect(inn.positions).toContain('DR');
  });

  it('auto-pick already leaves out a badly tired player', () => {
    const game = testGame('eng', 83);
    const squad = squadOf(game, game.userClubId);
    const best = pickTeam(squad, '4-4-2').xi;
    // A starter with a natural replacement of similar ability waiting.
    const starter = best.find((p) => squad.some((q) => !best.includes(q) && q.positions.includes(p.position) && q.overall >= p.overall - 3))!;
    expect(starter).toBeDefined();
    starter.fitness = 40;
    expect(pickTeam(squad, '4-4-2').xi.map((p) => p.id)).not.toContain(starter.id);
  });

  it('the assistant rests tired picks in simmed matches, but your lineup is kept', () => {
    const game = testGame('eng', 84);
    const club = userClub(game);
    const squad = squadOf(game, club.id);
    club.lineup = autoLineup(squad, club.tactics.formation);
    const slots = FORMATIONS[club.tactics.formation];
    // A starter with a fresh natural replacement of similar ability on the bench.
    const i = slots.findIndex((slot, k) => {
      const starter = squad.find((p) => p.id === club.lineup![k])!;
      return squad.some((p) => !club.lineup!.includes(p.id) && p.positions.includes(slot) && p.overall >= starter.overall - 4);
    });
    expect(i).toBeGreaterThanOrEqual(0);
    const tired = squad.find((p) => p.id === club.lineup![i])!;
    tired.fitness = 40;
    expect(userSelection(game).selection.xi).toContain(tired);
    expect(userSelection(game, undefined, true).selection.xi).not.toContain(tired);
    expect(club.lineup[i]).toBe(tired.id);
  });
});

describe('the bench', () => {
  it('uses your chosen substitutes, topped up with the best of the rest', () => {
    const game = testGame('eng', 85);
    const club = userClub(game);
    const squad = squadOf(game, club.id);
    const auto = userSelection(game).selection;
    const outsider = squad.filter((p) => !auto.xi.includes(p) && !auto.bench.includes(p))[0];
    club.bench = assignToBench(auto.bench.map((p) => p.id), 0, outsider.id);
    const sel = userSelection(game).selection;
    expect(sel.bench[0]).toBe(outsider);
    expect(sel.bench).toHaveLength(BENCH_SIZE);
    // A chosen sub who's injured is skipped.
    outsider.injuryWeeks = 2;
    expect(withBench(sel, squad, club.bench).bench).not.toContain(outsider);
  });
});

describe('squad roles and happiness', () => {
  it('every player in your squad has a role, the best as key players', () => {
    const game = testGame('eng', 86);
    const squad = squadOf(game, game.userClubId).sort((a, b) => b.overall - a.overall);
    expect(squad.slice(0, 5).every((p) => roleOf(p) === 'key')).toBe(true);
    expect(squad.every((p) => p.role)).toBe(true);
  });

  it('a key player left out complains, then asks to leave, then settles when he plays', () => {
    const game = testGame('eng', 87);
    const club = userClub(game);
    const squad = squadOf(game, club.id);
    const p = squad.find((x) => roleOf(x) === 'key')!;
    for (const x of squad) x.seasonStats.apps = 10;
    p.seasonStats.apps = 1;
    club.seasonGames = 10;
    const morale = p.morale;
    playingTimeCheck(game);
    expect(p.unhappy).toBe(1);
    expect(p.morale).toBeLessThan(morale);
    expect(game.inbox!.some((i) => i.subject === 'Unhappy with playing time' && i.text.includes(p.lastName))).toBe(true);
    playingTimeCheck(game);
    playingTimeCheck(game);
    expect(p.transferRequest).toBe(true);
    // Back in the side: the grievance fades and the request is withdrawn.
    p.seasonStats.apps = 10;
    for (let i = 0; i < 3; i++) playingTimeCheck(game);
    expect(p.unhappy).toBe(0);
    expect(p.transferRequest).toBe(false);
  });

  it('backups and prospects are happy with little football', () => {
    expect(ROLE_SHARE.backup).toBeLessThan(0.2);
    const game = testGame('eng', 88);
    const club = userClub(game);
    const squad = squadOf(game, club.id);
    const backup = squad.find((x) => roleOf(x) === 'backup' || roleOf(x) === 'prospect')!;
    for (const x of squad) x.seasonStats.apps = 10;
    backup.seasonStats.apps = 0;
    club.seasonGames = 10;
    playingTimeCheck(game);
    expect(backup.unhappy ?? 0).toBe(0);
  });

  it('promotion pleases a player; dropping a key player hurts', () => {
    const game = testGame('eng', 89);
    const squad = squadOf(game, game.userClubId);
    const key = squad.find((x) => roleOf(x) === 'key')!;
    const backup = squad.find((x) => roleOf(x) === 'backup' || roleOf(x) === 'prospect')!;
    key.morale = backup.morale = 70;
    setRole(key, 'rotation');
    setRole(backup, 'first');
    expect(key.morale).toBeLessThan(70);
    expect(backup.morale).toBeGreaterThan(70);
    expect(key.roleSetByUser && backup.roleSetByUser).toBe(true);
  });
});

describe('medical', () => {
  it('injuries have names, are logged for your club and clear when healed', async () => {
    const { playWeek } = await import('../src/engine/season/season');
    const { daysToFull } = await import('../src/engine/players/squad');
    const game = testGame('eng', 172, { topFlight: true });
    for (let i = 0; i < 20; i++) playWeek(game);
    const club = userClub(game);
    const log = club.injuryLog ?? [];
    expect(log.length).toBeGreaterThan(0);
    for (const r of log) {
      expect(r.injury.length).toBeGreaterThan(2);
      expect(r.weeks).toBeGreaterThan(0);
    }
    for (const p of squadOf(game, club.id)) {
      if (p.injuryWeeks > 0) expect(p.injuryName).toBeDefined();
      else expect(p.injuryName).toBeUndefined();
    }
    const p = squadOf(game, club.id)[0];
    p.fitness = 70;
    expect(daysToFull(p)).toBeGreaterThan(5);
    p.fitness = 100;
    expect(daysToFull(p)).toBe(0);
  });
});
