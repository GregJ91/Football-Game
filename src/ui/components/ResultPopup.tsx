import { useGame } from '../../state/store';
import { MatchCard } from './MatchCard';

export function ResultPopup() {
  const game = useGame((s) => s.game);
  const fixture = useGame((s) => s.resultPopup);
  const dismiss = useGame((s) => s.dismissResult);
  if (!game || !fixture?.result) return null;
  const us = fixture.homeId === game.userClubId;
  const ours = us ? fixture.result.homeGoals : fixture.result.awayGoals;
  const theirs = us ? fixture.result.awayGoals : fixture.result.homeGoals;
  const pens = fixture.result.penalties;
  const pensUs = pens ? (us ? pens.home : pens.away) : 0;
  const pensThem = pens ? (us ? pens.away : pens.home) : 0;
  // A shoot-out decides a cup tie that finished level.
  const verdict = ours > theirs || pensUs > pensThem ? 'Win' : ours < theirs || pensUs < pensThem ? 'Defeat' : 'Draw';
  return (
    <div className="sheet-backdrop center" onClick={dismiss}>
      <div className="popup" role="dialog" aria-modal="true" aria-label="Full time" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">Full time</div>
        <h2 className={`verdict verdict-${verdict.toLowerCase()}`}>{verdict}</h2>
        <MatchCard game={game} fixture={fixture} />
        <button type="button" className="btn primary" onClick={dismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
