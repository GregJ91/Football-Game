import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { boardOf, loanOptions } from '../../engine/club/chairman';
import { FACILITY_INFO, MAX_FACILITY, facilitiesOf, facilityBusy, facilityUpgrade, facilityUpkeep, totalUpkeep } from '../../engine/club/facilities';
import { floodlightOption, nextLevelGrading, stadiumBusy, stadiumOf, standOptions, totalCapacity, totalSeats, } from '../../engine/club/stadium';
import { crowdFill, guideTicketPrice, ledgerOf, moneyPw, ticketPrice, wageBill, weeklyTv } from '../../engine/economy/finance';
import { buildTable } from '../../engine/season/table';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { money, ordinal, seasonLabel } from '../format';
const TABS = [
    { t: 'ground', label: 'Ground' },
    { t: 'facilities', label: 'Facilities' },
    { t: 'money', label: 'Money' },
    { t: 'board', label: 'Board' },
    { t: 'honours', label: 'Honours' },
];
const STYLE_LABEL = { steady: 'Steady deal', upfront: 'Cash up front', bonus: 'Promotion bonus' };
function buildLabel(b, stands) {
    if (b.kind === 'facility')
        return `${FACILITY_INFO[b.facility].name} upgrade`;
    if (b.kind === 'floodlights')
        return 'Floodlights';
    const stand = stands[b.stand].name;
    if (b.kind === 'extend')
        return `${stand}: +${b.size.toLocaleString('en-GB')} places`;
    if (b.kind === 'seats')
        return `${stand}: seating`;
    return `${stand}: roof`;
}
export function Club() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const build = useGame((s) => s.buildStadium);
    const upgrade = useGame((s) => s.upgradeFacility);
    const setTicketPrice = useGame((s) => s.setTicketPrice);
    const pickSponsor = useGame((s) => s.pickSponsor);
    const borrow = useGame((s) => s.borrow);
    const repay = useGame((s) => s.repay);
    const showToast = useGame((s) => s.showToast);
    const setUnlimited = useGame((s) => s.setUnlimitedMoney);
    const [tab, setTab] = useState('ground');
    const [standSheet, setStandSheet] = useState(null);
    const club = userClub(game);
    const stadium = stadiumOf(club);
    const grading = nextLevelGrading(game);
    const busy = stadiumBusy(club);
    const facilities = facilitiesOf(club);
    const board = boardOf(club);
    const ledger = ledgerOf(club);
    const div = divisionOf(game, club.id);
    const price = ticketPrice(game, club);
    const guide = guideTicketPrice(game, club);
    const expectedCrowd = Math.min(club.capacity, Math.round(club.capacity * crowdFill(game, club)));
    const act = (err, ok) => showToast(err ?? ok);
    const start = (opt) => {
        act(build(opt), `Work has started: ${opt.label.toLowerCase()}.`);
        setStandSheet(null);
    };
    // Stand layout around the pitch: Main (west), North, East, South.
    const standButton = (i, area) => {
        const s = stadium.stands[i];
        const work = stadium.builds.find((b) => b.stand === i);
        return (_jsxs("button", { type: "button", className: `stand stand-${area} ${work ? 'building' : ''}`, onClick: () => setStandSheet(i), children: [_jsx("strong", { children: s.name }), _jsxs("span", { children: [s.capacity.toLocaleString('en-GB'), s.seats ? ` · ${s.seats.toLocaleString('en-GB')} seated` : ' · terrace'] }), s.roof && _jsx("em", { children: "Roofed" }), work && _jsxs("em", { className: "busy", children: ["Building \u00B7 ", work.weeksLeft, " wk", work.weeksLeft === 1 ? '' : 's'] })] }));
    };
    const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === div.def.id));
    const started = table.some((r) => r.played > 0);
    const pos = table.findIndex((r) => r.clubId === club.id) + 1;
    const income = [
        ['Gate receipts', ledger.gate],
        ['TV and prize money', ledger.tv + (ledger.prize ?? 0)],
        ['Sponsorship', ledger.sponsor ?? 0],
        ['Player sales', ledger.transfersIn],
    ];
    const spending = [
        ['Wages', ledger.wages],
        ['Transfer fees', ledger.transfersOut],
        ['Building work', ledger.building ?? 0],
        ['Facility upkeep', ledger.upkeep ?? 0],
        ['Pay-offs', Math.max(0, -ledger.other)],
    ];
    const loanNet = ledger.loan ?? 0;
    return (_jsxs("main", { className: "screen club-screen", children: [_jsxs("header", { className: "screen-head", children: [_jsx("div", { className: "eyebrow", children: "Chairman's office" }), _jsx("h1", { children: club.stadiumName })] }), _jsx("div", { className: "segmented", role: "tablist", children: TABS.map(({ t, label }) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === t, onClick: () => setTab(t), children: label }, t))) }), tab === 'ground' && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "ground", "aria-label": "Stadium", children: [standButton(1, 'north'), standButton(0, 'west'), _jsx("div", { className: "ground-pitch", "aria-hidden": "true", children: _jsx("i", {}) }), standButton(2, 'east'), standButton(3, 'south')] }), _jsxs("div", { className: "stat-row", children: [_jsxs("div", { children: [_jsx("small", { children: "Capacity" }), _jsx("strong", { children: totalCapacity(stadium).toLocaleString('en-GB') }), club.capacity < totalCapacity(stadium) && _jsxs("small", { children: [club.capacity.toLocaleString('en-GB'), " during work"] })] }), _jsxs("div", { children: [_jsx("small", { children: "Seats" }), _jsx("strong", { children: totalSeats(stadium).toLocaleString('en-GB') })] }), _jsxs("div", { children: [_jsx("small", { children: "Floodlights" }), _jsx("strong", { children: stadium.floodlights ? 'Yes' : 'No' })] })] }), !stadium.floodlights && !stadium.builds.some((b) => b.kind === 'floodlights') && (() => {
                        const opt = floodlightOption(game);
                        return (_jsxs("button", { type: "button", className: "btn secondary", disabled: busy, onClick: () => start(opt), children: ["Install floodlights \u00B7 ", money(opt.cost), " \u00B7 ", opt.weeks, " weeks"] }));
                    })(), stadium.builds.length > 0 && (_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Under construction" }) }), stadium.builds.map((b, i) => (_jsxs("div", { className: "progress-row", children: [_jsx("span", { className: "grow", children: buildLabel(b, stadium.stands) }), _jsx("span", { className: "track", children: _jsx("i", { style: { width: `${((b.totalWeeks - b.weeksLeft) / b.totalWeeks) * 100}%` } }) }), _jsxs("small", { children: [b.weeksLeft, " wk", b.weeksLeft === 1 ? '' : 's'] })] }, i)))] })), grading && (_jsxs("section", { className: `card grading ${grading.ok ? 'ok' : 'not-ok'}`, children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: "Ground rules for the level above" }), _jsx("span", { children: grading.ok ? 'Passes' : 'Not yet' })] }), grading.items.map((it) => (_jsxs("div", { className: "grading-row", children: [_jsx("span", { "aria-hidden": "true", children: it.ok ? '✓' : '✗' }), _jsx("span", { className: "grow", children: it.label }), _jsxs("span", { children: [it.have, " / ", it.need] })] }, it.label))), !grading.ok && _jsx("p", { className: "muted small", children: "You can't be promoted until the ground passes. Builds must be finished by the end of the season." })] })), _jsx("p", { className: "hint left", children: "Tap a stand to extend it, add seats or put a roof on. One stadium project at a time." })] })), tab === 'facilities' && (_jsxs(_Fragment, { children: [Object.keys(FACILITY_INFO).map((kind) => {
                        const level = facilities[kind];
                        const next = level < MAX_FACILITY ? facilityUpgrade(game, level + 1) : null;
                        const inProgress = stadium.builds.find((b) => b.kind === 'facility' && b.facility === kind);
                        return (_jsxs("section", { className: "card facility", children: [_jsxs("div", { className: "facility-head", children: [_jsx("strong", { children: FACILITY_INFO[kind].name }), _jsx("span", { className: "pips", "aria-label": `Level ${level} of ${MAX_FACILITY}`, children: Array.from({ length: MAX_FACILITY }, (_, i) => _jsx("i", { className: i < level ? 'on' : '' }, i)) })] }), _jsxs("p", { className: "muted small", children: [FACILITY_INFO[kind].effect, " Running cost ", moneyPw(facilityUpkeep(level)), "."] }), inProgress ? (_jsxs("p", { className: "small", children: ["Upgrading to level ", level + 1, ": ", inProgress.weeksLeft, " weeks to go."] })) : next ? (_jsxs("button", { type: "button", className: "btn tile", disabled: facilityBusy(club), onClick: () => act(upgrade(kind), `${FACILITY_INFO[kind].name} upgrade started.`), children: ["Upgrade to level ", level + 1, " \u00B7 ", money(next.cost), " \u00B7 ", next.weeks, " wks \u00B7 then ", moneyPw(next.upkeep)] })) : (_jsx("p", { className: "small", children: "Top level." }))] }, kind));
                    }), _jsxs("p", { className: "hint left", children: ["One facility upgrade at a time. Total running costs ", moneyPw(totalUpkeep(club)), "."] })] })), tab === 'money' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stat-row", children: [_jsxs("div", { children: [_jsx("small", { children: "Bank" }), _jsx("strong", { children: money(club.balance) })] }), _jsxs("div", { children: [_jsx("small", { children: "Wages" }), _jsx("strong", { children: moneyPw(wageBill(game, club)) })] }), _jsxs("div", { children: [_jsx("small", { children: "TV & sponsors" }), _jsx("strong", { children: moneyPw(weeklyTv(game, club) + (club.sponsor?.weekly ?? 0)) })] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: "Ticket price" }), _jsxs("span", { children: ["Typical at this level \u00A3", guide] })] }), _jsxs("div", { className: "stepper", children: [_jsx("button", { type: "button", "aria-label": "Lower ticket price", onClick: () => setTicketPrice(price - 1), children: "\u2212" }), _jsx("label", { className: "visually-hidden", htmlFor: "ticket-price", children: "Ticket price" }), _jsx("input", { id: "ticket-price", inputMode: "numeric", value: `£${price}`, onChange: (e) => setTicketPrice(Number(e.target.value.replace(/[^0-9]/g, '')) || 1) }), _jsx("button", { type: "button", "aria-label": "Raise ticket price", onClick: () => setTicketPrice(price + 1), children: "+" })] }), _jsxs("p", { className: "muted small", children: ["Expected crowd ", expectedCrowd.toLocaleString('en-GB'), " of ", club.capacity.toLocaleString('en-GB'), ", about ", money(expectedCrowd * price), " a home game.", price > guide ? ' Fans grumble about prices above the going rate.' : ''] })] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Shirt sponsor" }) }), club.sponsorOffers ? (_jsxs("div", { className: "stack", children: [_jsx("p", { className: "muted small", children: "Pick one before the summer window shuts, or the board takes the steady deal." }), club.sponsorOffers.map((o, i) => (_jsxs("button", { type: "button", className: "choice", onClick: () => pickSponsor(i), children: [_jsx("strong", { children: o.name }), _jsxs("small", { children: [STYLE_LABEL[o.style], ":", ' ', o.style === 'steady' && `${moneyPw(o.weekly)} for two seasons`, o.style === 'upfront' && `${money(o.upfront)} now, this season only`, o.style === 'bonus' && `${moneyPw(o.weekly)} plus ${money(o.promotionBonus)} if promoted`] })] }, i)))] })) : club.sponsor ? (_jsxs("p", { className: "small", children: [_jsx("strong", { children: club.sponsor.name }), " \u00B7 ", STYLE_LABEL[club.sponsor.style], club.sponsor.weekly ? ` · ${moneyPw(club.sponsor.weekly)}` : '', club.sponsor.promotionBonus ? ` · ${money(club.sponsor.promotionBonus)} if promoted` : '', " \u00B7 until summer ", club.sponsor.endsSeason + 1] })) : (_jsx("p", { className: "muted small", children: "No sponsor this season." }))] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Bank loan" }) }), club.loan ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "small", children: [money(club.loan.remaining), " left to repay at ", moneyPw(club.loan.weekly), "."] }), _jsx("button", { type: "button", className: "btn tile", onClick: () => act(repay(), 'Loan paid off.'), children: "Pay it all off now" })] })) : (_jsxs("div", { className: "stack", children: [_jsx("p", { className: "muted small", children: "Borrow for building work. Repaid weekly over two seasons, 8% interest." }), loanOptions(game, club).map((o) => (_jsxs("button", { type: "button", className: "btn tile", onClick: () => act(borrow(o.amount), `${money(o.amount)} borrowed.`), children: ["Borrow ", money(o.amount), " \u00B7 repay ", moneyPw(o.weekly)] }, o.amount)))] }))] }), _jsx("section", { className: "card", children: _jsxs("label", { className: "toggle no-rule", htmlFor: "unlimited-money", children: [_jsx("input", { id: "unlimited-money", type: "checkbox", checked: !!game.settings?.unlimitedMoney, onChange: (e) => setUnlimited(e.target.checked) }), _jsxs("span", { children: ["Unlimited money (testing)", _jsx("small", { children: "Bank and budgets stay topped up at \u00A31bn. Switch off to go back to your real balance." })] })] }) }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "This season" }) }), _jsxs("div", { className: "ledger", children: [_jsx("h3", { children: "Money in" }), income.map(([label, v]) => _jsxs("div", { children: [_jsx("span", { children: label }), _jsx("b", { children: money(v) })] }, label)), loanNet > 0 && _jsxs("div", { children: [_jsx("span", { children: "Loan (net)" }), _jsx("b", { children: money(loanNet) })] }), _jsx("h3", { children: "Money out" }), spending.map(([label, v]) => _jsxs("div", { children: [_jsx("span", { children: label }), _jsx("b", { children: money(v) })] }, label)), loanNet < 0 && _jsxs("div", { children: [_jsx("span", { children: "Loan repayments" }), _jsx("b", { children: money(-loanNet) })] })] })] })] })), tab === 'board' && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card meters", children: [_jsxs("div", { className: "meter", children: [_jsxs("div", { className: "meter-head", children: [_jsx("span", { children: "Board confidence" }), _jsx("b", { children: Math.round(board.confidence) })] }), _jsx("span", { className: "track", children: _jsx("i", { style: { width: `${board.confidence}%` } }) })] }), _jsxs("div", { className: "meter", children: [_jsxs("div", { className: "meter-head", children: [_jsx("span", { children: "Fan mood" }), _jsx("b", { children: Math.round(board.fans) })] }), _jsx("span", { className: "track fans", children: _jsx("i", { style: { width: `${board.fans}%` } }) })] })] }), board.target && (_jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Season target" }) }), _jsx("p", { className: "target", children: board.target.label }), _jsxs("p", { className: "muted small", children: ["Finish ", ordinal(board.target.position), " or better. ", started ? `You're ${ordinal(pos)} right now.` : 'The season has not started yet.'] })] })), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "What moves them" }) }), _jsxs("ul", { className: "plain-list", children: [_jsx("li", { children: "Results, and how you finish against the target." }), _jsx("li", { children: "Promotion lifts both meters; relegation hits them hard." }), _jsx("li", { children: "Fans dislike ticket prices above the going rate and love new stands." }), _jsx("li", { children: "Big loans worry the board." }), _jsx("li", { children: "A confident board sets bigger transfer and wage budgets each summer." })] })] })] })), tab === 'honours' && (() => {
                const trophies = club.trophies ?? [];
                const counts = new Map();
                for (const t of trophies)
                    counts.set(t.name, [...(counts.get(t.name) ?? []), t.season]);
                return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card", children: [_jsxs("div", { className: "card-label", children: [_jsx("span", { children: "Trophy cabinet" }), _jsx("span", { children: trophies.length })] }), trophies.length === 0 ? (_jsx("p", { className: "muted small", children: "Empty for now. Win a league or a cup to start filling it." })) : (_jsx("ul", { className: "trophies", children: [...counts.entries()].map(([name, seasons]) => (_jsxs("li", { children: [_jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": "true", children: _jsx("path", { d: "M7 4 H17 V9 A5 5 0 0 1 7 9 Z M12 14 V18 M8 20 H16 M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11" }) }), _jsxs("span", { className: "grow", children: [_jsx("strong", { children: name }), _jsx("small", { children: seasons.map(seasonLabel).join(', ') })] }), seasons.length > 1 && _jsxs("b", { children: ["\u00D7", seasons.length] })] }, name))) }))] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "card-label", children: _jsx("span", { children: "Club history" }) }), club.history.length === 0 ? (_jsx("p", { className: "muted small", children: "Your first season is under way." })) : (_jsx("ul", { className: "history-list", children: [...club.history].reverse().map((h) => (_jsxs("li", { children: [_jsx("span", { className: "season", children: seasonLabel(h.season) }), _jsx("span", { className: "grow", children: game.divisions.find((d) => d.def.id === h.divisionId)?.def.name ?? h.divisionId }), _jsx("b", { children: ordinal(h.position) }), _jsx("span", { className: `outcome outcome-${h.outcome}`, children: h.outcome === 'stayed' ? '' : h.outcome[0].toUpperCase() + h.outcome.slice(1) })] }, h.season))) }))] })] }));
            })(), standSheet !== null && (_jsx("div", { className: "sheet-backdrop", onClick: () => setStandSheet(null), children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", "aria-label": stadium.stands[standSheet].name, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "sheet-head", children: [_jsx("strong", { className: "grow", children: stadium.stands[standSheet].name }), _jsx("button", { type: "button", className: "link-btn", onClick: () => setStandSheet(null), children: "Close" })] }), _jsxs("p", { className: "muted small", children: [stadium.stands[standSheet].capacity.toLocaleString('en-GB'), " capacity, ", stadium.stands[standSheet].seats.toLocaleString('en-GB'), " seated,", stadium.stands[standSheet].roof ? ' roofed' : ' open to the weather', ". Bank ", money(club.balance), ".", busy ? ' Builders are busy on another job.' : ' A stand under construction holds half its fans.'] }), _jsx("div", { className: "stack", children: standOptions(game, club, standSheet).map((o) => (_jsxs("button", { type: "button", className: "work-option", disabled: busy || o.cost > club.balance, onClick: () => start(o), children: [_jsx("strong", { children: o.label }), _jsxs("span", { children: [money(o.cost), " \u00B7 ", o.weeks, " weeks"] })] }, `${o.kind}-${o.size ?? ''}`))) })] }) }))] }));
}
