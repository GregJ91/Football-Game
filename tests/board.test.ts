import { describe, expect, it } from 'vitest';
import { advanceHalfDay } from '../src/engine/calendar';
import { boardCheck, boardOf, difficultyOf, judge, shiftConfidence } from '../src/engine/club/chairman';
import { playToSeasonEnd, playWeek, startNextSeason } from '../src/engine/season/season';
import type { Difficulty } from '../src/engine/types';
import { buildTable } from '../src/engine/season/table';
import { divisionOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

const game = (difficulty: Difficulty, seed = 91) => testGame('eng', seed, { difficulty });

describe('difficulty', () => {
  it('sets starting money and the board’s starting confidence', () => {
    const [easy, normal, hard] = (['easy', 'normal', 'hard'] as const).map((d) => game(d));
    expect(difficultyOf(hard)).toBe('hard');
    expect(userClub(easy).balance).toBeGreaterThan(userClub(normal).balance);
    expect(userClub(normal).balance).toBeGreaterThan(userClub(hard).balance);
    expect(boardOf(userClub(easy)).confidence).toBeGreaterThan(boardOf(userClub(hard)).confidence);
  });

  it('bad news hits harder on hard, softer on easy', () => {
    const easy = game('easy');
    const hard = game('hard');
    boardOf(userClub(easy)).confidence = boardOf(userClub(hard)).confidence = 50;
    shiftConfidence(easy, -10);
    shiftConfidence(hard, -10);
    expect(boardOf(userClub(easy)).confidence).toBe(45);
    expect(boardOf(userClub(hard)).confidence).toBeCloseTo(36.5);
  });

  it('older saves count as normal', () => {
    const g = game('normal');
    delete g.settings!.difficulty;
    expect(difficultyOf(g)).toBe('normal');
  });
});

describe('the board', () => {
  it('loses patience when you are well behind the target, and warms when on track', () => {
    const g = game('normal', 92);
    const b = boardOf(userClub(g));
    while (g.week < 8) playWeek(g);
    const div = divisionOf(g, g.userClubId);
    const pos = buildTable(div.clubIds, g.fixtures.filter((f) => f.divisionId === div.def.id)).findIndex((r) => r.clubId === g.userClubId) + 1;
    // Well behind: a title target from a mid-table position.
    b.target = { label: 'Win the league', position: Math.max(1, pos - 6) };
    b.confidence = 50;
    boardCheck(g);
    expect(b.confidence).toBeLessThan(50);
    // On track: a target they're already beating.
    b.target = { label: 'Avoid relegation', position: div.clubIds.length };
    b.confidence = 50;
    boardCheck(g);
    expect(b.confidence).toBeGreaterThan(50);
  });

  it('on normal it warns but never sacks', () => {
    const g = game('normal', 93);
    boardOf(userClub(g)).confidence = 5;
    expect(judge(g, false)).toBe(false);
    expect(boardOf(userClub(g)).warning).toBe('final');
    g.week += 8;
    expect(judge(g, true)).toBe(false);
    expect(g.phase).toBe('season');
  });

  it('on easy there are no warnings at all', () => {
    const g = game('easy', 94);
    boardOf(userClub(g)).confidence = 5;
    judge(g, false);
    expect(boardOf(userClub(g)).warning).toBeUndefined();
  });

  it('on hard: concerned, final warning, then the sack a month later', () => {
    const g = game('hard', 95);
    g.startSeason = g.season - 1;
    const b = boardOf(userClub(g));
    g.week = 10;
    b.confidence = 25;
    judge(g, false);
    expect(b.warning).toBe('concerned');
    b.confidence = 15;
    expect(judge(g, false)).toBe(false);
    expect(b.warning).toBe('final');
    expect(g.inbox!.some((i) => i.subject === 'Final warning')).toBe(true);
    g.week = 12;
    expect(judge(g, false)).toBe(false);
    g.week = 14;
    expect(judge(g, false)).toBe(true);
    expect(g.phase).toBe('sacked');
    expect(g.sacked?.reason).toMatch(/final warning/);
  });

  it('on hard, recovering lifts the warning', () => {
    const g = game('hard', 96);
    const b = boardOf(userClub(g));
    b.confidence = 15;
    judge(g, false);
    b.confidence = 45;
    judge(g, false);
    expect(b.warning).toBeUndefined();
  });

  it('on hard, falling to 8 is the sack straight away', () => {
    const g = game('hard', 97);
    g.startSeason = g.season - 1;
    boardOf(userClub(g)).confidence = 8;
    expect(judge(g, false)).toBe(true);
  });

  it('a new manager is not sacked during his first season, only at its end', () => {
    const g = game('hard', 100);
    boardOf(userClub(g)).confidence = 5;
    g.week = 20;
    expect(judge(g, false)).toBe(false);
    expect(boardOf(userClub(g)).warning).toBe('final');
    expect(judge(g, true)).toBe(true);
  });

  it('once sacked, the season stops and nothing moves on', () => {
    const g = game('hard', 98);
    g.startSeason = g.season - 1;
    boardOf(userClub(g)).confidence = 5;
    judge(g, false);
    const week = g.week;
    playToSeasonEnd(g);
    expect(g.week).toBe(week);
    expect(advanceHalfDay(g)).toBe('seasonEnd');
    startNextSeason(g);
    expect(g.phase).toBe('sacked');
  });

  it('a season on hard runs to the end or to the sack, never both', () => {
    const g = game('hard', 99);
    playToSeasonEnd(g);
    expect(['seasonEnd', 'sacked']).toContain(g.phase);
    if (g.phase === 'sacked') expect(g.sacked).toBeDefined();
  });
});
