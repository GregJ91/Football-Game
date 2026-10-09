import { cupDef } from '../../data/cups';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot, Crest } from '../components/ClubArt';
import { LeagueTable, TableKey } from '../components/LeagueTable';
import { ordinal, seasonLabel } from '../format';

const HEADLINES = {
  champions: 'Champions!',
  promoted: 'Promoted!',
  relegated: 'Relegated',
  stayed: 'Season complete',
} as const;

export function SeasonEnd() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const nextSeason = useGame((s) => s.nextSeason);
  const summary = game.lastSummary;
  if (!summary) return null;

  const club = userClub(game);
  const division = divisionOf(game, club.id);
  const record = club.history.at(-1)!;
  const rows = summary.finalTables[division.def.id];
  const userPlayoffs = summary.playoffs.filter((t) => t.homeId === club.id || t.awayId === club.id);
  const nameOf = (id: string) => game.clubs[id].name;

  return (
    <main className="screen season-end">
      <section className={`hero-card outcome-${record.outcome}`}>
        <Crest colours={club.colours} size={64} />
        <div className="eyebrow">{seasonLabel(summary.season)} · {division.def.name}</div>
        <h1>{HEADLINES[record.outcome]}</h1>
        <p>
          {club.name} finished {ordinal(record.position)}
          {record.outcome === 'promoted' && userPlayoffs.length > 0 ? ' and won the play-offs' : ''}.
        </p>
      </section>

      {userPlayoffs.length > 0 && (
        <section className="card">
          <div className="card-label">
            <span>Your play-offs</span>
          </div>
          {userPlayoffs.map((t, i) => (
            <div key={i} className="po-row">
              <span>{t.round === 'final' ? 'Final' : 'Semi'}</span>
              <span className="grow">
                {nameOf(t.homeId)} {t.result.homeGoals}–{t.result.awayGoals} {nameOf(t.awayId)}
                {t.result.penalties ? ` (${t.result.penalties.home}–${t.result.penalties.away} pens)` : ''}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="card flush">
        <LeagueTable game={game} def={division.def} rows={rows} />
      </section>
      <TableKey def={division.def} />

      {(game.cups ?? []).length > 0 && (
        <section className="card">
          <div className="card-label"><span>Cup winners</span></div>
          {game.cups!.map((cup) => {
            const w = cup.winnerId ? game.clubs[cup.winnerId] : null;
            return (
              <div key={cup.id} className="po-row">
                <span className="grow">{cupDef(game.country, cup.id).name}</span>
                {w && <ClubDot colours={w.colours} size={12} />}
                <strong>{w ? w.name : '–'}</strong>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <div className="card-label">
          <span>Around the pyramid</span>
        </div>
        {game.divisions.map((d) => {
          const champ = game.clubs[summary.champions[d.def.id]];
          return (
            <div key={d.def.id} className="po-row">
              <span className="grow">{d.def.name}</span>
              <ClubDot colours={champ.colours} size={12} />
              <strong>{champ.name}</strong>
            </div>
          );
        })}
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn primary big" onClick={nextSeason}>
          Start {seasonLabel(summary.season + 1)}
        </button>
      </div>
    </main>
  );
}
