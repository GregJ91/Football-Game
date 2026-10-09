import { useState } from 'react';
import { EURO_COMPS, EURO_SLOTS, euroDef } from '../../data/europe';
import { dateIn, formatDate } from '../../engine/calendar';
import { aggregate, leagueTable, nationOf, STAGE_NAMES } from '../../engine/season/europe';
import type { CupState, CupTie, DivisionDef, GameState } from '../../engine/types';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { LeagueTable } from '../components/LeagueTable';
import { LeagueTabs } from '../components/LeagueTabs';
import { ordinal, seasonLabel } from '../format';

/** League-phase zones: top 8 into the round of 16, 9th–24th into the knockout play-off. */
const LEAGUE_PHASE: DivisionDef = { id: 'euro', name: 'League phase', level: 0, size: 36, rounds: 1, promotion: { auto: 8, playoff: [9, 24] }, relegation: 0, quality: 0 };

function involves(t: CupTie, id: string) {
  return t.homeId === id || t.awayId === id;
}

function scoreLine(game: GameState, t: CupTie) {
  const r = t.result!;
  const agg = aggregate(game, t);
  return `${r.homeGoals}–${r.awayGoals}${agg ? ` (agg ${agg.home}–${agg.away})` : ''}${r.penalties ? ` p${r.penalties.home}–${r.penalties.away}` : ''}`;
}

/** Where the user stands in a competition. */
function userStatus(game: GameState, comp: CupState): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  const user = game.userClubId;
  const def = euroDef(comp.id);
  const ties = comp.rounds.flatMap((r) => r.ties).filter((t) => involves(t, user));
  if (!ties.length && !comp.league?.includes(user)) return null;
  if (comp.winnerId === user) return { text: `${def.name} winners!`, tone: 'good' };
  const next = ties.find((t) => !t.result);
  if (next) {
    const round = comp.rounds[next.round];
    const opp = game.clubs[next.homeId === user ? next.awayId : next.homeId];
    const where = next.neutral ? 'neutral ground' : next.homeId === user ? 'home' : 'away';
    return { text: `${round.name}: ${opp.name} (${nationOf(game, opp.id)}, ${where}), ${formatDate(dateIn(game.season, round.week, round.day))}.`, tone: 'neutral' };
  }
  const lost = ties.find((t) => t.winnerId && t.winnerId !== user && t.leg !== 1);
  if (lost) {
    const opp = game.clubs[lost.homeId === user ? lost.awayId : lost.homeId];
    const stage = comp.rounds[lost.round].stage!;
    const drop = stage === 'playoff' && def.dropTo ? ` Into the ${euroDef(def.dropTo).name}.` : '';
    return { text: `Out in the ${STAGE_NAMES[stage].toLowerCase()} to ${opp.name}.${drop}`, tone: 'bad' };
  }
  const table = comp.league ? leagueTable(comp) : [];
  const pos = table.findIndex((r) => r.clubId === user) + 1;
  const leagueDone = comp.rounds.filter((r) => r.stage === 'league').every((r) => r.played);
  if (leagueDone && pos > 24) return { text: `Finished ${ordinal(pos)} in the league phase: out.`, tone: 'bad' };
  return { text: 'Through. Waiting for the next draw.', tone: 'good' };
}

export function Europe() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const eu = game.europe;
  const user = game.userClubId;
  const mineId = eu?.comps.find((c) => c.league?.includes(user) || c.rounds.some((r) => r.ties.some((t) => involves(t, user))))?.id;
  const [compId, setCompId] = useState(mineId ?? 'ucl');

  if (!eu || !eu.comps.length) {
    return (
      <main className="screen europe">
        <header className="screen-head">
          <h1>League</h1>
          <LeagueTabs />
        </header>
        <section className="card"><p className="muted">European competition starts next season.</p></section>
      </main>
    );
  }

  const comp = eu.comps.find((c) => c.id === compId) ?? eu.comps[0];
  const def = euroDef(comp.id);
  const status = userStatus(game, comp);
  const winner = comp.winnerId ? game.clubs[comp.winnerId] : null;
  const latestKo = [...comp.rounds].reverse().find((r) => r.played && r.stage !== 'league' && r.ties.length);
  const upcoming = comp.rounds.find((r) => r.drawn && !r.played && r.ties.length);
  const homeClubs = eu.entries.filter((e) => e.compId === comp.id);
  const topName = game.divisions.find((d) => d.def.level === 1)!.def.name;
  const slots = EURO_SLOTS[game.country];
  const leagueSlots = slots.filter((s) => s.league).length;

  return (
    <main className="screen europe">
      <header className="screen-head">
        <h1>League</h1>
        <LeagueTabs />
      </header>

      <div className="segmented" role="tablist" aria-label="Competition">
        {EURO_COMPS.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === comp.id} onClick={() => setCompId(d.id)}>
            {d.short}{d.id === mineId ? ' •' : ''}
          </button>
        ))}
      </div>

      <section className="card cup-card">
        <div className="cup-head">
          <strong>{def.name}</strong>
          {winner && <span className="cup-winner"><ClubDot colours={winner.colours} size={12} /> {winner.name}</span>}
        </div>
        {status ? (
          <p className={`note ${status.tone}`}><span aria-hidden="true">{status.tone === 'good' ? '▲' : status.tone === 'bad' ? '▼' : '•'}</span>{status.text}</p>
        ) : !mineId ? (
          <p className="muted small">
            We're not in Europe this season. Finish in the top {leagueSlots} of the {topName}, or win a cup that carries a European place, to qualify.
          </p>
        ) : null}
        {upcoming && !winner && (
          <p className="muted small">Next: {upcoming.name} on {formatDate(dateIn(game.season, upcoming.week, upcoming.day))}</p>
        )}
        {homeClubs.length > 0 && (
          <p className="muted small">
            {game.country === 'eng' ? 'English' : 'Scottish'} entrants: {homeClubs.map((e) => `${game.clubs[e.clubId].name}${e.playoff ? ' (play-off)' : ''}`).join(', ')}
          </p>
        )}
      </section>

      {latestKo && (
        <section className="card">
          <div className="card-label"><span>{latestKo.name}</span></div>
          <ul className="cup-results">
            {[...latestKo.ties].sort((a, b) => Number(involves(b, user)) - Number(involves(a, user))).map((t) => (
              <li key={t.id} className={involves(t, user) ? 'mine' : ''}>
                <span className={t.winnerId === t.homeId ? 'won' : ''}>{game.clubs[t.homeId].name}</span>
                <b>{scoreLine(game, t)}</b>
                <span className={t.winnerId === t.awayId ? 'won' : ''}>{game.clubs[t.awayId].name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming && upcoming.stage !== 'league' && (
        <section className="card">
          <div className="card-label"><span>{upcoming.name}</span></div>
          <ul className="cup-results">
            {upcoming.ties.map((t) => (
              <li key={t.id} className={involves(t, user) ? 'mine' : ''}>
                <span>{game.clubs[t.homeId].name} <small className="muted">{nationOf(game, t.homeId)}</small></span>
                <b>v</b>
                <span><small className="muted">{nationOf(game, t.awayId)}</small> {game.clubs[t.awayId].name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comp.league ? (
        <>
          <section className="card flush">
            <LeagueTable game={game} def={LEAGUE_PHASE} rows={leagueTable(comp)} tag={(id) => nationOf(game, id)} />
          </section>
          <div className="table-key">
            <span><i className="zone-auto" /> Round of 16</span>
            <span><i className="zone-playoff" /> Knockout play-off</span>
          </div>
        </>
      ) : (
        <section className="card"><p className="muted small">The league-phase draw is made after the play-off round.</p></section>
      )}

      {eu.winners.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Past winners</span></div>
          {[...eu.winners].reverse().filter((w) => w.compId === comp.id).slice(0, 10).map((w) => {
            const c = game.clubs[w.clubId];
            return (
              <div key={w.season} className="po-row">
                <span>{seasonLabel(w.season)}</span>
                <span className="grow">{c.name} <small className="muted">{nationOf(game, c.id)}</small></span>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
