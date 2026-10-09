import { useState } from 'react';
import { dateIn, formatDate } from '../../engine/calendar';
import type { InboxCategory, InboxItem } from '../../engine/types';
import { useGame } from '../../state/store';
import { BidCard } from '../components/BidCard';

const FILTERS: { value: InboxCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'training', label: 'Training' },
  { value: 'medical', label: 'Medical' },
  { value: 'scouting', label: 'Scouting' },
  { value: 'club', label: 'Club' },
];

const CATEGORY_LABEL: Record<InboxCategory, string> = {
  transfers: 'Transfers',
  training: 'Training',
  medical: 'Medical',
  scouting: 'Scouting',
  club: 'Club',
  match: 'Match',
};

function categoryOf(i: InboxItem): InboxCategory {
  return i.category ?? (i.kind === 'bid' ? 'transfers' : 'club');
}

function subjectOf(i: InboxItem): string {
  return i.subject ?? i.text.split('. ')[0].slice(0, 60);
}

export function Inbox() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const markRead = useGame((s) => s.markRead);
  const markAllRead = useGame((s) => s.markAllRead);
  const [filter, setFilter] = useState<InboxCategory | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const items = (game.inbox ?? []).filter((i) => filter === 'all' || categoryOf(i) === filter);
  const unread = (game.inbox ?? []).filter((i) => !i.read).length;

  return (
    <main className="screen inbox-screen">
      <header className="screen-head row">
        <h1 className="grow">Inbox</h1>
        <button type="button" className="link-btn" disabled={!unread} onClick={markAllRead}>Mark all read</button>
      </header>
      <div className="pills compact">
        {FILTERS.map((f) => {
          const n = (game.inbox ?? []).filter((i) => !i.read && (f.value === 'all' || categoryOf(i) === f.value)).length;
          return (
            <button key={f.value} type="button" className="pill" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}{n ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>
      {items.length === 0 && <p className="hint">Nothing here yet.</p>}
      <ul className="mail-list">
        {items.map((i) => {
          const expanded = open === i.id;
          const cat = categoryOf(i);
          return (
            <li key={i.id} className={`mail ${i.read ? '' : 'unread'} ${expanded ? 'open' : ''}`}>
              <button
                type="button"
                className="mail-head"
                aria-expanded={expanded}
                onClick={() => {
                  setOpen(expanded ? null : i.id);
                  markRead(i.id);
                }}
              >
                <span className={`cat cat-${cat}`}>{CATEGORY_LABEL[cat]}</span>
                <span className="subject">{subjectOf(i)}</span>
                <small>{formatDate(dateIn(i.season, i.week, i.day ?? 1))}</small>
              </button>
              {expanded ? (
                i.kind === 'bid' && !i.resolved ? <BidCard item={i} /> : <p className="mail-body">{i.text}</p>
              ) : (
                <p className="mail-preview">{i.text}</p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
