import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { shortName } from '../../engine/players/generate';
import { ClubDot } from './ClubArt';
export function MatchCard({ game, fixture }) {
    const r = fixture.result;
    if (!r)
        return null;
    const home = game.clubs[fixture.homeId];
    const away = game.clubs[fixture.awayId];
    const scorers = (side) => r.events
        .filter((e) => e.type === 'goal' && e.side === side)
        .map((e) => {
        const p = game.players[e.playerId];
        return `${p ? shortName(p) : 'Unknown'} ${e.minute}'`;
    });
    const reds = r.events.filter((e) => e.type === 'red');
    return (_jsxs("div", { className: "match-card", children: [_jsxs("div", { className: "score-row", children: [_jsxs("div", { className: "team", children: [_jsx(ClubDot, { colours: home.colours, size: 22 }), _jsx("span", { children: home.name })] }), _jsxs("div", { className: "score", children: [r.homeGoals, " \u2013 ", r.awayGoals] }), _jsxs("div", { className: "team right", children: [_jsx(ClubDot, { colours: away.colours, size: 22 }), _jsx("span", { children: away.name })] })] }), r.penalties && (_jsxs("div", { className: "pens", children: [r.penalties.home, " \u2013 ", r.penalties.away, " on penalties"] })), _jsxs("div", { className: "scorers", children: [_jsx("ul", { children: scorers('home').map((s, i) => _jsx("li", { children: s }, i)) }), _jsx("ul", { className: "right", children: scorers('away').map((s, i) => _jsx("li", { children: s }, i)) })] }), _jsxs("div", { className: "match-stats", children: [_jsxs("span", { children: ["Possession ", r.possessionHome, "% \u2013 ", 100 - r.possessionHome, "%"] }), _jsxs("span", { children: ["Shots ", r.shotsHome, " \u2013 ", r.shotsAway] }), _jsxs("span", { children: ["Att. ", r.attendance.toLocaleString('en-GB')] })] }), reds.length > 0 && (_jsxs("div", { className: "reds", children: ["Sent off: ", reds.map((e) => (game.players[e.playerId] ? shortName(game.players[e.playerId]) : '?')).join(', ')] }))] }));
}
