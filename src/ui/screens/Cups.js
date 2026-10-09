import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cupDef } from '../../data/cups';
import { dateIn, formatDate } from '../../engine/calendar';
import { divisionOf } from '../../engine/world';
import { inRound } from '../../engine/season/cups';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { LeagueTabs } from '../components/LeagueTabs';
function scoreLine(t) {
    const r = t.result;
    return `${r.homeGoals}–${r.awayGoals}${r.penalties ? ` (${r.penalties.home}–${r.penalties.away} pens)` : ''}`;
}
export function Cups() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const user = game.userClubId;
    const userLevel = divisionOf(game, user).def.level;
    const status = (cup) => {
        const def = cupDef(game.country, cup.id);
        const mine = cup.rounds.flatMap((r) => r.ties).filter((t) => t.homeId === user || t.awayId === user);
        const lost = mine.find((t) => t.winnerId && t.winnerId !== user);
        if (cup.winnerId === user)
            return { text: 'Winners!', tone: 'good' };
        if (lost) {
            const opp = game.clubs[lost.homeId === user ? lost.awayId : lost.homeId];
            return { text: `Knocked out ${inRound(cup.rounds[lost.round].name)} by ${opp.name}.`, tone: 'bad' };
        }
        const next = mine.find((t) => !t.result);
        if (next) {
            const opp = game.clubs[next.homeId === user ? next.awayId : next.homeId];
            const round = cup.rounds[next.round];
            const where = next.neutral ? 'neutral ground' : next.homeId === user ? 'home' : 'away';
            return { text: `${round.name}: ${opp.name} (${where}), ${formatDate(dateIn(game.season, round.week, round.day))}.`, tone: 'neutral' };
        }
        const entered = def.entries[userLevel] !== undefined;
        if (!entered)
            return { text: 'Not entered: this cup is for clubs at other levels.', tone: 'neutral' };
        if (cup.winnerId)
            return { text: 'Finished.', tone: 'neutral' };
        return { text: 'Through. Waiting for the next draw.', tone: 'good' };
    };
    return (_jsxs("main", { className: "screen cups", children: [_jsxs("header", { className: "screen-head", children: [_jsx("h1", { children: "League" }), _jsx(LeagueTabs, {})] }), (game.cups ?? []).map((cup) => {
                const def = cupDef(game.country, cup.id);
                const st = status(cup);
                const latest = [...cup.rounds].reverse().find((r) => r.played);
                const upcoming = cup.rounds.find((r) => r.drawn && !r.played);
                const winner = cup.winnerId ? game.clubs[cup.winnerId] : null;
                const shown = latest ? [...latest.ties].sort((a, b) => Number(b.homeId === user || b.awayId === user) - Number(a.homeId === user || a.awayId === user)).slice(0, 6) : [];
                return (_jsxs("section", { className: "card cup-card", children: [_jsxs("div", { className: "cup-head", children: [_jsx("strong", { children: def.name }), winner && (_jsxs("span", { className: "cup-winner", children: [_jsx(ClubDot, { colours: winner.colours, size: 12 }), " ", winner.name] }))] }), _jsxs("p", { className: `note ${st.tone}`, children: [_jsx("span", { "aria-hidden": "true", children: st.tone === 'good' ? '▲' : st.tone === 'bad' ? '▼' : '•' }), st.text] }), upcoming && !winner && (_jsxs("p", { className: "muted small", children: ["Next round: ", upcoming.name, " on ", formatDate(dateIn(game.season, upcoming.week, upcoming.day)), " \u00B7 ", upcoming.ties.length, " ties"] })), latest && (_jsxs(_Fragment, { children: [_jsx("div", { className: "card-label", children: _jsxs("span", { children: [latest.name, " results"] }) }), _jsx("ul", { className: "cup-results", children: shown.map((t) => (_jsxs("li", { className: t.homeId === user || t.awayId === user ? 'mine' : '', children: [_jsx("span", { className: t.winnerId === t.homeId ? 'won' : '', children: game.clubs[t.homeId].name }), _jsx("b", { children: scoreLine(t) }), _jsx("span", { className: t.winnerId === t.awayId ? 'won' : '', children: game.clubs[t.awayId].name })] }, t.id))) }), latest.ties.length > shown.length && _jsxs("p", { className: "muted small", children: ["and ", latest.ties.length - shown.length, " more ties"] })] }))] }, cup.id));
            })] }));
}
