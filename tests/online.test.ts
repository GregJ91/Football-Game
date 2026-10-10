import { describe, expect, it } from 'vitest';
import { clubOnTheClock, draftOptions } from '../src/engine/legends';
import type { GameState } from '../src/engine/types';
import { GuestSession, HostSession, type Person } from '../src/online/session';
import { localTransport, packState, unpackState } from '../src/online/transport';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await wait(20);
  }
}

const person = (pid: string, name: string, teamName: string): Person => ({
  pid,
  name,
  team: { teamName, shortName: teamName.slice(0, 3).toUpperCase(), colours: { primary: '#123456', secondary: '#FFFFFF', pattern: 'plain' } },
});

describe('online legends', () => {
  it('packs the game small enough to send', async () => {
    const packed = await packState({ a: 'x'.repeat(100_000) });
    expect(packed.length).toBeLessThan(2000);
    expect(await unpackState<{ a: string }>(packed)).toEqual({ a: 'x'.repeat(100_000) });
  });

  it('a host and two friends: lobby, draft picks from the guests, team changes and releases', async () => {
    const code = `T${Math.random().toString(36).slice(2, 6)}`;
    let hostGame: GameState | null = null;
    const host = new HostSession(localTransport(code), code, person('h', 'Greg', 'Dream XI'), {
      game: () => hostGame,
      commit: () => host.stateChanged(),
      changed: () => {},
    });
    const guestGames: Record<string, GameState | null> = { a: null, b: null };
    const guests = (['a', 'b'] as const).map(
      (id) =>
        new GuestSession(localTransport(code), code, person(id, `Friend ${id}`, `Team ${id.toUpperCase()}`), {
          onState: (g) => (guestGames[id] = g),
          changed: () => {},
          toast: () => {},
        }),
    );
    await until(() => host.seats.length === 3 && guests.every((g) => g.connected));
    expect(guests[0].lobby!.seats.map((s) => s.teamName)).toEqual(['Dream XI', 'Team A', 'Team B']);

    hostGame = host.start('medium');
    expect(hostGame.legends!.humans).toEqual(['L0', 'L1', 'L2']);
    host.stateChanged();
    await until(() => !!guestGames.a && !!guestGames.b);
    expect(guestGames.a!.userClubId).toBe('L1');
    expect(guestGames.a!.clubs.L1.isUser).toBe(true);
    expect(guestGames.a!.clubs.L0.isUser).toBe(false);

    // Draft until everyone has a full squad: whoever is on the clock picks.
    for (let i = 0; i < 200 && hostGame.legends!.draft; i++) {
      const d = hostGame.legends!.draft;
      const club = clubOnTheClock(d)!;
      const before = d.pick;
      if (club === 'L0') {
        hostGame.legends!.draft && (await import('../src/engine/legends')).autoPick(hostGame, 'L0');
        host.stateChanged();
      } else {
        const g = guests[club === 'L1' ? 0 : 1];
        if (i % 2) g.autoPick();
        else g.pick(draftOptions(hostGame)[0].id);
      }
      await until(() => !hostGame!.legends!.draft || hostGame!.legends!.draft.pick > before);
    }
    expect(hostGame.legends!.draft).toBeNull();
    expect(hostGame.clubs.L1.playerIds).toHaveLength(23);
    await until(() => guestGames.a!.legends!.draft === null && guestGames.a!.phase === 'season');

    // A guest changes mentality; the host plays with it, but the formation stays locked.
    const ga = guestGames.a!;
    const locked = hostGame.clubs.L1.tactics.formation;
    ga.clubs.L1.tactics = { ...ga.clubs.L1.tactics, mentality: 'attacking', formation: locked === '5-3-2' ? '4-4-2' : '5-3-2' };
    guests[0].team(ga);
    await until(() => hostGame!.clubs.L1.tactics.mentality === 'attacking');
    expect(hostGame.clubs.L1.tactics.formation).toBe(locked);

    guests[1].ready(true);
    await until(() => host.seats[2].ready === true);
    expect(host.allReady()).toBe(false);
    guests[0].ready(true);
    await until(() => host.allReady());

    const release = hostGame.clubs.L2.playerIds.slice(0, 2);
    guests[1].release(release);
    await until(() => host.releases().L2?.length === 2);

    host.close();
    guests.forEach((g) => g.close());
  }, 60_000);
});
