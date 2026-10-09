import { cupDef } from '../../data/cups';
import { dateIn, formatDate } from '../../engine/calendar';
import type { CupState, CupTie } from '../../engine/types';
import { divisionOf } from '../../engine/world';
import { inRound } from '../../engine/season/cups';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { LeagueTabs } from '../components/LeagueTabs';

function scoreLine(t: CupTie) {
  const r = t.result!;
  return `${r.homeGoals}–${r.awayGoals}${r.penalties ? ` (${r.penalties.home}–${r.penalties.away} pens)` : ''}`;
}

export function Cups() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const user = game.userClubId;
  const userLevel = divisionOf(game, user).def.level;

  const status = (cup: CupState): { text: string; tone: 'good' | 'bad' | 'neutral' } => {
    const def = cupDef(game.country, cup.id);
    const mine = cup.rounds.flatMap((r) => r.ties).filter((t) => t.homeId === user || t.awayId === user);
    const lost = mine.find((t) => t.winnerId && t.winnerId !== user);
    if (cup.winnerId === user) return { text: 'Winners!', tone: 'good' };
    if (lost) {
      const opp = game.clubs[lost.homeId === user ? lost.awayId : lost.homeId];
      return { text: `Knocked out ${inRound(cup.rounds[lost.round].name)} by ${opp.name}.`, tone: 'bad' };
    }
    const next = mine.find((t) => !t.result);
    if (next) {
      const opp = game.clubs[next.homeId === user ? next.awayId : next.homeId];
      const round = cup.rounds[next.round];
      const where = next.neutral ? 'neutral ground' : next.homeId === user ? 'home' : 'away';
      return { text: `${round.name}: ${opp.name} (${where}), ${formatDate(dateIn(game.season, round.week, round.day))}.`, tone: 'neutral' };
    }
    if (def.showpiece) {
      const tie = cup.rounds[0]?.ties[0];
      if (!tie) return { text: 'Not played this season.', tone: 'neutral' };
      const [a, b] = [game.clubs[tie.homeId].name, game.clubs[tie.awayId].name];
      if (cup.winnerId) return { text: `${game.clubs[cup.winnerId].name} won it.`, tone: 'neutral' };
      return { text: `${a} v ${b} at a neutral ground, ${formatDate(dateIn(game.season, cup.rounds[0].week, cup.rounds[0].day))}.`, tone: 'neutral' };
    }
    const entered = def.entries[userLevel] !== undefined;
    if (!entered) return { text: 'Not entered: this cup is for clubs at other levels.', tone: 'neutral' };
    if (cup.winnerId) return { text: 'Finished.', tone: 'neutral' };
    return { text: 'Through. Waiting for the next draw.', tone: 'good' };
  };

  return (
    <main className="screen cups">
      <header className="screen-head">
        <h1>League</h1>
        <LeagueTabs />
      </header>
      {(game.cups ?? []).map((cup) => {
        const def = cupDef(game.country, cup.id);
        const st = status(cup);
        const latest = [...cup.rounds].reverse().find((r) => r.played);
        const upcoming = cup.rounds.find((r) => r.drawn && !r.played);
        const winner = cup.winnerId ? game.clubs[cup.winnerId] : null;
        const shown = latest ? [...latest.ties].sort((a, b) => Number(b.homeId === user || b.awayId === user) - Number(a.homeId === user || a.awayId === user)).slice(0, 6) : [];
        return (
          <section key={cup.id} className="card cup-card">
            <div className="cup-head">
              <strong>{def.name}</strong>
              {winner && (
                <span className="cup-winner"><ClubDot colours={winner.colours} size={12} /> {winner.name}</span>
              )}
            </div>
            <p className={`note ${st.tone}`}><span aria-hidden="true">{st.tone === 'good' ? '▲' : st.tone === 'bad' ? '▼' : '•'}</span>{st.text}</p>
            {upcoming && !winner && (
              <p className="muted small">
                Next round: {upcoming.name} on {formatDate(dateIn(game.season, upcoming.week, upcoming.day))} · {upcoming.ties.length} ties
              </p>
            )}
            {latest && (
              <>
                <div className="card-label"><span>{latest.name} results</span></div>
                <ul className="cup-results">
                  {shown.map((t) => (
                    <li key={t.id} className={t.homeId === user || t.awayId === user ? 'mine' : ''}>
                      <span className={t.winnerId === t.homeId ? 'won' : ''}>{game.clubs[t.homeId].name}</span>
                      <b>{scoreLine(t)}</b>
                      <span className={t.winnerId === t.awayId ? 'won' : ''}>{game.clubs[t.awayId].name}</span>
                    </li>
                  ))}
                </ul>
                {latest.ties.length > shown.length && <p className="muted small">and {latest.ties.length - shown.length} more ties</p>}
              </>
            )}
          </section>
        );
      })}
    </main>
  );
}
