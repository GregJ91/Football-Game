import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { matchdayCount, roundRobin } from '../src/engine/season/fixtures';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import { buildTable } from '../src/engine/season/table';
import type { Fixture } from '../src/engine/types';
import { divisionOf, domesticClubs } from '../src/engine/world';
import { testGame } from './helpers';

describe('fixtures', () => {
  it('double round robin: everyone plays everyone home and away, once per matchday', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const days = roundRobin(ids, 2, new Rng(1));
    expect(days).toHaveLength(matchdayCount(20, 2));
    const seen = new Set<string>();
    for (const day of days) {
      const playing = day.flat();
      expect(new Set(playing).size).toBe(20);
      for (const [h, a] of day) seen.add(`${h}-${a}`);
    }
    expect(seen.size).toBe(20 * 19);
  });

  it('four-round Scottish format gives 36 games each', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const days = roundRobin(ids, 4, new Rng(2));
    const games = days.flat().filter(([h, a]) => h === 'c0' || a === 'c0');
    expect(games).toHaveLength(36);
  });

  it('every club plays at most once per week', () => {
    const game = testGame('eng');
    for (let w = 0; w < game.totalWeeks; w++) {
      const clubs = game.fixtures.filter((f) => f.week === w).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(clubs).size).toBe(clubs.length);
    }
  });
});

describe('table', () => {
  it('sorts by points, then goal difference, then goals scored', () => {
    const r = (homeGoals: number, awayGoals: number) => ({
      homeGoals, awayGoals, events: [], homeXI: [], awayXI: [], ratings: {}, possessionHome: 50, shotsHome: 0, shotsAway: 0, attendance: 0,
    });
    const f = (homeId: string, awayId: string, hg: number, ag: number): Fixture => ({
      id: `${homeId}${awayId}`, divisionId: 'd', week: 0, homeId, awayId, result: r(hg, ag),
    });
    const table = buildTable(['a', 'b', 'c', 'd'], [
      f('a', 'b', 1, 0), // a 3pts
      f('c', 'd', 3, 0), // c 3pts, better GD
      f('b', 'd', 2, 2),
    ]);
    expect(table.map((t) => t.clubId)).toEqual(['c', 'a', 'b', 'd']);
    expect(table[0]).toMatchObject({ played: 1, won: 1, goalsFor: 3, points: 3 });
  });
});

describe('season flow', () => {
  it('plays a full season, promotes and relegates, keeps division sizes', () => {
    const game = testGame('eng', 7);
    playWeek(game);
    expect(game.week).toBe(1);
    playToSeasonEnd(game);
    expect(game.phase).toBe('seasonEnd');
    expect(game.fixtures.every((f) => f.result)).toBe(true);

    const s = game.lastSummary!;
    expect(s.promoted['eng-2']).toHaveLength(3);
    expect(s.relegated['eng-1']).toHaveLength(3);
    expect(s.playoffs.filter((p) => p.divisionId === 'eng-2')).toHaveLength(3);
    const relegated = s.relegated['eng-1'][0];
    const promoted = s.promoted['eng-2'][0];

    startNextSeason(game);
    expect(game.season).toBe(2027);
    expect(game.phase).toBe('season');
    expect(divisionOf(game, relegated).def.id).toBe('eng-2');
    expect(divisionOf(game, promoted).def.id).toBe('eng-1');
    for (const div of game.divisions) expect(div.clubIds).toHaveLength(div.def.size);
    expect(game.fixtures.every((f) => !f.result)).toBe(true);
  });

  it('records the season in every club history', () => {
    const game = testGame('sco', 3);
    playToSeasonEnd(game);
    for (const c of domesticClubs(game)) expect(c.history).toHaveLength(1);
  });
});

describe('multi-season stability', () => {
  it('keeps divisions full, squads healthy and ratings anchored over several seasons', () => {
    const game = testGame('sco', 21);
    const avg = () => {
      const all = Object.values(game.players).map((p) => p.overall);
      return all.reduce((s, x) => s + x, 0) / all.length;
    };
    const start = avg();
    for (let s = 0; s < 4; s++) {
      playToSeasonEnd(game);
      startNextSeason(game);
      for (const div of game.divisions) expect(div.clubIds).toHaveLength(div.def.size);
      for (const c of domesticClubs(game)) {
        expect(c.playerIds.length).toBeGreaterThanOrEqual(18);
        expect(c.playerIds.every((id) => game.players[id]?.clubId === c.id)).toBe(true);
      }
    }
    expect(Math.abs(avg() - start)).toBeLessThan(3);
    expect(game.season).toBe(2030);
  });
});

describe('live user match', () => {
  it('pauses at half time, accepts subs and tactics, then records the result', async () => {
    const { advanceToUserMatch, startUserMatch, completeUserMatch } = await import('../src/engine/season/season');
    const { stepMinute, giveTeamTalk, makeSub, changeTactics, runToEnd } = await import('../src/engine/match/engine');
    const game = testGame('eng', 31);
    const fixture = advanceToUserMatch(game)!;
    const weekBefore = game.week;
    const live = startUserMatch(game, fixture);
    const side = fixture.homeId === game.userClubId ? 'home' : 'away';
    while (!live.halfTimePending) stepMinute(live);
    expect(live.minute).toBe(45);
    stepMinute(live);
    expect(live.minute).toBe(45); // paused until the talk
    giveTeamTalk(live, side, 'rally');
    live.halfTimePending = false;
    const out = live[side].onPitch.find((o) => o.slot !== 'GK')!.player;
    const inc = live[side].bench.find((b) => b.position !== 'GK')!;
    expect(makeSub(live, side, out.id, inc.id)).toBe(true);
    changeTactics(live, side, { formation: '4-3-3', mentality: 'attacking', pressing: 'high' });
    expect(live[side].onPitch.map((o) => o.slot)).toContain('DMC');
    runToEnd(live);
    const result = completeUserMatch(game, fixture, live);
    expect(fixture.result).toBe(result);
    expect(result.events.some((e) => e.type === 'sub' && e.inId === inc.id)).toBe(true);
    expect(result.events.some((e) => e.type === 'attack')).toBe(false);
    expect(game.week).toBe(weekBefore + 1);
    expect(game.fixtures.filter((f) => f.week === weekBefore).every((f) => f.result)).toBe(true);
  });
});
