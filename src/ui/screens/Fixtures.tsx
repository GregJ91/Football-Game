import { useState } from 'react';
import { fixtureDate, formatDate } from '../../engine/calendar';
import type { Fixture } from '../../engine/types';
import { userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { LeagueTabs } from '../components/LeagueTabs';
import { MatchCard } from '../components/MatchCard';

export function Fixtures() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const [open, setOpen] = useState<Fixture | null>(null);
  const club = userClub(game);
  const fixtures = game.fixtures
    .filter((f) => f.homeId === club.id || f.awayId === club.id)
    .sort((a, b) => a.week - b.week);

  return (
    <main className="screen fixtures">
      <header className="screen-head">
        <h1>League</h1>
        <LeagueTabs />
      </header>
      <ul className="fixture-list">
        {fixtures.map((f) => {
          const home = f.homeId === club.id;
          const opp = game.clubs[home ? f.awayId : f.homeId];
          const r = f.result;
          let outcome = '';
          if (r) {
            const us = home ? r.homeGoals : r.awayGoals;
            const them = home ? r.awayGoals : r.homeGoals;
            outcome = us > them ? 'W' : us < them ? 'L' : 'D';
          }
          return (
            <li key={f.id}>
              <button type="button" className="fixture-row" disabled={!r} onClick={() => setOpen(f)}>
                <span className="wk">{formatDate(fixtureDate(game, f.week)).replace(/^\w+ /, '')}</span>
                <span className="ha">{home ? 'H' : 'A'}</span>
                <ClubDot colours={opp.colours} size={12} />
                <span className="opp">{opp.name}</span>
                {r ? (
                  <span className={`res res-${outcome}`}>
                    {outcome} {home ? r.homeGoals : r.awayGoals}–{home ? r.awayGoals : r.homeGoals}
                  </span>
                ) : (
                  <span className="res">–</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Match report" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">{formatDate(fixtureDate(game, open.week), true)}</strong>
              <button type="button" className="link-btn" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
            <MatchCard game={game} fixture={open} />
          </div>
        </div>
      )}
    </main>
  );
}
