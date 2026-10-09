import { useMemo } from 'react';
import { previewMatch, recommendTactics } from '../../engine/match/preview';
import { pickTeam } from '../../engine/match/selection';
import { aiTactics, userSelection } from '../../engine/season/season';
import { buildTable } from '../../engine/season/table';
import type { Tactics } from '../../engine/types';
import { divisionOf, squadOf, userClub } from '../../engine/world';
import { nextUserFixture, useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { TacticsPicker, tacticsLabel } from '../components/TacticsPicker';
import { ordinal } from '../format';

export function PreMatch() {
  const game = useGame((s) => s.game)!;
  const rev = useGame((s) => s.rev);
  const busy = useGame((s) => s.busy);
  const setTactics = useGame((s) => s.setTactics);
  const kickOff = useGame((s) => s.kickOff);
  const simNextMatch = useGame((s) => s.simNextMatch);
  const go = useGame((s) => s.go);

  const club = userClub(game);
  const fixture = nextUserFixture(game);
  const isHome = fixture?.homeId === club.id;
  const opponent = fixture ? game.clubs[isHome ? fixture.awayId : fixture.homeId] : null;

  // `game` is mutated in place, so `rev` is the change signal for these.
  const analysis = useMemo(() => {
    if (!fixture || !opponent) return null;
    const squad = squadOf(game, club.id);
    const oppTactics = aiTactics(game, opponent, club);
    const oppSheet = { selection: pickTeam(squadOf(game, opponent.id), oppTactics.formation), tactics: oppTactics };
    const ours = userSelection(game);
    const ourSheet = { selection: ours.selection, tactics: club.tactics };
    const preview = isHome ? previewMatch(ourSheet, oppSheet, 'home') : previewMatch(oppSheet, ourSheet, 'away');
    const advice = recommendTactics(squad, oppSheet, isHome ? 'home' : 'away', false, (f) => userSelection(game, f).selection);
    const div = divisionOf(game, club.id);
    const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === div.def.id));
    const started = table.some((r) => r.played > 0);
    const posOf = (id: string) => (started ? ordinal(table.findIndex((r) => r.clubId === id) + 1) : '–');
    return { oppTactics, preview, advice, posOf, covers: ours.covers };
  }, [rev, fixture?.id]);

  if (!fixture || !opponent || !analysis) {
    return (
      <main className="screen">
        <p>No match to play.</p>
        <button type="button" className="btn primary" onClick={() => go('hub')}>Back</button>
      </main>
    );
  }

  const { preview, advice, oppTactics, posOf, covers } = analysis;
  const ourXg = isHome ? preview.xgHome : preview.xgAway;
  const theirXg = isHome ? preview.xgAway : preview.xgHome;
  const ourStrength = isHome ? preview.strengthHome : preview.strengthAway;
  const theirStrength = isHome ? preview.strengthAway : preview.strengthHome;
  const same = (a: Tactics, b: Tactics) => a.formation === b.formation && a.mentality === b.mentality && a.pressing === b.pressing;
  const usingAdvice = same(club.tactics, advice.tactics);

  return (
    <main className="screen prematch">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => go('hub')}>← Hub</button>
        <div className="eyebrow">Pre-match · {isHome ? 'Home' : 'Away'}</div>
        <h1>vs {opponent.name}</h1>
      </header>

      <section className="card">
        <div className="compare">
          <div className="side">
            <ClubDot colours={club.colours} size={28} />
            <strong>{club.shortName}</strong>
            <span>{posOf(club.id)}</span>
          </div>
          <div className="compare-rows">
            <div className="compare-row"><b>{ourStrength}</b><span>Team rating</span><b>{theirStrength}</b></div>
            <div className="compare-row"><b>{ourXg.toFixed(1)}</b><span>Expected goals</span><b>{theirXg.toFixed(1)}</b></div>
          </div>
          <div className="side">
            <ClubDot colours={opponent.colours} size={28} />
            <strong>{opponent.shortName}</strong>
            <span>{posOf(opponent.id)}</span>
          </div>
        </div>
        <div className="scout">
          Scout report: they line up <strong>{tacticsLabel(oppTactics)}</strong>.
        </div>
      </section>

      <section className="card">
        <div className="card-label"><span>Your tactics</span><span>Squad fit {Math.round(preview.squadFit * 100)}%</span></div>
        <TacticsPicker tactics={club.tactics} onChange={setTactics} />
        {covers.length > 0 && (
          <ul className="notes">
            {covers.map((c) => {
              const out = game.players[c.outId];
              const inn = c.inId ? game.players[c.inId] : null;
              return (
                <li key={c.slotIndex} className="note bad">
                  <span aria-hidden="true">▼</span>
                  {out ? out.lastName : 'A chosen player'} {c.reason === 'left' ? 'has left the club' : `is ${c.reason}`}{inn ? `, so ${inn.lastName} plays ${c.slot}` : ''}.
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="link-btn" onClick={() => go('tactics')}>
          Change starting XI ({club.lineup ? 'your picks' : 'auto-picked'}) →
        </button>
      </section>

      <section className="card assistant">
        <div className="card-label"><span>Assistant manager</span></div>
        {preview.notes.length === 0 ? (
          <p className="note neutral">No real tactical edge either way. It'll come down to the players.</p>
        ) : (
          <ul className="notes">
            {preview.notes.map((n, i) => (
              <li key={i} className={`note ${n.effect > 0.005 ? 'good' : n.effect < -0.005 ? 'bad' : 'neutral'}`}>
                <span aria-hidden="true">{n.effect > 0.005 ? '▲' : n.effect < -0.005 ? '▼' : '•'}</span>
                {n.text}
              </li>
            ))}
          </ul>
        )}
        {usingAdvice ? (
          <p className="advice ok">You're set up the way I'd do it, gaffer.</p>
        ) : (
          <button type="button" className="btn secondary" onClick={() => setTactics(advice.tactics)}>
            Use my pick: {tacticsLabel(advice.tactics)}
          </button>
        )}
      </section>

      <div className="sticky-cta grid-2">
        <button type="button" className="btn primary big" disabled={busy} onClick={kickOff}>Play match</button>
        <button type="button" className="btn secondary big" disabled={busy} onClick={() => void simNextMatch()}>Sim match</button>
      </div>
    </main>
  );
}
