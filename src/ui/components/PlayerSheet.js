import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { WAGE_TO_TRANSFER, budgetsOf, moneyPw, wageBill } from '../../engine/economy/finance';
import { formatDate, scoutDueDate } from '../../engine/calendar';
import { playerName } from '../../engine/players/generate';
import { positionsLabel, roundMoney } from '../../engine/players/ratings';
import { SCOUT_REPORTS_PER_WEEK, cannotBuy, interestIn, isKnown, potentialStars, ratingRange, releaseCost, renewalDemand, wageDemand, } from '../../engine/transfers/market';
import { GOALKEEPING, MENTAL, PHYSICAL, TECHNICAL } from '../../engine/types';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { money } from '../format';
// Goalkeepers see goalkeeping in place of the outfield technical column, as in CM.
const groupsFor = (p) => [
    p.position === 'GK' ? { title: 'Goalkeeping', keys: GOALKEEPING } : { title: 'Technical', keys: TECHNICAL },
    { title: 'Mental', keys: MENTAL },
    { title: 'Physical', keys: PHYSICAL },
];
const LABELS = {
    longShots: 'Long shots',
    offTheBall: 'Off the ball',
    workRate: 'Work rate',
    oneOnOnes: 'One on ones',
    aerialAbility: 'Aerial ability',
};
const label = (k) => LABELS[k] ?? k[0].toUpperCase() + k.slice(1);
/** CM-style colour band for a 1–20 attribute. */
const tier = (v) => (v >= 16 ? 'a-top' : v >= 11 ? 'a-good' : v >= 6 ? 'a-avg' : 'a-poor');
const INTEREST_LABEL = {
    keen: 'Keen to join',
    open: 'Open to a move',
    reluctant: 'Reluctant',
    no: 'Needs a big wage to drop down',
};
function feeStep(value) {
    if (value >= 1_000_000)
        return 50_000;
    if (value >= 100_000)
        return 5_000;
    if (value >= 10_000)
        return 500;
    return 100;
}
export function PlayerSheet({ player, onClose }) {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const scout = useGame((s) => s.scout);
    const bid = useGame((s) => s.bid);
    const sign = useGame((s) => s.sign);
    const offerLowerWage = useGame((s) => s.offerLowerWage);
    const toggleListed = useGame((s) => s.toggleListed);
    const release = useGame((s) => s.release);
    const renew = useGame((s) => s.renew);
    const showToast = useGame((s) => s.showToast);
    const adjustBudgets = useGame((s) => s.adjustBudgets);
    const p = player;
    const club = game.clubs[game.userClubId];
    const own = p.clubId === club.id;
    const known = isKnown(game, club, p);
    const [lo, hi] = ratingRange(p);
    const currentClub = p.clubId ? game.clubs[p.clubId] : null;
    const level = currentClub ? divisionOf(game, currentClub.id).def : null;
    const interest = own ? null : interestIn(game, club, p);
    const budgets = budgetsOf(game, club);
    const bill = wageBill(game, club);
    const [step, setStep] = useState({ kind: 'view' });
    const [fee, setFee] = useState(() => (p.clubId ? Math.round(p.value / feeStep(p.value)) * feeStep(p.value) : 0));
    const [years, setYears] = useState(p.age >= 30 ? 2 : 3);
    const [talksOff, setTalksOff] = useState(false);
    const [confirmRelease, setConfirmRelease] = useState(false);
    const [problem, setProblem] = useState(null);
    const blocker = own ? null : cannotBuy(game, p);
    const demand = own ? 0 : wageDemand(game, club, p);
    const renewal = own ? renewalDemand(game, p) : null;
    const stepSize = feeStep(Math.max(p.value, 1000));
    const lowerWage = roundMoney(demand * 0.85);
    const submitBid = (amount) => {
        const r = bid(p.id, amount);
        if ('error' in r)
            return setStep({ kind: 'fee', message: r.error });
        if (r.result === 'accepted')
            return setStep({ kind: 'terms', fee: amount, message: `${currentClub?.name} accept ${money(amount)}.` });
        if (r.result === 'countered') {
            // Their counter-offer goes straight into the fee box.
            setFee(r.asking);
            return setStep({ kind: 'fee', counter: r.asking, message: `${currentClub?.name} want ${money(r.asking)}.` });
        }
        return setStep({ kind: 'fee', message: `Rejected. ${currentClub?.name} would want around ${money(r.asking)}.` });
    };
    const agree = (feeAmount, wage) => {
        const err = sign(p.id, feeAmount, wage, years);
        if (err)
            setStep({ kind: 'terms', fee: feeAmount, message: err });
        else
            setStep({ kind: 'done', message: `${playerName(p)} has signed on ${moneyPw(wage)} until summer ${game.season + years}.` });
    };
    const YearsPicker = (_jsx("div", { className: "pills compact", role: "group", "aria-label": "Contract length", children: [1, 2, 3, 4].map((y) => (_jsxs("button", { type: "button", className: "pill", "aria-pressed": years === y, onClick: () => setYears(y), children: [y, " yr", y > 1 ? 's' : ''] }, y))) }));
    return (_jsx("div", { className: "sheet-backdrop", onClick: onClose, children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": playerName(p), onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsx("span", { className: "ovr big", children: known ? p.overall : `${lo}–${hi}` }), _jsxs("div", { className: "grow", children: [_jsx("strong", { children: playerName(p) }), _jsxs("small", { children: [positionsLabel(p), " \u00B7 ", p.age, " yrs \u00B7 ", currentClub ? `${currentClub.name} (${level.name})` : 'Free agent'] })] }), _jsx("button", { type: "button", className: "link-btn", onClick: onClose, children: "Close" })] }), _jsxs("div", { className: "facts", children: [p.clubId && _jsxs("span", { children: ["Value ", money(p.value)] }), _jsxs("span", { children: ["Wage ", moneyPw(p.wage)] }), p.clubId && _jsxs("span", { children: ["Contract ends summer ", p.contractEnd + 1] }), own && _jsxs("span", { children: ["Morale ", Math.round(p.morale)] }), own && _jsxs("span", { children: ["Form ", p.form.toFixed(1)] }), own && p.listed && _jsx("span", { className: "warn", children: "Transfer listed" }), interest && _jsx("span", { className: `interest interest-${interest}`, children: INTEREST_LABEL[interest] }), known && !own && _jsxs("span", { children: ["Potential ", '★'.repeat(potentialStars(p)), '☆'.repeat(5 - potentialStars(p))] })] }), step.kind === 'view' && (_jsxs(_Fragment, { children: [known ? (_jsx("div", { className: "cm-attrs", children: groupsFor(p).map((g) => (_jsxs("div", { className: "cm-col", children: [_jsx("h3", { children: g.title }), g.keys.map((k) => (_jsxs("div", { className: "cm-attr", children: [_jsx("span", { children: label(k) }), _jsx("b", { className: tier(p.attributes[k]), children: p.attributes[k] })] }, k)))] }, g.title))) })) : (_jsx("div", { className: "card inset", children: (() => {
                                const due = scoutDueDate(game, p.id);
                                if (due)
                                    return _jsxs("p", { className: "muted", children: ["A scout is watching him. Report due ", formatDate(due), "."] });
                                return (_jsxs(_Fragment, { children: [_jsx("p", { className: "muted", children: "Your scouts haven't watched him yet. A report takes a few days and reveals his ability, potential and whether he'd suit you." }), _jsxs("button", { type: "button", className: "btn secondary", disabled: (game.scoutReportsLeft ?? SCOUT_REPORTS_PER_WEEK) <= 0, onClick: () => {
                                                const r = scout(p.id);
                                                if (r === 'none-left')
                                                    showToast('No scouts free this week.');
                                                else if (r === 'assigned')
                                                    showToast(`Scout sent to watch ${p.lastName}.`);
                                            }, children: ["Send a scout (", game.scoutReportsLeft ?? SCOUT_REPORTS_PER_WEEK, " free this week)"] })] }));
                            })() })), !own && (_jsx("div", { className: "stack", children: blocker || talksOff ? (_jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), talksOff ? `${p.lastName} has walked away from talks.` : blocker] })) : p.clubId ? (_jsx("button", { type: "button", className: "btn primary", onClick: () => setStep({ kind: 'fee' }), children: "Make an offer" })) : (_jsx("button", { type: "button", className: "btn primary", onClick: () => setStep({ kind: 'terms', fee: 0 }), children: "Offer a contract" })) })), own && (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "grid-2", children: [_jsx("button", { type: "button", className: "btn tile", onClick: () => toggleListed(p.id), children: p.listed ? 'Take off the list' : 'Transfer list' }), _jsx("button", { type: "button", className: "btn tile", onClick: () => setStep({ kind: 'renew' }), children: "New contract" })] }), confirmRelease ? (_jsxs("div", { className: "grid-2", children: [_jsx("button", { type: "button", className: "btn danger", onClick: () => {
                                                const err = release(p.id);
                                                if (err)
                                                    setProblem(err);
                                                else
                                                    onClose();
                                            }, children: "Confirm release" }), _jsx("button", { type: "button", className: "btn tile", onClick: () => setConfirmRelease(false), children: "Keep him" })] })) : (_jsxs("button", { type: "button", className: "link-btn", onClick: () => setConfirmRelease(true), children: ["Release him (pay-off ", money(releaseCost(game, p)), ")"] })), problem && _jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), problem] })] }))] })), step.kind === 'fee' && (_jsxs("div", { className: "negotiate", children: [_jsx("h3", { children: "Transfer offer" }), _jsxs("p", { className: "muted small", children: ["Valued at ", money(p.value), ". Your transfer budget is ", money(budgets.transfer), "."] }), _jsxs("div", { className: "stepper", children: [_jsx("button", { type: "button", "aria-label": "Lower the offer", onClick: () => setFee(Math.max(0, fee - stepSize)), children: "\u2212" }), _jsx("label", { className: "visually-hidden", htmlFor: "bid-fee", children: "Fee" }), _jsx("input", { id: "bid-fee", inputMode: "numeric", value: `£${fee.toLocaleString('en-GB')}`, onChange: (e) => setFee(Number(e.target.value.replace(/[^0-9]/g, '')) || 0) }), _jsx("button", { type: "button", "aria-label": "Raise the offer", onClick: () => setFee(fee + stepSize), children: "+" })] }), step.message && _jsxs("p", { className: `note ${step.counter ? 'neutral' : 'bad'}`, children: [_jsx("span", { "aria-hidden": "true", children: "\u2022" }), step.message] }), _jsxs("div", { className: "grid-2", children: [_jsx("button", { type: "button", className: "btn primary", onClick: () => submitBid(fee), children: step.counter && fee === step.counter ? `Agree ${money(fee)}` : 'Submit offer' }), _jsx("button", { type: "button", className: "btn tile", onClick: () => setStep({ kind: 'view' }), children: "Walk away" })] })] })), step.kind === 'terms' && (() => {
                    const wage = step.lowered ? lowerWage : demand;
                    return (_jsxs("div", { className: "negotiate", children: [_jsx("h3", { children: "Personal terms" }), step.message && _jsxs("p", { className: "note neutral", children: [_jsx("span", { "aria-hidden": "true", children: "\u2022" }), step.message] }), _jsxs("p", { children: [p.lastName, " wants ", _jsx("strong", { children: moneyPw(demand) }), "."] }), interest === 'no' && (_jsx("p", { className: "muted small", children: "He'd never normally drop this far, so this is what it takes. He won't haggle." })), _jsxs("p", { className: "muted small", children: ["Wages would go to ", moneyPw(bill + wage), " of your ", moneyPw(budgets.wage), " budget."] }), bill + wage > budgets.wage && (_jsx(OverBudget, { shortfall: bill + wage - budgets.wage, transfer: budgets.transfer, onMove: adjustBudgets })), YearsPicker, _jsxs("button", { type: "button", className: "btn primary", onClick: () => agree(step.fee, wage), children: ["Agree ", moneyPw(wage), " for ", years, " yr", years > 1 ? 's' : ''] }), !step.lowered && (_jsxs("button", { type: "button", className: "btn tile", onClick: () => {
                                    if (offerLowerWage(p.id))
                                        setStep({ ...step, lowered: true, message: `He'll accept ${moneyPw(lowerWage)}.` });
                                    else {
                                        setTalksOff(true);
                                        setStep({ kind: 'view' });
                                    }
                                }, children: ["Offer ", moneyPw(lowerWage)] })), _jsx("button", { type: "button", className: "link-btn", onClick: () => setStep({ kind: 'view' }), children: "Walk away" })] }));
                })(), step.kind === 'renew' && renewal && (_jsxs("div", { className: "negotiate", children: [_jsx("h3", { children: "New contract" }), renewal.refuses ? (_jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), renewal.refuses] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { children: [p.lastName, " wants ", _jsx("strong", { children: moneyPw(renewal.wage) }), " (now ", moneyPw(p.wage), ")."] }), _jsxs("p", { className: "muted small", children: ["Wages would go to ", moneyPw(bill - p.wage + renewal.wage), " of your ", moneyPw(budgets.wage), " budget."] }), bill - p.wage + renewal.wage > budgets.wage && (_jsx(OverBudget, { shortfall: bill - p.wage + renewal.wage - budgets.wage, transfer: budgets.transfer, onMove: adjustBudgets })), YearsPicker, step.message && _jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), step.message] }), _jsxs("button", { type: "button", className: "btn primary", onClick: () => {
                                        const err = renew(p.id, renewal.wage, years);
                                        if (err)
                                            setStep({ kind: 'renew', message: err });
                                        else
                                            setStep({ kind: 'done', message: `${p.lastName} has signed a new deal until summer ${p.contractEnd + 1}.` });
                                    }, children: ["Agree ", moneyPw(renewal.wage), " for ", years, " more yr", years > 1 ? 's' : ''] })] })), _jsx("button", { type: "button", className: "link-btn", onClick: () => setStep({ kind: 'view' }), children: "Back" })] })), step.kind === 'done' && (_jsxs("div", { className: "negotiate", children: [_jsxs("p", { className: "note good", children: [_jsx("span", { "aria-hidden": "true", children: "\u25B2" }), step.message] }), _jsx("button", { type: "button", className: "btn primary", onClick: onClose, children: "Done" })] }))] }) }));
}
/** Over the wage budget: offer to move the difference over from the transfer budget. */
function OverBudget({ shortfall, transfer, onMove }) {
    const cost = Math.ceil(shortfall) * WAGE_TO_TRANSFER;
    return (_jsxs("div", { className: "over-budget", children: [_jsxs("p", { className: "note bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u25BC" }), "That's ", moneyPw(Math.ceil(shortfall)), " over your wage budget."] }), cost <= transfer ? (_jsxs("button", { type: "button", className: "btn tile", onClick: () => onMove(Math.ceil(shortfall)), children: ["Move ", money(cost), " from transfers to wages"] })) : (_jsx("p", { className: "muted small", children: "Sell or release a player to free up wages." }))] }));
}
