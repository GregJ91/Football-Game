import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { userSelection } from '../../engine/season/season';
import { playerName } from '../../engine/players/generate';
import { POSITION_ORDER, positionsLabel } from '../../engine/players/ratings';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { PlayerSheet } from '../components/PlayerSheet';
import { moneyPw } from '../../engine/economy/finance';
function status(p) {
    if (p.injuryWeeks > 0)
        return `Injured ${p.injuryWeeks}w`;
    if (p.suspendedMatches > 0)
        return 'Suspended';
    return null;
}
export function Squad() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const go = useGame((s) => s.go);
    const [selected, setSelected] = useState(null);
    const club = userClub(game);
    const squad = squadOf(game, club.id).sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.overall - a.overall);
    const { selection } = userSelection(game);
    const starters = new Set(selection.xi.map((p) => p.id));
    const bench = new Set(selection.bench.map((p) => p.id));
    return (_jsxs("main", { className: "screen squad", children: [_jsx("header", { className: "screen-head", children: _jsx("h1", { children: "Squad" }) }), _jsxs("button", { type: "button", className: "card link-card", onClick: () => go('tactics'), children: [_jsxs("span", { children: [_jsx("strong", { children: "Starting XI and tactics" }), _jsxs("small", { children: [club.tactics.formation, " \u00B7 ", club.lineup ? 'your chosen XI' : 'best XI picked automatically'] })] }), _jsx("span", { "aria-hidden": "true", children: "\u2192" })] }), _jsx("ul", { className: "player-list", children: squad.map((p) => {
                    const st = status(p);
                    const apps = p.seasonStats.apps;
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: "player-row", onClick: () => setSelected(p), children: [_jsx("span", { className: `pos pos-${p.position}`, children: positionsLabel(p) }), _jsx("span", { className: "ovr", children: p.overall }), _jsxs("span", { className: "who", children: [_jsx("strong", { children: playerName(p) }), _jsxs("small", { children: [p.age, " yrs \u00B7 ", apps, " apps", p.seasonStats.goals ? ` · ${p.seasonStats.goals} gls` : '', apps ? ` · ${(p.seasonStats.ratingSum / apps).toFixed(1)} avg` : ''] })] }), _jsxs("span", { className: "role", children: [st ? _jsx("em", { className: "warn", children: st }) : p.listed ? _jsx("em", { className: "warn", children: "Listed" }) : starters.has(p.id) ? 'XI' : bench.has(p.id) ? 'Sub' : '', _jsx("small", { children: moneyPw(p.wage) }), p.contractEnd <= game.season && _jsx("small", { className: "warn", children: "Contract ends" })] })] }) }, p.id));
                }) }), selected && _jsx(PlayerSheet, { player: selected, onClose: () => setSelected(null) })] }));
}
