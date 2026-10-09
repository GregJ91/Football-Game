import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cupDef } from '../../data/cups';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot, Crest } from '../components/ClubArt';
import { LeagueTable, TableKey } from '../components/LeagueTable';
import { ordinal, seasonLabel } from '../format';
const HEADLINES = {
    champions: 'Champions!',
    promoted: 'Promoted!',
    relegated: 'Relegated',
    stayed: 'Season complete',
};
export function SeasonEnd() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const nextSeason = useGame((s) => s.nextSeason);
    const summary = game.lastSummary;
    if (!summary)
        return null;
    const club = userClub(game);
    const division = divisionOf(game, club.id);
    const record = club.history.at(-1);
    const rows = summary.finalTables[division.def.id];
    const userPlayoffs = summary.playoffs.filter((t) => t.homeId === club.id || t.awayId === club.id);
    const nameOf = (id) => game.clubs[id].name;
    return (_jsxs("main", { className: "screen season-end", children: [_jsxs("section", { className: `hero-card outcome-${record.outcome}`, children: [_jsx(Crest, { colours: club.colours, size: 64 }), _jsxs("div", { className: "eyebrow", children: [seasonLabel(summary.season), " \u00B7 ", division.def.name] }), _jsx("h1", { children: HEADLINES[record.outcome] }), _jsxs("p", { children: [club.name, " finished ", ordinal(record.position), record.outcome === 'promoted' && userPlayoffs.length > 0 ? ' and won the play-offs' : '', "."] })] }), userPlayoffs.length > 0 && (_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Your play-offs" }) }), userPlayoffs.map((t, i) => (_jsxs("div", { className: "po-row", children: [_jsx("span", { children: t.round === 'final' ? 'Final' : 'Semi' }), _jsxs("span", { className: "grow", children: [nameOf(t.homeId), " ", t.result.homeGoals, "\u2013", t.result.awayGoals, " ", nameOf(t.awayId), t.result.penalties ? ` (${t.result.penalties.home}–${t.result.penalties.away} pens)` : ''] })] }, i)))] })), _jsx("section", { className: "card flush", children: _jsx(LeagueTable, { game: game, def: division.def, rows: rows }) }), _jsx(TableKey, { def: division.def }), (game.cups ?? []).length > 0 && (_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Cup winners" }) }), game.cups.map((cup) => {
                        const w = cup.winnerId ? game.clubs[cup.winnerId] : null;
                        return (_jsxs("div", { className: "po-row", children: [_jsx("span", { className: "grow", children: cupDef(game.country, cup.id).name }), w && _jsx(ClubDot, { colours: w.colours, size: 12 }), _jsx("strong", { children: w ? w.name : '–' })] }, cup.id));
                    })] })), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Around the pyramid" }) }), game.divisions.map((d) => {
                        const champ = game.clubs[summary.champions[d.def.id]];
                        return (_jsxs("div", { className: "po-row", children: [_jsx("span", { className: "grow", children: d.def.name }), _jsx(ClubDot, { colours: champ.colours, size: 12 }), _jsx("strong", { children: champ.name })] }, d.def.id));
                    })] }), _jsx("div", { className: "sticky-cta", children: _jsxs("button", { type: "button", className: "btn primary big", onClick: nextSeason, children: ["Start ", seasonLabel(summary.season + 1)] }) })] }));
}
