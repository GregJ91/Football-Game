import { create } from 'zustand';
import { playWeek, startNextSeason } from '../engine/season/season';
import type { Fixture, Formation, GameState, Mentality } from '../engine/types';
import { createGame, type NewGameConfig } from '../engine/world';
import { loadGame, saveGame } from './persistence';

export type Screen = 'start' | 'create' | 'hub' | 'squad' | 'league' | 'fixtures' | 'seasonEnd';

interface Store {
  /** The game is mutated in place by the engine; `rev` bumps to re-render. */
  game: GameState | null;
  rev: number;
  screen: Screen;
  busy: boolean;
  go: (screen: Screen) => void;
  newGame: (config: Omit<NewGameConfig, 'seed'>) => void;
  continueGame: () => Promise<boolean>;
  playNextMatch: () => Promise<void>;
  simToSeasonEnd: () => Promise<void>;
  nextSeason: () => void;
  setTactics: (formation: Formation, mentality: Mentality) => void;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export function nextUserFixture(game: GameState): Fixture | undefined {
  return game.fixtures.find((f) => !f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
}

export function lastUserFixture(game: GameState): Fixture | undefined {
  const played = game.fixtures.filter((f) => f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
  return played.sort((a, b) => b.week - a.week)[0];
}

export const useGame = create<Store>()((set, get) => {
  const commit = () => {
    const { game } = get();
    set((s) => ({ rev: s.rev + 1, screen: game?.phase === 'seasonEnd' ? 'seasonEnd' : s.screen }));
    if (game) void saveGame(game);
  };

  return {
    game: null,
    rev: 0,
    screen: 'start',
    busy: false,

    go: (screen) => set({ screen }),

    newGame: (config) => {
      const game = createGame({ ...config, seed: Math.floor(Math.random() * 2 ** 32) });
      set({ game, screen: 'hub' });
      commit();
    },

    continueGame: async () => {
      const game = await loadGame();
      if (!game) return false;
      set((s) => ({ game, rev: s.rev + 1, screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' }));
      return true;
    },

    playNextMatch: async () => {
      const { game } = get();
      if (!game || get().busy) return;
      set({ busy: true });
      const target = nextUserFixture(game);
      while (game.phase === 'season' && (!target || !target.result)) {
        playWeek(game);
        await yieldToUi();
      }
      set({ busy: false });
      commit();
    },

    simToSeasonEnd: async () => {
      const { game } = get();
      if (!game || get().busy) return;
      set({ busy: true });
      while (game.phase === 'season') {
        playWeek(game);
        if (game.week % 4 === 0) {
          set((s) => ({ rev: s.rev + 1 }));
          await yieldToUi();
        }
      }
      set({ busy: false });
      commit();
    },

    nextSeason: () => {
      const { game } = get();
      if (!game) return;
      startNextSeason(game);
      set({ screen: 'hub' });
      commit();
    },

    setTactics: (formation, mentality) => {
      const { game } = get();
      if (!game) return;
      game.clubs[game.userClubId].tactics = { formation, mentality };
      commit();
    },
  };
});
