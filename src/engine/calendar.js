import { injuryFactor } from './club/facilities';
import { playerName } from './players/generate';
import { playWeek } from './season/season';
import { addInbox, askingPrice, interestIn, potentialStars } from './transfers/market';
import { cupName, cupRoundsToday, isCupTie, playDueCupRounds, roundOf, userCupTies, userTieToday } from './season/cups';
import { divisionOf, squadOf, withRng } from './world';
/** Days run Sunday (0) to Saturday (6); league matches are on Saturdays. */
export const MATCHDAY = 6;
export const SEASON_START_DAY = 1; // the season begins on a Monday morning
const DAY_MS = 86_400_000;
/** The Sunday before the first Saturday of August in the season's year. */
function seasonStart(year) {
    let t = Date.UTC(year, 7, 1);
    while (new Date(t).getUTCDay() !== 6)
        t += DAY_MS;
    return t - 6 * DAY_MS;
}
export function dateOf(game, week = game.week, day = game.day ?? SEASON_START_DAY) {
    return dateIn(game.season, week, day);
}
export function dateIn(season, week, day) {
    return new Date(seasonStart(season) + (week * 7 + day) * DAY_MS);
}
export function fixtureDate(game, week) {
    return dateOf(game, week, MATCHDAY);
}
export function formatDate(d, withYear = false) {
    return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(withYear ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
    }).replace(',', '');
}
function today(game) {
    return game.week * 7 + (game.day ?? SEASON_START_DAY);
}
export function userFixtureThisWeek(game) {
    return game.fixtures.find((f) => f.week === game.week && !f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
}
/** The user's match today, league (Saturday) or cup (midweek), if not yet played. */
export function todaysUserMatch(game) {
    return game.day === MATCHDAY ? userFixtureThisWeek(game) : userTieToday(game);
}
/** Morning of a day with the user's match still to play. */
export function isMatchdayMorning(game) {
    return game.phase === 'season' && game.half === 'am' && !!todaysUserMatch(game);
}
/** Day of the week a fixture is played. */
export function matchDay(game, f) {
    return isCupTie(f) ? roundOf(game, f).day : MATCHDAY;
}
export function matchDate(game, f) {
    return dateOf(game, f.week, matchDay(game, f));
}
/** The user's next league or cup match, whichever comes first. */
export function nextUserMatch(game) {
    const league = game.fixtures.find((f) => !f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId));
    const cups = userCupTies(game).filter((t) => !t.result);
    const all = [...(league ? [league] : []), ...cups];
    return all.sort((a, b) => a.week * 7 + matchDay(game, a) - (b.week * 7 + matchDay(game, b)))[0];
}
/** Competition label for a fixture, e.g. "FA Cup · Round 2" or "League". */
export function competitionLabel(game, f) {
    return isCupTie(f) ? `${cupName(game, f.cupId)} · ${roundOf(game, f).name}` : 'League';
}
/**
 * Continue: move on half a day (AM → PM → next day). On a Saturday morning
 * with a match to play it stops and returns 'matchday' instead.
 */
export function advanceHalfDay(game) {
    if (game.phase !== 'season')
        return 'seasonEnd';
    const day = game.day ?? SEASON_START_DAY;
    if ((game.half ?? 'am') === 'am') {
        if (day === MATCHDAY) {
            if (userFixtureThisWeek(game))
                return 'matchday';
            playWeek(game); // everyone else's games; leaves us on Saturday evening
            return game.phase === 'season' ? 'moved' : 'seasonEnd';
        }
        // A midweek cup day: stop for the user's tie, otherwise play the round.
        if (cupRoundsToday(game).length) {
            if (userTieToday(game))
                return 'matchday';
            playDueCupRounds(game, game.week, day);
        }
        game.half = 'pm';
        dailyEvents(game);
        return 'moved';
    }
    game.half = 'am';
    game.day = (day + 1) % 7;
    dailyEvents(game);
    return 'moved';
}
// ---------------------------------------------------------------- daily events
function dailyEvents(game) {
    withRng(game, (rng) => {
        deliverScoutReports(game);
        const day = game.day ?? SEASON_START_DAY;
        const weekday = day >= 1 && day <= 5;
        if (weekday && game.half === 'am')
            trainingKnock(game, rng);
        if (day === 5 && game.half === 'pm')
            trainingReport(game, rng);
    });
}
function trainingKnock(game, rng) {
    if (!rng.chance(0.025))
        return;
    const club = game.clubs[game.userClubId];
    const fit = squadOf(game, club.id).filter((p) => p.injuryWeeks === 0);
    if (!fit.length)
        return;
    const p = rng.pick(fit);
    p.injuryWeeks = Math.max(1, Math.round(rng.int(1, 3) * injuryFactor(club)));
    addInbox(game, 'info', `${playerName(p)} picked up a knock in training and will miss about ${p.injuryWeeks} week${p.injuryWeeks === 1 ? '' : 's'}.`, {
        category: 'medical',
        subject: `${p.lastName} injured in training`,
    });
}
function trainingReport(game, rng) {
    const squad = squadOf(game, game.userClubId).filter((p) => p.injuryWeeks === 0);
    if (squad.length < 3)
        return;
    // Young players with room to grow and in-form players catch the eye.
    const score = (p) => p.form + Math.max(0, p.potential - p.overall) / 6 + rng.next() * 2;
    const ranked = [...squad].sort((a, b) => score(b) - score(a));
    const stars = ranked.slice(0, 2);
    const struggler = ranked[ranked.length - 1];
    for (const p of stars)
        p.morale = Math.min(100, p.morale + 3);
    struggler.morale = Math.max(0, struggler.morale - 2);
    const tired = squad.filter((p) => p.fitness < 80).map((p) => p.lastName);
    const injured = squadOf(game, game.userClubId).filter((p) => p.injuryWeeks > 0).map((p) => `${p.lastName} (${p.injuryWeeks}w)`);
    const lines = [
        `Impressed this week: ${stars.map((p) => `${playerName(p)} (${p.position})`).join(' and ')}.`,
        `Struggling: ${playerName(struggler)} looked off the pace.`,
        tired.length ? `Still recovering fitness: ${tired.join(', ')}.` : 'The squad is fit and fresh.',
        injured.length ? `Injured: ${injured.join(', ')}.` : '',
    ].filter(Boolean);
    addInbox(game, 'info', lines.join(' '), { category: 'training', subject: 'Weekly training report' });
}
/** Send a scout to watch a player; the report arrives in 2–4 days. */
export function assignScout(game, playerId, known) {
    if (known)
        return 'known';
    game.scoutAssignments ??= [];
    if (game.scoutAssignments.some((a) => a.playerId === playerId))
        return 'pending';
    const left = game.scoutReportsLeft ?? 0;
    if (left <= 0)
        return 'none-left';
    game.scoutReportsLeft = left - 1;
    const days = 2 + (playerId.charCodeAt(playerId.length - 1) % 3);
    game.scoutAssignments.push({ playerId, dueDay: today(game) + days });
    return 'assigned';
}
export function scoutDueDate(game, playerId) {
    const a = game.scoutAssignments?.find((x) => x.playerId === playerId);
    if (!a)
        return null;
    return new Date(seasonStart(game.season) + a.dueDay * DAY_MS);
}
function verdict(game, p) {
    const xiAvg = (() => {
        const same = squadOf(game, game.userClubId).filter((x) => x.position === p.position).map((x) => x.overall).sort((a, b) => b - a);
        return same.length ? same[0] : 0;
    })();
    const diff = p.overall - xiAvg;
    if (diff >= 4)
        return 'Would walk into your first team.';
    if (diff >= -1)
        return 'Would challenge for a starting place.';
    if (diff >= -6)
        return 'A useful squad player.';
    return 'Not good enough for us right now.';
}
const INTEREST_TEXT = { keen: 'He would be keen to join.', open: 'He is open to a move.', reluctant: 'He would be reluctant to join.', no: 'He would only drop to our level for a very big wage.' };
export function deliverScoutReports(game, all = false) {
    const club = game.clubs[game.userClubId];
    const now = today(game);
    const due = (game.scoutAssignments ?? []).filter((a) => all || a.dueDay <= now);
    if (!due.length)
        return;
    game.scoutAssignments = (game.scoutAssignments ?? []).filter((a) => !due.includes(a));
    for (const a of due) {
        const p = game.players[a.playerId];
        if (!p)
            continue;
        club.scouted = { ...club.scouted, [p.id]: true };
        const where = p.clubId ? `${game.clubs[p.clubId].name} (${divisionOf(game, p.clubId).def.name})` : 'a free agent';
        const price = p.clubId ? ` Expect to pay around £${Math.round(askingPrice(game, p) / 1000)}k.` : '';
        addInbox(game, 'info', `${playerName(p)}, ${p.age}, ${p.position} at ${where}. Ability ${p.overall}, potential ${'★'.repeat(potentialStars(p))}. ${verdict(game, p)} ${INTEREST_TEXT[interestIn(game, club, p)]}${price}`, { category: 'scouting', subject: `Scout report: ${p.lastName}` });
    }
}
