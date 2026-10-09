import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { buildTable } from '../../engine/season/table';
import { divisionOf, userClub } from '../../engine/world';
import { lastUserFixture, nextUserFixture, useGame } from '../../state/store';
import { ClubDot, Crest } from '../components/ClubArt';
import { LeagueTable } from '../components/LeagueTable';
import { BidCard } from '../components/BidCard';
import { MatchCard } from '../components/MatchCard';
import { openInboxItems, transferWindow } from '../../engine/transfers/market';
import { boardOf } from '../../engine/club/chairman';
import { competitionLabel, formatDate, matchDate } from '../../engine/calendar';
import { isCupTie } from '../../engine/season/cups';
import { money, ordinal, seasonLabel } from '../format';
export function Hub() {
    const game = useGame((s) => s.game);
    const rev = useGame((s) => s.rev);
    const busy = useGame((s) => s.busy);
    const openPreMatch = useGame((s) => s.openPreMatch);
    const simNextMatch = useGame((s) => s.simNextMatch);
    const simToSeasonEnd = useGame((s) => s.simToSeasonEnd);
    const go = useGame((s) => s.go);
    const club = userClub(game);
    const division = divisionOf(game, club.id);
    // The engine mutates `game` in place, so `rev` is what signals a change.
    const table = useMemo(() => buildTable(division.clubIds, game.fixtures.filter((f) => f.divisionId === division.def.id)), [rev, division]);
    const started = table.some((r) => r.played > 0);
    const pos = started ? table.findIndex((r) => r.clubId === club.id) + 1 : 0;
    const next = nextUserFixture(game);
    const last = lastUserFixture(game);
    const opponent = next ? game.clubs[next.homeId === club.id ? next.awayId : next.homeId] : null;
    const isHome = next?.homeId === club.id;
    const oppPos = opponent && started ? table.findIndex((r) => r.clubId === opponent.id) + 1 : 0;
    const ourFixtures = game.fixtures.filter((f) => f.homeId === club.id || f.awayId === club.id);
    const matchday = Math.min(ourFixtures.filter((f) => f.result).length + 1, ourFixtures.length);
    const bids = openInboxItems(game);
    const unreadItems = (game.inbox ?? []).filter((i) => !i.read && i.kind !== 'bid');
    const unread = unreadItems.length;
    const latest = unreadItems[0];
    const board = boardOf(club);
    const window = transferWindow(game);
    const form = (clubId) => game.fixtures
        .filter((f) => f.result && (f.homeId === clubId || f.awayId === clubId))
        .sort((a, b) => b.week - a.week)
        .slice(0, 5)
        .reverse()
        .map((f) => {
        const us = f.homeId === clubId ? f.result.homeGoals : f.result.awayGoals;
        const them = f.homeId === clubId ? f.result.awayGoals : f.result.homeGoals;
        return us > them ? 'W' : us < them ? 'L' : 'D';
    })
        .join('');
    return (_jsxs("main", { className: "screen hub", children: [_jsxs("header", { className: "club-head", children: [_jsx(Crest, { colours: club.colours, size: 40 }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "club-title", children: club.name }), _jsxs("div", { className: "sub", children: [seasonLabel(game.season), " \u00B7 Game ", matchday, " of ", ourFixtures.length, " \u00B7 ", division.def.name] })] }), _jsxs("div", { className: "bank", children: [_jsx("strong", { children: money(club.balance) }), _jsx("span", { children: "Bank" })] })] }), _jsxs("button", { type: "button", className: "mood-row", onClick: () => go('club'), children: [_jsxs("span", { children: ["Board ", _jsx("b", { children: Math.round(board.confidence) }), _jsx("i", { className: "mini", children: _jsx("i", { style: { width: `${board.confidence}%` } }) })] }), _jsxs("span", { children: ["Fans ", _jsx("b", { children: Math.round(board.fans) }), _jsx("i", { className: "mini fans", children: _jsx("i", { style: { width: `${board.fans}%` } }) })] }), board.target && _jsxs("span", { className: "target-chip", children: ["Target: ", board.target.label] })] }), next && opponent ? (_jsxs("section", { className: "card fixture", children: [_jsxs("div", { className: "card-label", children: [_jsxs("span", { children: [formatDate(matchDate(game, next)), " \u00B7 ", competitionLabel(game, next)] }), _jsx("span", { children: isCupTie(next) && next.neutral ? 'Neutral' : isHome ? 'Home' : 'Away' })] }), _jsxs("div", { className: "versus", children: [_jsxs("div", { className: "side", children: [_jsx(ClubDot, { colours: club.colours, size: 34 }), _jsx("strong", { children: club.name }), _jsxs("span", { children: [pos ? ordinal(pos) : '–', " \u00B7 ", form(club.id) || 'No games yet'] })] }), _jsx("div", { className: "vs", children: "VS" }), _jsxs("div", { className: "side", children: [_jsx(ClubDot, { colours: opponent.colours, size: 34 }), _jsx("strong", { children: opponent.name }), _jsxs("span", { children: [oppPos ? ordinal(oppPos) : '–', " \u00B7 ", form(opponent.id) || 'No games yet'] })] })] }), _jsxs("div", { className: "grid-2", children: [_jsx("button", { type: "button", className: "btn primary", disabled: busy, onClick: openPreMatch, children: "Play match" }), _jsx("button", { type: "button", className: "btn secondary", disabled: busy, onClick: () => void simNextMatch(), children: busy ? 'Simming…' : 'Sim match' })] }), _jsx("button", { type: "button", className: "link-btn center", disabled: busy, onClick: () => void simToSeasonEnd(), children: "Sim to the end of the season" })] })) : (_jsxs("section", { className: "card", children: [_jsx("p", { children: "No more league fixtures this season." }), _jsx("button", { type: "button", className: "btn primary", disabled: busy, onClick: () => void simToSeasonEnd(), children: "Finish the season" })] })), (bids.length > 0 || unread > 0) && (_jsxs("section", { className: "inbox", children: [_jsxs("div", { className: "card-label inbox-label", children: [_jsx("span", { children: "Needs your attention" }), _jsxs("button", { type: "button", className: "link-btn", onClick: () => go('transfers'), children: [window.label, " \u2192"] })] }), bids.slice(0, 3).map((item) => _jsx(BidCard, { item: item }, item.id)), unread > 0 && (_jsxs("button", { type: "button", className: "news unread-link", onClick: () => go('inbox'), children: [unread, " unread message", unread === 1 ? '' : 's', ": ", latest?.subject ?? 'open your inbox', " \u2192"] }))] })), last && (_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Last result" }) }), _jsx(MatchCard, { game: game, fixture: last })] })), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: division.def.name }), _jsx("button", { type: "button", className: "link-btn", onClick: () => go('league'), children: "Full table \u2192" })] }), _jsx(LeagueTable, { game: game, def: division.def, rows: table, around: 2 })] })] }));
}
