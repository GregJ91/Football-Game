import { useState } from 'react';
import type { LegendsDifficulty } from '../../engine/types';
import { useGame } from '../../state/store';
import { DEFAULT_CREST } from '../components/ClubArt';
import { IdentityEditor, type Identity } from '../components/IdentityEditor';

const DIFFICULTIES: { d: LegendsDifficulty; label: string; note: string }[] = [
  { d: 'easy', label: 'Easy', note: 'The AI drafts loosely and plays a touch below its best' },
  { d: 'medium', label: 'Medium', note: 'A fair fight' },
  { d: 'hard', label: 'Hard', note: 'The AI drafts sharply and raises its game' },
];

/** Legends: name your team, pick your kits and the AI's difficulty, then draft. */
export function LegendsSetup() {
  const go = useGame((s) => s.go);
  const newLegends = useGame((s) => s.newLegends);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [difficulty, setDifficulty] = useState<LegendsDifficulty>('medium');
  const [identity, setIdentity] = useState<Identity>({
    colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'plain' },
    awayKit: { primary: '#F5F1E6', secondary: '#B3202A', pattern: 'plain' },
    crest: DEFAULT_CREST,
  });
  const teamName = name.trim();
  const short = (shortName.trim() || teamName.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
  const valid = teamName.length >= 3;

  return (
    <main className="screen create legends-setup">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => go('start')}>← Back</button>
        <div className="eyebrow">Legends</div>
        <h1>Draft the greatest</h1>
      </header>

      <section className="card">
        <ul className="plain-list">
          <li>The best players of the last 40 years, every one aged 20 and at their peak.</li>
          <li>20 teams draft 23 players each in a snake draft (the order reverses every round).</li>
          <li>A Super League with no relegation, plus the Super League Cup, the Super FA Cup and the Super Cup.</li>
          <li>No transfers. Each summer every team lets two players go, then a two-round draft: the champions pick first.</li>
          <li>Ten seasons. Most trophies wins.</li>
        </ul>
      </section>

      <div className="form">
        <label className="field">
          <span>Team name</span>
          <input value={name} maxLength={28} placeholder="e.g. Dream XI" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>3-letter name</span>
          <input value={shortName} maxLength={3} placeholder={short || 'ABC'} onChange={(e) => setShortName(e.target.value.toUpperCase())} />
        </label>
        <IdentityEditor value={identity} onChange={setIdentity} shortName={short} />

        <fieldset className="field">
          <legend>Who's playing</legend>
          <div className="grid-2">
            <button type="button" className="choice" aria-pressed="true">
              <strong>On your own</strong>
              <small>You against 19 AI teams</small>
            </button>
            <button type="button" className="choice" disabled>
              <strong>Online with friends</strong>
              <small>Coming in the next update</small>
            </button>
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>AI difficulty</legend>
          <div className="grid-3">
            {DIFFICULTIES.map(({ d, label, note }) => (
              <button key={d} type="button" className="choice" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                <strong>{label}</strong>
                <small>{note}</small>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn primary big"
          disabled={!valid}
          onClick={() => newLegends({ teamName, shortName: short, colours: identity.colours, awayKit: identity.awayKit, crest: identity.crest, difficulty })}
        >
          Start the draft
        </button>
      </div>
    </main>
  );
}
