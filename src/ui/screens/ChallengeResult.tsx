import { challengeDef, seasonsSurvived } from '../../engine/club/challenge';
import { userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubCrest } from '../components/ClubArt';

/** A challenge has been won or lost. */
export function ChallengeResult() {
  const game = useGame((s) => s.game)!;
  const go = useGame((s) => s.go);
  const continueAfterChallenge = useGame((s) => s.continueAfterChallenge);
  const c = game.challenge!;
  const def = challengeDef(c.id);
  const club = userClub(game);
  const won = c.status === 'won';
  const seasons = seasonsSurvived(game);

  return (
    <main className="screen season-end challenge-result">
      <section className={`hero-card ${won ? 'outcome-champions' : 'outcome-relegated'}`}>
        <ClubCrest club={club} size={64} />
        <div className="eyebrow">{def.name}</div>
        <h1>{won ? 'Challenge complete' : 'Game over'}</h1>
        <p>{c.result}</p>
      </section>

      <section className="card">
        <div className="card-label"><span>Your run</span></div>
        <div className="po-row"><span className="grow">Club</span><strong>{club.name}</strong></div>
        {c.id !== 'relegation' && (
          <div className="po-row"><span className="grow">Seasons completed</span><strong>{seasons}</strong></div>
        )}
        <div className="po-row"><span className="grow">Trophies</span><strong>{(club.trophies ?? []).filter((t) => t.season >= c.startSeason).length}</strong></div>
      </section>

      <div className="stack">
        {won && (
          <button type="button" className="btn primary big" onClick={continueAfterChallenge}>
            Keep playing
          </button>
        )}
        <button type="button" className={`btn big ${won ? 'secondary' : 'primary'}`} onClick={() => go('challenges')}>
          Try another challenge
        </button>
        <button type="button" className="link-btn center" onClick={() => go('start')}>
          Main menu
        </button>
      </div>
    </main>
  );
}
