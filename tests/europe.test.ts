import { cupDef } from '../src/data/cups';
import { describe, expect, it } from 'vitest';
import { EURO_COMPS, EURO_SLOTS } from '../src/data/europe';
import { runToEnd } from '../src/engine/match/engine';
import { setupCups } from '../src/engine/season/cups';
import { aggregate, allocatePlaces, leagueMatchdays, leagueTable, setupEurope } from '../src/engine/season/europe';
import { advanceToUserMatch, completeUserMatch, playToSeasonEnd, simUserMatchToday, startNextSeason, startUserMatch } from '../src/engine/season/season';
import type { CupTie, GameState } from '../src/engine/types';
import { divisionOf, domesticClubs, squadOf } from '../src/engine/world';
import { testGame } from './helpers';

const allTies = (game: GameState) => game.europe!.comps.flatMap((c) => c.rounds.flatMap((r) => r.ties));

describe('foreign clubs', () => {
  it('builds a pool of fictional foreign clubs, leaving out the user’s own country', () => {
    const game = testGame('eng', 61);
    const eu = game.europe!;
    expect(eu.foreignIds.length).toBeGreaterThan(110);
    const foreign = eu.foreignIds.map((id) => game.clubs[id]);
    expect(foreign.every((c) => c.foreign && c.foreign.nation !== 'ENG')).toBe(true);
    expect(foreign.some((c) => c.foreign!.nation === 'SCO')).toBe(true);
    expect(new Set(Object.values(game.clubs).map((c) => c.name)).size).toBe(Object.keys(game.clubs).length);
    // Foreign clubs sit outside the pyramid and the player database.
    expect(domesticClubs(game).every((c) => !c.foreign)).toBe(true);
    expect(foreign.every((c) => c.playerIds.length === 0)).toBe(true);
  });

  it('makes a foreign squad on demand, near the club’s strength, the same each time', () => {
    const game = testGame('sco', 62);
    const club = game.clubs[game.europe!.foreignIds[0]];
    const squad = squadOf(game, club.id);
    expect(squad).toHaveLength(22);
    expect(squad.every((p) => !game.players[p.id])).toBe(true);
    const xi = squad.map((p) => p.overall).sort((a, b) => b - a).slice(0, 11);
    const avg = xi.reduce((s, x) => s + x, 0) / 11;
    expect(Math.abs(avg - club.foreign!.strength)).toBeLessThan(4);
    expect(squadOf(game, club.id).map((p) => p.lastName)).toEqual(squad.map((p) => p.lastName));
  });
});

describe('league phase pairings', () => {
  for (const games of [8, 6]) {
    it(`${games} games: one match a matchday, half at home, no repeats`, () => {
      const clubs = Array.from({ length: 36 }, (_, i) => `c${i}`);
      const days = leagueMatchdays(clubs, games);
      expect(days).toHaveLength(games);
      const pairs = new Set<string>();
      const home: Record<string, number> = {};
      for (const day of days) {
        expect(day).toHaveLength(18);
        expect(new Set(day.flat()).size).toBe(36);
        for (const [h, a] of day) {
          pairs.add([h, a].sort().join('-'));
          home[h] = (home[h] ?? 0) + 1;
        }
      }
      expect(pairs.size).toBe(18 * games);
      expect(clubs.every((c) => home[c] === games / 2)).toBe(true);
    });
  }
});

describe('qualification', () => {
  it('a cup winner already qualified passes the place down the league', () => {
    const game = testGame('eng', 63);
    const order = game.divisions[0].clubIds;
    const outsider = game.divisions[1].clubIds[0];
    const places = allocatePlaces(game, order, { 'fa-cup': order[2], 'league-cup': outsider });
    expect(places).toHaveLength(EURO_SLOTS.eng.length);
    expect(places.filter((p) => p.compId === 'ucl').map((p) => p.clubId)).toEqual(order.slice(0, 4));
    expect(places.filter((p) => p.compId === 'uel').map((p) => p.clubId)).toEqual([order[4], order[5]]);
    expect(places.find((p) => p.compId === 'uecl')).toMatchObject({ clubId: outsider, playoff: true, reason: 'League Cup winners' });
  });

  it('Scotland: champions straight in, the rest through the play-off round', () => {
    const game = testGame('sco', 64);
    const entries = game.europe!.entries;
    expect(entries).toHaveLength(EURO_SLOTS.sco.length);
    expect(entries.filter((e) => !e.playoff)).toHaveLength(1);
    expect(entries.every((e) => divisionOf(game, e.clubId).def.level === 1)).toBe(true);
  });
});

describe('a European season', () => {
  const game = testGame('eng', 65);
  const before = structuredClone(game.cups!.flatMap((c) => c.rounds.map((r) => `${r.week}:${r.day}`)));
  playToSeasonEnd(game);

  it('every competition runs from the play-offs to a final', () => {
    for (const comp of game.europe!.comps) {
      const def = EURO_COMPS.find((d) => d.id === comp.id)!;
      expect(new Set(comp.league).size).toBe(36);
      expect(comp.rounds.every((r) => r.drawn && r.played)).toBe(true);
      expect(comp.rounds.every((r) => r.week < game.totalWeeks)).toBe(true);
      const table = leagueTable(comp);
      expect(table.every((r) => r.played === def.leagueGames)).toBe(true);
      const final = comp.rounds.at(-1)!.ties;
      expect(final).toHaveLength(1);
      expect(final[0].neutral).toBe(true);
      expect(comp.winnerId).toBe(final[0].winnerId);
      // Top 8 and the 8 play-off winners make the round of 16.
      const r16 = comp.rounds.find((r) => r.stage === 'r16')!.ties;
      expect(r16).toHaveLength(8);
      const top8 = table.slice(0, 8).map((r) => r.clubId);
      expect(r16.every((t) => top8.includes(t.awayId))).toBe(true);
    }
  });

  it('second legs are decided on aggregate, then extra time and penalties', () => {
    const legs = allTies(game).filter((t) => t.leg === 2);
    expect(legs.length).toBeGreaterThan(30);
    for (const t of legs) {
      const agg = aggregate(game, t)!;
      const homeWon = agg.home !== agg.away ? agg.home > agg.away : t.result!.penalties!.home > t.result!.penalties!.away;
      expect(t.winnerId).toBe(homeWon ? t.homeId : t.awayId);
    }
  });

  it('English entrants play, earn prize money and next season’s places are handed out', () => {
    for (const e of game.europe!.entries) {
      expect(allTies(game).some((t) => t.homeId === e.clubId || t.awayId === e.clubId)).toBe(true);
      expect(game.clubs[e.clubId].ledger!.prize!).toBeGreaterThan(1_000_000);
    }
    // One extra place if an English club won the Europa or Conference League.
    const extra = game.lastSummary!.europe!.qualified.filter((e) => /League (winners|holders)/.test(e.reason)).length;
    expect(game.lastSummary!.europe!.qualified.length).toBeGreaterThanOrEqual(EURO_SLOTS.eng.length);
    expect(game.lastSummary!.europe!.qualified.length).toBeLessThanOrEqual(EURO_SLOTS.eng.length + extra);
    expect(game.lastSummary!.europe!.winners).toHaveLength(3);
  });

  it('domestic cup ties never clash with a European night', () => {
    const euro = new Set(game.europe!.comps.flatMap((c) => c.rounds.map((r) => `${r.week}:${r.day}`)));
    expect(before.some((k) => euro.has(k))).toBe(false);
  });

  it('next season starts with the places earned', () => {
    const next = game.europe!.next!;
    startNextSeason(game);
    expect(game.europe!.entries).toEqual(next);
    expect(game.europe!.comps.every((c) => c.season === game.season && !c.league)).toBe(true);
  });
});

describe('the user in Europe', () => {
  it('plays European ties live, two-legged knockouts included', () => {
    const game = testGame('eng', 66);
    const user = game.userClubId;
    // Put the user's club in the Premier League and into the Champions League play-off round.
    const bottom = divisionOf(game, user);
    const top = game.divisions[0];
    const swap = top.clubIds[0];
    top.clubIds[0] = user;
    bottom.clubIds[bottom.clubIds.indexOf(user)] = swap;
    for (const p of squadOf(game, user)) for (const k in p.attributes) p.attributes[k as keyof typeof p.attributes] = 16;
    game.europe!.next = [{ clubId: user, compId: 'ucl', playoff: true, reason: 'Test' }];
    setupEurope(game);
    setupCups(game);
    expect(game.inbox!.some((i) => i.subject === 'Champions League: play-off round draw')).toBe(true);

    let euroPlayed = 0;
    while (game.phase === 'season') {
      const f = advanceToUserMatch(game);
      if (!f) break;
      if ('cupId' in f && ['ucl', 'uel', 'uecl'].includes((f as CupTie).cupId)) {
        const live = startUserMatch(game, f);
        runToEnd(live);
        completeUserMatch(game, f, live);
        euroPlayed++;
      } else simUserMatchToday(game);
    }
    const mine = allTies(game).filter((t) => t.homeId === user || t.awayId === user);
    expect(euroPlayed).toBe(mine.length);
    expect(mine.length).toBeGreaterThanOrEqual(8);
    expect(mine.every((t) => t.result)).toBe(true);
    expect(game.inbox!.some((i) => /league phase draw/.test(i.subject ?? ''))).toBe(true);
    // Live second legs settle on aggregate like the rest.
    for (const t of mine.filter((x) => x.leg === 2)) {
      const agg = aggregate(game, t)!;
      const homeWon = agg.home !== agg.away ? agg.home > agg.away : t.result!.penalties!.home > t.result!.penalties!.away;
      expect(t.winnerId).toBe(homeWon ? t.homeId : t.awayId);
    }
  });
});

describe('older saves', () => {
  it('a save from before Europe picks it up at the next season', () => {
    const game = testGame('sco', 67);
    for (const id of game.europe!.foreignIds) delete game.clubs[id];
    delete game.europe;
    game.cups = game.cups!.filter((c) => c.id !== 'super-cup');
    playToSeasonEnd(game);
    expect(game.europe!.next).toHaveLength(EURO_SLOTS.sco.length);
    startNextSeason(game);
    expect(game.europe!.comps).toHaveLength(3);
  });
});

describe('testing start: a top-flight giant', () => {
  for (const country of ['eng', 'sco'] as const) {
    it(`${country}: top flight, top-team squad, Champions League and the big cups`, () => {
      const game = testGame(country, 68, { topFlight: true });
      const user = game.userClubId;
      const div = divisionOf(game, user);
      expect(div.def.level).toBe(1);
      expect(div.clubIds).toHaveLength(div.def.size);
      const xi = (id: string) => squadOf(game, id).map((p) => p.overall).sort((a, b) => b - a).slice(0, 11).reduce((s, x) => s + x, 0) / 11;
      const ranked = [...div.clubIds].sort((a, b) => xi(b) - xi(a));
      expect(ranked.indexOf(user)).toBeLessThan(3);
      expect(game.clubs[user].capacity).toBeGreaterThan(40000);
      expect(game.europe!.entries.find((e) => e.clubId === user)).toMatchObject({ compId: 'ucl', playoff: false });
      // Top-flight clubs join the domestic cups later; the user is drawn as rounds reach them.
      expect(game.cups!.filter((c) => !cupDef(country, c.id).showpiece).every((c) => !c.rounds[0].ties.some((t) => t.homeId === user || t.awayId === user))).toBe(true);
      // As the biggest club, England's giant opens the season in the Community Shield.
      if (country === 'eng') expect(game.cups!.find((c) => c.id === 'community-shield')!.rounds[0].ties[0]).toSatisfy((t: { homeId: string; awayId: string }) => t.homeId === user || t.awayId === user);
      playToSeasonEnd(game);
      const ucl = game.europe!.comps.find((c) => c.id === 'ucl')!;
      expect(ucl.league).toContain(user);
      const cupTies = game.cups!.flatMap((c) => c.rounds.flatMap((r) => r.ties)).filter((t) => t.homeId === user || t.awayId === user);
      expect(cupTies.length).toBeGreaterThan(0);
    });
  }
});
