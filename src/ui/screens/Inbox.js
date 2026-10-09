import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { dateIn, formatDate } from '../../engine/calendar';
import { useGame } from '../../state/store';
import { BidCard } from '../components/BidCard';
const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'transfers', label: 'Transfers' },
    { value: 'training', label: 'Training' },
    { value: 'medical', label: 'Medical' },
    { value: 'scouting', label: 'Scouting' },
    { value: 'club', label: 'Club' },
];
const CATEGORY_LABEL = {
    transfers: 'Transfers',
    training: 'Training',
    medical: 'Medical',
    scouting: 'Scouting',
    club: 'Club',
    match: 'Match',
};
function categoryOf(i) {
    return i.category ?? (i.kind === 'bid' ? 'transfers' : 'club');
}
function subjectOf(i) {
    return i.subject ?? i.text.split('. ')[0].slice(0, 60);
}
export function Inbox() {
    const game = useGame((s) => s.game);
    useGame((s) => s.rev);
    const markRead = useGame((s) => s.markRead);
    const markAllRead = useGame((s) => s.markAllRead);
    const [filter, setFilter] = useState('all');
    const [open, setOpen] = useState(null);
    const items = (game.inbox ?? []).filter((i) => filter === 'all' || categoryOf(i) === filter);
    const unread = (game.inbox ?? []).filter((i) => !i.read).length;
    return (_jsxs("main", { className: "screen inbox-screen", children: [_jsxs("header", { className: "screen-head row", children: [_jsx("h1", { className: "grow", children: "Inbox" }), _jsx("button", { type: "button", className: "link-btn", disabled: !unread, onClick: markAllRead, children: "Mark all read" })] }), _jsx("div", { className: "pills compact", children: FILTERS.map((f) => {
                    const n = (game.inbox ?? []).filter((i) => !i.read && (f.value === 'all' || categoryOf(i) === f.value)).length;
                    return (_jsxs("button", { type: "button", className: "pill", "aria-pressed": filter === f.value, onClick: () => setFilter(f.value), children: [f.label, n ? ` (${n})` : ''] }, f.value));
                }) }), items.length === 0 && _jsx("p", { className: "hint", children: "Nothing here yet." }), _jsx("ul", { className: "mail-list", children: items.map((i) => {
                    const expanded = open === i.id;
                    const cat = categoryOf(i);
                    return (_jsxs("li", { className: `mail ${i.read ? '' : 'unread'} ${expanded ? 'open' : ''}`, children: [_jsxs("button", { type: "button", className: "mail-head", "aria-expanded": expanded, onClick: () => {
                                    setOpen(expanded ? null : i.id);
                                    markRead(i.id);
                                }, children: [_jsx("span", { className: `cat cat-${cat}`, children: CATEGORY_LABEL[cat] }), _jsx("span", { className: "subject", children: subjectOf(i) }), _jsx("small", { children: formatDate(dateIn(i.season, i.week, i.day ?? 1)) })] }), expanded ? (i.kind === 'bid' && !i.resolved ? _jsx(BidCard, { item: i }) : _jsx("p", { className: "mail-body", children: i.text })) : (_jsx("p", { className: "mail-preview", children: i.text }))] }, i.id));
                }) })] }));
}
