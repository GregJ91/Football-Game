import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listSaves } from '../../state/persistence';
import { useGame } from '../../state/store';
import { seasonLabel } from '../format';
export function Start() {
    const go = useGame((s) => s.go);
    const continueGame = useGame((s) => s.continueGame);
    const [save, setSave] = useState(null);
    useEffect(() => {
        listSaves()
            .then((saves) => setSave(saves[0] ?? null))
            .catch(() => setSave(null));
    }, []);
    return (_jsxs("main", { className: "screen start", children: [_jsxs("div", { className: "start-hero", children: [_jsxs("svg", { width: "96", height: "110", viewBox: "0 0 84 96", "aria-hidden": "true", children: [_jsx("path", { d: "M42 4 L78 14 L78 48 C78 72 60 86 42 92 C24 86 6 72 6 48 L6 14 Z", fill: "#B3202A", stroke: "#F2B632", strokeWidth: "4" }), _jsx("path", { d: "M42 26 L50 42 L68 44 L54 56 L58 74 L42 64 L26 74 L30 56 L16 44 L34 42 Z", fill: "#F5F1E6" })] }), _jsx("h1", { children: "Pyramid FC" }), _jsx("p", { children: "Found a club at the bottom of the pyramid. Take it to the top." })] }), _jsxs("div", { className: "stack", children: [save && (_jsxs("button", { type: "button", className: "btn primary big", onClick: () => void continueGame(), children: ["Continue", _jsxs("small", { children: [save.clubName, " \u00B7 ", seasonLabel(save.season)] })] })), _jsx("button", { type: "button", className: `btn big ${save ? 'secondary' : 'primary'}`, onClick: () => go('create'), children: "New game" }), save && _jsx("p", { className: "hint", children: "Starting a new game replaces your current save." })] })] }));
}
