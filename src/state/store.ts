import { create } from 'zustand';
import {
  changeTactics, giveTeamTalk, makeSub, runToEnd, stepMinute, type LiveMatch, type SideName, type TeamTalk,
} from '../engine/match/engine';
import {
  advanceToUserMatch, completeUserMatch, playWeek, startNextSeason, startUserMatch, userFixtureNext,
} from '../engine/season/season';
import type { Fixture, GameState, Tactics } from '../engine/types';
import { assignToSlot, autoLineup, remapLineup } from '../engine/match/selection';
import { createGame, squadOf, withRng, type NewGameConfig } from '../engine/world';
import { adjustBudgets as adjustBudgetsEngine, moneyPw, wageBudgetProblem } from '../engine/economy/finance';
import {
  acceptsLowerWage, addInbox, answerBid as answerBidEngine, bidFor, cannotBuy, cannotRelease, completeTransfer, feeProblem,
  releasePlayer, renewContract, scoutPlayer, type BidAction, type BidResponse,
} from '../engine/transfers/market';
import { loadGame, saveGame } from './persistence';

export type Screen = 'start' | 'create' | 'hub' | 'squad' | 'tactics' | 'transfers' | 'league' | 'fixtures' | 'prematch' | 'match' | 'seasonEnd';

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
  /** A short message shown briefly at the bottom of the screen. */
  toast: string | null;
  showToast: (text: string | null) => void;

  go: (screen: Screen) => void;
  newGame: (config: Omit<NewGameConfig, 'seed'>) => void;
  continueGame: () => Promise<boolean>;
  setTactics: (tactics: Tactics) => void;
  /** Put a player into a starting slot (swapping if already in the XI). */
  setLineupSlot: (slotIndex: number, playerId: string) => void;
  /** Go back to the automatically picked best XI. */
  resetLineup: () => void;

  scout: (playerId: string) => boolean;
  /** Submit a fee; the selling club answers straight away. */
  bid: (playerId: string, fee: number) => BidResponse | { error: string };
  /** Agree terms and complete a signing. Returns a problem, or null on success. */
  sign: (playerId: string, fee: number, wage: number, years: number) => string | null;
  /** Offer less than the player's demand; true if he accepts. */
  offerLowerWage: (playerId: string) => boolean;
  toggleListed: (playerId: string) => void;
  release: (playerId: string) => string | null;
  renew: (playerId: string, wage: number, years: number) => string | null;
  answerBid: (itemId: string, action: BidAction) => string;
  adjustBudgets: (wageDelta: number) => void;
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
    toast: null,
    showToast: (text) => set({ toast: text }),

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
      const club = game.clubs[game.userClubId];
      if (club.lineup && tactics.formation !== club.tactics.formation) {
        club.lineup = remapLineup(squadOf(game, club.id), club.lineup, tactics.formation);
      }
      club.tactics = { ...tactics };
      commit();
    },

    setLineupSlot: (slotIndex, playerId) => {
      const { game } = get();
      if (!game) return;
      const club = game.clubs[game.userClubId];
      const base = club.lineup ?? autoLineup(squadOf(game, club.id), club.tactics.formation);
      club.lineup = assignToSlot(base, slotIndex, playerId);
      commit();
    },

    scout: (playerId) => {
      const { game } = get();
      if (!game) return false;
      const ok = scoutPlayer(game, playerId);
      commit();
      return ok;
    },

    bid: (playerId, fee) => {
      const { game } = get();
      if (!game) return { error: 'No game loaded.' };
      const p = game.players[playerId];
      const problem = cannotBuy(game, p) ?? feeProblem(game, fee);
      if (problem) return { error: problem };
      return bidFor(game, p, fee);
    },

    sign: (playerId, fee, wage, years) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = game.players[playerId];
      const club = game.clubs[game.userClubId];
      const problem = cannotBuy(game, p) ?? (fee ? feeProblem(game, fee) : null) ?? wageBudgetProblem(game, club, wage);
      if (problem) return problem;
      const from = p.clubId ? game.clubs[p.clubId].name : null;
      completeTransfer(game, p, club.id, fee, wage, years);
      addInbox(game, 'info', `${p.firstName} ${p.lastName} signs ${from ? `from ${from} for ${fee ? `£${fee.toLocaleString('en-GB')}` : 'a nominal fee'}` : 'on a free'}, on ${moneyPw(wage)} until ${p.contractEnd + 1}.`);
      commit();
      return null;
    },

    offerLowerWage: (playerId) => {
      const { game } = get();
      if (!game) return false;
      const p = game.players[playerId];
      return withRng(game, (rng) => acceptsLowerWage(game, rng, game.clubs[game.userClubId], p));
    },

    toggleListed: (playerId) => {
      const { game } = get();
      if (!game) return;
      const p = game.players[playerId];
      p.listed = !p.listed;
      commit();
    },

    release: (playerId) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = game.players[playerId];
      const problem = cannotRelease(game, p);
      if (problem) return problem;
      releasePlayer(game, p);
      commit();
      return null;
    },

    renew: (playerId, wage, years) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = game.players[playerId];
      const problem = wageBudgetProblem(game, game.clubs[game.userClubId], wage, p.wage);
      if (problem) return problem;
      renewContract(game, p, wage, years);
      commit();
      return null;
    },

    answerBid: (itemId, action) => {
      const { game } = get();
      if (!game) return '';
      const msg = withRng(game, (rng) => answerBidEngine(game, rng, itemId, action));
      commit();
      return msg;
    },

    adjustBudgets: (wageDelta) => {
      const { game } = get();
      if (!game) return;
      adjustBudgetsEngine(game, game.clubs[game.userClubId], wageDelta);
      commit();
    },

    resetLineup: () => {
      const { game } = get();
      if (!game) return;
      delete game.clubs[game.userClubId].lineup;
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
      const club = game.clubs[game.userClubId];
      if (club.lineup && tactics.formation !== club.tactics.formation) {
        club.lineup = remapLineup(squadOf(game, club.id), club.lineup, tactics.formation);
      }
      club.tactics = { ...tactics };
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
