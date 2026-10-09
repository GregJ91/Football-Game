import { create } from 'zustand';
import { changeTactics, giveTeamTalk, makeSub, runToEnd, stepMinute, } from '../engine/match/engine';
import { advanceToUserMatch, completeUserMatch, playWeek, simUserMatchToday, startNextSeason, startUserMatch, } from '../engine/season/season';
import { advanceHalfDay, assignScout, matchDay, nextUserMatch } from '../engine/calendar';
import { userCupTies } from '../engine/season/cups';
import { assignToSlot, autoLineup, remapLineup } from '../engine/match/selection';
import { createGame, squadOf, withRng } from '../engine/world';
import { adjustBudgets as adjustBudgetsEngine, moneyPw, setUnlimitedMoney as setUnlimitedMoneyEngine, topUpUnlimited, wageBudgetProblem, } from '../engine/economy/finance';
import { chooseSponsor, repayLoan, takeLoan } from '../engine/club/chairman';
import { startFacilityUpgrade } from '../engine/club/facilities';
import { startStadiumWork } from '../engine/club/stadium';
import { acceptsLowerWage, addInbox, answerBid as answerBidEngine, bidFor, cannotBuy, cannotRelease, completeTransfer, feeProblem, isKnown, releasePlayer, renewContract, } from '../engine/transfers/market';
import { loadGame, saveGame } from './persistence';
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));
/** The user's next match, league or cup. */
export function nextUserFixture(game) {
    return nextUserMatch(game);
}
export function lastUserFixture(game) {
    const mine = (f) => f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId);
    const played = [...game.fixtures.filter(mine), ...userCupTies(game).filter(mine)];
    return played.sort((a, b) => b.week * 7 + matchDay(game, b) - (a.week * 7 + matchDay(game, a)))[0];
}
export function userSide(game, fixture) {
    return fixture.homeId === game.userClubId ? 'home' : 'away';
}
const TALK_REACTION = {
    well: 'The players respond well to the team talk.',
    neutral: 'The team talk gets a muted response.',
    badly: "The team talk falls flat. The players don't look convinced.",
};
export const useGame = create()((set, get) => {
    const bump = () => set((s) => ({ rev: s.rev + 1 }));
    const commit = () => {
        const { game } = get();
        if (game)
            topUpUnlimited(game);
        // A pending result popup is shown on the hub first; dismissing it moves on.
        set((s) => ({ rev: s.rev + 1, screen: game?.phase === 'seasonEnd' && !s.resultPopup ? 'seasonEnd' : s.screen }));
        if (game)
            void saveGame(game);
    };
    const liveSideName = () => {
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
            if (!game)
                return false;
            set((s) => ({ game, rev: s.rev + 1, screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' }));
            return true;
        },
        setTactics: (tactics) => {
            const { game } = get();
            if (!game)
                return;
            const club = game.clubs[game.userClubId];
            if (club.lineup && tactics.formation !== club.tactics.formation) {
                club.lineup = remapLineup(squadOf(game, club.id), club.lineup, tactics.formation);
            }
            club.tactics = { ...tactics };
            commit();
        },
        setLineupSlot: (slotIndex, playerId) => {
            const { game } = get();
            if (!game)
                return;
            const club = game.clubs[game.userClubId];
            const base = club.lineup ?? autoLineup(squadOf(game, club.id), club.tactics.formation);
            club.lineup = assignToSlot(base, slotIndex, playerId);
            commit();
        },
        scout: (playerId) => {
            const { game } = get();
            if (!game)
                return 'none-left';
            const club = game.clubs[game.userClubId];
            const result = assignScout(game, playerId, isKnown(game, club, game.players[playerId]));
            commit();
            return result;
        },
        continueDay: () => {
            const { game } = get();
            if (!game || get().busy)
                return;
            const r = advanceHalfDay(game);
            if (r === 'matchday')
                set({ screen: 'prematch' });
            commit();
        },
        markRead: (id) => {
            const { game } = get();
            const item = game?.inbox?.find((i) => i.id === id);
            if (!item || item.read)
                return;
            item.read = true;
            bump();
        },
        markAllRead: () => {
            const { game } = get();
            if (!game)
                return;
            for (const i of game.inbox ?? [])
                i.read = true;
            commit();
        },
        bid: (playerId, fee) => {
            const { game } = get();
            if (!game)
                return { error: 'No game loaded.' };
            const p = game.players[playerId];
            const problem = cannotBuy(game, p) ?? feeProblem(game, fee);
            if (problem)
                return { error: problem };
            return bidFor(game, p, fee);
        },
        sign: (playerId, fee, wage, years) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const p = game.players[playerId];
            const club = game.clubs[game.userClubId];
            const problem = cannotBuy(game, p) ?? (fee ? feeProblem(game, fee) : null) ?? wageBudgetProblem(game, club, wage);
            if (problem)
                return problem;
            const from = p.clubId ? game.clubs[p.clubId].name : null;
            completeTransfer(game, p, club.id, fee, wage, years);
            addInbox(game, 'info', `${p.firstName} ${p.lastName} signs ${from ? `from ${from} for ${fee ? `£${fee.toLocaleString('en-GB')}` : 'a nominal fee'}` : 'on a free'}, on ${moneyPw(wage)} until ${p.contractEnd + 1}.`, { category: 'transfers', subject: `${p.lastName} signs` });
            commit();
            return null;
        },
        offerLowerWage: (playerId) => {
            const { game } = get();
            if (!game)
                return false;
            const p = game.players[playerId];
            return withRng(game, (rng) => acceptsLowerWage(game, rng, game.clubs[game.userClubId], p));
        },
        toggleListed: (playerId) => {
            const { game } = get();
            if (!game)
                return;
            const p = game.players[playerId];
            p.listed = !p.listed;
            commit();
        },
        release: (playerId) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const p = game.players[playerId];
            const problem = cannotRelease(game, p);
            if (problem)
                return problem;
            releasePlayer(game, p);
            commit();
            return null;
        },
        renew: (playerId, wage, years) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const p = game.players[playerId];
            const problem = wageBudgetProblem(game, game.clubs[game.userClubId], wage, p.wage);
            if (problem)
                return problem;
            renewContract(game, p, wage, years);
            commit();
            return null;
        },
        answerBid: (itemId, action) => {
            const { game } = get();
            if (!game)
                return '';
            const msg = withRng(game, (rng) => answerBidEngine(game, rng, itemId, action));
            commit();
            return msg;
        },
        setUnlimitedMoney: (on) => {
            const { game } = get();
            if (!game)
                return;
            setUnlimitedMoneyEngine(game, on);
            commit();
        },
        adjustBudgets: (wageDelta) => {
            const { game } = get();
            if (!game)
                return;
            adjustBudgetsEngine(game, game.clubs[game.userClubId], wageDelta);
            commit();
        },
        buildStadium: (opt) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const err = startStadiumWork(game.clubs[game.userClubId], opt);
            if (!err)
                addInbox(game, 'info', `Work has started: ${opt.label.toLowerCase()} (${opt.weeks} weeks).`, { subject: 'Building work' });
            commit();
            return err;
        },
        upgradeFacility: (kind) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const err = startFacilityUpgrade(game, game.clubs[game.userClubId], kind);
            commit();
            return err;
        },
        setTicketPrice: (price) => {
            const { game } = get();
            if (!game)
                return;
            game.clubs[game.userClubId].ticketPrice = Math.max(1, Math.round(price));
            commit();
        },
        pickSponsor: (index) => {
            const { game } = get();
            if (!game)
                return;
            chooseSponsor(game, index);
            commit();
        },
        borrow: (amount) => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const err = takeLoan(game, amount);
            commit();
            return err;
        },
        repay: () => {
            const { game } = get();
            if (!game)
                return 'No game loaded.';
            const err = repayLoan(game);
            commit();
            return err;
        },
        resetLineup: () => {
            const { game } = get();
            if (!game)
                return;
            delete game.clubs[game.userClubId].lineup;
            commit();
        },
        setAssistantTactics: (on) => {
            const { game } = get();
            if (!game)
                return;
            game.settings = { ...game.settings, assistantTactics: on };
            commit();
        },
        openPreMatch: () => {
            const { game } = get();
            if (!game)
                return;
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
            if (!game || get().busy)
                return;
            set({ busy: true });
            await yieldToUi();
            const target = advanceToUserMatch(game) ? simUserMatchToday(game) : undefined;
            const popup = target?.result ? target : null;
            set({ busy: false, resultPopup: popup, screen: popup || game.phase === 'season' ? 'hub' : 'seasonEnd' });
            commit();
        },
        simToSeasonEnd: async () => {
            const { game } = get();
            if (!game || get().busy)
                return;
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
            if (!game)
                return;
            startNextSeason(game);
            set({ screen: 'hub' });
            commit();
        },
        kickOff: () => {
            const { game } = get();
            if (!game)
                return;
            const fixture = advanceToUserMatch(game);
            if (!fixture)
                return;
            const live = startUserMatch(game, fixture);
            set({ live, liveFixture: fixture, liveNotes: [{ minute: 0, text: 'The referee blows and we are under way!' }], screen: 'match' });
            bump();
        },
        liveTick: () => {
            const { live } = get();
            if (!live || live.finished || live.halfTimePending)
                return;
            const before = live.minute;
            stepMinute(live);
            const notes = [];
            if (before < 45 && live.minute >= 45)
                notes.push({ minute: 45, text: `Half time: ${live.homeGoals}–${live.awayGoals}.` });
            if (before < 90 && live.minute >= 90 && live.endMinute === 120)
                notes.push({ minute: 90, text: 'Level after 90 minutes. Extra time!' });
            if (live.finished)
                notes.push({ minute: live.minute, text: `Full time: ${live.homeGoals}–${live.awayGoals}.` });
            if (notes.length)
                set((s) => ({ liveNotes: [...s.liveNotes, ...notes] }));
            bump();
        },
        liveTeamTalk: (talk) => {
            const { live } = get();
            const side = liveSideName();
            if (!live || !side)
                return;
            const reaction = giveTeamTalk(live, side, talk);
            live.halfTimePending = false;
            set((s) => ({ liveNotes: [...s.liveNotes, { minute: 45, text: TALK_REACTION[reaction] }] }));
            bump();
        },
        liveSetTactics: (tactics) => {
            const { live, game } = get();
            const side = liveSideName();
            if (!live || !side || !game)
                return;
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
            if (!live || !side)
                return false;
            const ok = makeSub(live, side, outId, inId);
            bump();
            return ok;
        },
        liveSkip: () => {
            const { live } = get();
            if (!live)
                return;
            runToEnd(live);
            set((s) => ({ liveNotes: [...s.liveNotes, { minute: live.minute, text: `Full time: ${live.homeGoals}–${live.awayGoals}.` }] }));
            bump();
        },
        liveFinish: () => {
            const { game, live, liveFixture } = get();
            if (!game || !live || !liveFixture || !live.finished)
                return;
            completeUserMatch(game, liveFixture, live);
            set({ live: null, liveFixture: null, liveNotes: [], screen: game.phase === 'seasonEnd' ? 'seasonEnd' : 'hub' });
            commit();
        },
    };
});
