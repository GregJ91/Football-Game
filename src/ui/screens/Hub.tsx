import { useMemo } from 'react';
import { buildTable } from '../../engine/season/table';
import { divisionOf, userClub } from '../../engine/world';
import { lastUserFixture, nextUserFixture, useGame } from '../../state/store';
import { ClubDot, Crest } from '../components/ClubArt';
import { LeagueTable } from '../components/LeagueTable';
import { MatchCard } from '../components/MatchCard';
import { money, ordinal, seasonLabel } from '../format';

export function Hub() {
  const game = useGame((s) => s.game)!;
  const rev = useGame((s) => s.rev);
  const busy = useGame((s) => s.busy);
  const openPreMatch = useGame((s) => s.openPreMatch);
  const simNextMatch = useGame((s) => s.simNextMatch);
  const simToSeasonEnd = useGame((s) => s.simToSeasonEnd);
  const go = useGame((s) => s.go);

  const club = userClub(game);
  const division = divisionOf(game, club.id);
  // The engine mutates `game` in place, so `rev` is what signals a change.
  const table = useMemo(() => buildTable(division.clubIds, game.fixtures.filter((f) => f.divisionId === division.def.id)), [rev, division]);
  const started = table.some((r) => r.played > 0);
  const pos = started ? table.findIndex((r) => r.clubId === club.id) + 1 : 0;
  const next = nextUserFixture(game);
  const last = lastUserFixture(game);
  const opponent = next ? game.clubs[next.homeId === club.id ? next.awayId : next.homeId] : null;
  const isHome = next?.homeId === club.id;
  const oppPos = opponent && started ? table.findIndex((r) => r.clubId === opponent.id) + 1 : 0;
  const ourFixtures = game.fixtures.filter((f) => f.homeId === club.id || f.awayId === club.id);
  const matchday = Math.min(ourFixtures.filter((f) => f.result).length + 1, ourFixtures.length);

  const form = (clubId: string) =>
    game.fixtures
      .filter((f) => f.result && (f.homeId === clubId || f.awayId === clubId))
      .sort((a, b) => b.week - a.week)
      .slice(0, 5)
      .reverse()
      .map((f) => {
        const us = f.homeId === clubId ? f.result!.homeGoals : f.result!.awayGoals;
        const them = f.homeId === clubId ? f.result!.awayGoals : f.result!.homeGoals;
        return us > them ? 'W' : us < them ? 'L' : 'D';
      })
      .join('');

  return (
    <main className="screen hub">
      <header className="club-head">
        <Crest colours={club.colours} size={40} />
        <div className="grow">
          <div className="club-title">{club.name}</div>
          <div className="sub">
            {seasonLabel(game.season)} · Game {matchday} of {ourFixtures.length} · {division.def.name}
          </div>
        </div>
        <div className="bank">
          <strong>{money(club.balance)}</strong>
          <span>Bank</span>
        </div>
      </header>

      {next && opponent ? (
        <section className="card fixture">
          <div className="card-label">
            <span>Next match · League</span>
            <span>{isHome ? 'Home' : 'Away'}</span>
          </div>
          <div className="versus">
            <div className="side">
              <ClubDot colours={club.colours} size={34} />
              <strong>{club.name}</strong>
              <span>{pos ? ordinal(pos) : '–'} · {form(club.id) || 'No games yet'}</span>
            </div>
            <div className="vs">VS</div>
            <div className="side">
              <ClubDot colours={opponent.colours} size={34} />
              <strong>{opponent.name}</strong>
              <span>{oppPos ? ordinal(oppPos) : '–'} · {form(opponent.id) || 'No games yet'}</span>
            </div>
          </div>
          <div className="grid-2">
            <button type="button" className="btn primary" disabled={busy} onClick={openPreMatch}>
              Play match
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => void simNextMatch()}>
              {busy ? 'Simming…' : 'Sim match'}
            </button>
          </div>
          <button type="button" className="link-btn center" disabled={busy} onClick={() => void simToSeasonEnd()}>
            Sim to the end of the season
          </button>
        </section>
      ) : (
        <section className="card">
          <p>No more league fixtures this season.</p>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void simToSeasonEnd()}>
            Finish the season
          </button>
        </section>
      )}

      {last && (
        <section className="card">
          <div className="card-label">
            <span>Last result</span>
          </div>
          <MatchCard game={game} fixture={last} />
        </section>
      )}

      <section className="card">
        <div className="card-label">
          <span>{division.def.name}</span>
          <button type="button" className="link-btn" onClick={() => go('league')}>
            Full table →
          </button>
        </div>
        <LeagueTable game={game} def={division.def} rows={table} around={2} />
      </section>
    </main>
  );
}
