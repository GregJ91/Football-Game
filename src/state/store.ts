import { create } from 'zustand';
import {
  changeTactics, giveTeamTalk, makeSub, runToEnd, stepMinute, type LiveMatch, type SideName, type TeamTalk,
} from '../engine/match/engine';
import {
  advanceToUserMatch, completeUserMatch, playWeek, startNextSeason, startUserMatch, userFixtureNext,
} from '../engine/season/season';
import type { Fixture, GameState, Tactics } from '../engine/types';
import { createGame, type NewGameConfig } from '../engine/world';
import { loadGame, saveGame } from './persistence';

export type Screen = 'start' | 'create' | 'hub' | 'squad' | 'league' | 'fixtures' | 'prematch' | 'match' | 'seasonEnd';

export interface LiveNote {
  minute: number;
  text: string;
}

interface Store {
  /** The game is mutated in place by the engine; `rev` bumps to re-render. */
  game: GameState | null;
  rev: number;
  screen: Screen;
  busy: boolean;
  live: LiveMatch | null;
  liveFixture: Fixture | null;
  liveNotes: LiveNote[];
  /** Fixture whose full-time result should pop up on the hub. */
  resultPopup: Fixture | null;

  go: (screen: Screen) => void;
  newGame: (config: Omit<NewGameConfig, 'seed'>) => void;
  continueGame: () => Promise<boolean>;
  setTactics: (tactics: Tactics) => void;
  setAssistantTactics: (on: boolean) => void;

  openPreMatch: () => void;
  simNextMatch: () => Promise<void>;
  simToSeasonEnd: () => Promise<void>;
  dismissResult: () => void;
  nextSeason: () => void;

  kickOff: () => void;
  liveTick: () => void;
  liveTeamTalk: (talk: TeamTalk) => void;
  liveSetTactics: (tactics: Tactics) => void;
  liveSub: (outId: string, inId: string) => boolean;
  liveSkip: () => void;
  liveFinish: () => void;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export function nextUserFixture(game: GameState): Fixture | undefined {
  return userFixtureNext(game);
}

export function lastUserFixture(game: GameState): Fixture | undefined {
  const played = game.fixtures.filter((f) => f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
  return played.sort((a, b) => b.week - a.week)[0];
}

export function userSide(game: GameState, fixture: Fixture): SideName {
  return fixture.homeId === game.userClubId ? 'home' : 'away';
}

const TALK_REACTION = {
  well: 'The players respond well to the team talk.',
  neutral: 'The team talk gets a muted response.',
  badly: "The team talk falls flat. The players don't look convinced.",
} as const;

export const useGame = create<Store>()((set, get) => {
  const bump = () => set((s) => ({ rev: s.rev + 1 }));
  const commit = () => {
    const { game } = get();
    // A pending result popup is shown on the hub first; dismissing it moves on.
    set((s) => ({ rev: s.rev + 1, screen: game?.phase === 'seasonEnd' && !s.resultPopup ? 'seasonEnd' : s.screen }));
    if (game) void saveGame(game);
  };
  const liveSideName = (): SideName | null => {
    const { game, liveFixture } = get();
    return game && liveFixture ? userSide(game, liveFixture) : null;
  };

  return {
    game: null,
    rev: 0,
    screen: 'start',
    busy: false,
    live: null,
    liveFixture: null,
    liveNotes: [],
    resultPopup: null,

    go: (screen) => set({ screen }),

    newGame: (config) => {
      const game = createGame({ ...config, seed: Math.floor(Math.random() * 2 ** 32) });
      set({ game, screen: 'hub', live: null, liveFixture: null, resultPopup: null });
      commit();
    },

    continueGame: async () => {
      const game = await loadGame();
      if (!game) return false;
      set((s) => ({ game, rev: s.rev + 1, screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' }));
      return true;
    },

    setTactics: (tactics) => {
      const { game } = get();
      if (!game) return;
      game.clubs[game.userClubId].tactics = { ...tactics };
      commit();
    },

    setAssistantTactics: (on) => {
      const { game } = get();
      if (!game) return;
      game.settings = { ...game.settings, assistantTactics: on };
      commit();
    },

    openPreMatch: () => {
      const { game } = get();
      if (!game) return;
      const fixture = advanceToUserMatch(game);
      if (!fixture) {
        commit();
        return;
      }
      set({ screen: 'prematch' });
      commit();
    },

    simNextMatch: async () => {
      const { game } = get();
      if (!game || get().busy) return;
      set({ busy: true });
      const target = nextUserFixture(game);
      while (game.phase === 'season' && (!target || !target.result)) {
        playWeek(game);
        await yieldToUi();
      }
      const popup = target?.result ? target : null;
      set({ busy: false, resultPopup: popup, screen: popup || game.phase === 'season' ? 'hub' : 'seasonEnd' });
      commit();
    },

    simToSeasonEnd: async () => {
      const { game } = get();
      if (!game || get().busy) return;
      set({ busy: true });
      while (game.phase === 'season') {
        playWeek(game);
        if (game.week % 4 === 0) {
          bump();
          await yieldToUi();
        }
      }
      set({ busy: false });
      commit();
    },

    dismissResult: () => {
      const { game } = get();
      set({ resultPopup: null, screen: game?.phase === 'seasonEnd' ? 'seasonEnd' : get().screen });
    },

    nextSeason: () => {
      const { game } = get();
      if (!game) return;
      startNextSeason(game);
      set({ screen: 'hub' });
      commit();
    },

    kickOff: () => {
      const { game } = get();
      if (!game) return;
      const fixture = advanceToUserMatch(game);
      if (!fixture) return;
      const live = startUserMatch(game, fixture);
      set({ live, liveFixture: fixture, liveNotes: [{ minute: 0, text: 'The referee blows and we are under way!' }], screen: 'match' });
      bump();
    },

    liveTick: () => {
      const { live } = get();
      if (!live || live.finished || live.halfTimePending) return;
      const before = live.minute;
      stepMinute(live);
      const notes: LiveNote[] = [];
      if (before < 45 && live.minute >= 45) notes.push({ minute: 45, text: `Half time: ${live.homeGoals}–${live.awayGoals}.` });
      if (before < 90 && live.minute >= 90 && live.endMinute === 120) notes.push({ minute: 90, text: 'Level after 90 minutes. Extra time!' });
      if (live.finished) notes.push({ minute: live.minute, text: `Full time: ${live.homeGoals}–${live.awayGoals}.` });
      if (notes.length) set((s) => ({ liveNotes: [...s.liveNotes, ...notes] }));
      bump();
    },

    liveTeamTalk: (talk) => {
      const { live } = get();
      const side = liveSideName();
      if (!live || !side) return;
      const reaction = giveTeamTalk(live, side, talk);
      live.halfTimePending = false;
      set((s) => ({ liveNotes: [...s.liveNotes, { minute: 45, text: TALK_REACTION[reaction] }] }));
      bump();
    },

    liveSetTactics: (tactics) => {
      const { live, game } = get();
      const side = liveSideName();
      if (!live || !side || !game) return;
      changeTactics(live, side, tactics);
      game.clubs[game.userClubId].tactics = { ...tactics };
      set((s) => ({
        liveNotes: [...s.liveNotes, { minute: live.minute, text: `Tactics changed: ${tactics.formation}, ${tactics.mentality}, ${tactics.pressing} press.` }],
      }));
      bump();
    },

    liveSub: (outId, inId) => {
      const { live } = get();
      const side = liveSideName();
      if (!live || !side) return false;
      const ok = makeSub(live, side, outId, inId);
      bump();
      return ok;
    },

    liveSkip: () => {
      const { live } = get();
      if (!live) return;
      runToEnd(live);
      set((s) => ({ liveNotes: [...s.liveNotes, { minute: live.minute, text: `Full time: ${live.homeGoals}–${live.awayGoals}.` }] }));
      bump();
    },

    liveFinish: () => {
      const { game, live, liveFixture } = get();
      if (!game || !live || !liveFixture || !live.finished) return;
      completeUserMatch(game, liveFixture, live);
      set({ live: null, liveFixture: null, liveNotes: [], screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' });
      commit();
    },
  };
});
