import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGame } from '../../state/store';
/** An AI club's offer for one of your players, with Accept / Ask for more / Reject. */
export function BidCard({ item }) {
    const answerBid = useGame((s) => s.answerBid);
    const showToast = useGame((s) => s.showToast);
    const answer = (action) => showToast(answerBid(item.id, action));
    return (_jsxs("section", { className: "card bid-card", children: [_jsx("p", { className: "bid-text", children: item.text }), !item.resolved && (_jsxs("div", { className: "grid-3", children: [_jsx("button", { type: "button", className: "btn tile", onClick: () => answer('accept'), children: "Accept" }), !item.bid?.countered && (_jsx("button", { type: "button", className: "btn tile", onClick: () => answer('counter'), children: "Ask for more" })), _jsx("button", { type: "button", className: "btn tile", onClick: () => answer('reject'), children: "Reject" })] }))] }));
}
