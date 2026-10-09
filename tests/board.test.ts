import { describe, expect, it } from 'vitest';
import { careerOf, takeJob, waitAWeek, waitForOffer } from '../src/engine/club/career';
import { boardCheck, boardOf, difficultyOf, judge, shiftConfidence } from '../src/engine/club/chairman';
import { playToSeasonEnd, playWeek } from '../src/engine/season/season';
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
    // A season where the user is well down the table after eight weeks.
    let g = game('normal', 92);
    let pos = 0;
    for (let seed = 92; seed < 120; seed++) {
      g = game('normal', seed);
      while (g.week < 8) playWeek(g);
      const d = divisionOf(g, g.userClubId);
      pos = buildTable(d.clubIds, g.fixtures.filter((f) => f.divisionId === d.def.id)).findIndex((r) => r.clubId === g.userClubId) + 1;
      if (pos >= 8) break;
    }
    expect(pos).toBeGreaterThanOrEqual(8);
    const b = boardOf(userClub(g));
    const div = divisionOf(g, g.userClubId);
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
    expect(g.unemployed?.reason).toMatch(/final warning/);
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

  it('a season on hard runs to the end, sacked or not', () => {
    const g = game('hard', 99);
    playToSeasonEnd(g);
    expect(g.phase).toBe('seasonEnd');
  });
});

describe('out of work', () => {
  const sacked = () => {
    const g = game('hard', 101);
    g.startSeason = g.season - 1;
    while (g.week < 10) playWeek(g);
    boardOf(userClub(g)).confidence = 5;
    judge(g, false);
    return g;
  };

  it('the old club gets a new manager and clubs get in touch straight away', () => {
    const g = sacked();
    const old = g.clubs[g.unemployed!.fromClubId];
    expect(old.isUser).toBe(false);
    expect(g.unemployed!.offers.length).toBeGreaterThan(0);
    expect(g.unemployed!.offers.every((o) => o.clubId !== old.id)).toBe(true);
    // Offers come from your level or a step or two down.
    const level = g.unemployed!.level;
    for (const o of g.unemployed!.offers) {
      const l = divisionOf(g, o.clubId).def.level;
      expect(l).toBeGreaterThanOrEqual(level - 1);
      expect(l).toBeLessThanOrEqual(level + 2);
    }
    expect(careerOf(g)[0].left).toBe('sacked');
    expect((g.inbox ?? []).filter((i) => i.kind === 'bid' && !i.resolved)).toHaveLength(0);
  });

  it('the world plays on while you wait, offers lapse and new ones arrive, across seasons too', () => {
    const g = sacked();
    const week = g.week;
    waitAWeek(g);
    expect(g.week).toBe(week + 1);
    const season = g.season;
    for (let i = 0; i < 60 && g.unemployed; i++) waitAWeek(g);
    expect(g.season).toBeGreaterThan(season);
    expect(g.unemployed!.offers.length).toBeLessThanOrEqual(3);
    // Nothing lands in an inbox you don't have.
    expect(g.inbox!.filter((i) => i.season > season)).toHaveLength(0);
  });

  it('taking a job hands you the club, with a new board, target, budgets and ground', () => {
    const g = sacked();
    const offer = g.unemployed!.offers[0];
    expect(takeJob(g, 'not-a-club')).not.toBeNull();
    expect(takeJob(g, offer.clubId)).toBeNull();
    const club = userClub(g);
    expect(club.id).toBe(offer.clubId);
    expect(club.isUser).toBe(true);
    expect(g.unemployed).toBeUndefined();
    expect(club.board!.target).toBeDefined();
    expect(club.budgets).toBeDefined();
    expect(club.stadium!.stands).toHaveLength(4);
    expect(club.capacity).toBeGreaterThan(0);
    expect(careerOf(g).map((s) => s.clubId)).toEqual([g.career![0].clubId, club.id]);
    // A new manager gets his first season.
    expect(g.startSeason).toBe(g.season);
    // And the season carries on with you in charge.
    playToSeasonEnd(g);
    expect(club.history.at(-1)!.season).toBe(g.season);
  });

  it('wait for an offer stops as soon as one arrives', () => {
    const g = sacked();
    g.unemployed!.offers = [];
    waitForOffer(g);
    expect(g.unemployed!.offers.length).toBeGreaterThan(0);
  });
});
