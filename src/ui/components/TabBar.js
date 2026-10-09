import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGame } from '../../state/store';
const TABS = [
    { screen: 'hub', label: 'Hub', icon: _jsx("path", { d: "M3 11 L12 4 L21 11 V20 H3 Z" }) },
    {
        screen: 'squad',
        label: 'Squad',
        icon: (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "9", cy: "8", r: "3.5" }), _jsx("path", { d: "M2 20 C2 15 16 15 16 20" }), _jsx("circle", { cx: "17", cy: "9", r: "2.5" })] })),
    },
    {
        screen: 'tactics',
        label: 'Tactics',
        icon: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M3 12 H21" }), _jsx("circle", { cx: "12", cy: "12", r: "2.5" })] })),
    },
    { screen: 'transfers', label: 'Transfers', icon: _jsx("path", { d: "M4 8 H18 L14 4 M20 16 H6 L10 20" }) },
    {
        screen: 'club',
        label: 'Club',
        icon: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M3 20 V10 L12 5 L21 10 V20" }), _jsx("path", { d: "M8 20 V14 H16 V20" })] })),
    },
];
export function TabBar() {
    const current = useGame((s) => s.screen);
    // League and fixtures are reached from the Hub.
    const screen = current === 'fixtures' || current === 'league' || current === 'cups' || current === 'inbox' ? 'hub' : current;
    const go = useGame((s) => s.go);
    return (_jsx("nav", { className: "tab-bar", "aria-label": "Main", children: TABS.map((t) => (_jsxs("button", { type: "button", className: screen === t.screen ? 'active' : undefined, "aria-current": screen === t.screen ? 'page' : undefined, onClick: () => go(t.screen), children: [_jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": "true", children: t.icon }), t.label] }, t.screen))) }));
}
