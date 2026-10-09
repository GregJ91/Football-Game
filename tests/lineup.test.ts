import { describe, expect, it } from 'vitest';
import { FORMATIONS, assignToSlot, autoLineup, remapLineup, selectionFromLineup } from '../src/engine/match/selection';
import { SQUAD_TEMPLATE, generatePlayer } from '../src/engine/players/generate';
import { Rng } from '../src/engine/rng';
import { advanceToUserMatch, startUserMatch, teamSheet, userSelection } from '../src/engine/season/season';
import { squadOf, userClub } from '../src/engine/world';
import { testGame } from './helpers';

const squad = () => {
  const rng = new Rng(5);
  return SQUAD_TEMPLATE.map((position, i) => generatePlayer(rng, { id: `p${i}`, position, quality: 60, clubId: 'c', season: 2026, age: 25 }));
};

describe('chosen starting XI', () => {
  it('uses the chosen players in their slots', () => {
    const s = squad();
    const lineup = autoLineup(s, '4-4-2');
    const benchStriker = s.find((p) => p.position === 'ST' && !lineup.includes(p.id))!;
    const stSlot = FORMATIONS['4-4-2'].indexOf('ST');
    const mine = assignToSlot(lineup, stSlot, benchStriker.id);
    const { selection, covers } = selectionFromLineup(s, '4-4-2', mine);
    expect(selection.xi[stSlot].id).toBe(benchStriker.id);
    expect(covers).toEqual([]);
    expect(selection.bench.some((p) => p.id === benchStriker.id)).toBe(false);
  });

  it('swaps two starters when one is moved into the other slot', () => {
    const lineup = ['a', 'b', 'c'];
    expect(assignToSlot(lineup, 0, 'c')).toEqual(['c', 'b', 'a']);
  });

  it('covers an injured pick with the best available player and says so', () => {
    const s = squad();
    const lineup = autoLineup(s, '4-4-2');
    const keeper = s.find((p) => p.id === lineup[0])!;
    keeper.injuryWeeks = 3;
    const { selection, covers } = selectionFromLineup(s, '4-4-2', lineup);
    expect(selection.xi[0].id).not.toBe(keeper.id);
    expect(selection.xi[0].position).toBe('GK');
    expect(covers).toEqual([{ slotIndex: 0, slot: 'GK', outId: keeper.id, inId: selection.xi[0].id, reason: 'injured' }]);
  });

  it('keeps the same players when the formation changes', () => {
    const s = squad();
    const lineup = autoLineup(s, '4-4-2');
    const remapped = remapLineup(s, lineup, '4-3-3');
    expect(new Set(remapped)).toEqual(new Set(lineup));
    expect(remapped[0]).toBe(lineup[0]); // keeper stays in goal
  });

  it("is what the user's club actually fields, live or simmed", () => {
    const game = testGame('eng', 8);
    const club = userClub(game);
    const s = squadOf(game, club.id);
    const lineup = autoLineup(s, club.tactics.formation);
    const reserve = s.find((p) => !lineup.includes(p.id) && p.position !== 'GK')!;
    club.lineup = assignToSlot(lineup, 5, reserve.id);
    expect(userSelection(game).selection.xi.map((p) => p.id)).toContain(reserve.id);

    const fixture = advanceToUserMatch(game)!;
    const opp = game.clubs[fixture.homeId === club.id ? fixture.awayId : fixture.homeId];
    expect(teamSheet(game, club, opp).selection.xi.map((p) => p.id)).toContain(reserve.id);
    const live = startUserMatch(game, fixture);
    const side = fixture.homeId === club.id ? 'home' : 'away';
    expect(live[side].onPitch.map((o) => o.player.id)).toContain(reserve.id);
  });
});
