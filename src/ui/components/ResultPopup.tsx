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
  const verdict = ours > theirs ? 'Win' : ours < theirs ? 'Defeat' : 'Draw';
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
