import { createLiveMatch, finishMatch, simulateMatch } from '../match/engine';
import { recommendTactics } from '../match/preview';
import { isAvailable, pickTeam, remapLineup, selectionFromLineup } from '../match/selection';
import { addGate, crowdFill, moneyPw, resetLedgers, setBoardBudgets, weeklyFinances } from '../economy/finance';
import { MATCHDAY, SEASON_START_DAY, advanceHalfDay, deliverScoutReports, isMatchdayMorning, todaysUserMatch } from '../calendar';
import { awardLeagueTitles, completeUserCupTie, isCupTie, playDueCupRounds, setupCups } from './cups';
import { chairmanWeek, gradingWarning, makeSponsorOffers, moodAfterMatch, seasonPayouts, seasonReview, setSeasonTarget } from '../club/chairman';
import { injuryFactor } from '../club/facilities';
import { checkGrading } from '../club/stadium';
import { rolloverPlayers } from '../players/development';
import { attr100 } from '../players/ratings';
import { SCOUT_REPORTS_PER_WEEK, addInbox, expiringUserContracts, handleContractExpiries, maintainFreeAgents, marketWeek, transferWindow, trimAiSquads, } from '../transfers/market';
import { Rng } from '../rng';
import { divisionOf, newId, squadOf, withRng } from '../world';
import { matchdayCount, roundRobin, weekForMatchday } from './fixtures';
import { buildTable } from './table';
export function scheduleSeason(game) {
    game.totalWeeks = Math.max(...game.divisions.map((d) => matchdayCount(d.clubIds.length, d.def.rounds)));
    game.fixtures = [];
    withRng(game, (rng) => {
        for (const div of game.divisions) {
            const days = roundRobin(div.clubIds, div.def.rounds, rng);
            days.forEach((pairs, md) => {
                const week = weekForMatchday(md, days.length, game.totalWeeks);
                for (const [homeId, awayId] of pairs) {
                    game.fixtures.push({ id: newId(game, 'f'), divisionId: div.def.id, week, homeId, awayId, result: null });
                }
            });
        }
    });
}
/** Quick strength estimate: the average of the best eleven available players. */
function xiStrength(game, club) {
    const best = squadOf(game, club.id)
        .filter(isAvailable)
        .map((p) => p.overall)
        .sort((a, b) => b - a)
        .slice(0, 11);
    return best.reduce((s, x) => s + x, 0) / Math.max(1, best.length);
}
/** AI managers keep their shape but set their mentality by the opposition. */
export function aiTactics(game, club, opponent) {
    const gap = xiStrength(game, club) - xiStrength(game, opponent);
    const mentality = gap > 3 ? 'attacking' : gap < -3 ? 'defensive' : 'balanced';
    return { formation: club.tactics.formation, pressing: club.tactics.pressing ?? 'medium', mentality };
}
/** The user's XI for a formation: their saved lineup if they have one, else the best XI. */
export function userSelection(game, formation = game.clubs[game.userClubId].tactics.formation) {
    const club = game.clubs[game.userClubId];
    const squad = squadOf(game, club.id);
    if (!club.lineup)
        return { selection: pickTeam(squad, formation), covers: [] };
    const lineup = formation === club.tactics.formation ? club.lineup : remapLineup(squad, club.lineup, formation);
    return selectionFromLineup(squad, formation, lineup);
}
export function teamSheet(game, club, opponent, opts = {}) {
    if (!club.isUser) {
        const tactics = aiTactics(game, club, opponent);
        return { selection: pickTeam(squadOf(game, club.id), tactics.formation), tactics };
    }
    // Optionally delegate simmed matches to the assistant manager.
    if (!opts.live && game.settings?.assistantTactics) {
        const oppSheet = teamSheet(game, opponent, club);
        const select = (f) => userSelection(game, f).selection;
        const { tactics } = recommendTactics(squadOf(game, club.id), oppSheet, opts.home ? 'home' : 'away', false, select);
        return { selection: select(tactics.formation), tactics };
    }
    const tactics = { ...club.tactics, pressing: club.tactics.pressing ?? 'medium' };
    return { selection: userSelection(game).selection, tactics };
}
export function playMatch(game, rng, homeId, awayId, opts = {}) {
    const home = game.clubs[homeId];
    const away = game.clubs[awayId];
    const result = simulateMatch(rng, teamSheet(game, home, away, { home: true }), teamSheet(game, away, home), {
        ...opts,
        capacity: opts.neutral ? Math.max(home.capacity, away.capacity) * 2 : home.capacity,
        crowdFill: crowdFill(game, home),
    });
    applyMatchToPlayers(game, rng, result, home, away);
    if (opts.neutral) {
        addGate(game, home, result.attendance / 2);
        addGate(game, away, result.attendance / 2);
    }
    else
        addGate(game, home, result.attendance);
    return result;
}
export function userFixtureNext(game) {
    return game.fixtures.find((f) => !f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
}
/**
 * Move through the days to the morning of the user's next match; returns
 * that fixture (or nothing at season end). Daily events still happen.
 */
export function advanceToUserMatch(game) {
    while (game.phase === 'season') {
        if (isMatchdayMorning(game))
            return todaysUserMatch(game);
        if (advanceHalfDay(game) === 'seasonEnd')
            break;
    }
    return undefined;
}
/** Sim the user's match today (and the rest of that day's or week's games). */
export function simUserMatchToday(game) {
    const match = todaysUserMatch(game);
    if (!match)
        return undefined;
    if (isCupTie(match)) {
        playDueCupRounds(game, game.week, game.day ?? MATCHDAY);
        game.half = 'pm';
    }
    else
        playWeek(game);
    return match;
}
/** A live, steppable match for the user's fixture, with the user's side managed by hand. */
export function startUserMatch(game, fixture) {
    const home = game.clubs[fixture.homeId];
    const away = game.clubs[fixture.awayId];
    const seed = withRng(game, (rng) => rng.int(0, 2 ** 31));
    const cup = isCupTie(fixture) ? fixture : null;
    return createLiveMatch(new Rng(seed), teamSheet(game, home, away, { live: true }), teamSheet(game, away, home, { live: true }), {
        knockout: !!cup,
        neutral: cup?.neutral,
        capacity: cup?.neutral ? Math.max(home.capacity, away.capacity) * 2 : home.capacity,
        crowdFill: crowdFill(game, home),
        commentary: true,
        manual: { home: home.isUser, away: away.isUser },
    });
}
/** Record the user's finished match, then play the rest of that week. */
export function completeUserMatch(game, fixture, live) {
    const result = finishMatch(live);
    fixture.result = result;
    withRng(game, (rng) => applyMatchToPlayers(game, rng, result, game.clubs[fixture.homeId], game.clubs[fixture.awayId]));
    if (isCupTie(fixture)) {
        if (fixture.neutral) {
            addGate(game, game.clubs[fixture.homeId], result.attendance / 2);
            addGate(game, game.clubs[fixture.awayId], result.attendance / 2);
        }
        else
            addGate(game, game.clubs[fixture.homeId], result.attendance);
        completeUserCupTie(game, fixture);
        game.half = 'pm';
        return result;
    }
    addGate(game, game.clubs[fixture.homeId], result.attendance);
    playWeek(game);
    return result;
}
export function applyMatchToPlayers(game, rng, result, home, away) {
    const sides = [
        { club: home, used: result.homeXI, scored: result.homeGoals, conceded: result.awayGoals },
        { club: away, used: result.awayXI, scored: result.awayGoals, conceded: result.homeGoals },
    ];
    for (const { club, used, scored, conceded } of sides) {
        const usedSet = new Set(used);
        const moraleShift = scored > conceded ? 4 : scored < conceded ? -4 : 0;
        for (const id of club.playerIds) {
            const p = game.players[id];
            if (!usedSet.has(id)) {
                // Serving a ban: this match counts towards it.
                if (p.suspendedMatches > 0)
                    p.suspendedMatches--;
                continue;
            }
            const rating = result.ratings[id] ?? 6;
            p.seasonStats.apps++;
            p.seasonStats.ratingSum += rating;
            p.form = Math.round((p.form * 0.7 + rating * 0.3) * 10) / 10;
            p.fitness = Math.max(40, p.fitness - (24 - attr100(p, 'stamina') / 10));
            p.morale = Math.max(0, Math.min(100, p.morale + moraleShift + (rating >= 7.5 ? 2 : rating < 5.5 ? -2 : 0)));
        }
    }
    for (const e of result.events) {
        const p = game.players[e.playerId];
        if (!p)
            continue;
        if (e.type === 'goal') {
            p.seasonStats.goals++;
            if (e.assistId && game.players[e.assistId])
                game.players[e.assistId].seasonStats.assists++;
        }
        else if (e.type === 'red')
            p.suspendedMatches = 1;
        else if (e.type === 'injury') {
            const club = p.clubId ? game.clubs[p.clubId] : null;
            p.injuryWeeks = Math.max(1, Math.round(rng.int(2, 7) * (club ? injuryFactor(club) : 1)));
            if (club?.isUser) {
                const opp = club.id === home.id ? away : home;
                addInbox(game, 'info', `${p.firstName} ${p.lastName} was injured against ${opp.name} and will be out for about ${p.injuryWeeks} weeks.`, {
                    category: 'medical',
                    subject: `${p.lastName} injured`,
                });
            }
        }
    }
}
function weeklyRecovery(game) {
    for (const id in game.players) {
        const p = game.players[id];
        p.fitness = Math.min(100, p.fitness + 14 + attr100(p, 'stamina') / 20);
        if (p.injuryWeeks > 0)
            p.injuryWeeks--;
    }
}
export function fixturesForWeek(game, week) {
    return game.fixtures.filter((f) => f.week === week);
}
/** Play every fixture in the current week across the whole pyramid. */
export function playWeek(game) {
    if (game.phase !== 'season')
        return [];
    // Any cup rounds earlier in the week that were skipped over.
    playDueCupRounds(game, game.week, MATCHDAY);
    // It's matchday: messages from today's games and business carry Saturday's date.
    game.day = MATCHDAY;
    const fixtures = fixturesForWeek(game, game.week).filter((f) => !f.result);
    withRng(game, (rng) => {
        for (const f of fixtures)
            f.result = playMatch(game, rng, f.homeId, f.awayId);
    });
    weeklyRecovery(game);
    weeklyFinances(game);
    withRng(game, (rng) => {
        chairmanWeek(game, rng);
        marketWeek(game, rng);
    });
    userMatchMood(game, fixtures);
    const wasOpen = transferWindow(game).open;
    game.week++;
    // Saturday evening: day -1 of the new week is the Saturday just gone,
    // and Continue goes on to Sunday.
    game.day = MATCHDAY - 7;
    game.half = 'pm';
    if (game.week >= game.totalWeeks)
        endSeason(game);
    const now = transferWindow(game);
    if (!wasOpen && now.open)
        addInbox(game, 'info', `The ${now.name} transfer window is open for ${now.weeksLeft} weeks.`, { category: 'transfers', subject: 'Window open' });
    if (wasOpen && !now.open && game.phase === 'season')
        addInbox(game, 'info', 'The transfer window has closed. Free agents can still be signed.', { category: 'transfers', subject: 'Window closed' });
    if (game.phase === 'season' && game.week === Math.floor(game.totalWeeks * 0.6)) {
        const expiring = expiringUserContracts(game);
        if (expiring.length) {
            addInbox(game, 'contract', `Contracts ending this summer: ${expiring.map((p) => p.lastName).join(', ')}. Renew them from the Squad screen or they will leave.`, { category: 'transfers', subject: 'Contracts ending' });
        }
    }
    return fixtures;
}
/** Fans and board react to the user's result this week; ground warning later in the season. */
function userMatchMood(game, fixtures) {
    const all = [...fixtures, ...fixturesForWeek(game, game.week).filter((f) => f.result && !fixtures.includes(f))];
    const f = all.find((x) => x.result && (x.homeId === game.userClubId || x.awayId === game.userClubId));
    if (f?.result) {
        const home = f.homeId === game.userClubId;
        moodAfterMatch(game, home ? f.result.homeGoals : f.result.awayGoals, home ? f.result.awayGoals : f.result.homeGoals, home);
    }
    if (game.week >= game.totalWeeks * 0.5) {
        const div = divisionOf(game, game.userClubId);
        const table = buildTable(div.clubIds, game.fixtures.filter((x) => x.divisionId === div.def.id));
        gradingWarning(game, table.findIndex((r) => r.clubId === game.userClubId) + 1);
    }
}
/** Sim straight to the end of the regular season. */
export function playToSeasonEnd(game) {
    while (game.phase === 'season')
        playWeek(game);
}
function playKnockout(game, rng, divisionId, round, homeId, awayId) {
    const result = playMatch(game, rng, homeId, awayId, { knockout: true, neutral: round === 'final' });
    let winnerId;
    if (result.homeGoals !== result.awayGoals)
        winnerId = result.homeGoals > result.awayGoals ? homeId : awayId;
    else
        winnerId = result.penalties.home > result.penalties.away ? homeId : awayId;
    return { divisionId, round, homeId, awayId, result, winnerId };
}
export function endSeason(game) {
    const summary = {
        season: game.season,
        champions: {},
        promoted: {},
        relegated: {},
        playoffs: [],
        finalTables: {},
    };
    withRng(game, (rng) => {
        for (const div of game.divisions) {
            const id = div.def.id;
            const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === id));
            summary.finalTables[id] = table;
            summary.champions[id] = table[0].clubId;
            const promo = div.def.promotion;
            const promoted = [];
            if (promo) {
                promoted.push(...table.slice(0, promo.auto).map((r) => r.clubId));
                if (promo.playoff) {
                    const [from, to] = promo.playoff;
                    const seeds = table.slice(from - 1, to).map((r) => r.clubId);
                    const semi1 = playKnockout(game, rng, id, 'semi', seeds[0], seeds[3]);
                    const semi2 = playKnockout(game, rng, id, 'semi', seeds[1], seeds[2]);
                    const final = playKnockout(game, rng, id, 'final', semi1.winnerId, semi2.winnerId);
                    summary.playoffs.push(semi1, semi2, final);
                    promoted.push(final.winnerId);
                }
            }
            summary.promoted[id] = promoted;
            summary.relegated[id] = div.def.relegation > 0 ? table.slice(-div.def.relegation).map((r) => r.clubId) : [];
        }
    });
    denyPromotionIfGroundFails(game, summary);
    for (const div of game.divisions) {
        const id = div.def.id;
        summary.finalTables[id].forEach((row, i) => {
            const outcome = i === 0 ? 'champions'
                : summary.promoted[id].includes(row.clubId) ? 'promoted'
                    : summary.relegated[id].includes(row.clubId) ? 'relegated'
                        : 'stayed';
            game.clubs[row.clubId].history.push({ season: game.season, divisionId: id, position: i + 1, outcome });
        });
    }
    awardLeagueTitles(game, summary.champions);
    seasonPayouts(game, summary);
    seasonReview(game, summary);
    game.lastSummary = summary;
    game.phase = 'seasonEnd';
}
/** No promotion without a ground that meets the next level's rules; the next club goes up instead. */
function denyPromotionIfGroundFails(game, summary) {
    const user = game.clubs[game.userClubId];
    const div = divisionOf(game, user.id);
    const promoted = summary.promoted[div.def.id];
    if (!promoted.includes(user.id))
        return;
    const check = checkGrading(game, user, div.def.level - 1);
    if (!check || check.ok)
        return;
    const final = summary.playoffs.find((t) => t.divisionId === div.def.id && t.round === 'final');
    const replacementId = final && final.winnerId === user.id
        ? final.homeId === user.id ? final.awayId : final.homeId
        : summary.finalTables[div.def.id].map((r) => r.clubId).find((id) => !promoted.includes(id));
    summary.promoted[div.def.id] = promoted.map((id) => (id === user.id ? replacementId : id));
    summary.deniedPromotion = { clubId: user.id, replacementId };
    addInbox(game, 'contract', `Promotion denied: the ground doesn't meet the rules for the next level. ${game.clubs[replacementId].name} go up instead.`, { subject: 'Promotion denied' });
}
/** Distribute clubs into divisions, honouring each target's quota and preferring a regional match. */
function assign(clubs, targets) {
    const out = new Map();
    const remaining = targets.map((t) => ({ ...t }));
    const pending = [];
    for (const c of clubs) {
        const t = remaining.find((r) => r.quota > 0 && r.div.def.region === c.region);
        if (t) {
            t.quota--;
            out.set(c.id, t.div);
        }
        else
            pending.push(c);
    }
    for (const c of pending) {
        const t = remaining.find((r) => r.quota > 0);
        if (!t)
            throw new Error('Promotion/relegation quotas do not balance');
        t.quota--;
        out.set(c.id, t.div);
        // A club moved into another region's league adopts that region.
        if (t.div.def.region)
            c.region = t.div.def.region;
    }
    return out;
}
export function applyMovements(game, summary) {
    const levels = [...new Set(game.divisions.map((d) => d.def.level))].sort((a, b) => a - b);
    const moves = new Map();
    for (let i = 0; i < levels.length - 1; i++) {
        const upper = game.divisions.filter((d) => d.def.level === levels[i]);
        const lower = game.divisions.filter((d) => d.def.level === levels[i + 1]);
        const down = upper.flatMap((d) => summary.relegated[d.def.id].map((id) => ({ club: game.clubs[id], from: d })));
        const up = lower.flatMap((d) => summary.promoted[d.def.id].map((id) => ({ club: game.clubs[id], from: d })));
        const downTo = assign(down.map((x) => x.club), lower.map((d) => ({ div: d, quota: summary.promoted[d.def.id].length })));
        const upTo = assign(up.map((x) => x.club), upper.map((d) => ({ div: d, quota: summary.relegated[d.def.id].length })));
        for (const { club, from } of down)
            moves.set(club.id, { from, to: downTo.get(club.id) });
        for (const { club, from } of up)
            moves.set(club.id, { from, to: upTo.get(club.id) });
    }
    for (const [clubId, { from, to }] of moves) {
        from.clubIds = from.clubIds.filter((id) => id !== clubId);
        to.clubIds.push(clubId);
        const club = game.clubs[clubId];
        club.reputation += to.def.level < from.def.level ? 4 : -4;
    }
    return moves;
}
/** Promotion/relegation, player ageing and a fresh fixture list. */
export function startNextSeason(game) {
    if (game.phase !== 'seasonEnd' || !game.lastSummary)
        return;
    deliverScoutReports(game, true);
    const userLevel = divisionOf(game, game.userClubId).def.level;
    const moves = applyMovements(game, game.lastSummary);
    // A new level has a different going rate for tickets.
    if (divisionOf(game, game.userClubId).def.level !== userLevel)
        game.clubs[game.userClubId].ticketPrice = undefined;
    withRng(game, (rng) => {
        handleContractExpiries(game, rng);
        rolloverPlayers(game, rng, new Set(moves.keys()));
        trimAiSquads(game);
        maintainFreeAgents(game, rng);
    });
    resetLedgers(game);
    game.season++;
    game.week = 0;
    game.day = SEASON_START_DAY;
    game.half = 'am';
    game.phase = 'season';
    game.scoutReportsLeft = SCOUT_REPORTS_PER_WEEK;
    scheduleSeason(game);
    setupCups(game);
    startOfSeasonBusiness(game);
}
/** Board target, sponsor offers, budgets and the window opening. */
export function startOfSeasonBusiness(game) {
    setSeasonTarget(game);
    withRng(game, (rng) => makeSponsorOffers(game, rng));
    announceBudgets(game);
    addInbox(game, 'info', `The summer transfer window is open for ${transferWindow(game).weeksLeft} weeks.`, { category: 'transfers', subject: 'Window open' });
}
/** The board sets the user's budgets for the new season and says so. */
export function announceBudgets(game) {
    const club = game.clubs[game.userClubId];
    const b = setBoardBudgets(game, club);
    addInbox(game, 'info', `The board has set your budgets: ${money(b.transfer)} for transfers and ${moneyPw(b.wage)} for wages.`, { subject: 'Budgets set' });
}
function money(n) {
    return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
}
