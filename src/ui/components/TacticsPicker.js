import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FORMATIONS } from '../../engine/match/selection';
const MENTALITIES = ['defensive', 'balanced', 'attacking'];
const PRESSING = [
    { value: 'low', label: 'Sit deep' },
    { value: 'medium', label: 'Mid block' },
    { value: 'high', label: 'High press' },
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export function TacticsPicker({ tactics, onChange }) {
    return (_jsxs("div", { className: "tactics-picker", children: [_jsxs("fieldset", { children: [_jsx("legend", { children: "Formation" }), _jsx("div", { className: "pills", children: Object.keys(FORMATIONS).map((f) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": tactics.formation === f, onClick: () => onChange({ ...tactics, formation: f }), children: f }, f))) })] }), _jsxs("fieldset", { children: [_jsx("legend", { children: "Mentality" }), _jsx("div", { className: "pills", children: MENTALITIES.map((m) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": tactics.mentality === m, onClick: () => onChange({ ...tactics, mentality: m }), children: cap(m) }, m))) })] }), _jsxs("fieldset", { children: [_jsx("legend", { children: "Pressing" }), _jsx("div", { className: "pills", children: PRESSING.map((p) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": tactics.pressing === p.value, onClick: () => onChange({ ...tactics, pressing: p.value }), children: p.label }, p.value))) })] })] }));
}
export function tacticsLabel(t) {
    const press = PRESSING.find((p) => p.value === t.pressing)?.label ?? t.pressing;
    return `${t.formation} · ${cap(t.mentality)} · ${press}`;
}
