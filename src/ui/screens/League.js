import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { buildTable } from '../../engine/season/table';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { LeagueTable, TableKey } from '../components/LeagueTable';
import { LeagueTabs } from '../components/LeagueTabs';
export function League() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const [divId, setDivId] = useState(() => divisionOf(game, game.userClubId).def.id);
    const division = game.divisions.find((d) => d.def.id === divId) ?? game.divisions[0];
    const rows = buildTable(division.clubIds, game.fixtures.filter((f) => f.divisionId === division.def.id));
    return (_jsxs("main", { className: "screen league", children: [_jsxs("header", { className: "screen-head", children: [_jsx("h1", { children: "League" }), _jsx(LeagueTabs, {}), _jsxs("label", { className: "field", children: [_jsx("span", { className: "visually-hidden", children: "Division" }), _jsx("select", { value: division.def.id, onChange: (e) => setDivId(e.target.value), children: game.divisions.map((d) => (_jsxs("option", { value: d.def.id, children: ["Level ", d.def.level, " \u00B7 ", d.def.name] }, d.def.id))) })] })] }), _jsx("section", { className: "card flush", children: _jsx(LeagueTable, { game: game, def: division.def, rows: rows }) }), _jsx(TableKey, { def: division.def })] }));
}
