import { dateOf, formatDate, isMatchdayMorning } from '../../engine/calendar';
import { hp } from '../help';
import { useGame } from '../../state/store';

/** Inbox on the left; today's date and Continue on the right (CM 01/02 style). */
export function TopBar() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const screen = useGame((s) => s.screen);
  const busy = useGame((s) => s.busy);
  const go = useGame((s) => s.go);
  const continueDay = useGame((s) => s.continueDay);
  // Online guests: the host moves the game on.
  const guest = useGame((s) => s.online?.role === 'guest');

  const unread = (game.inbox ?? []).filter((i) => !i.read).length;
  const ended = game.phase !== 'season';
  const matchday = isMatchdayMorning(game);
  const half = game.half === 'pm' ? 'PM' : 'AM';

  return (
    <header className="top-bar">
      <button
        type="button"
        className={`inbox-btn ${screen === 'inbox' ? 'active' : ''}`}
        aria-label={`Inbox, ${unread} unread`}
        onClick={() => go('inbox')}
        {...hp('inbox')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7 L12 13 L21 7" />
        </svg>
        <span>Inbox</span>
        {unread > 0 && <b className="badge">{unread > 99 ? '99+' : unread}</b>}
      </button>
      <div className="date" {...hp('date')}>
        <strong>{formatDate(dateOf(game))}</strong>
        <small>{ended ? 'Season over' : matchday ? `Matchday · ${half}` : half}</small>
      </div>
      <button
        type="button"
        className={`continue-btn ${matchday ? 'matchday' : ''}`}
        disabled={busy || (guest && !ended)}
        onClick={() => (ended ? go('seasonEnd') : continueDay())}
        {...hp('continue')}
      >
        {ended ? 'Review' : guest ? "Host's turn" : matchday ? 'Match' : 'Continue'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4 L19 12 L7 20 Z" /></svg>
      </button>
    </header>
  );
}
