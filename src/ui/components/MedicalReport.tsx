import { MATCHDAY, dateIn, formatDate } from '../../engine/calendar';
import { facilitiesOf } from '../../engine/club/facilities';
import { STAFF_INFO } from '../../engine/club/staff';
import { playerName } from '../../engine/players/generate';
import { positionsLabel } from '../../engine/players/ratings';
import { ROLE_LABEL, TIRED, daysToFull, roleOf } from '../../engine/players/squad';
import type { Player } from '../../engine/types';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';

/** The club doctor's report: who's injured, who's suspended, and how fit everyone is. */
export function MedicalReport({ onOpen }: { onOpen: (p: Player) => void }) {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const restTiredPlayers = useGame((s) => s.restTiredPlayers);
  const showToast = useGame((s) => s.showToast);
  const club = userClub(game);
  const squad = squadOf(game, club.id);
  const injured = squad.filter((p) => p.injuryWeeks > 0).sort((a, b) => b.injuryWeeks - a.injuryWeeks);
  const suspended = squad.filter((p) => p.suspendedMatches > 0);
  const available = squad.filter((p) => !p.injuryWeeks && !p.suspendedMatches).sort((a, b) => a.fitness - b.fitness);
  const tired = available.filter((p) => p.fitness < TIRED);
  const avgFit = available.length ? Math.round(available.reduce((n, p) => n + p.fitness, 0) / available.length) : 0;
  const physio = club.staff?.physio;
  const log = (club.injuryLog ?? []).filter((r) => r.season === game.season);
  const firstTeam = (p: Player) => roleOf(p) === 'key' || roleOf(p) === 'first';

  const backOn = (p: Player) => {
    const week = game.week + p.injuryWeeks;
    return week >= game.totalWeeks ? 'next season' : `around ${formatDate(dateIn(game.season, week, MATCHDAY))}`;
  };

  return (
    <div className="medical">
      <section className="card medical-summary">
        <div className="med-stat"><b className={injured.length ? 'warn' : ''}>{injured.length}</b><small>Injured</small></div>
        <div className="med-stat"><b className={suspended.length ? 'warn' : ''}>{suspended.length}</b><small>Suspended</small></div>
        <div className="med-stat"><b className={tired.length ? 'warn' : ''}>{tired.length}</b><small>Tired</small></div>
        <div className="med-stat"><b>{avgFit}%</b><small>Avg fitness</small></div>
      </section>
      <p className="muted small">
        {STAFF_INFO.physio.name}: {physio ? `${physio.name} (rated ${physio.rating})` : 'vacant'} · Medical centre level {facilitiesOf(club).medical}.
        A better physio and medical centre mean shorter injuries and fewer knocks.
      </p>

      <section className="card">
        <div className="card-label"><span>Injured</span><span>{injured.length}</span></div>
        {injured.length === 0 ? (
          <p className="muted small">A clean bill of health.</p>
        ) : (
          <ul className="med-list">
            {injured.map((p) => (
              <li key={p.id}>
                <button type="button" className="med-row" onClick={() => onOpen(p)}>
                  <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                  <span className="grow">
                    <strong>{playerName(p)}</strong>
                    <small className="block muted">{p.injuryName ?? 'Injury'} · back {backOn(p)}{firstTeam(p) ? ` · ${ROLE_LABEL[roleOf(p)]}` : ''}</small>
                  </span>
                  <b className="warn">{p.injuryWeeks}w</b>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {suspended.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Suspended</span><span>{suspended.length}</span></div>
          <ul className="med-list">
            {suspended.map((p) => (
              <li key={p.id}>
                <button type="button" className="med-row" onClick={() => onOpen(p)}>
                  <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                  <span className="grow"><strong>{playerName(p)}</strong><small className="block muted">Sent off</small></span>
                  <b className="warn">{p.suspendedMatches} match{p.suspendedMatches === 1 ? '' : 'es'}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-label"><span>Fitness</span><span>Most tired first</span></div>
        {tired.length > 0 && (
          <button
            type="button"
            className="btn tile"
            onClick={() => {
              const n = restTiredPlayers();
              showToast(n ? `Rested ${n} tired player${n === 1 ? '' : 's'} from your XI.` : 'Nobody fresh is good enough to come in.');
            }}
          >
            Rest tired players from the XI
          </button>
        )}
        <ul className="med-list">
          {available.map((p) => {
            const days = daysToFull(p);
            return (
              <li key={p.id}>
                <button type="button" className="med-row" onClick={() => onOpen(p)}>
                  <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                  <span className="grow">
                    <strong>{playerName(p)}</strong>
                    <span className={`fit-bar ${p.fitness < TIRED ? 'low' : p.fitness < 90 ? 'mid' : ''}`}><i style={{ width: `${p.fitness}%` }} /></span>
                  </span>
                  <span className="med-fit">
                    <b className={p.fitness < TIRED ? 'warn' : undefined}>{Math.round(p.fitness)}%</b>
                    <small className="muted">{days ? `${days} day${days === 1 ? '' : 's'} to full` : 'Fully fit'}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-label"><span>Injuries this season</span><span>{log.length}</span></div>
        {log.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <ul className="med-list">
            {log.map((r, i) => (
              <li key={i} className="med-log">
                <span className="grow">
                  <strong>{r.name}</strong>
                  <small className="block muted">{r.injury} · {r.where} · {formatDate(dateIn(r.season, r.week, r.day))}</small>
                </span>
                <span className="muted small">{r.weeks}w</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
