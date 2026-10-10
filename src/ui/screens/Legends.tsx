import { useState } from 'react';
import { LEGENDS_SEASONS, SUMMER_ROUNDS, legendsStandings, seasonsPlayed } from '../../engine/legends';
import { playerName } from '../../engine/players/generate';
import { cupName } from '../../engine/season/cups';
import type { GameState } from '../../engine/types';
import { squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { ordinal, seasonLabel } from '../format';

function RollOfHonour({ game }: { game: GameState }) {
  const roll = game.legends!.roll;
  if (!roll.length) return <p className="muted small">The first season is under way. Winners go here.</p>;
  return (
    <ul className="trophies">
      {[...roll].reverse().map((r) => (
        <li key={r.season}>
          <span className="grow">
            <strong>{seasonLabel(r.season)}: {game.clubs[r.champions].name}</strong>
            <small>
              {r.cups.map((c) => `${cupName(game, c.id)}: ${game.clubs[c.winnerId].name}`).join(' · ')}
              {' · '}you finished {r.positions[game.userClubId]}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Standings({ game }: { game: GameState }) {
  const rows = legendsStandings(game);
  return (
    <div className="ledger standings">
      {rows.map((r, i) => (
        <div key={r.club.id} className={r.club.id === game.userClubId ? 'mine' : ''}>
          <span>
            {i + 1}. <ClubDot colours={r.club.colours} size={10} /> {r.club.name}
          </span>
          <b>{r.titles} league · {r.cups} cups{r.avgFinish ? ` · avg ${r.avgFinish.toFixed(1)}` : ''}</b>
        </div>
      ))}
    </div>
  );
}

/** The Legends tab: where the ten seasons stand, and your draft picks. */
export function Legends() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const played = seasonsPlayed(game);
  const online = useGame((s) => s.online);
  const leaveOnline = useGame((s) => s.leaveOnline);
  const myPicks = [game.legends!.lastDraft, game.legends!.draft].flatMap((d) => d?.picks.filter((p) => p.clubId === game.userClubId) ?? []);
  return (
    <main className="screen legends-home">
      <header className="screen-head">
        <div className="eyebrow">Legends · {game.legends!.difficulty} AI</div>
        <h1>Season {Math.min(played + 1, LEGENDS_SEASONS)} of {LEGENDS_SEASONS}</h1>
      </header>
      <section className="card">
        <div className="card-label"><span>Roll of honour</span><span>{played} played</span></div>
        <RollOfHonour game={game} />
      </section>
      <section className="card">
        <div className="card-label"><span>All-time table</span><span>trophies, then titles</span></div>
        <Standings game={game} />
      </section>
      {online && (
        <button type="button" className="btn secondary" onClick={leaveOnline}>
          {online.role === 'host' ? 'Stop hosting (the game stays saved)' : 'Leave the online game'}
        </button>
      )}
      {myPicks.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Your latest draft</span></div>
          <p className="small">{myPicks.map((p) => `#${p.pick} ${playerName(game.players[p.playerId])}`).join(' · ')}</p>
        </section>
      )}
    </main>
  );
}

/** End of a Legends season: the table, then let two go and into the summer draft; or the final standings. */
export function LegendsSeasonEnd() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const summer = useGame((s) => s.legendsSummer);
  const go = useGame((s) => s.go);
  const roll = game.legends!.roll.at(-1)!;
  const me = game.userClubId;
  const squad = [...squadOf(game, me)].sort((a, b) => a.overall - b.overall);
  const [release, setRelease] = useState<string[]>(() => squad.filter((p) => p.position !== 'GK').slice(0, SUMMER_ROUNDS).map((p) => p.id));
  const finished = !!game.legends!.finished;
  const online = useGame((s) => s.online);
  const [sent, setSent] = useState(false);
  const others = online?.lobby?.seats.filter((s) => s.clubId && s.clubId !== me) ?? [];
  const myCups = roll.cups.filter((c) => c.winnerId === me).map((c) => cupName(game, c.id));
  const pos = roll.positions[me];
  const toggle = (id: string) =>
    setRelease((r) => (r.includes(id) ? r.filter((x) => x !== id) : r.length >= SUMMER_ROUNDS ? [...r.slice(1), id] : [...r, id]));

  return (
    <main className="screen season-end legends-end">
      <header className="screen-head">
        <div className="eyebrow">Legends · season {seasonsPlayed(game)} of {LEGENDS_SEASONS}</div>
        <h1>{pos === 1 ? 'Champions!' : `You finished ${ordinal(pos)}`}</h1>
      </header>
      <section className="card">
        <div className="card-label"><span>{seasonLabel(roll.season)}</span></div>
        <p className="small">
          League: {game.clubs[roll.champions].name}.{' '}
          {roll.cups.map((c) => `${cupName(game, c.id)}: ${game.clubs[c.winnerId].name}.`).join(' ')}
        </p>
        {myCups.length > 0 && <p className="note good"><span aria-hidden="true">▲</span>You won the {myCups.join(' and the ')}.</p>}
      </section>

      {finished ? (
        <>
          <section className="card">
            <div className="card-label"><span>Final standings after ten seasons</span></div>
            <Standings game={game} />
          </section>
          <section className="card">
            <div className="card-label"><span>Roll of honour</span></div>
            <RollOfHonour game={game} />
          </section>
          <button type="button" className="btn primary big" onClick={() => go('start')}>Back to the start</button>
        </>
      ) : (
        <>
          <section className="card">
            <div className="card-label"><span>Let two go</span><span>{release.length} / {SUMMER_ROUNDS}</span></div>
            <p className="muted small">
              Every team releases {SUMMER_ROUNDS} players back into the pool, then there's a {SUMMER_ROUNDS}-round draft in order of the final table, champions first.
              You pick {pos === 1 ? 'first' : ordinal(pos)} each round.
            </p>
            <ul className="release-list">
              {squad.map((p) => (
                <li key={p.id}>
                  <label className="toggle no-rule">
                    <input type="checkbox" checked={release.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span>
                      {playerName(p)} <small className="muted">{p.positions.join(', ')} · {p.overall} · {p.seasonStats.apps} games, {p.seasonStats.goals} goals</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
          {online && others.length > 0 && (
            <section className="card">
              <div className="card-label"><span>Friends' releases</span></div>
              <div className="ready-list">
                {others.map((s) => <span key={s.pid} className={s.released ? 'ready' : ''}>{s.released ? '✓' : '…'} {s.teamName}</span>)}
              </div>
              {online.role === 'host' && <p className="muted small">Anyone who hasn't chosen lets their two weakest go.</p>}
            </section>
          )}
          {online?.role === 'guest' ? (
            <button type="button" className="btn primary big" disabled={release.length !== SUMMER_ROUNDS} onClick={() => { summer(release); setSent(true); }}>
              {sent ? 'Sent ✓ Waiting for the host' : 'Send my releases to the host'}
            </button>
          ) : (
            <button type="button" className="btn primary big" disabled={release.length !== SUMMER_ROUNDS} onClick={() => summer(release)}>
              Release and start the summer draft
            </button>
          )}
        </>
      )}
    </main>
  );
}
