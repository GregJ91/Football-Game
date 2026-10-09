import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGame } from '../../state/store';
/** Switch between the league table and your fixtures (both under the League tab). */
export function LeagueTabs() {
    const screen = useGame((s) => s.screen);
    const go = useGame((s) => s.go);
    return (_jsxs("div", { className: "segmented", role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": screen === 'league', onClick: () => go('league'), children: "Table" }), _jsx("button", { type: "button", role: "tab", "aria-selected": screen === 'fixtures', onClick: () => go('fixtures'), children: "Fixtures" }), _jsx("button", { type: "button", role: "tab", "aria-selected": screen === 'cups', onClick: () => go('cups'), children: "Cups" })] }));
}
