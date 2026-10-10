import { useState } from 'react';
import type { LegendsDifficulty } from '../../engine/types';
import { lastRoom, useGame } from '../../state/store';
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
  const hostLegends = useGame((s) => s.hostLegends);
  const joinLegends = useGame((s) => s.joinLegends);
  const [who, setWho] = useState<'solo' | 'host' | 'join'>('solo');
  const [code, setCode] = useState(lastRoom);
  const [you, setYou] = useState('');
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
  const valid = teamName.length >= 3 && (who === 'solo' || you.trim().length >= 2) && (who !== 'join' || code.trim().length === 5);
  const team = { teamName, shortName: short, colours: identity.colours, awayKit: identity.awayKit, crest: identity.crest };
  const go2 = () => {
    if (who === 'solo') newLegends({ ...team, difficulty });
    else if (who === 'host') void hostLegends({ name: you.trim(), team });
    else void joinLegends(code, { name: you.trim(), team });
  };

  return (
    <main className="screen create legends-setup">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => go('start')}>← Back</button>
        <div className="eyebrow">Legends</div>
        <h1>Draft the greatest</h1>
      </header>

      <section className="card">
        <ul className="plain-list">
          <li>The best players of the last 40 years, every one aged 20 and at their peak. They age a year each season but never lose their powers.</li>
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
          <div className="grid-3">
            <button type="button" className="choice" aria-pressed={who === 'solo'} onClick={() => setWho('solo')}>
              <strong>On your own</strong>
              <small>You against 19 AI teams</small>
            </button>
            <button type="button" className="choice" aria-pressed={who === 'host'} onClick={() => setWho('host')}>
              <strong>Host online</strong>
              <small>Friends join with a code</small>
            </button>
            <button type="button" className="choice" aria-pressed={who === 'join'} onClick={() => setWho('join')}>
              <strong>Join a friend</strong>
              <small>Enter their code</small>
            </button>
          </div>
        </fieldset>
        {who !== 'solo' && (
          <label className="field">
            <span>Your name</span>
            <input value={you} maxLength={20} placeholder="So your friends know who's who" onChange={(e) => setYou(e.target.value)} />
          </label>
        )}
        {who === 'join' && (
          <label className="field">
            <span>Room code</span>
            <input value={code} maxLength={5} placeholder="e.g. K7QXM" autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
        )}
        {who !== 'solo' && (
          <p className="muted small">
            Live online play: everyone needs signal, and the host's phone runs the game, so the host keeps the app open while you play. The host picks the AI difficulty.
          </p>
        )}

        {who === 'solo' && (
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
        )}
      </div>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn primary big"
          disabled={!valid}
          onClick={go2}
        >
          {who === 'solo' ? 'Start the draft' : who === 'host' ? 'Open the room' : 'Join the room'}
        </button>
      </div>
    </main>
  );
}
