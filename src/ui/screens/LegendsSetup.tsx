import { useState } from 'react';
import { squadNeeds } from '../../engine/legends';
import { FORMATIONS } from '../../engine/match/selection';
import type { Formation, LegendsDifficulty } from '../../engine/types';
import { lastRoom, useGame } from '../../state/store';
import { Crest, DEFAULT_CREST } from '../components/ClubArt';
import { IdentityEditor, type Identity } from '../components/IdentityEditor';
import { PITCH_ROWS } from './Tactics';

const DIFFICULTIES: { d: LegendsDifficulty; label: string; note: string }[] = [
  { d: 'easy', label: 'Easy', note: 'The AI drafts loosely and plays a touch below its best' },
  { d: 'medium', label: 'Medium', note: 'A fair fight' },
  { d: 'hard', label: 'Hard', note: 'The AI drafts sharply and raises its game' },
];

const STEP_TITLES = ['Name your team', 'Kits and crest', 'Formation and players'];

/** A small pitch with the formation's eleven dots. */
function FormationDiagram({ formation }: { formation: Formation }) {
  return (
    <span className="mini-pitch" aria-hidden="true">
      {PITCH_ROWS[formation].map((row, r) => (
        <span key={r} className="mini-row">
          {row.map((i) => <i key={i} />)}
        </span>
      ))}
    </span>
  );
}

/** Legends: the same three steps as a new club, then the draft. */
export function LegendsSetup() {
  const go = useGame((s) => s.go);
  const newLegends = useGame((s) => s.newLegends);
  const hostLegends = useGame((s) => s.hostLegends);
  const joinLegends = useGame((s) => s.joinLegends);
  const [step, setStep] = useState(1);
  const [who, setWho] = useState<'solo' | 'host' | 'join'>('solo');
  const [code, setCode] = useState(lastRoom);
  const [you, setYou] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [ground, setGround] = useState('');
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [difficulty, setDifficulty] = useState<LegendsDifficulty>('medium');
  const [identity, setIdentity] = useState<Identity>({
    colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'plain' },
    awayKit: { primary: '#F5F1E6', secondary: '#B3202A', pattern: 'plain' },
    crest: DEFAULT_CREST,
  });
  const teamName = name.trim();
  const short = (shortName.trim() || teamName.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
  const named = teamName.length >= 3;
  const valid = named && (who === 'solo' || you.trim().length >= 2) && (who !== 'join' || code.trim().length === 5);
  const team = {
    teamName,
    shortName: short,
    stadiumName: ground.trim() || `${teamName.split(' ')[0]} Arena`,
    colours: identity.colours,
    awayKit: identity.awayKit,
    crest: identity.crest,
    formation,
  };
  const begin = () => {
    if (who === 'solo') newLegends({ ...team, difficulty });
    else if (who === 'host') void hostLegends({ name: you.trim(), team });
    else void joinLegends(code, { name: you.trim(), team });
  };
  const needs = squadNeeds(formation);

  return (
    <main className="screen create legends-setup">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => (step > 1 ? setStep(step - 1) : go('start'))}>← Back</button>
        <div className="eyebrow">Legends</div>
        <h1>{STEP_TITLES[step - 1]}</h1>
        <div className="steps" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => <i key={n} className={n <= step ? 'on' : ''} />)}
          <small>Step {step} of 3</small>
        </div>
      </header>

      {step === 1 && (
        <section className="card">
          <ul className="plain-list">
            <li>The best players of the last 40 years, all aged 20 at their peak. They age a year each season but never lose their powers.</li>
            <li>20 teams, one formation each for the whole game. Draft keepers first, then defenders, midfielders and attackers.</li>
            <li>A Super League, the Super League Cup, the Super FA Cup and the Super Cup. No transfers: each summer let two go and draft two, champions first.</li>
            <li>Ten seasons. Most trophies wins.</li>
          </ul>
        </section>
      )}

      <section className="card preview">
        <Crest colours={identity.colours} size={72} design={identity.crest} initials={short} />
        <div className="preview-name">
          <strong>{teamName || 'Your team'}</strong>
          <span>{short || '???'} · {ground.trim() || 'Your ground'}{step === 3 ? ` · ${formation}` : ''}</span>
        </div>
      </section>

      <div className="form">
        {step === 1 && (
          <>
            <label className="field">
              <span>Team name</span>
              <input value={name} maxLength={28} placeholder="e.g. Dream XI" onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>3-letter name</span>
                <input value={shortName} maxLength={3} placeholder={short || 'ABC'} onChange={(e) => setShortName(e.target.value.toUpperCase())} />
              </label>
              <label className="field">
                <span>Stadium name</span>
                <input value={ground} maxLength={24} placeholder="e.g. Legends Arena" onChange={(e) => setGround(e.target.value)} />
              </label>
            </div>
          </>
        )}

        {step === 2 && <IdentityEditor value={identity} onChange={setIdentity} shortName={short} />}

        {step === 3 && (
          <>
            <fieldset className="field">
              <legend>Formation (locked for all ten seasons)</legend>
              <div className="formation-grid">
                {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                  <button key={f} type="button" className="choice formation-choice" aria-pressed={formation === f} onClick={() => setFormation(f)}>
                    <FormationDiagram formation={f} />
                    <strong>{f}</strong>
                  </button>
                ))}
              </div>
              <p className="muted small">
                You'll draft {needs.GK} goalkeepers, {needs.DEF} defenders, {needs.MID} midfielders and {needs.ATT} attackers: two for every place in the team, plus a third keeper.
              </p>
            </fieldset>

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
          </>
        )}
      </div>

      <div className="sticky-cta">
        {step < 3 ? (
          <button type="button" className="btn primary big" disabled={!named} onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="btn primary big" disabled={!valid} onClick={begin}>
            {who === 'solo' ? 'Start the draft' : who === 'host' ? 'Open the room' : 'Join the room'}
          </button>
        )}
        {step === 1 && !named && <p className="hint">Give the team a name of at least 3 letters.</p>}
      </div>
    </main>
  );
}
