import { useEffect, useState } from 'react';
import { listSaves, type SaveMeta } from '../../state/persistence';
import { useGame } from '../../state/store';
import { seasonLabel } from '../format';

export function Start() {
  const go = useGame((s) => s.go);
  const continueGame = useGame((s) => s.continueGame);
  const setChallengeDraft = useGame((s) => s.setChallengeDraft);
  const [save, setSave] = useState<SaveMeta | null>(null);

  useEffect(() => {
    listSaves()
      .then((saves) => setSave(saves[0] ?? null))
      .catch(() => setSave(null));
  }, []);

  return (
    <main className="screen start">
      <div className="start-hero">
        <svg width="96" height="110" viewBox="0 0 84 96" aria-hidden="true">
          <path d="M42 4 L78 14 L78 48 C78 72 60 86 42 92 C24 86 6 72 6 48 L6 14 Z" fill="#B3202A" stroke="#F2B632" strokeWidth="4" />
          <path d="M42 26 L50 42 L68 44 L54 56 L58 74 L42 64 L26 74 L30 56 L16 44 L34 42 Z" fill="#F5F1E6" />
        </svg>
        <h1>Pyramid FC</h1>
        <p>Found a club at the bottom of the pyramid. Take it to the top.</p>
      </div>
      <div className="stack">
        {save && (
          <button type="button" className="btn primary big" onClick={() => void continueGame()}>
            Continue
            <small>
              {save.clubName} · {seasonLabel(save.season)}
            </small>
          </button>
        )}
        <button type="button" className={`btn big ${save ? 'secondary' : 'primary'}`} onClick={() => {
          setChallengeDraft(null);
          go('create');
        }}>
          New game
        </button>
        <button type="button" className="btn big secondary" onClick={() => go('challenges')}>
          Challenge mode
        </button>
        {save && <p className="hint">Starting a new game replaces your current save.</p>}
      </div>
    </main>
  );
}
