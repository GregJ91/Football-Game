import type { DivisionDef, GameState, TableRow } from '../../engine/types';
import { ClubDot } from './ClubArt';

type Zone = 'auto' | 'playoff' | 'relegation' | null;

function zoneFor(def: DivisionDef, pos: number, size: number): Zone {
  if (def.promotion) {
    if (pos <= def.promotion.auto) return 'auto';
    const po = def.promotion.playoff;
    if (po && pos >= po[0] && pos <= po[1]) return 'playoff';
  } else if (pos === 1) return 'auto';
  if (def.relegation && pos > size - def.relegation) return 'relegation';
  return null;
}

interface Props {
  game: GameState;
  def: DivisionDef;
  rows: TableRow[];
  /** Show only rows within this many places of the user's club. */
  around?: number;
  /** A short tag after a club's name (e.g. its country). */
  tag?: (clubId: string) => string;
}

export function LeagueTable({ game, def, rows, around, tag }: Props) {
  const userIdx = rows.findIndex((r) => r.clubId === game.userClubId);
  let shown = rows.map((r, i) => ({ r, pos: i + 1 }));
  if (around !== undefined && userIdx >= 0) {
    const start = Math.max(0, Math.min(userIdx - around, rows.length - (around * 2 + 1)));
    shown = shown.slice(start, start + around * 2 + 1);
  }
  return (
    <table className="league-table">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>Club</th>
          <th className="num">P</th>
          {around === undefined && (
            <>
              <th className="num wide">W</th>
              <th className="num wide">D</th>
              <th className="num wide">L</th>
            </>
          )}
          <th className="num">GD</th>
          <th className="num">Pts</th>
        </tr>
      </thead>
      <tbody>
        {shown.map(({ r, pos }) => {
          const club = game.clubs[r.clubId];
          const zone = zoneFor(def, pos, rows.length);
          return (
            <tr key={r.clubId} className={r.clubId === game.userClubId ? 'is-user' : undefined}>
              <td className={`num zone-${zone ?? 'none'}`}>{pos}</td>
              <td className="club-cell">
                <ClubDot colours={club.colours} size={12} />
                <span>{club.name}</span>
                {tag && <small className="tag">{tag(r.clubId)}</small>}
              </td>
              <td className="num">{r.played}</td>
              {around === undefined && (
                <>
                  <td className="num wide">{r.won}</td>
                  <td className="num wide">{r.drawn}</td>
                  <td className="num wide">{r.lost}</td>
                </>
              )}
              <td className="num">{r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</td>
              <td className="num strong" title={r.deducted ? `${r.deducted} points deducted` : undefined}>{r.points}{r.deducted ? <sup className="warn">−{r.deducted}</sup> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TableKey({ def }: { def: DivisionDef }) {
  return (
    <div className="table-key">
      <span><i className="zone-auto" /> {def.promotion ? 'Promotion' : 'Champions'}</span>
      {def.promotion?.playoff && <span><i className="zone-playoff" /> Play-offs</span>}
      {def.relegation > 0 && <span><i className="zone-relegation" /> Relegation</span>}
    </div>
  );
}
