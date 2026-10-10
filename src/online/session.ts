import { autoPick, createLegendsGame, makePick, type LegendsTeam } from '../engine/legends';
import type { GameState, LegendsDifficulty, Tactics } from '../engine/types';
import { packState, unpackState, type Message, type Transport } from './transport';

/**
 * Online Legends, live: one phone hosts and runs the game; the others join
 * with the room code. Guests send their draft picks, team selections, "ready"
 * and summer releases; the host applies them and sends the whole game back
 * after every change.
 */

export interface Person {
  /** Stays the same on this phone, so you can rejoin after losing signal. */
  pid: string;
  name: string;
  team: LegendsTeam;
}

export interface SeatView {
  pid: string;
  name: string;
  teamName: string;
  clubId?: string;
  connected: boolean;
  ready?: boolean;
  /** Summer releases chosen (online, before the summer draft). */
  released?: boolean;
  host?: boolean;
}

export interface LobbyInfo {
  code: string;
  started: boolean;
  difficulty: LegendsDifficulty;
  seats: SeatView[];
}

interface Seat extends Person {
  clubId?: string;
  peer?: string;
  ready?: boolean;
  release?: string[];
}

export const MAX_PEOPLE = 20;

export class HostSession {
  seats: Seat[];
  started = false;
  difficulty: LegendsDifficulty = 'medium';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastWeek = '';

  constructor(
    private t: Transport,
    readonly code: string,
    host: Person,
    private hooks: { game: () => GameState | null; commit: () => void; changed: () => void },
  ) {
    this.seats = [{ ...host }];
    t.onMessage((m, from) => void this.handle(m, from));
    t.onPeerJoin(() => this.sendLobby());
    t.onPeerLeave((peer) => {
      const seat = this.seats.find((s) => s.peer === peer);
      if (seat) seat.peer = undefined;
      this.sendLobby();
    });
  }

  /** Carry on a saved online game: the same people, the same code. */
  resume(game: GameState) {
    const online = game.online!;
    this.started = true;
    this.difficulty = game.legends!.difficulty;
    this.seats = online.seats.map((s, i) => ({ ...(i === 0 ? this.seats[0] : { pid: s.pid, name: s.name, team: { teamName: game.clubs[s.clubId].name, shortName: game.clubs[s.clubId].shortName, colours: game.clubs[s.clubId].colours } }), clubId: s.clubId }));
  }

  lobby(): LobbyInfo {
    return {
      code: this.code,
      started: this.started,
      difficulty: this.difficulty,
      seats: this.seats.map((s, i) => ({
        pid: s.pid,
        name: s.name,
        teamName: s.team.teamName,
        clubId: s.clubId,
        connected: i === 0 || !!s.peer,
        ready: i === 0 ? undefined : s.ready,
        released: !!s.release,
        host: i === 0,
      })),
    };
  }

  sendLobby(to?: string) {
    this.t.send({ t: 'lobby', d: this.lobby() as never }, to);
    this.hooks.changed();
  }

  /** Start the game with everyone in the lobby; the AI takes the other teams. */
  start(difficulty: LegendsDifficulty): GameState {
    this.difficulty = difficulty;
    const [me, ...others] = this.seats;
    const game = createLegendsGame({
      seed: Math.floor(Math.random() * 2 ** 32),
      ...me.team,
      difficulty,
      others: others.map((s) => s.team),
    });
    this.seats.forEach((s, i) => (s.clubId = `L${i}`));
    game.online = { code: this.code, seats: this.seats.map((s) => ({ pid: s.pid, name: s.name, clubId: s.clubId! })) };
    this.started = true;
    return game;
  }

  /** The game changed on the host: send it to everyone (batched). */
  stateChanged() {
    if (!this.started) return;
    const game = this.hooks.game();
    if (!game) return;
    // A new matchday: everyone has to say they're ready again.
    const now = `${game.season}:${game.week}:${game.phase}`;
    if (now !== this.lastWeek) {
      this.lastWeek = now;
      for (const s of this.seats) s.ready = false;
      if (game.phase === 'season') for (const s of this.seats) s.release = undefined;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sendState();
      this.sendLobby();
    }, 250);
  }

  async sendState(to?: string) {
    const game = this.hooks.game();
    if (!game) return;
    this.t.send({ t: 'state', d: await packState(game) }, to);
  }

  /** Everyone's chosen releases for the summer draft (host's own come from the screen). */
  releases(): Record<string, string[]> {
    return Object.fromEntries(this.seats.filter((s) => s.clubId && s.release).map((s) => [s.clubId!, s.release!]));
  }

  allReady(): boolean {
    return this.seats.slice(1).every((s) => s.ready || !s.peer);
  }

  private async handle(m: Message, from: string) {
    const seat = this.seats.find((s) => s.peer === from);
    if (m.t === 'hello') {
      const p = m.d as Person;
      // Never the host's own seat (the same browser in two tabs shares an id).
      let mine = this.seats.find((s, i) => i > 0 && s.pid === p.pid);
      if (p.pid === this.seats[0].pid) p.pid = `${p.pid}-${from}`;
      if (!mine) {
        if (this.started) return this.t.send({ t: 'toast', d: 'This game has already started.' }, from);
        if (this.seats.length >= MAX_PEOPLE) return this.t.send({ t: 'toast', d: 'This game is full.' }, from);
        mine = { ...p };
        this.seats.push(mine);
      } else if (!this.started) {
        mine.name = p.name;
        mine.team = p.team;
      }
      for (const s of this.seats) if (s.peer === from) s.peer = undefined;
      mine.peer = from;
      this.t.send({ t: 'welcome', d: { clubId: mine.clubId ?? null } }, from);
      this.sendLobby();
      if (this.started) await this.sendState(from);
      return;
    }
    if (!seat) return;
    const game = this.hooks.game();
    if (m.t === 'ready') {
      seat.ready = !!m.d;
      this.sendLobby();
      return;
    }
    if (!game || !seat.clubId) return;
    const club = game.clubs[seat.clubId];
    if (m.t === 'pick' || m.t === 'auto') {
      const err = m.t === 'pick' ? makePick(game, seat.clubId, String(m.d)) : autoPick(game, seat.clubId);
      if (err) this.t.send({ t: 'toast', d: err }, from);
      this.hooks.commit();
    } else if (m.t === 'team') {
      const d = m.d as { tactics: Tactics; lineup?: (string | null)[]; bench?: string[] };
      const own = (id: string | null) => !id || club.playerIds.includes(id);
      club.tactics = { ...club.tactics, ...d.tactics };
      if (d.lineup && d.lineup.every(own)) club.lineup = d.lineup;
      if (d.bench && d.bench.every(own)) club.bench = d.bench;
      this.hooks.commit();
    } else if (m.t === 'release') {
      const ids = (m.d as string[]).filter((id) => club.playerIds.includes(id)).slice(0, 2);
      seat.release = ids;
      this.sendLobby();
    }
  }

  close() {
    this.t.leave();
  }
}

export class GuestSession {
  lobby: LobbyInfo | null = null;
  clubId: string | null = null;
  private host: string | null = null;
  private helloTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private t: Transport,
    readonly code: string,
    private me: Person,
    private hooks: { onState: (game: GameState) => void; changed: () => void; toast: (text: string) => void },
  ) {
    t.onMessage((m, from) => void this.handle(m, from));
    t.onPeerJoin(() => this.hello());
    t.onPeerLeave((peer) => {
      if (peer === this.host) {
        this.host = null;
        this.hooks.changed();
      }
    });
    this.hello();
    // Keep knocking until the host answers (they may not be in the room yet).
    this.helloTimer = setInterval(() => !this.host && this.hello(), 2000);
  }

  get connected(): boolean {
    return !!this.host;
  }

  private hello() {
    this.t.send({ t: 'hello', d: this.me as never });
  }

  private send(m: Message) {
    if (this.host) this.t.send(m, this.host);
    else this.hooks.toast("Not connected to the host. Trying again…");
  }

  pick(playerId: string) {
    this.send({ t: 'pick', d: playerId });
  }

  autoPick() {
    this.send({ t: 'auto' });
  }

  team(game: GameState) {
    if (!this.clubId) return;
    const club = game.clubs[this.clubId];
    this.send({ t: 'team', d: { tactics: club.tactics, lineup: club.lineup, bench: club.bench } as never });
  }

  ready(on: boolean) {
    this.send({ t: 'ready', d: on });
  }

  release(ids: string[]) {
    this.send({ t: 'release', d: ids });
  }

  private async handle(m: Message, from: string) {
    if (m.t === 'lobby') {
      this.host = from;
      this.lobby = m.d as LobbyInfo;
      const mine = this.lobby.seats.find((s) => s.pid === this.me.pid);
      if (mine?.clubId) this.clubId = mine.clubId;
      this.hooks.changed();
    } else if (m.t === 'welcome') {
      this.host = from;
      const d = m.d as { clubId: string | null };
      if (d.clubId) this.clubId = d.clubId;
      this.hooks.changed();
    } else if (m.t === 'state' && from === this.host) {
      const game = await unpackState<GameState>(String(m.d));
      const mine = game.online?.seats.find((s) => s.pid === this.me.pid);
      if (!mine) return;
      this.clubId = mine.clubId;
      // Seen from this phone: our club is "the user's" club.
      game.userClubId = mine.clubId;
      for (const c of Object.values(game.clubs)) c.isUser = c.id === mine.clubId;
      this.hooks.onState(game);
    } else if (m.t === 'toast') this.hooks.toast(String(m.d));
  }

  close() {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.t.leave();
  }
}
