import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { FORMATIONS } from '../../engine/match/selection';
import { canPlay, effectiveRating, positionFit, positionsLabel, positionsOf } from '../../engine/players/ratings';
import { userSelection } from '../../engine/season/season';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { TacticsPicker } from '../components/TacticsPicker';
/** Pitch rows (attack at the top) as indexes into each formation's slots, left to right. */
const PITCH_ROWS = {
    '4-4-2': [[9, 10], [8, 6, 7, 5], [4, 2, 3, 1], [0]],
    '4-3-3': [[9, 10, 8], [6, 7], [5], [4, 2, 3, 1], [0]],
    '4-2-3-1': [[10], [9, 8, 7], [5, 6], [4, 2, 3, 1], [0]],
    '3-5-2': [[9, 10], [8, 6, 7, 4], [5], [1, 2, 3], [0]],
    '5-3-2': [[9, 10], [7, 8], [6], [5, 2, 3, 4, 1], [0]],
};
const surname = (p) => p.lastName;
function fitClass(p, slot) {
    const fit = positionFit(positionsOf(p), slot);
    return fit >= 1 ? 'fit-good' : fit >= 0.85 ? 'fit-ok' : 'fit-poor';
}
function statusOf(p) {
    if (p.injuryWeeks > 0)
        return `Injured ${p.injuryWeeks}w`;
    if (p.suspendedMatches > 0)
        return 'Suspended';
    return null;
}
export function Tactics() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const setTactics = useGame((s) => s.setTactics);
    const setLineupSlot = useGame((s) => s.setLineupSlot);
    const resetLineup = useGame((s) => s.resetLineup);
    const setAssistantTactics = useGame((s) => s.setAssistantTactics);
    const [picking, setPicking] = useState(null);
    const club = userClub(game);
    const formation = club.tactics.formation;
    const slots = FORMATIONS[formation];
    const squad = squadOf(game, club.id);
    const { selection, covers } = userSelection(game);
    // Selection drops empty slots; map back to slot indexes for the pitch.
    const bySlot = [];
    {
        let k = 0;
        slots.forEach((slot, i) => {
            if (selection.slots[k] === slot && selection.xi[k]) {
                bySlot[i] = selection.xi[k];
                k++;
            }
        });
    }
    const starters = new Set(selection.xi.map((p) => p.id));
    const avg = Math.round(selection.xi.reduce((s, p, i) => s + effectiveRating(p, selection.slots[i]), 0) / Math.max(1, selection.xi.length));
    const manual = !!club.lineup;
    const pickingSlot = picking !== null ? slots[picking] : null;
    // Best to worst at this position: those who play there first, then everyone else.
    const byRating = pickingSlot
        ? [...squad].sort((a, b) => {
            const ua = statusOf(a) ? 1 : 0;
            const ub = statusOf(b) ? 1 : 0;
            return ua - ub || effectiveRating(b, pickingSlot) - effectiveRating(a, pickingSlot);
        })
        : [];
    const naturals = pickingSlot ? byRating.filter((p) => canPlay(p, pickingSlot)) : [];
    const others = pickingSlot ? byRating.filter((p) => !canPlay(p, pickingSlot)) : [];
    const row = (p) => {
        const st = statusOf(p);
        const current = picking !== null && bySlot[picking]?.id === p.id;
        return (_jsx("li", { children: _jsxs("button", { type: "button", className: "player-row", "aria-pressed": current, disabled: !!st, onClick: () => {
                    setLineupSlot(picking, p.id);
                    setPicking(null);
                }, children: [_jsx("span", { className: "pos", children: positionsLabel(p) }), _jsx("span", { className: `ovr ${fitClass(p, pickingSlot)}`, children: Math.round(effectiveRating(p, pickingSlot)) }), _jsxs("span", { className: "who", children: [_jsxs("strong", { children: [p.firstName, " ", p.lastName] }), _jsxs("small", { children: [p.age, " yrs \u00B7 Fit ", Math.round(p.fitness), "%"] })] }), _jsx("span", { className: "role", children: st ? _jsx("em", { className: "warn", children: st }) : current ? 'Here' : starters.has(p.id) ? 'In XI' : '' })] }) }, p.id));
    };
    return (_jsxs("main", { className: "screen tactics", children: [_jsxs("header", { className: "screen-head row", children: [_jsx("h1", { className: "grow", children: "Tactics" }), _jsx("span", { className: `chip ${manual ? 'chip-accent' : ''}`, children: manual ? 'Your XI' : 'Auto XI' })] }), _jsxs("section", { className: "pitch", "aria-label": `Starting eleven in a ${formation}`, children: [_jsxs("div", { className: "pitch-lines", "aria-hidden": "true", children: [_jsx("i", { className: "halfway" }), _jsx("i", { className: "circle" }), _jsx("i", { className: "box top" }), _jsx("i", { className: "box bottom" })] }), PITCH_ROWS[formation].map((row, r) => (_jsx("div", { className: "pitch-row", children: row.map((i) => {
                            const p = bySlot[i];
                            const slot = slots[i];
                            return (_jsxs("button", { type: "button", className: `slot-chip ${p ? fitClass(p, slot) : 'empty'}`, onClick: () => setPicking(i), children: [_jsx("span", { className: "slot-rating", children: p ? Math.round(effectiveRating(p, slot)) : '–' }), _jsx("span", { className: "slot-name", children: p ? surname(p) : 'Pick' }), _jsxs("span", { className: "slot-pos", children: [slot, p && !canPlay(p, slot) ? ` (${p.position})` : ''] })] }, i));
                        }) }, r)))] }), _jsxs("div", { className: "pitch-meta", children: [_jsxs("span", { children: ["Team rating ", _jsx("strong", { children: avg })] }), _jsxs("span", { className: "legend", children: [_jsx("i", { className: "fit-good" }), " Natural ", _jsx("i", { className: "fit-ok" }), " Can cover ", _jsx("i", { className: "fit-poor" }), " Out of position"] })] }), covers.length > 0 && (_jsx("section", { className: "card warn-card", children: covers.map((c) => {
                    const out = game.players[c.outId];
                    const inn = c.inId ? game.players[c.inId] : null;
                    const why = c.reason === 'left' ? 'has left the club' : `is ${c.reason}`;
                    return (_jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), out ? `${out.firstName} ${out.lastName}` : 'A chosen player', " ", why, ". ", inn ? `${inn.lastName} covers at ${c.slot}.` : ''] }, c.slotIndex));
                }) })), _jsxs("div", { className: "grid-2", children: [_jsx("button", { type: "button", className: "btn secondary", onClick: resetLineup, disabled: !manual, children: "Pick best XI" }), _jsx("div", { className: "hint left", children: "Tap a player on the pitch to change who plays there." })] }), _jsxs("section", { className: "card", children: [_jsx(TacticsPicker, { tactics: club.tactics, onChange: setTactics }), _jsxs("label", { className: "toggle", children: [_jsx("input", { id: "assistant-tactics", type: "checkbox", checked: !!game.settings?.assistantTactics, onChange: (e) => setAssistantTactics(e.target.checked) }), _jsxs("span", { children: ["Let my assistant set tactics for simmed matches", _jsx("small", { children: "He'll counter each opponent using your chosen players. Matches you play live use your own tactics." })] })] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: "Substitutes" }), _jsx("span", { children: "Best of the rest" })] }), _jsx("ul", { className: "bench-list", children: selection.bench.map((p) => (_jsxs("li", { children: [_jsx("span", { className: `pos pos-${p.position}`, children: positionsLabel(p) }), p.firstName, " ", p.lastName, _jsx("b", { children: p.overall })] }, p.id))) })] }), picking !== null && pickingSlot && (_jsx("div", { className: "sheet-backdrop", onClick: () => setPicking(null), children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": `Choose a player for ${pickingSlot}`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsxs("strong", { className: "grow", children: ["Who plays ", pickingSlot, "?"] }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setPicking(null), children: "Close" })] }), _jsx("p", { className: "muted small", children: "Ratings are for this position, including fitness. Best first." }), _jsxs("div", { className: "card-label", children: [_jsxs("span", { children: ["Plays ", pickingSlot] }), _jsx("span", { children: naturals.length })] }), naturals.length === 0 && _jsxs("p", { className: "muted small", children: ["Nobody in the squad plays ", pickingSlot, "."] }), _jsx("ul", { className: "player-list", children: naturals.map(row) }), others.length > 0 && (_jsxs("details", { className: "others", children: [_jsxs("summary", { children: ["Out of position (", others.length, ")"] }), _jsx("ul", { className: "player-list", children: others.map(row) })] }))] }) }))] }));
}
