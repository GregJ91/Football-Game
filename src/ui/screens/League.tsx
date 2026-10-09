import { useState } from 'react';
import { divisionTable } from '../../engine/season/table';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { topScorers } from '../../engine/season/awards';
import { LeagueTable, TableKey } from '../components/LeagueTable';
import { LeagueTabs } from '../components/LeagueTabs';

export function League() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const [divId, setDivId] = useState(() => divisionOf(game, game.userClubId).def.id);
  const division = game.divisions.find((d) => d.def.id === divId) ?? game.divisions[0];
  const rows = divisionTable(game, division.def.id);

  return (
    <main className="screen league">
      <header className="screen-head">
        <h1>League</h1>
        <LeagueTabs />
        <label className="field">
          <span className="visually-hidden">Division</span>
          <select value={division.def.id} onChange={(e) => setDivId(e.target.value)}>
            {game.divisions.map((d) => (
              <option key={d.def.id} value={d.def.id}>
                Level {d.def.level} · {d.def.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <section className="card flush">
        <LeagueTable game={game} def={division.def} rows={rows} />
      </section>
      <TableKey def={division.def} />
      {(() => {
        const scorers = topScorers(game, division.clubIds);
        return (
          <section className="card">
            <div className="card-label"><span>Top scorers</span></div>
            {scorers.length === 0 ? (
              <p className="muted small">No goals yet this season.</p>
            ) : (
              <ol className="scorers-list">
                {scorers.map(({ p, clubId }) => (
                  <li key={p.id} className={clubId === game.userClubId ? 'is-user' : ''}>
                    <span className="grow">{p.firstName} {p.lastName}<small className="block muted">{game.clubs[clubId].name}</small></span>
                    <span className="muted small">{p.seasonStats.apps} apps</span>
                    <b>{p.seasonStats.goals}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })()}
    </main>
  );
}
