import { cupDef } from '../../data/cups';
import { euroDef } from '../../data/europe';
import { nationOf } from '../../engine/season/europe';
import { checkGrading } from '../../engine/club/stadium';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubCrest, ClubDot } from '../components/ClubArt';
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
  const denied = summary.deniedPromotion?.clubId === club.id;
  const grading = denied ? checkGrading(game, club, division.def.level - 1) : null;

  return (
    <main className="screen season-end">
      <section className={`hero-card outcome-${record.outcome}`}>
        <ClubCrest club={club} size={64} />
        <div className="eyebrow">{seasonLabel(summary.season)} · {division.def.name}</div>
        <h1>{HEADLINES[record.outcome]}</h1>
        <p>
          {club.name} finished {ordinal(record.position)}
          {record.outcome === 'promoted' && userPlayoffs.length > 0 ? ' and won the play-offs' : ''}.
          {denied ? ' But there is no promotion this time.' : ''}
        </p>
      </section>

      {denied && grading && (
        <section className="card grading not-ok">
          <div className="card-label"><span>Promotion denied</span></div>
          <p className="small">
            The ground doesn't meet the rules for the level above, so {nameOf(summary.deniedPromotion!.replacementId)} go up instead.
            Build it up in Club → Ground: work has to be finished before the end of next season.
          </p>
          {grading.items.map((it) => (
            <div key={it.label} className="grading-row">
              <span aria-hidden="true">{it.ok ? '✓' : '✗'}</span>
              <span className="grow">{it.label}</span>
              <span>{it.have} / {it.need}</span>
            </div>
          ))}
        </section>
      )}

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

      {summary.awards?.[division.def.id] && (() => {
        const a = summary.awards[division.def.id];
        const line = (label: string, w: typeof a.player, unit: string) => w && (
          <div className={`po-row${w.clubId === club.id ? ' is-user' : ''}`}>
            <span className="grow">{label}<small className="block muted">{game.clubs[w.clubId]?.name}</small></span>
            <strong>{w.name}</strong>
            <span className="muted small">{unit === 'rating' ? w.value.toFixed(2) : `${w.value} ${unit}`}</span>
          </div>
        );
        return (
          <section className="card">
            <div className="card-label"><span>{division.def.name} awards</span></div>
            {line('Player of the Season', a.player, 'rating')}
            {line('Young Player of the Season', a.young, 'rating')}
            {line('Golden Boot', a.topScorer, 'goals')}
            {line('Most assists', a.topAssists, 'assists')}
            {a.team.length > 0 && (
              <>
                <div className="card-label"><span>Team of the Season</span></div>
                <ul className="tots">
                  {a.team.map((t) => (
                    <li key={t.playerId} className={t.clubId === club.id ? 'is-user' : ''}>
                      <span className="pos">{t.position}</span>
                      <span className="grow">{t.name}<small className="block muted">{game.clubs[t.clubId]?.name}</small></span>
                      <b>{t.value.toFixed(2)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })()}

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

      {summary.europe && (
        <section className="card">
          <div className="card-label"><span>Europe</span></div>
          {summary.europe.winners.map((w) => {
            const c = game.clubs[w.clubId];
            return (
              <div key={w.compId} className="po-row">
                <span className="grow">{euroDef(w.compId).name}</span>
                <ClubDot colours={c.colours} size={12} />
                <strong>{c.name} <small className="muted">{nationOf(game, c.id)}</small></strong>
              </div>
            );
          })}
          <div className="card-label"><span>Into Europe next season</span></div>
          {summary.europe.qualified.map((e) => (
            <div key={e.clubId} className={`po-row${e.clubId === club.id ? ' is-user' : ''}`}>
              <span>{euroDef(e.compId).short}</span>
              <span className="grow">{game.clubs[e.clubId].name}</span>
              <span className="muted small">{e.reason}{e.playoff ? ' · play-off' : ''}</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-label">
          <span>Around the pyramid</span>
        </div>
        {game.divisions.map((d) => {
          const champ = game.clubs[summary.champions[d.def.id]];
          const boot = summary.awards?.[d.def.id]?.topScorer;
          return (
            <div key={d.def.id} className="po-row">
              <span className="grow">{d.def.name}{boot && <small className="block muted">Golden Boot: {boot.name} ({boot.value})</small>}</span>
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
