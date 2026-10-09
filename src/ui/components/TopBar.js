import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dateOf, formatDate, isMatchdayMorning } from '../../engine/calendar';
import { useGame } from '../../state/store';
/** Inbox on the left; today's date and Continue on the right (CM 01/02 style). */
export function TopBar() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const screen = useGame((s) => s.screen);
    const busy = useGame((s) => s.busy);
    const go = useGame((s) => s.go);
    const continueDay = useGame((s) => s.continueDay);
    const unread = (game.inbox ?? []).filter((i) => !i.read).length;
    const ended = game.phase !== 'season';
    const matchday = isMatchdayMorning(game);
    const half = game.half === 'pm' ? 'PM' : 'AM';
    return (_jsxs("header", { className: "top-bar", children: [_jsxs("button", { type: "button", className: `inbox-btn ${screen === 'inbox' ? 'active' : ''}`, "aria-label": `Inbox, ${unread} unread`, onClick: () => go('inbox'), children: [_jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": "true", children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }), _jsx("path", { d: "M3 7 L12 13 L21 7" })] }), _jsx("span", { children: "Inbox" }), unread > 0 && _jsx("b", { className: "badge", children: unread > 99 ? '99+' : unread })] }), _jsxs("div", { className: "date", children: [_jsx("strong", { children: formatDate(dateOf(game)) }), _jsx("small", { children: ended ? 'Season over' : matchday ? `Matchday · ${half}` : half })] }), _jsxs("button", { type: "button", className: `continue-btn ${matchday ? 'matchday' : ''}`, disabled: busy, onClick: () => (ended ? go('seasonEnd') : continueDay()), children: [ended ? 'Review' : matchday ? 'Match' : 'Continue', _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M7 4 L19 12 L7 20 Z" }) })] })] }));
}
