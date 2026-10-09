import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { competitionLabel, formatDate, matchDate, matchDay } from '../../engine/calendar';
import { cupDef } from '../../data/cups';
import { isCupTie, userCupTies } from '../../engine/season/cups';
import { userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { LeagueTabs } from '../components/LeagueTabs';
import { MatchCard } from '../components/MatchCard';
export function Fixtures() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const [open, setOpen] = useState(null);
    const club = userClub(game);
    // League fixtures and cup ties drawn so far, in date order.
    const fixtures = [...game.fixtures.filter((f) => f.homeId === club.id || f.awayId === club.id), ...userCupTies(game)].sort((a, b) => a.week * 7 + matchDay(game, a) - (b.week * 7 + matchDay(game, b)));
    return (_jsxs("main", { className: "screen fixtures", children: [_jsxs("header", { className: "screen-head", children: [_jsx("h1", { children: "League" }), _jsx(LeagueTabs, {})] }), _jsx("ul", { className: "fixture-list", children: fixtures.map((f) => {
                    const home = f.homeId === club.id;
                    const opp = game.clubs[home ? f.awayId : f.homeId];
                    const r = f.result;
                    let outcome = '';
                    if (r) {
                        const us = home ? r.homeGoals : r.awayGoals;
                        const them = home ? r.awayGoals : r.homeGoals;
                        const pens = r.penalties;
                        const pu = pens ? (home ? pens.home : pens.away) : 0;
                        const pt = pens ? (home ? pens.away : pens.home) : 0;
                        outcome = us > them || pu > pt ? 'W' : us < them || pu < pt ? 'L' : 'D';
                    }
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: "fixture-row", disabled: !r, onClick: () => setOpen(f), children: [_jsx("span", { className: "wk", children: formatDate(matchDate(game, f)).replace(/^\w+ /, '') }), _jsx("span", { className: `comp ${isCupTie(f) ? 'cup' : ''}`, children: isCupTie(f) ? cupDef(game.country, f.cupId).short : 'L' }), _jsx("span", { className: "ha", children: isCupTie(f) && f.neutral ? 'N' : home ? 'H' : 'A' }), _jsx(ClubDot, { colours: opp.colours, size: 12 }), _jsx("span", { className: "opp", children: opp.name }), r ? (_jsxs("span", { className: `res res-${outcome}`, children: [outcome, " ", home ? r.homeGoals : r.awayGoals, "\u2013", home ? r.awayGoals : r.homeGoals] })) : (_jsx("span", { className: "res", children: "\u2013" }))] }) }, f.id));
                }) }), open && (_jsx("div", { className: "sheet-backdrop", onClick: () => setOpen(null), children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Match report", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsxs("strong", { className: "grow", children: [formatDate(matchDate(game, open), true), " \u00B7 ", competitionLabel(game, open)] }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setOpen(null), children: "Close" })] }), _jsx(MatchCard, { game: game, fixture: open })] }) }))] }));
}
