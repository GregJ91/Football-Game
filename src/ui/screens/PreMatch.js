import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { previewMatch, recommendTactics } from '../../engine/match/preview';
import { pickTeam } from '../../engine/match/selection';
import { aiTactics, userSelection } from '../../engine/season/season';
import { competitionLabel } from '../../engine/calendar';
import { isCupTie } from '../../engine/season/cups';
import { buildTable } from '../../engine/season/table';
import { divisionOf, squadOf, userClub } from '../../engine/world';
import { nextUserFixture, useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { TacticsPicker, tacticsLabel } from '../components/TacticsPicker';
import { ordinal } from '../format';
export function PreMatch() {
    const game = useGame((s) => s.game);
    const rev = useGame((s) => s.rev);
    const busy = useGame((s) => s.busy);
    const setTactics = useGame((s) => s.setTactics);
    const kickOff = useGame((s) => s.kickOff);
    const simNextMatch = useGame((s) => s.simNextMatch);
    const go = useGame((s) => s.go);
    const club = userClub(game);
    const fixture = nextUserFixture(game);
    const isHome = fixture?.homeId === club.id;
    const opponent = fixture ? game.clubs[isHome ? fixture.awayId : fixture.homeId] : null;
    // `game` is mutated in place, so `rev` is the change signal for these.
    const analysis = useMemo(() => {
        if (!fixture || !opponent)
            return null;
        const squad = squadOf(game, club.id);
        const oppTactics = aiTactics(game, opponent, club);
        const oppSheet = { selection: pickTeam(squadOf(game, opponent.id), oppTactics.formation), tactics: oppTactics };
        const ours = userSelection(game);
        const ourSheet = { selection: ours.selection, tactics: club.tactics };
        const neutral = isCupTie(fixture) && fixture.neutral;
        const preview = isHome ? previewMatch(ourSheet, oppSheet, 'home', neutral) : previewMatch(oppSheet, ourSheet, 'away', neutral);
        const advice = recommendTactics(squad, oppSheet, isHome ? 'home' : 'away', neutral, (f) => userSelection(game, f).selection);
        const div = divisionOf(game, club.id);
        const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === div.def.id));
        const started = table.some((r) => r.played > 0);
        const posOf = (id) => (started ? ordinal(table.findIndex((r) => r.clubId === id) + 1) : '–');
        return { oppTactics, preview, advice, posOf, covers: ours.covers };
    }, [rev, fixture?.id]);
    if (!fixture || !opponent || !analysis) {
        return (_jsxs("main", { className: "screen", children: [_jsx("p", { children: "No match to play." }), _jsx("button", { type: "button", className: "btn primary", onClick: () => go('hub'), children: "Back" })] }));
    }
    const { preview, advice, oppTactics, posOf, covers } = analysis;
    const ourXg = isHome ? preview.xgHome : preview.xgAway;
    const theirXg = isHome ? preview.xgAway : preview.xgHome;
    const ourStrength = isHome ? preview.strengthHome : preview.strengthAway;
    const theirStrength = isHome ? preview.strengthAway : preview.strengthHome;
    const same = (a, b) => a.formation === b.formation && a.mentality === b.mentality && a.pressing === b.pressing;
    const usingAdvice = same(club.tactics, advice.tactics);
    return (_jsxs("main", { className: "screen prematch", children: [_jsxs("header", { className: "screen-head", children: [_jsx("button", { type: "button", className: "link-btn", onClick: () => go('hub'), children: "\u2190 Hub" }), _jsxs("div", { className: "eyebrow", children: [competitionLabel(game, fixture), " \u00B7 ", isCupTie(fixture) && fixture.neutral ? 'Neutral ground' : isHome ? 'Home' : 'Away'] }), _jsxs("h1", { children: ["vs ", opponent.name] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "compare", children: [_jsxs("div", { className: "side", children: [_jsx(ClubDot, { colours: club.colours, size: 28 }), _jsx("strong", { children: club.shortName }), _jsx("span", { children: posOf(club.id) })] }), _jsxs("div", { className: "compare-rows", children: [_jsxs("div", { className: "compare-row", children: [_jsx("b", { children: ourStrength }), _jsx("span", { children: "Team rating" }), _jsx("b", { children: theirStrength })] }), _jsxs("div", { className: "compare-row", children: [_jsx("b", { children: ourXg.toFixed(1) }), _jsx("span", { children: "Expected goals" }), _jsx("b", { children: theirXg.toFixed(1) })] })] }), _jsxs("div", { className: "side", children: [_jsx(ClubDot, { colours: opponent.colours, size: 28 }), _jsx("strong", { children: opponent.shortName }), _jsx("span", { children: posOf(opponent.id) })] })] }), _jsxs("div", { className: "scout", children: ["Scout report: they line up ", _jsx("strong", { children: tacticsLabel(oppTactics) }), "."] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: "Your tactics" }), _jsxs("span", { children: ["Squad fit ", Math.round(preview.squadFit * 100), "%"] })] }), _jsx(TacticsPicker, { tactics: club.tactics, onChange: setTactics }), covers.length > 0 && (_jsx("ul", { className: "notes", children: covers.map((c) => {
                            const out = game.players[c.outId];
                            const inn = c.inId ? game.players[c.inId] : null;
                            return (_jsxs("li", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), out ? out.lastName : 'A chosen player', " ", c.reason === 'left' ? 'has left the club' : `is ${c.reason}`, inn ? `, so ${inn.lastName} plays ${c.slot}` : '', "."] }, c.slotIndex));
                        }) })), _jsxs("button", { type: "button", className: "link-btn", onClick: () => go('tactics'), children: ["Change starting XI (", club.lineup ? 'your picks' : 'auto-picked', ") \u2192"] })] }), _jsxs("section", { className: "card assistant", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Assistant manager" }) }), preview.notes.length === 0 ? (_jsx("p", { className: "note neutral", children: "No real tactical edge either way. It'll come down to the players." })) : (_jsx("ul", { className: "notes", children: preview.notes.map((n, i) => (_jsxs("li", { className: `note ${n.effect > 0.005 ? 'good' : n.effect < -0.005 ? 'bad' : 'neutral'}`, children: [_jsx("span", { "aria-hidden": "true", children: n.effect > 0.005 ? '▲' : n.effect < -0.005 ? '▼' : '•' }), n.text] }, i))) })), usingAdvice ? (_jsx("p", { className: "advice ok", children: "You're set up the way I'd do it, gaffer." })) : (_jsxs("button", { type: "button", className: "btn secondary", onClick: () => setTactics(advice.tactics), children: ["Use my pick: ", tacticsLabel(advice.tactics)] }))] }), _jsxs("div", { className: "sticky-cta grid-2", children: [_jsx("button", { type: "button", className: "btn primary big", disabled: busy, onClick: kickOff, children: "Play match" }), _jsx("button", { type: "button", className: "btn secondary big", disabled: busy, onClick: () => void simNextMatch(), children: "Sim match" })] })] }));
}
