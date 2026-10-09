import { describe, expect, it } from 'vitest';
import { topScorers } from '../src/engine/season/awards';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import { divisionOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

describe('season awards', () => {
  const game = testGame('eng', 141);
  playToSeasonEnd(game);
  const summary = game.lastSummary!;

  it('every division has its awards and an eleven-man Team of the Season', () => {
    for (const div of game.divisions) {
      const a = summary.awards![div.def.id];
      expect(a.player).toBeDefined();
      expect(a.topScorer!.value).toBeGreaterThan(5);
      expect(a.team).toHaveLength(11);
      expect(new Set(a.team.map((t) => t.playerId)).size).toBe(11);
      expect(a.team.filter((t) => t.position === 'GK')).toHaveLength(1);
      // Award winners played in that division.
      expect(div.clubIds).toContain(a.player!.clubId);
    }
  });

  it('the Golden Boot goes to the top of the scoring chart', () => {
    const div = divisionOf(game, game.userClubId);
    const top = topScorers(game, div.clubIds, 1)[0];
    expect(summary.awards![div.def.id].topScorer!.value).toBe(top.p.seasonStats.goals);
  });

  it('the young player award is for 21 and under', () => {
    for (const div of game.divisions) {
      const y = summary.awards![div.def.id].young;
      if (y) expect(game.players[y.playerId].age).toBeLessThanOrEqual(21);
    }
  });

  it('the club keeps a Hall of Fame and records across seasons', () => {
    const club = userClub(game);
    const legends = Object.values(club.legends!);
    expect(legends.length).toBeGreaterThan(11);
    const apps = legends.reduce((n, l) => n + l.apps, 0);
    expect(apps).toBeGreaterThan(11 * 20);
    expect(club.records!.recordAttendance!.attendance).toBeGreaterThan(0);
    startNextSeason(game);
    playToSeasonEnd(game);
    const after = Object.values(userClub(game).legends!).reduce((n, l) => n + l.apps, 0);
    expect(after).toBeGreaterThan(apps);
  });
});

describe('monthly and yearly awards', () => {
  const game = testGame('eng', 142);
  playToSeasonEnd(game);
  const awards = game.awards!;

  it('every division has a Player, Young Player and Manager of the Month, each month', () => {
    const months = new Set(awards.monthly.map((m) => m.month));
    expect(months.size).toBeGreaterThanOrEqual(9);
    for (const div of game.divisions) {
      const mine = awards.monthly.filter((m) => m.divisionId === div.def.id);
      // A league with no games (or only one) in a month has no award that month.
      expect(mine.length).toBeGreaterThanOrEqual(months.size - 2);
      for (const m of mine) {
        expect(div.clubIds).toContain(m.manager!.clubId);
        expect(m.manager!.played).toBeGreaterThan(0);
        expect(m.player).toBeDefined();
      }
    }
    // Monthly stats start again after each award.
    expect(Object.values(game.players).every((p) => !p.monthStats)).toBe(true);
  });

  it('a Ballon d’Or podium and the Player of the Year from the top flight', () => {
    const year = awards.history.at(-1)!;
    expect(year.season).toBe(game.season);
    expect(year.ballonDor).toHaveLength(10);
    expect(year.ballonDor[0].score).toBeGreaterThanOrEqual(year.ballonDor[1].score);
    const top = game.divisions.find((d) => d.def.level === 1)!;
    expect(top.clubIds).toContain(year.playerOfYear!.clubId);
    expect(year.goldenBoot!.value).toBeGreaterThan(5);
    expect(game.inbox!.some((i) => i.subject === "Ballon d'Or")).toBe(true);
  });
});
