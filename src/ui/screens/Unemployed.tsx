import { careerOf, spellTrophies } from '../../engine/club/career';
import { buildTable } from '../../engine/season/table';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { ordinal, seasonLabel } from '../format';
import { formatDate, dateOf } from '../../engine/calendar';

/** Sacked and out of work: the world plays on while clubs come calling. */
export function Unemployed() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const busy = useGame((s) => s.busy);
  const go = useGame((s) => s.go);
  const waitAWeek = useGame((s) => s.waitAWeek);
  const waitForOffer = useGame((s) => s.waitForOffer);
  const takeJob = useGame((s) => s.takeJob);
  const u = game.unemployed!;
  const career = careerOf(game);

  const standing = (clubId: string) => {
    const d = divisionOf(game, clubId);
    const table = buildTable(d.clubIds, game.fixtures.filter((f) => f.divisionId === d.def.id));
    const pos = table.findIndex((r) => r.clubId === clubId) + 1;
    return { name: d.def.name, pos: table.some((r) => r.played > 0) ? ordinal(pos) : null };
  };

  return (
    <main className="screen season-end unemployed">
      <section className="hero-card outcome-relegated">
        <div className="eyebrow">{formatDate(dateOf(game), true)}</div>
        <h1>Out of work</h1>
        <p>{u.reason} {game.clubs[u.fromClubId].name} sacked you in {seasonLabel(u.season)}.</p>
      </section>

      <section className="card">
        <div className="card-label"><span>Job offers</span><span>{u.offers.length}</span></div>
        {u.offers.length === 0 ? (
          <p className="muted small">Nobody has been in touch yet. Clubs that are struggling look for a new manager as the weeks go by.</p>
        ) : (
          u.offers.map((o) => {
            const club = game.clubs[o.clubId];
            const st = standing(club.id);
            const weeksLeft = o.expires - (game.season * 100 + game.week);
            return (
              <div key={o.clubId} className="offer-row">
                <ClubDot colours={club.colours} size={22} />
                <span className="grow">
                  <strong>{club.name}</strong>
                  <small className="block muted">
                    {st.name}{st.pos ? ` · ${st.pos}` : ''} · offer open {weeksLeft} more week{weeksLeft === 1 ? '' : 's'}
                  </small>
                </span>
                <button type="button" className="btn primary" disabled={busy} onClick={() => takeJob(club.id)}>
                  Accept
                </button>
              </div>
            );
          })
        )}
        <div className="grid-2">
          <button type="button" className="btn secondary" disabled={busy} onClick={() => void waitAWeek()}>
            Wait a week
          </button>
          <button type="button" className="btn secondary" disabled={busy || u.offers.length > 0} onClick={() => void waitForOffer()}>
            Wait for an offer
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-label"><span>Your career</span></div>
        {career.map((s, i) => {
          const trophies = spellTrophies(game, s);
          return (
            <div key={i} className="po-row">
              <span className="grow">
                {s.clubName}
                <small className="block muted">{seasonLabel(s.from)}{s.to && s.to !== s.from ? ` to ${seasonLabel(s.to)}` : ''}</small>
                {trophies.length > 0 && <small className="block muted">{trophies.map((t) => `${t.name} ${seasonLabel(t.season)}`).join(', ')}</small>}
              </span>
              <strong>{s.left === 'sacked' ? 'Sacked' : s.to ? 'Left' : ''}</strong>
            </div>
          );
        })}
      </section>

      <button type="button" className="link-btn center" onClick={() => go('create')}>
        Give up and start a new career
      </button>
    </main>
  );
}
