import type { InboxItem } from '../../engine/types';
import { useGame } from '../../state/store';

/** An AI club's offer for one of your players, with Accept / Ask for more / Reject. */
export function BidCard({ item }: { item: InboxItem }) {
  const answerBid = useGame((s) => s.answerBid);
  const showToast = useGame((s) => s.showToast);
  const answer = (action: 'accept' | 'counter' | 'reject') => showToast(answerBid(item.id, action));
  return (
    <section className="card bid-card">
      <p className="bid-text">{item.text}</p>
      {!item.resolved && (
        <div className="grid-3">
          <button type="button" className="btn tile" onClick={() => answer('accept')}>Accept</button>
          {!item.bid?.countered && (
            <button type="button" className="btn tile" onClick={() => answer('counter')}>Ask for more</button>
          )}
          <button type="button" className="btn tile" onClick={() => answer('reject')}>Reject</button>
        </div>
      )}
    </section>
  );
}
