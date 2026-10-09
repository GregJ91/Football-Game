import { useState } from 'react';
import { COUNTRIES } from '../../data/pyramids';
import { CHALLENGES, relegationLeagues } from '../../engine/club/challenge';
import type { ChallengeId, CountryId } from '../../engine/types';
import { useGame } from '../../state/store';

/** Challenge mode: pick a challenge, then found a club (or, for Relegation Battlers, pick a league). */
export function Challenges() {
  const go = useGame((s) => s.go);
  const busy = useGame((s) => s.busy);
  const setChallengeDraft = useGame((s) => s.setChallengeDraft);
  const startRelegationBattle = useGame((s) => s.startRelegationBattle);
  const [picked, setPicked] = useState<ChallengeId | null>(null);
  const [country, setCountry] = useState<CountryId>('eng');
  const leagues = relegationLeagues(country);
  const [league, setLeague] = useState(leagues[0].id);

  const pickCountry = (c: CountryId) => {
    setCountry(c);
    setLeague(relegationLeagues(c)[0].id);
  };

  return (
    <main className="screen challenges">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => go('start')}>← Back</button>
        <div className="eyebrow">Challenge mode</div>
        <h1>Pick a challenge</h1>
      </header>

      {CHALLENGES.map((c) => (
        <section key={c.id} className={`card challenge-card ${picked === c.id ? 'picked' : ''}`}>
          <button type="button" className="challenge-head" aria-expanded={picked === c.id} onClick={() => setPicked(picked === c.id ? null : c.id)}>
            <strong>{c.name}</strong>
            <small>{c.tagline}</small>
          </button>
          {picked === c.id && (
            <div className="challenge-body">
              <ul className="plain-list">
                {c.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {c.id === 'relegation' ? (
                <>
                  <div className="grid-2">
                    {(Object.keys(COUNTRIES) as CountryId[]).map((k) => (
                      <button key={k} type="button" className="choice" aria-pressed={country === k} onClick={() => pickCountry(k)}>
                        <strong>{COUNTRIES[k].name}</strong>
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>League</span>
                    <select value={league} onChange={(e) => setLeague(e.target.value)}>
                      {leagues.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn primary" disabled={busy} onClick={() => void startRelegationBattle(country, league)}>
                    {busy ? 'Playing out the season…' : 'Take the job'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setChallengeDraft(c.id);
                    go('create');
                  }}
                >
                  Found your club
                </button>
              )}
            </div>
          )}
        </section>
      ))}
      <p className="hint">Starting a challenge replaces your current save.</p>
    </main>
  );
}
