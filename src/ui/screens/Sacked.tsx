import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { Crest } from '../components/ClubArt';
import { ordinal, seasonLabel } from '../format';

/** Career over: the board has sacked you. A look back, then a fresh start. */
export function Sacked() {
  const game = useGame((s) => s.game)!;
  const go = useGame((s) => s.go);
  const club = userClub(game);
  const sacked = game.sacked!;
  const history = club.history;
  const trophies = club.trophies ?? [];
  const best = history.reduce<(typeof history)[number] | null>((b, h) => {
    if (!b) return h;
    const lb = game.divisions.find((d) => d.def.id === b.divisionId)?.def.level ?? 99;
    const lh = game.divisions.find((d) => d.def.id === h.divisionId)?.def.level ?? 99;
    return lh < lb || (lh === lb && h.position < b.position) ? h : b;
  }, null);
  const divName = (id: string) => game.divisions.find((d) => d.def.id === id)?.def.name ?? id;

  return (
    <main className="screen season-end sacked">
      <section className="hero-card outcome-relegated">
        <Crest colours={club.colours} size={64} />
        <div className="eyebrow">{seasonLabel(sacked.season)} · {divisionOf(game, club.id).def.name}</div>
        <h1>Sacked</h1>
        <p>{sacked.reason} Your time at {club.name} is over.</p>
      </section>

      <section className="card">
        <div className="card-label"><span>Your career</span></div>
        <div className="po-row"><span className="grow">Seasons in charge</span><strong>{history.some((h) => h.season === sacked.season) ? history.length : history.length + 1}</strong></div>
        {best && <div className="po-row"><span className="grow">Best finish</span><strong>{ordinal(best.position)} in the {divName(best.divisionId)}</strong></div>}
        <div className="po-row"><span className="grow">Trophies</span><strong>{trophies.length}</strong></div>
      </section>

      {trophies.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Honours</span></div>
          {trophies.map((t, i) => (
            <div key={i} className="po-row"><span>{seasonLabel(t.season)}</span><span className="grow">{t.name}</span></div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Season by season</span></div>
          {history.map((h) => (
            <div key={h.season} className="po-row">
              <span>{seasonLabel(h.season)}</span>
              <span className="grow">{divName(h.divisionId)}</span>
              <strong>{ordinal(h.position)}{h.outcome === 'promoted' ? ' ▲' : h.outcome === 'relegated' ? ' ▼' : h.outcome === 'champions' ? ' ★' : ''}</strong>
            </div>
          ))}
        </section>
      )}

      <div className="sticky-cta">
        <button type="button" className="btn primary big" onClick={() => go('create')}>
          Start a new career
        </button>
      </div>
    </main>
  );
}
