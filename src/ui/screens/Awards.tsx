import { useState } from 'react';
import type { AwardWinner } from '../../engine/types';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { LeagueTabs } from '../components/LeagueTabs';
import { seasonLabel } from '../format';

/** Awards: monthly winners by division, the season's honours, and the Ballon d'Or. */
export function Awards() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const user = game.userClubId;
  const [divId, setDivId] = useState(() => divisionOf(game, user).def.id);
  const awards = game.awards ?? { monthly: [], history: [] };
  const months = awards.monthly.filter((m) => m.divisionId === divId);
  const latest = awards.history.at(-1);
  const lastSeason = game.lastSummary?.awards?.[divId];
  const club = (id: string) => game.clubs[id]?.name ?? '';

  const row = (label: string, w: AwardWinner | undefined, value?: string) =>
    w && (
      <div className={`po-row${w.clubId === user ? ' is-user' : ''}`}>
        <span className="grow">{label}<small className="block muted">{club(w.clubId)}</small></span>
        <strong>{w.name}</strong>
        {value && <span className="muted small">{value}</span>}
      </div>
    );

  return (
    <main className="screen awards">
      <header className="screen-head">
        <h1>League</h1>
        <LeagueTabs />
      </header>

      <section className="card">
        <div className="card-label"><span>Ballon d'Or</span>{latest && <span>{seasonLabel(latest.season)}</span>}</div>
        {!latest ? (
          <p className="muted small">Awarded at the end of the season to the best player in the game.</p>
        ) : (
          <ol className="podium">
            {latest.ballonDor.slice(0, 5).map((b, i) => (
              <li key={b.playerId} className={b.clubId === user ? 'is-user' : ''}>
                <span className={`place place-${i + 1}`}>{i + 1}</span>
                <span className="grow">{b.name}<small className="block muted">{b.clubName} · {b.nation}</small></span>
              </li>
            ))}
          </ol>
        )}
        {awards.history.length > 1 && (
          <>
            <div className="card-label"><span>Past winners</span></div>
            {[...awards.history].reverse().slice(1, 11).map((y) => (
              <div key={y.season} className="po-row">
                <span>{seasonLabel(y.season)}</span>
                <span className="grow">{y.ballonDor[0]?.name}<small className="block muted">{y.ballonDor[0]?.clubName}</small></span>
              </div>
            ))}
          </>
        )}
      </section>

      {latest && (
        <section className="card">
          <div className="card-label"><span>Players' awards · {game.divisions.find((d) => d.def.level === 1)!.def.name}</span><span>{seasonLabel(latest.season)}</span></div>
          {row("Players' Player of the Year", latest.playerOfYear, latest.playerOfYear?.value.toFixed(2))}
          {row("Young Players' Player of the Year", latest.youngPlayerOfYear, latest.youngPlayerOfYear?.value.toFixed(2))}
          {row('Golden Boot', latest.goldenBoot, latest.goldenBoot && `${latest.goldenBoot.value} goals`)}
          <p className="muted small">Voted by the players on form, goals and assists. The league's own Player of the Season is judged on form alone.</p>
        </section>
      )}

      <label className="field">
        <span className="visually-hidden">Division</span>
        <select value={divId} onChange={(e) => setDivId(e.target.value)}>
          {game.divisions.map((d) => <option key={d.def.id} value={d.def.id}>{d.def.name}</option>)}
        </select>
      </label>

      <section className="card">
        <div className="card-label"><span>Monthly awards</span><span>{seasonLabel(game.season)}</span></div>
        {months.length === 0 ? (
          <p className="muted small">The first awards come at the end of the month.</p>
        ) : (
          [...months].reverse().map((m) => (
            <div key={m.month} className="month-block">
              <div className="month-title">{m.month}</div>
              {m.player && <div className={`po-row${m.player.clubId === user ? ' is-user' : ''}`}><span className="grow">Player<small className="block muted">{club(m.player.clubId)}</small></span><strong>{m.player.name}</strong></div>}
              {m.young && <div className={`po-row${m.young.clubId === user ? ' is-user' : ''}`}><span className="grow">Young player<small className="block muted">{club(m.young.clubId)}</small></span><strong>{m.young.name}</strong></div>}
              {m.manager && <div className={`po-row${m.manager.clubId === user ? ' is-user' : ''}`}><span className="grow">Manager<small className="block muted">{m.manager.points} pts from {m.manager.played}</small></span><strong>{m.manager.clubName}</strong></div>}
            </div>
          ))
        )}
      </section>

      {lastSeason && (
        <section className="card">
          <div className="card-label"><span>Last season</span><span>{seasonLabel(game.lastSummary!.season)}</span></div>
          {row('Player of the Season', lastSeason.player, lastSeason.player?.value.toFixed(2))}
          {row('Young Player of the Season', lastSeason.young, lastSeason.young?.value.toFixed(2))}
          {row('Golden Boot', lastSeason.topScorer, lastSeason.topScorer && `${lastSeason.topScorer.value} goals`)}
          {row('Most assists', lastSeason.topAssists, lastSeason.topAssists && `${lastSeason.topAssists.value}`)}
        </section>
      )}
    </main>
  );
}
