import { useState } from 'react';
import { COUNTRIES, bottomDivisions } from '../../data/pyramids';
import type { CountryId, Difficulty, Region } from '../../engine/types';
import { useGame } from '../../state/store';
import { Crest, DEFAULT_CREST } from '../components/ClubArt';
import { IdentityEditor, type Identity } from '../components/IdentityEditor';
import { challengeDef } from '../../engine/club/challenge';

const DIFFICULTIES: { d: Difficulty; label: string; note: string }[] = [
  { d: 'easy', label: 'Easy', note: 'More money, a patient board' },
  { d: 'normal', label: 'Normal', note: 'The board warns, never sacks' },
  { d: 'hard', label: 'Hard', note: 'Less money, and you can be sacked' },
];

export function CreateClub() {
  const newGame = useGame((s) => s.newGame);
  const go = useGame((s) => s.go);
  const challenge = useGame((s) => s.challengeDraft);
  const setChallengeDraft = useGame((s) => s.setChallengeDraft);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [ground, setGround] = useState('');
  const [identity, setIdentity] = useState<Identity>({
    colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'stripes' },
    awayKit: { primary: '#F5F1E6', secondary: '#B3202A', pattern: 'plain' },
    crest: DEFAULT_CREST,
  });
  const { colours } = identity;
  const [country, setCountry] = useState<CountryId>('eng');
  const [region, setRegion] = useState<Region>('N');
  const [topFlight, setTopFlight] = useState(false);
  const [realNames, setRealNames] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  const clubName = name.trim();
  const valid = clubName.length >= 3;
  const short = (shortName.trim() || clubName.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();

  const found = () => {
    if (!valid) return;
    newGame({
      clubName,
      shortName: short,
      stadiumName: ground.trim() || `${clubName.split(' ')[0]} Park`,
      colours,
      awayKit: identity.awayKit,
      crest: identity.crest,
      country,
      region,
      topFlight: challenge ? false : topFlight,
      realNames,
      difficulty,
      challenge: challenge ?? undefined,
    });
  };

  return (
    <main className="screen create">
      <header className="screen-head">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            if (challenge) {
              setChallengeDraft(null);
              go('challenges');
            } else go('start');
          }}
        >
          ← Back
        </button>
        <div className="eyebrow">{challenge ? `Challenge: ${challengeDef(challenge).name}` : 'New game'}</div>
        <h1>Create your club</h1>
      </header>

      {challenge && (
        <section className="card challenge-banner">
          <ul className="plain-list">
            {challengeDef(challenge).rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      )}

      <section className="card preview">
        <Crest colours={colours} size={72} design={identity.crest} initials={short} />
        <div className="preview-name">
          <strong>{clubName || 'Your club'}</strong>
          <span>
            {short || '???'} · {ground.trim() || 'Your ground'}
          </span>
        </div>
      </section>

      <div className="form">
        <label className="field">
          <span>Club name</span>
          <input value={name} maxLength={28} placeholder="e.g. Ashford Rovers" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Short name</span>
            <input value={shortName} maxLength={3} placeholder={short || 'ABC'} onChange={(e) => setShortName(e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            <span>Ground</span>
            <input value={ground} maxLength={24} placeholder="e.g. The Meadow" onChange={(e) => setGround(e.target.value)} />
          </label>
        </div>

        <IdentityEditor value={identity} onChange={setIdentity} shortName={short} />

        <fieldset className="field">
          <legend>Start in</legend>
          <div className="grid-2">
            {(Object.keys(COUNTRIES) as CountryId[]).map((c) => (
              <button key={c} type="button" className="choice" aria-pressed={country === c} onClick={() => setCountry(c)}>
                <strong>{COUNTRIES[c].name}</strong>
                <small>Level {Math.max(...COUNTRIES[c].divisions.map((d) => d.level))}</small>
              </button>
            ))}
          </div>
        </fieldset>
        {!topFlight && (
        <fieldset className="field">
          <legend>League</legend>
          <div className="grid-2">
            {bottomDivisions(country).map((d) => (
              <button key={d.id} type="button" className="choice" aria-pressed={region === d.region} onClick={() => setRegion(d.region ?? 'N')}>
                <strong>{d.name}</strong>
                <small>{d.size} clubs</small>
              </button>
            ))}
          </div>
        </fieldset>
        )}
        {challenge !== 'sack' && (
        <fieldset className="field">
          <legend>Difficulty</legend>
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
        <fieldset className="field">
          <legend>The world</legend>
          <label className="toggle no-rule" htmlFor="real-names">
            <input id="real-names" type="checkbox" checked={realNames} onChange={(e) => setRealNames(e.target.checked)} />
            <span>
              Real club names
              <small>Real clubs, colours and grounds at home and in Europe. Players are made up.</small>
            </span>
          </label>
        </fieldset>
        {!challenge && (
        <fieldset className="field">
          <legend>Testing</legend>
          <label className="toggle no-rule" htmlFor="top-flight">
            <input id="top-flight" type="checkbox" checked={topFlight} onChange={(e) => setTopFlight(e.target.checked)} />
            <span>
              Start as a top-flight giant
              <small>
                Begin in the {COUNTRIES[country].divisions.find((d) => d.level === 1)!.name} with a title-winning squad, a big ground and a place in the Champions League.
              </small>
            </span>
          </label>
        </fieldset>
        )}
      </div>

      <div className="sticky-cta">
        <button type="button" className="btn primary big" disabled={!valid} onClick={found}>
          Found the club
        </button>
      </div>
    </main>
  );
}
