import { autoPick, createLegendsGame, makePick, startSummerDraft, type LegendsConfig } from '../engine/legends';
import { startPartWork } from '../engine/club/trainingGround';
import type { TrainingPart } from '../engine/types';
import { acceptJobOffer, declineJobOffer } from '../engine/club/manager';
import { sendMission, toggleShortlist, type MissionBrief } from '../engine/transfers/scouting';
import { create } from 'zustand';
import { assignToBench, restTired, setRole } from '../engine/players/squad';
import { takeJob, waitAWeek, waitForOffer } from '../engine/club/career';
import { createRelegationBattle } from '../engine/club/challenge';
import { endLoan, loanIn } from '../engine/transfers/loans';
import { hireStaff } from '../engine/club/staff';
import { startRetraining } from '../engine/players/training';
import {
  changeTactics, giveTeamTalk, makeSub, runToEnd, stepMinute, type LiveMatch, type SideName, type TeamTalk,
} from '../engine/match/engine';
import {
  advanceToUserMatch, completeUserMatch, playWeek, simUserMatchToday, startNextSeason, startUserMatch, userSelection,
} from '../engine/season/season';
import type { ChallengeId, ClubColours, CountryId, CrestDesign, FacilityKind, IndividualFocus, Position, TrainingSettings, Fixture, GameState, SquadRole, StaffRole, Tactics } from '../engine/types';
import { advanceHalfDay, assignScout, matchDay, nextUserMatch, type ScoutResult } from '../engine/calendar';
import { userCupTies } from '../engine/season/cups';
import { assignToSlot, autoLineup, remapLineup } from '../engine/match/selection';
import { createGame, playerById, squadOf, withRng, type NewGameConfig } from '../engine/world';
import {
  adjustBudgets as adjustBudgetsEngine, moneyPw, setUnlimitedMoney as setUnlimitedMoneyEngine, topUpUnlimited, wageBudgetProblem,
} from '../engine/economy/finance';
import { chooseSponsor, repayLoan, takeLoan } from '../engine/club/chairman';
import { startFacilityUpgrade } from '../engine/club/facilities';
import { startCommercialWork, startStadiumWork, type WorkOption } from '../engine/club/stadium';
import type { Commercial } from '../engine/club/matchday';
import {
  acceptsLowerWage, addInbox, answerBid as answerBidEngine, bidFor, cannotBuy, cannotRelease, completeTransfer, feeProblem,
  isKnown, releasePlayer, renewContract, type BidAction, type BidResponse,
} from '../engine/transfers/market';
import { deleteSave, loadAchievements, loadGame, saveAchievements, saveGame, type Unlock } from './persistence';
import { ACHIEVEMENTS, earnedAchievements } from '../engine/achievements';
import { addInbox as addInboxItem } from '../engine/transfers/market';

export type Screen = 'start' | 'create' | 'hub' | 'inbox' | 'squad' | 'tactics' | 'transfers' | 'club' | 'league' | 'cups' | 'europe' | 'awards' | 'fixtures' | 'prematch' | 'match' | 'seasonEnd' | 'challenges' | 'manager' | 'achievements' | 'legendsSetup' | 'legends';

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
  /** Achievements unlocked on this device, across every career. */
  achievements: Record<string, Unlock>;
  loadAchievements: () => Promise<void>;
  /** Challenge picked on the challenge screen, waiting for the club to be created. */
  challengeDraft: ChallengeId | null;
  setChallengeDraft: (id: ChallengeId | null) => void;
  /** Relegation Battlers: no club to create, straight into the run-in. */
  startRelegationBattle: (country: CountryId, divisionId: string) => Promise<void>;
  /** After winning a challenge, carry on as a normal career. */
  continueAfterChallenge: () => void;
  loanPlayer: (playerId: string) => string | null;
  hireStaff: (role: StaffRole, index: number) => string | null;
  setTraining: (settings: TrainingSettings) => void;
  setPlayerTraining: (playerId: string, focus: IndividualFocus | null) => void;
  setRetrain: (playerId: string, position: Position | null) => void;
  /** Your club's crest and home and away kits. */
  setIdentity: (identity: { colours: ClubColours; awayKit: ClubColours; crest: CrestDesign }) => void;
  sendBackLoan: (playerId: string) => void;
  showToast: (text: string | null) => void;

  go: (screen: Screen) => void;
  newGame: (config: Omit<NewGameConfig, 'seed'>) => void;
  continueGame: () => Promise<boolean>;
  /** The save slot the current game lives in (slot1–slot3). */
  slot: string;
  /** Pick the slot the next new game will save into. */
  chooseSlot: (slot: string) => void;
  /** Load the game in a slot and carry on. */
  loadSlot: (slot: string) => Promise<boolean>;
  deleteSlot: (slot: string) => Promise<void>;
  setTactics: (tactics: Tactics) => void;
  /** Put a player into a starting slot (swapping if already in the XI). */
  setLineupSlot: (slotIndex: number, playerId: string) => void;
  /** Go back to the automatically picked best XI. */
  resetLineup: () => void;
  /** Choose a substitute for a place on the bench. */
  setBenchSlot: (index: number, playerId: string) => void;
  /** Go back to the best of the rest on the bench. */
  resetBench: () => void;
  /** Swap tired players in your XI for fresher ones; returns how many. */
  restTiredPlayers: () => number;
  setAutoRotate: (on: boolean) => void;
  setPlayerRole: (playerId: string, role: SquadRole) => void;
  /** Out of work: let a week pass. */
  waitAWeek: () => Promise<void>;
  /** Out of work: wait until a club gets in touch. */
  waitForOffer: () => Promise<void>;
  takeJob: (clubId: string) => void;
  /** A job offer while in work: move to the new club, or turn it down. */
  acceptJobOffer: (clubId: string) => void;
  declineJobOffer: (clubId: string) => void;

  /** Send a scout; the report lands in the inbox a few days later. */
  scout: (playerId: string) => ScoutResult;
  /** Send the scouts on a brief; returns a problem or null. */
  sendScoutMission: (brief: MissionBrief) => string | null;
  cancelScoutMission: (id: string) => void;
  toggleShortlist: (playerId: string) => void;
  /** CM-style Continue: move on half a day. */
  continueDay: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
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
  /** The in-game editor: set the club's reputation, budgets and bank balance. */
  editClub: (values: { reputation: number; wage: number; transfer: number; balance: number }) => void;

  // Chairman decisions; each returns a problem, or null when done.
  buildStadium: (opt: WorkOption) => string | null;
  /** Build the next level of food outlets or VIP hospitality. */
  buildCommercial: (kind: Commercial) => string | null;
  buildTrainingPart: (part: TrainingPart) => string | null;
  upgradeFacility: (kind: FacilityKind) => string | null;
  setTicketPrice: (price: number) => void;
  pickSponsor: (index: number) => void;
  borrow: (amount: number) => string | null;
  repay: () => string | null;
  setAssistantTactics: (on: boolean) => void;

  openPreMatch: () => void;
  simNextMatch: () => Promise<void>;
  simToSeasonEnd: () => Promise<void>;
  dismissResult: () => void;
  nextSeason: () => void;
  /** Legends mode. */
  newLegends: (config: Omit<LegendsConfig, 'seed'>) => void;
  legendsPick: (playerId: string) => string | null;
  legendsAutoPick: () => string | null;
  /** Release the chosen players (or the weakest) and start the summer draft. */
  legendsSummer: (released: string[]) => void;

  kickOff: () => void;
  liveTick: () => void;
  liveTeamTalk: (talk: TeamTalk) => void;
  liveSetTactics: (tactics: Tactics) => void;
  liveSub: (outId: string, inId: string) => boolean;
  liveSkip: () => void;
  liveFinish: () => void;
}

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

/** The user's next match, league or cup. */
export function nextUserFixture(game: GameState): Fixture | undefined {
  return nextUserMatch(game);
}

export function lastUserFixture(game: GameState): Fixture | undefined {
  const mine = (f: Fixture) => f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId);
  const played: Fixture[] = [...game.fixtures.filter(mine), ...userCupTies(game).filter(mine)];
  return played.sort((a, b) => b.week * 7 + matchDay(game, b) - (a.week * 7 + matchDay(game, a)))[0];
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
    if (game) topUpUnlimited(game);
    // A pending result popup is shown on the hub first; dismissing it moves on.
    if (game) unlockAchievements(game);
    set((s) => ({ rev: s.rev + 1, screen: game?.phase === 'seasonEnd' && !s.resultPopup ? 'seasonEnd' : s.screen }));
    if (game) void saveGame(game, get().slot);
  };
  // Anything newly achieved: kept on the device, and announced.
  const unlockAchievements = (game: GameState) => {
    const have = get().achievements;
    const fresh = earnedAchievements(game).filter((id) => !have[id]);
    if (!fresh.length) return;
    const club = game.unemployed ? game.clubs[game.unemployed.fromClubId] : game.clubs[game.userClubId];
    const unlocked = { ...have };
    for (const id of fresh) {
      unlocked[id] = { at: Date.now(), clubName: club.name, season: game.season };
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      addInboxItem(game, 'info', `Achievement unlocked: ${a.name}. ${a.description}`, { category: 'club', subject: `Achievement: ${a.name}` });
    }
    const first = ACHIEVEMENTS.find((x) => x.id === fresh[0])!;
    set({ achievements: unlocked, toast: `🏆 Achievement unlocked: ${first.name}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}` });
    void saveAchievements(unlocked);
  };
  const liveSideName = (): SideName | null => {
    const { game, liveFixture } = get();
    return game && liveFixture ? userSide(game, liveFixture) : null;
  };

  return {
    game: null,
    rev: 0,
    screen: 'start',
    challengeDraft: null,
    busy: false,
    live: null,
    liveFixture: null,
    liveNotes: [],
    resultPopup: null,
    toast: null,
    achievements: {},
    loadAchievements: async () => {
      const unlocked = await loadAchievements();
      set((s) => ({ achievements: { ...unlocked, ...s.achievements } }));
    },
    showToast: (text) => set({ toast: text }),

    go: (screen) => set({ screen }),

    setChallengeDraft: (id) => set({ challengeDraft: id }),

    startRelegationBattle: async (country, divisionId) => {
      set({ busy: true });
      await new Promise((r) => setTimeout(r, 0));
      const game = createRelegationBattle(Math.floor(Math.random() * 2 ** 32), country, divisionId, true);
      set({ game, busy: false, screen: 'hub', live: null, liveFixture: null, resultPopup: null, challengeDraft: null });
      commit();
    },

    continueAfterChallenge: () => {
      const { game } = get();
      if (!game?.challenge) return;
      game.challenge.continued = true;
      set({ screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' });
      commit();
    },

    setIdentity: ({ colours, awayKit, crest }) => {
      const { game } = get();
      if (!game) return;
      const club = game.clubs[game.userClubId];
      club.colours = colours;
      club.awayKit = awayKit;
      club.crest = crest;
      commit();
    },

    setTraining: (settings) => {
      const { game } = get();
      if (!game) return;
      game.clubs[game.userClubId].training = settings;
      commit();
    },

    setPlayerTraining: (playerId, focus) => {
      const { game } = get();
      const p = game?.players[playerId];
      if (!game || !p) return;
      p.trainingFocus = focus ?? undefined;
      commit();
    },

    setRetrain: (playerId, position) => {
      const { game } = get();
      const p = game?.players[playerId];
      if (!game || !p) return;
      startRetraining(p, position);
      commit();
    },

    hireStaff: (role, index) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = hireStaff(game, role, index);
      if (!err) commit();
      return err;
    },

    loanPlayer: (playerId) => {
      const { game } = get();
      const p = (game ? playerById(game, playerId) : undefined);
      if (!game || !p) return 'No such player.';
      const err = loanIn(game, p);
      if (!err) commit();
      return err;
    },

    sendBackLoan: (playerId) => {
      const { game } = get();
      const p = (game ? playerById(game, playerId) : undefined);
      if (!game || !p) return;
      endLoan(game, p);
      commit();
    },

    newGame: (config) => {
      const game = createGame({ ...config, seed: Math.floor(Math.random() * 2 ** 32) });
      set({ game, screen: 'hub', live: null, liveFixture: null, resultPopup: null, challengeDraft: null });
      commit();
    },

    slot: 'slot1',
    chooseSlot: (slot) => set({ slot }),
    loadSlot: async (slot) => {
      set({ slot, live: null, liveFixture: null, resultPopup: null });
      return get().continueGame();
    },
    deleteSlot: async (slot) => {
      await deleteSave(slot);
      if (get().slot === slot) set({ game: null });
    },

    continueGame: async () => {
      const game = await loadGame(get().slot);
      if (!game) return false;
      // The old testing switches are gone: turn them off in older saves.
      if (game.settings?.unlimitedMoney) setUnlimitedMoneyEngine(game, false);
      if (game.settings?.allInterested) game.settings = { ...game.settings, allInterested: false };
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
      if (!game) return 'none-left';
      const club = game.clubs[game.userClubId];
      const result = assignScout(game, playerId, isKnown(game, club, playerById(game, playerId)!));
      commit();
      return result;
    },

    sendScoutMission: (brief) => {
      const { game } = get();
      if (!game) return null;
      const problem = sendMission(game, brief);
      if (!problem) commit();
      return problem;
    },

    cancelScoutMission: (id) => {
      const { game } = get();
      if (!game) return;
      game.scoutMissions = (game.scoutMissions ?? []).filter((m) => m.id !== id);
      commit();
    },

    toggleShortlist: (playerId) => {
      const { game } = get();
      if (!game) return;
      toggleShortlist(game, playerId);
      commit();
    },

    continueDay: () => {
      const { game } = get();
      if (!game || get().busy) return;
      const r = advanceHalfDay(game);
      if (r === 'matchday') set({ screen: 'prematch' });
      commit();
    },

    markRead: (id) => {
      const { game } = get();
      const item = game?.inbox?.find((i) => i.id === id);
      if (!item || item.read) return;
      item.read = true;
      bump();
    },

    markAllRead: () => {
      const { game } = get();
      if (!game) return;
      for (const i of game.inbox ?? []) i.read = true;
      commit();
    },

    bid: (playerId, fee) => {
      const { game } = get();
      if (!game) return { error: 'No game loaded.' };
      const p = playerById(game, playerId)!;
      const problem = cannotBuy(game, p) ?? feeProblem(game, fee);
      if (problem) return { error: problem };
      return bidFor(game, p, fee);
    },

    sign: (playerId, fee, wage, years) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = playerById(game, playerId)!;
      const club = game.clubs[game.userClubId];
      const problem = cannotBuy(game, p) ?? (fee ? feeProblem(game, fee) : null) ?? wageBudgetProblem(game, club, wage);
      if (problem) return problem;
      const from = p.clubId ? game.clubs[p.clubId].name : null;
      completeTransfer(game, p, club.id, fee, wage, years);
      addInbox(game, 'info', `${p.firstName} ${p.lastName} signs ${from ? `from ${from} for ${fee ? `£${fee.toLocaleString('en-GB')}` : 'a nominal fee'}` : 'on a free'}, on ${moneyPw(wage)} until ${p.contractEnd + 1}.`, { category: 'transfers', subject: `${p.lastName} signs` });
      commit();
      return null;
    },

    offerLowerWage: (playerId) => {
      const { game } = get();
      if (!game) return false;
      const p = playerById(game, playerId)!;
      return withRng(game, (rng) => acceptsLowerWage(game, rng, game.clubs[game.userClubId], p));
    },

    toggleListed: (playerId) => {
      const { game } = get();
      if (!game) return;
      const p = playerById(game, playerId)!;
      p.listed = !p.listed;
      commit();
    },

    release: (playerId) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = playerById(game, playerId)!;
      const problem = cannotRelease(game, p);
      if (problem) return problem;
      releasePlayer(game, p);
      commit();
      return null;
    },

    renew: (playerId, wage, years) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const p = playerById(game, playerId)!;
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

    editClub: ({ reputation, wage, transfer, balance }) => {
      const { game } = get();
      if (!game) return;
      const club = game.clubs[game.userClubId];
      club.reputation = Math.max(1, Math.min(100, Math.round(reputation)));
      club.balance = Math.round(balance);
      club.budgets = { wage: Math.max(0, Math.round(wage)), transfer: Math.max(0, Math.round(transfer)) };
      game.edited = true;
      commit();
    },

    adjustBudgets: (wageDelta) => {
      const { game } = get();
      if (!game) return;
      adjustBudgetsEngine(game, game.clubs[game.userClubId], wageDelta);
      commit();
    },

    buildStadium: (opt) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = startStadiumWork(game.clubs[game.userClubId], opt);
      if (!err) addInbox(game, 'info', `Work has started: ${opt.label.toLowerCase()} (${opt.weeks} weeks).`, { subject: 'Building work' });
      commit();
      return err;
    },

    buildCommercial: (kind) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = startCommercialWork(game, game.clubs[game.userClubId], kind);
      commit();
      return err;
    },

    buildTrainingPart: (part) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = startPartWork(game, game.clubs[game.userClubId], part);
      commit();
      return err;
    },

    upgradeFacility: (kind) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = startFacilityUpgrade(game, game.clubs[game.userClubId], kind);
      commit();
      return err;
    },

    setTicketPrice: (price) => {
      const { game } = get();
      if (!game) return;
      game.clubs[game.userClubId].ticketPrice = Math.max(1, Math.round(price));
      commit();
    },

    pickSponsor: (index) => {
      const { game } = get();
      if (!game) return;
      chooseSponsor(game, index);
      commit();
    },

    borrow: (amount) => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = takeLoan(game, amount);
      commit();
      return err;
    },

    repay: () => {
      const { game } = get();
      if (!game) return 'No game loaded.';
      const err = repayLoan(game);
      commit();
      return err;
    },

    resetLineup: () => {
      const { game } = get();
      if (!game) return;
      delete game.clubs[game.userClubId].lineup;
      commit();
    },

    setBenchSlot: (index, playerId) => {
      const { game } = get();
      if (!game) return;
      const club = game.clubs[game.userClubId];
      const current = userSelection(game).selection.bench.map((p) => p.id);
      club.bench = assignToBench(club.bench ?? current, index, playerId);
      commit();
    },

    resetBench: () => {
      const { game } = get();
      if (!game) return;
      delete game.clubs[game.userClubId].bench;
      commit();
    },

    restTiredPlayers: () => {
      const { game } = get();
      if (!game) return 0;
      const club = game.clubs[game.userClubId];
      const squad = squadOf(game, club.id);
      const base = club.lineup ?? autoLineup(squad, club.tactics.formation);
      const { lineup, swaps } = restTired(squad, club.tactics.formation, base);
      if (swaps.length) {
        club.lineup = lineup;
        commit();
      }
      return swaps.length;
    },

    setAutoRotate: (on) => {
      const { game } = get();
      if (!game) return;
      game.settings = { ...game.settings, assistantTactics: !!game.settings?.assistantTactics, autoRotate: on };
      commit();
    },

    waitAWeek: async () => {
      const { game } = get();
      if (!game?.unemployed) return;
      set({ busy: true });
      await new Promise((r) => setTimeout(r, 0));
      waitAWeek(game);
      set({ busy: false });
      commit();
    },

    waitForOffer: async () => {
      const { game } = get();
      if (!game?.unemployed) return;
      set({ busy: true });
      await new Promise((r) => setTimeout(r, 0));
      waitForOffer(game);
      set({ busy: false });
      commit();
    },

    acceptJobOffer: (clubId) => {
      const { game } = get();
      if (!game) return;
      const err = acceptJobOffer(game, clubId);
      if (err) get().showToast(err);
      else set({ screen: 'hub', live: null, liveFixture: null, resultPopup: null });
      commit();
    },

    declineJobOffer: (clubId) => {
      const { game } = get();
      if (!game) return;
      declineJobOffer(game, clubId);
      commit();
    },

    takeJob: (clubId) => {
      const { game } = get();
      if (!game) return;
      const err = takeJob(game, clubId);
      if (err) get().showToast(err);
      else set({ screen: 'hub', live: null, liveFixture: null, resultPopup: null });
      commit();
    },

    setPlayerRole: (playerId, role) => {
      const { game } = get();
      const p = (game ? playerById(game, playerId) : undefined);
      if (!game || !p || p.clubId !== game.userClubId) return;
      setRole(p, role);
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
      await yieldToUi();
      const target = advanceToUserMatch(game) ? simUserMatchToday(game) : undefined;
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

    newLegends: (config) => {
      const game = createLegendsGame({ ...config, seed: Math.floor(Math.random() * 2 ** 32) });
      set({ game, screen: 'hub', live: null, liveFixture: null, resultPopup: null });
      commit();
    },

    legendsPick: (playerId) => {
      const { game } = get();
      if (!game?.legends) return 'No Legends game.';
      const err = makePick(game, game.userClubId, playerId);
      if (!game.legends.draft) set({ screen: 'hub' });
      commit();
      return err;
    },

    legendsAutoPick: () => {
      const { game } = get();
      if (!game?.legends) return 'No Legends game.';
      const err = autoPick(game, game.userClubId);
      if (!game.legends.draft) set({ screen: 'hub' });
      commit();
      return err;
    },

    legendsSummer: (released) => {
      const { game } = get();
      if (!game?.legends) return;
      startSummerDraft(game, { [game.userClubId]: released });
      set({ screen: 'hub' });
      commit();
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
