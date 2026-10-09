import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { WAGE_TO_TRANSFER, budgetsOf, moneyPw, wageBill } from '../../engine/economy/finance';
import { POSITION_GROUP, positionsLabel } from '../../engine/players/ratings';
import { askingPrice, interestIn, isKnown, openInboxItems, ratingRange, transferWindow, wageDemand, } from '../../engine/transfers/market';
import { divisionOf, squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { BidCard } from '../components/BidCard';
import { PlayerSheet } from '../components/PlayerSheet';
import { money } from '../format';
const AGES = [
    { v: 'any', label: 'Any age', test: () => true },
    { v: 'u21', label: 'Under 21', test: (a) => a <= 21 },
    { v: 'u24', label: 'Under 24', test: (a) => a <= 23 },
    { v: 'prime', label: '24–29', test: (a) => a >= 24 && a <= 29 },
    { v: 'vet', label: '30+', test: (a) => a >= 30 },
];
const GROUPS = ['ALL', 'GK', 'DEF', 'MID', 'ATT'];
const INTEREST_DOT = { keen: 'Keen', open: 'Open', reluctant: 'Reluctant', no: 'Big wage' };
export function Transfers() {
    const game = useGame((s) => s.game);
    const rev = useGame((s) => s.rev);
    const adjust = useGame((s) => s.adjustBudgets);
    const [tab, setTab] = useState('search');
    const [group, setGroup] = useState('ALL');
    const [age, setAge] = useState('any');
    const [freeOnly, setFreeOnly] = useState(false);
    const [affordable, setAffordable] = useState(true);
    const [open, setOpen] = useState(null);
    const [budgetSheet, setBudgetSheet] = useState(false);
    const club = game.clubs[game.userClubId];
    const window = transferWindow(game);
    const budgets = budgetsOf(game, club);
    const bill = wageBill(game, club);
    const wageRoom = Math.max(0, budgets.wage - bill);
    const avgWage = bill / Math.max(1, club.playerIds.length);
    const results = useMemo(() => {
        const ageTest = AGES.find((a) => a.v === age).test;
        const out = [];
        for (const p of Object.values(game.players)) {
            if (p.clubId === club.id)
                continue;
            if (freeOnly && p.clubId)
                continue;
            if (group !== 'ALL' && POSITION_GROUP[p.position] !== group)
                continue;
            if (!ageTest(p.age))
                continue;
            const interest = interestIn(game, club, p);
            const fee = p.clubId ? askingPrice(game, p) : 0;
            if (affordable && fee > budgets.transfer * 1.1)
                continue;
            // Wages you could fit in, at most by moving on one typical earner.
            if (affordable && wageDemand(game, club, p) > wageRoom + avgWage)
                continue;
            const known = isKnown(game, club, p);
            const [lo, hi] = ratingRange(p);
            out.push({ p, known, est: known ? p.overall : (lo + hi) / 2, interest, fee });
        }
        return out.sort((a, b) => b.est - a.est).slice(0, 40);
    }, [rev, group, age, freeOnly, affordable]); // `rev` marks engine changes to `game`
    const bids = openInboxItems(game);
    const listed = squadOf(game, club.id).filter((p) => p.listed);
    const recent = (game.transfers ?? []).filter((t) => t.toClubId === club.id || t.fromClubId === club.id).slice(0, 20);
    const bigMoves = (game.transfers ?? []).filter((t) => t.season === game.season && t.fee > 0).sort((a, b) => b.fee - a.fee).slice(0, 8);
    const maxWage = budgets.wage + budgets.transfer / WAGE_TO_TRANSFER;
    const step = Math.max(10, Math.round(budgets.wage / 50 / 10) * 10);
    return (_jsxs("main", { className: "screen transfers", children: [_jsxs("header", { className: "screen-head", children: [_jsx("div", { className: "eyebrow", children: window.label }), _jsx("h1", { children: "Transfers" })] }), _jsxs("button", { type: "button", className: "card budgets", onClick: () => setBudgetSheet(true), children: [_jsxs("span", { children: [_jsx("small", { children: "Transfer budget" }), _jsx("strong", { children: money(budgets.transfer) })] }), _jsxs("span", { children: [_jsx("small", { children: "Wages" }), _jsx("strong", { children: moneyPw(bill) }), _jsxs("small", { children: ["of ", moneyPw(budgets.wage)] })] }), _jsx("span", { className: "adjust", children: "Adjust" })] }), _jsx("div", { className: "segmented", role: "tablist", children: ['search', 'yours', 'recent'].map((t) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === t, onClick: () => setTab(t), children: t === 'search' ? 'Search' : t === 'yours' ? `Offers${bids.length ? ` (${bids.length})` : ''}` : 'History' }, t))) }), tab === 'search' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "pills compact", children: GROUPS.map((g) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": group === g, onClick: () => setGroup(g), children: g === 'ALL' ? 'All' : g }, g))) }), _jsx("div", { className: "pills compact", children: AGES.map((a) => (_jsx("button", { type: "button", className: "pill", "aria-pressed": age === a.v, onClick: () => setAge(a.v), children: a.label }, a.v))) }), _jsxs("div", { className: "pills compact", children: [_jsx("button", { type: "button", className: "pill", "aria-pressed": affordable, onClick: () => setAffordable(!affordable), children: "Realistic targets" }), _jsx("button", { type: "button", className: "pill", "aria-pressed": freeOnly, onClick: () => setFreeOnly(!freeOnly), children: "Free agents only" })] }), !window.open && _jsx("p", { className: "hint left", children: "The window is closed, so only free agents can join right now." }), _jsx("ul", { className: "player-list", children: results.map(({ p, known, interest, fee }) => {
                            const [lo, hi] = ratingRange(p);
                            const from = p.clubId ? game.clubs[p.clubId] : null;
                            return (_jsx("li", { children: _jsxs("button", { type: "button", className: "player-row", onClick: () => setOpen(p), children: [_jsx("span", { className: `pos pos-${p.position}`, children: positionsLabel(p) }), _jsx("span", { className: `ovr ${known ? '' : 'range'}`, children: known ? p.overall : `${lo}–${hi}` }), _jsxs("span", { className: "who", children: [_jsxs("strong", { children: [p.firstName, " ", p.lastName] }), _jsxs("small", { children: [p.age, " yrs \u00B7 ", from ? `${from.name} · L${divisionOf(game, from.id).def.level}` : 'Free agent'] })] }), _jsxs("span", { className: "role", children: [from ? money(fee) : 'Free', _jsx("small", { className: `interest-text interest-${interest}`, children: INTEREST_DOT[interest] })] })] }) }, p.id));
                        }) }), results.length === 0 && _jsx("p", { className: "hint", children: "No players match. Try fewer filters." })] })), tab === 'yours' && (_jsxs(_Fragment, { children: [bids.length === 0 && _jsx("p", { className: "hint left", children: "No offers for your players right now. Transfer-list a player to attract bids during a window." }), bids.map((item) => _jsx(BidCard, { item: item }, item.id)), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "On the transfer list" }) }), listed.length === 0 ? (_jsx("p", { className: "muted small", children: "Nobody. List players from their profile in Squad." })) : (_jsx("ul", { className: "player-list", children: listed.map((p) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "player-row", onClick: () => setOpen(p), children: [_jsx("span", { className: `pos pos-${p.position}`, children: positionsLabel(p) }), _jsx("span", { className: "ovr", children: p.overall }), _jsxs("span", { className: "who", children: [_jsxs("strong", { children: [p.firstName, " ", p.lastName] }), _jsxs("small", { children: ["Value ", money(p.value)] })] })] }) }, p.id))) }))] })] })), tab === 'recent' && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Your deals" }) }), recent.length === 0 ? (_jsx("p", { className: "muted small", children: "No deals yet." })) : (recent.map((t, i) => (_jsxs("div", { className: "po-row", children: [_jsx("span", { className: t.toClubId === club.id ? 'in' : 'out', children: t.toClubId === club.id ? 'IN' : 'OUT' }), _jsx("span", { className: "grow", children: t.playerName }), _jsx("strong", { children: t.fee ? money(t.fee) : 'Free' })] }, i))))] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Biggest deals this season" }) }), bigMoves.length === 0 && _jsx("p", { className: "muted small", children: "None yet." }), bigMoves.map((t, i) => (_jsxs("div", { className: "po-row", children: [_jsxs("span", { className: "grow", children: [t.playerName, _jsxs("small", { className: "block muted", children: [t.fromClubId ? game.clubs[t.fromClubId].name : 'Free', " \u2192 ", t.toClubId ? game.clubs[t.toClubId].name : 'Released'] })] }), _jsx("strong", { children: money(t.fee) })] }, i)))] })] })), open && _jsx(PlayerSheet, { player: open, onClose: () => setOpen(null) }), budgetSheet && (_jsx("div", { className: "sheet-backdrop", onClick: () => setBudgetSheet(false), children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Budgets", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsx("strong", { className: "grow", children: "Budgets" }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setBudgetSheet(false), children: "Done" })] }), _jsxs("p", { className: "muted small", children: ["Move money between transfers and wages. Every ", moneyPw(1), " of wage budget costs \u00A3", WAGE_TO_TRANSFER, " of transfer budget. You get back 75% of what you sell for."] }), _jsxs("div", { className: "budget-split", children: [_jsxs("div", { children: [_jsx("small", { children: "Transfers" }), _jsx("strong", { children: money(budgets.transfer) })] }), _jsxs("div", { children: [_jsx("small", { children: "Wage budget" }), _jsx("strong", { children: moneyPw(budgets.wage) })] })] }), _jsxs("label", { className: "field", htmlFor: "wage-budget", children: [_jsx("span", { children: "Wage budget" }), _jsx("input", { id: "wage-budget", type: "range", min: Math.round(bill), max: Math.round(maxWage), step: step, value: budgets.wage, onChange: (e) => adjust(Number(e.target.value) - budgets.wage) })] }), _jsxs("p", { className: "muted small", children: ["Current wage bill ", moneyPw(bill), ". The wage budget can't go below it."] })] }) }))] }));
}
