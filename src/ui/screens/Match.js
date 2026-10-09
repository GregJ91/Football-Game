import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { describeEvent, playerLabel } from '../../engine/match/commentary';
import { ENGINE, playerEnergy } from '../../engine/match/engine';
import { useGame, userSide } from '../../state/store';
import { positionsLabel } from '../../engine/players/ratings';
import { ClubDot } from '../components/ClubArt';
import { TacticsPicker } from '../components/TacticsPicker';
const TICK_MS = { normal: 280, fast: 60 };
const TALKS = [
    { talk: 'praise', label: 'Praise', hint: "Well done, keep it up." },
    { talk: 'calm', label: 'Calm', hint: 'Keep your heads, stick to the plan.' },
    { talk: 'rally', label: 'Rally', hint: "I want more. Get stuck in!" },
];
export function Match() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const live = useGame((s) => s.live);
    const fixture = useGame((s) => s.liveFixture);
    const notes = useGame((s) => s.liveNotes);
    const tick = useGame((s) => s.liveTick);
    const teamTalk = useGame((s) => s.liveTeamTalk);
    const setLiveTactics = useGame((s) => s.liveSetTactics);
    const sub = useGame((s) => s.liveSub);
    const skip = useGame((s) => s.liveSkip);
    const finish = useGame((s) => s.liveFinish);
    const [speed, setSpeed] = useState('normal');
    const [paused, setPaused] = useState(false);
    const [sheet, setSheet] = useState(null);
    const [subOut, setSubOut] = useState(null);
    const running = !!live && !live.finished && !live.halfTimePending && !paused && sheet === null;
    useEffect(() => {
        if (!running)
            return;
        const id = setInterval(tick, TICK_MS[speed]);
        return () => clearInterval(id);
    }, [running, speed, tick]);
    const lines = useMemo(() => {
        if (!live || !fixture)
            return [];
        const name = (id) => playerLabel(id ? live.players[id] : undefined);
        const clubName = (side) => game.clubs[side === 'home' ? fixture.homeId : fixture.awayId].name;
        const out = [];
        for (const e of live.events) {
            const l = describeEvent(e, name, clubName);
            if (l)
                out.push(l);
        }
        for (const n of notes)
            out.push({ minute: n.minute, kind: 'info', text: n.text });
        // Newest first; within a minute keep insertion order reversed too.
        return out.map((l, i) => ({ l, i })).sort((a, b) => b.l.minute - a.l.minute || b.i - a.i).map((x) => x.l);
    }, [live, live?.events.length, notes, fixture, game]);
    if (!live || !fixture)
        return null;
    const home = game.clubs[fixture.homeId];
    const away = game.clubs[fixture.awayId];
    const side = userSide(game, fixture);
    const ours = live[side];
    const possession = Math.round((live.homePossession / Math.max(1, live.ticks)) * 100);
    const progress = Math.min(100, (live.minute / live.endMinute) * 100);
    return (_jsxs("main", { className: "screen match", children: [_jsxs("section", { className: "scoreboard", children: [_jsxs("div", { className: "score-row", children: [_jsxs("div", { className: "team", children: [_jsx(ClubDot, { colours: home.colours, size: 20 }), _jsx("span", { children: home.name })] }), _jsxs("div", { className: "score big", children: [live.homeGoals, " \u2013 ", live.awayGoals] }), _jsxs("div", { className: "team right", children: [_jsx(ClubDot, { colours: away.colours, size: 20 }), _jsx("span", { children: away.name })] })] }), _jsxs("div", { className: "clock", children: [_jsx("span", { className: "minute", children: live.finished ? 'FT' : live.halfTimePending ? 'HT' : `${live.minute}'` }), _jsx("span", { className: "track", children: _jsx("i", { style: { width: `${progress}%` } }) })] }), _jsxs("div", { className: "poss", children: [_jsxs("div", { className: "poss-labels", children: [_jsxs("span", { children: ["Possession ", possession, "%"] }), _jsxs("span", { children: ["Shots ", live.shotsHome, " \u2013 ", live.shotsAway] }), _jsxs("span", { children: [100 - possession, "%"] })] }), _jsx("span", { className: "poss-bar", children: _jsx("i", { style: { width: `${possession}%` } }) })] }), live.penalties && _jsxs("div", { className: "pens", children: [live.penalties.home, " \u2013 ", live.penalties.away, " on penalties"] })] }), _jsx("ol", { className: "ticker", "aria-live": "polite", children: lines.map((l, i) => (_jsxs("li", { className: `line line-${l.kind} ${l.side ? (l.side === side ? 'ours' : 'theirs') : ''}`, children: [_jsxs("span", { className: "min", children: [l.minute, "'"] }), _jsx("span", { children: l.text })] }, i))) }), live.finished ? (_jsx("div", { className: "match-controls", children: _jsx("button", { type: "button", className: "btn primary big", onClick: finish, children: "Continue" }) })) : (_jsxs("div", { className: "match-controls", children: [_jsxs("div", { className: "pills compact", children: [_jsx("button", { type: "button", className: "pill", "aria-pressed": paused, onClick: () => setPaused(!paused), children: paused ? 'Resume' : 'Pause' }), _jsx("button", { type: "button", className: "pill", "aria-pressed": speed === 'normal', onClick: () => setSpeed('normal'), children: "Normal" }), _jsx("button", { type: "button", className: "pill", "aria-pressed": speed === 'fast', onClick: () => setSpeed('fast'), children: "Fast" })] }), _jsxs("div", { className: "grid-3", children: [_jsxs("button", { type: "button", className: "btn tile", onClick: () => setSheet('subs'), children: ["Subs (", ours.subsUsed, "/", ENGINE.maxSubs, ")"] }), _jsx("button", { type: "button", className: "btn tile", onClick: () => setSheet('tactics'), children: "Tactics" }), _jsx("button", { type: "button", className: "btn primary", onClick: skip, children: "Skip to FT" })] })] })), live.halfTimePending && (_jsx("div", { className: "sheet-backdrop center", children: _jsxs("div", { className: "popup", role: "dialog", "aria-modal": "true", "aria-label": "Half-time team talk", children: [_jsxs("div", { className: "eyebrow", children: ["Half time \u00B7 ", live.homeGoals, "\u2013", live.awayGoals] }), _jsx("h2", { children: "Team talk" }), _jsx("p", { className: "muted", children: "What do you say to the players?" }), _jsx("div", { className: "stack", children: TALKS.map((t) => (_jsxs("button", { type: "button", className: "choice", onClick: () => teamTalk(t.talk), children: [_jsx("strong", { children: t.label }), _jsxs("small", { children: ["\"", t.hint, "\""] })] }, t.talk))) }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setSheet('tactics'), children: "Change tactics first" })] }) })), sheet === 'tactics' && (_jsx("div", { className: "sheet-backdrop", onClick: () => setSheet(null), children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Tactics", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsx("strong", { className: "grow", children: "Tactics" }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setSheet(null), children: "Done" })] }), _jsx(TacticsPicker, { tactics: ours.tactics, onChange: setLiveTactics }), ours.mods.notes.length > 0 && (_jsx("ul", { className: "notes", children: ours.mods.notes.map((n, i) => (_jsxs("li", { className: `note ${n.effect > 0.005 ? 'good' : n.effect < -0.005 ? 'bad' : 'neutral'}`, children: [_jsx("span", { "aria-hidden": "true", children: n.effect > 0.005 ? '▲' : n.effect < -0.005 ? '▼' : '•' }), n.text] }, i))) }))] }) })), sheet === 'subs' && (_jsx("div", { className: "sheet-backdrop", onClick: () => { setSheet(null); setSubOut(null); }, children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Substitutions", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsx("strong", { className: "grow", children: subOut ? 'Bring on…' : 'Take off…' }), _jsx("button", { type: "button", className: "link-btn", onClick: () => { setSheet(null); setSubOut(null); }, children: "Done" })] }), ours.subsUsed >= ENGINE.maxSubs && _jsx("p", { className: "muted", children: "All substitutions used." }), _jsx("ul", { className: "player-list", children: (subOut ? ours.bench.map((p) => ({ player: p, slot: p.position })) : ours.onPitch).map(({ player, slot }) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "player-row", disabled: ours.subsUsed >= ENGINE.maxSubs, "aria-pressed": subOut === player.id, onClick: () => {
                                        if (!subOut)
                                            setSubOut(player.id);
                                        else {
                                            sub(subOut, player.id);
                                            setSubOut(null);
                                            setSheet(null);
                                        }
                                    }, children: [_jsx("span", { className: `pos pos-${slot}`, children: slot }), _jsx("span", { className: "ovr", children: player.overall }), _jsxs("span", { className: "who", children: [_jsx("strong", { children: playerLabel(player) }), _jsxs("small", { children: [positionsLabel(player), ours.booked.has(player.id) ? ' · Booked' : ''] })] }), _jsxs("span", { className: "role", children: [_jsx("small", { children: "Energy" }), Math.round(playerEnergy(live, side, player.id)), "%"] })] }) }, player.id))) }), subOut && _jsx("button", { type: "button", className: "link-btn", onClick: () => setSubOut(null), children: "\u2190 Pick a different player" })] }) }))] }));
}
