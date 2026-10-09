import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { COUNTRIES, bottomDivisions } from '../../data/pyramids';
import { useGame } from '../../state/store';
import { Crest, Kit } from '../components/ClubArt';
const PRIMARIES = [
    ['Red', '#B3202A'], ['Royal blue', '#1F4FB8'], ['Claret', '#6B1832'], ['Green', '#1E7A43'],
    ['Black', '#111111'], ['Amber', '#F2B632'], ['Purple', '#5B2A86'], ['White', '#F5F1E6'],
];
const SECONDARIES = [
    ['White', '#F5F1E6'], ['Sky', '#8EC5F0'], ['Gold', '#E8C04A'], ['Black', '#111111'],
    ['Navy', '#14234D'], ['Tangerine', '#F07A1F'], ['Red', '#B3202A'], ['Green', '#1E7A43'],
];
const PATTERNS = ['plain', 'stripes', 'hoops', 'halves', 'sash'];
export function CreateClub() {
    const newGame = useGame((s) => s.newGame);
    const go = useGame((s) => s.go);
    const [name, setName] = useState('');
    const [shortName, setShortName] = useState('');
    const [ground, setGround] = useState('');
    const [colours, setColours] = useState({ primary: '#B3202A', secondary: '#F5F1E6', pattern: 'stripes' });
    const [country, setCountry] = useState('eng');
    const [region, setRegion] = useState('N');
    const clubName = name.trim();
    const valid = clubName.length >= 3;
    const short = (shortName.trim() || clubName.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
    const found = () => {
        if (!valid)
            return;
        newGame({
            clubName,
            shortName: short,
            stadiumName: ground.trim() || `${clubName.split(' ')[0]} Park`,
            colours,
            country,
            region,
        });
    };
    return (_jsxs("main", { className: "screen create", children: [_jsxs("header", { className: "screen-head", children: [_jsx("button", { type: "button", className: "link-btn", onClick: () => go('start'), children: "\u2190 Back" }), _jsx("div", { className: "eyebrow", children: "New game" }), _jsx("h1", { children: "Create your club" })] }), _jsxs("section", { className: "card preview", children: [_jsx(Crest, { colours: colours, size: 72 }), _jsx(Kit, { colours: colours, size: 88 }), _jsxs("div", { className: "preview-name", children: [_jsx("strong", { children: clubName || 'Your club' }), _jsxs("span", { children: [short || '???', " \u00B7 ", ground.trim() || 'Your ground'] })] })] }), _jsxs("div", { className: "form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Club name" }), _jsx("input", { value: name, maxLength: 28, placeholder: "e.g. Ashford Rovers", onChange: (e) => setName(e.target.value) })] }), _jsxs("div", { className: "grid-2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Short name" }), _jsx("input", { value: shortName, maxLength: 3, placeholder: short || 'ABC', onChange: (e) => setShortName(e.target.value.toUpperCase()) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ground" }), _jsx("input", { value: ground, maxLength: 24, placeholder: "e.g. The Meadow", onChange: (e) => setGround(e.target.value) })] })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { children: "Primary colour" }), _jsx("div", { className: "swatches", children: PRIMARIES.map(([label, hex]) => (_jsx("button", { type: "button", "aria-label": label, "aria-pressed": colours.primary === hex, className: "swatch", style: { background: hex }, onClick: () => setColours({ ...colours, primary: hex }) }, hex))) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { children: "Secondary colour" }), _jsx("div", { className: "swatches", children: SECONDARIES.map(([label, hex]) => (_jsx("button", { type: "button", "aria-label": label, "aria-pressed": colours.secondary === hex, className: "swatch", style: { background: hex }, onClick: () => setColours({ ...colours, secondary: hex }) }, hex))) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { children: "Kit pattern" }), _jsx("div", { className: "pills", children: PATTERNS.map((p) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": colours.pattern === p, onClick: () => setColours({ ...colours, pattern: p }), children: p[0].toUpperCase() + p.slice(1) }, p))) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { children: "Start in" }), _jsx("div", { className: "grid-2", children: Object.keys(COUNTRIES).map((c) => (_jsxs("button", { type: "button", className: "choice", "aria-pressed": country === c, onClick: () => setCountry(c), children: [_jsx("strong", { children: COUNTRIES[c].name }), _jsxs("small", { children: ["Level ", Math.max(...COUNTRIES[c].divisions.map((d) => d.level))] })] }, c))) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { children: "League" }), _jsx("div", { className: "grid-2", children: bottomDivisions(country).map((d) => (_jsxs("button", { type: "button", className: "choice", "aria-pressed": region === d.region, onClick: () => setRegion(d.region ?? 'N'), children: [_jsx("strong", { children: d.name }), _jsxs("small", { children: [d.size, " clubs"] })] }, d.id))) })] })] }), _jsx("div", { className: "sticky-cta", children: _jsx("button", { type: "button", className: "btn primary big", disabled: !valid, onClick: found, children: "Found the club" }) })] }));
}
