import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ClubDot } from './ClubArt';
function zoneFor(def, pos, size) {
    if (def.promotion) {
        if (pos <= def.promotion.auto)
            return 'auto';
        const po = def.promotion.playoff;
        if (po && pos >= po[0] && pos <= po[1])
            return 'playoff';
    }
    else if (pos === 1)
        return 'auto';
    if (def.relegation && pos > size - def.relegation)
        return 'relegation';
    return null;
}
export function LeagueTable({ game, def, rows, around }) {
    const userIdx = rows.findIndex((r) => r.clubId === game.userClubId);
    let shown = rows.map((r, i) => ({ r, pos: i + 1 }));
    if (around !== undefined && userIdx >= 0) {
        const start = Math.max(0, Math.min(userIdx - around, rows.length - (around * 2 + 1)));
        shown = shown.slice(start, start + around * 2 + 1);
    }
    return (_jsxs("table", { className: "league-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "num", children: "#" }), _jsx("th", { children: "Club" }), _jsx("th", { className: "num", children: "P" }), around === undefined && (_jsxs(_Fragment, { children: [_jsx("th", { className: "num wide", children: "W" }), _jsx("th", { className: "num wide", children: "D" }), _jsx("th", { className: "num wide", children: "L" })] })), _jsx("th", { className: "num", children: "GD" }), _jsx("th", { className: "num", children: "Pts" })] }) }), _jsx("tbody", { children: shown.map(({ r, pos }) => {
                    const club = game.clubs[r.clubId];
                    const zone = zoneFor(def, pos, rows.length);
                    return (_jsxs("tr", { className: r.clubId === game.userClubId ? 'is-user' : undefined, children: [_jsx("td", { className: `num zone-${zone ?? 'none'}`, children: pos }), _jsxs("td", { className: "club-cell", children: [_jsx(ClubDot, { colours: club.colours, size: 12 }), _jsx("span", { children: club.name })] }), _jsx("td", { className: "num", children: r.played }), around === undefined && (_jsxs(_Fragment, { children: [_jsx("td", { className: "num wide", children: r.won }), _jsx("td", { className: "num wide", children: r.drawn }), _jsx("td", { className: "num wide", children: r.lost })] })), _jsxs("td", { className: "num", children: [r.goalsFor - r.goalsAgainst > 0 ? '+' : '', r.goalsFor - r.goalsAgainst] }), _jsx("td", { className: "num strong", children: r.points })] }, r.clubId));
                }) })] }));
}
export function TableKey({ def }) {
    return (_jsxs("div", { className: "table-key", children: [_jsxs("span", { children: [_jsx("i", { className: "zone-auto" }), " ", def.promotion ? 'Promotion' : 'Champions'] }), def.promotion?.playoff && _jsxs("span", { children: [_jsx("i", { className: "zone-playoff" }), " Play-offs"] }), def.relegation > 0 && _jsxs("span", { children: [_jsx("i", { className: "zone-relegation" }), " Relegation"] })] }));
}
