import { describe, expect, it } from 'vitest';
import { europeSeasonEnd } from '../src/engine/season/europe';
import { playToSeasonEnd, startNextSeason } from '../src/engine/season/season';
import { testGame } from './helpers';

describe('European winners move up', () => {
  it('Europa League winners go into the Champions League, Conference League winners into the Europa League', () => {
    const game = testGame('eng', 701, { topFlight: true });
    playToSeasonEnd(game);
    const top = game.divisions[0].def.id;
    const table = game.lastSummary!.finalTables[top].map((r) => r.clubId);
    const [uelWinner, ueclWinner] = [table[14], table[15]];
    const comps = game.europe!.comps;
    comps.find((c) => c.id === 'ucl')!.winnerId = game.europe!.foreignIds[0];
    comps.find((c) => c.id === 'uel')!.winnerId = uelWinner;
    comps.find((c) => c.id === 'uecl')!.winnerId = ueclWinner;
    europeSeasonEnd(game, game.lastSummary!);
    const next = game.europe!.next!;
    expect(next.find((e) => e.clubId === uelWinner)).toMatchObject({ compId: 'ucl', playoff: false, reason: 'Europa League winners' });
    expect(next.find((e) => e.clubId === ueclWinner)).toMatchObject({ compId: 'uel', playoff: false, reason: 'Conference League winners' });
    // Nobody is entered twice.
    expect(new Set(next.map((e) => e.clubId)).size).toBe(next.length);
  });
});

describe('Community Shield and UEFA Super Cup', () => {
  it('open the season: champions v FA Cup winners, Champions League v Europa League winners', () => {
    const game = testGame('eng', 702, { topFlight: true });
    playToSeasonEnd(game);
    const top = game.divisions[0].def.id;
    const champions = game.lastSummary!.champions[top];
    const faCup = game.cups!.find((c) => c.id === 'fa-cup')!.winnerId!;
    const runnersUp = game.lastSummary!.finalTables[top][1].clubId;
    const euro = game.lastSummary!.europe!.winners;
    const ucl = euro.find((w) => w.compId === 'ucl')!.clubId;
    const uel = euro.find((w) => w.compId === 'uel')!.clubId;
    startNextSeason(game);

    const shield = game.cups!.find((c) => c.id === 'community-shield')!;
    const tie = shield.rounds[0].ties[0];
    expect([tie.homeId, tie.awayId].sort()).toEqual([champions, faCup === champions ? runnersUp : faCup].sort());
    expect(tie.neutral).toBe(true);
    expect(shield.rounds[0].week).toBe(0);

    const superCup = game.cups!.find((c) => c.id === 'super-cup')!;
    const st = superCup.rounds[0].ties[0];
    if (ucl !== uel) expect([st.homeId, st.awayId].sort()).toEqual([ucl, uel].sort());

    // Both are played early in the season and someone lifts the trophy.
    playToSeasonEnd(game);
    for (const cup of [shield, superCup]) {
      expect(cup.winnerId).toBeDefined();
      const winner = game.clubs[cup.winnerId!];
      if (!winner.foreign || cup.id === 'super-cup') expect(winner.trophies?.some((t) => t.season === game.season)).toBe(true);
    }
  });

  it('Scotland has no Community Shield', () => {
    const game = testGame('sco', 703);
    expect(game.cups!.some((c) => c.id === 'community-shield')).toBe(false);
  });
});
