import { describe, expect, it } from 'vitest';
import { injuryFactor, trainingBonus } from '../src/engine/club/facilities';
import {
  STAFF_ROLES, assistantMorale, grievanceFactor, hireStaff, physioFactor, scoutReportsPerWeek, staffCandidates, staffRating,
} from '../src/engine/club/staff';
import { playWeek } from '../src/engine/season/season';
import { divisionOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

describe('backroom staff', () => {
  it('a new club has a full backroom team suited to its level', () => {
    const g = testGame('eng', 131);
    const club = userClub(g);
    for (const role of STAFF_ROLES) {
      const s = club.staff![role]!;
      expect(s.rating).toBeGreaterThanOrEqual(1);
      expect(s.rating).toBeLessThanOrEqual(12);
      expect(s.wage).toBeGreaterThan(0);
    }
    const giant = testGame('eng', 131, { topFlight: true });
    const avg = (c: typeof club) => STAFF_ROLES.reduce((n, r) => n + c.staff![r]!.rating, 0) / 4;
    expect(avg(userClub(giant))).toBeGreaterThan(avg(club) + 5);
  });

  it('the shortlist holds for the month; hiring replaces the old member of staff', () => {
    const g = testGame('eng', 132);
    const list = staffCandidates(g, 'coach');
    expect(list).toHaveLength(4);
    expect(staffCandidates(g, 'coach')).toEqual(list);
    expect(hireStaff(g, 'coach', 0)).toBeNull();
    expect(userClub(g).staff!.coach).toEqual(list[0]);
    expect(hireStaff(g, 'coach', 9)).not.toBeNull();
  });

  it('staff are paid every week', () => {
    const g = testGame('eng', 133);
    playWeek(g);
    expect(userClub(g).ledger!.staff).toBeGreaterThan(0);
  });

  it('better staff, better effects; AI clubs are neutral', () => {
    const g = testGame('eng', 134);
    const club = userClub(g);
    const set = (r: number) => {
      for (const role of STAFF_ROLES) club.staff![role]!.rating = r;
    };
    set(20);
    const good = { train: trainingBonus(club), injury: injuryFactor(club), physio: physioFactor(club), scouts: scoutReportsPerWeek(club), morale: assistantMorale(club), gripe: grievanceFactor(club) };
    set(1);
    const bad = { train: trainingBonus(club), injury: injuryFactor(club), physio: physioFactor(club), scouts: scoutReportsPerWeek(club), morale: assistantMorale(club), gripe: grievanceFactor(club) };
    expect(good.train).toBeGreaterThan(bad.train);
    expect(good.injury).toBeLessThan(bad.injury);
    expect(good.scouts).toBeGreaterThan(bad.scouts);
    expect(good.morale).toBeGreaterThan(0);
    expect(bad.morale).toBeLessThan(0);
    expect(good.gripe).toBeLessThan(bad.gripe);
    const ai = g.clubs[divisionOf(g, club.id).clubIds.find((id) => id !== club.id)!];
    expect(staffRating(ai, 'coach')).toBe(10);
    expect(trainingBonus(ai)).toBe(0);
  });
});
