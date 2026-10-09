import { shortName } from '../../engine/players/generate';
import type { Fixture, GameState } from '../../engine/types';
import { ClubDot } from './ClubArt';

export function MatchCard({ game, fixture }: { game: GameState; fixture: Fixture }) {
  const r = fixture.result;
  if (!r) return null;
  const home = game.clubs[fixture.homeId];
  const away = game.clubs[fixture.awayId];
  const scorers = (side: 'home' | 'away') =>
    r.events
      .filter((e) => e.type === 'goal' && e.side === side)
      .map((e) => {
        const p = game.players[e.playerId];
        return `${p ? shortName(p) : 'Unknown'} ${e.minute}'`;
      });
  const reds = r.events.filter((e) => e.type === 'red');
  return (
    <div className="match-card">
      <div className="score-row">
        <div className="team">
          <ClubDot colours={home.colours} size={22} />
          <span>{home.name}</span>
        </div>
        <div className="score">
          {r.homeGoals} – {r.awayGoals}
        </div>
        <div className="team right">
          <ClubDot colours={away.colours} size={22} />
          <span>{away.name}</span>
        </div>
      </div>
      {r.penalties && (
        <div className="pens">
          {r.penalties.home} – {r.penalties.away} on penalties
        </div>
      )}
      <div className="scorers">
        <ul>{scorers('home').map((s, i) => <li key={i}>{s}</li>)}</ul>
        <ul className="right">{scorers('away').map((s, i) => <li key={i}>{s}</li>)}</ul>
      </div>
      <div className="match-stats">
        <span>Possession {r.possessionHome}% – {100 - r.possessionHome}%</span>
        <span>Shots {r.shotsHome} – {r.shotsAway}</span>
        <span>Att. {r.attendance.toLocaleString('en-GB')}</span>
      </div>
      {reds.length > 0 && (
        <div className="reds">
          Sent off: {reds.map((e) => (game.players[e.playerId] ? shortName(game.players[e.playerId]) : '?')).join(', ')}
        </div>
      )}
    </div>
  );
}
