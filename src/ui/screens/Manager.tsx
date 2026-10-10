import { useState } from 'react';
import { careerOf, spellTrophies } from '../../engine/club/career';
import { bestXI, careerBlurb, jobOffers, managerOf, preferredTactic, teamTrophies } from '../../engine/club/manager';
import { divisionTable } from '../../engine/season/table';
import type { ManagerDeal } from '../../engine/types';
import { divisionOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { hp } from '../help';
import { money, ordinal, seasonLabel } from '../format';

type Tab = 'profile' | 'trophies' | 'offers';

const TROPHY_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z M12 14 V18 M8 20 H16 M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11" />
  </svg>
);

/** The manager: career record, trophy room and job offers. */
export function Manager() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const accept = useGame((s) => s.acceptJobOffer);
  const decline = useGame((s) => s.declineJobOffer);
  const offers = jobOffers(game);
  const [tab, setTab] = useState<Tab>(offers.length ? 'offers' : 'profile');
  const [confirm, setConfirm] = useState<string | null>(null);

  const m = managerOf(game);
  const spells = careerOf(game);
  const trophies = teamTrophies(game);
  const { formation, mentality } = preferredTactic(m);
  const winRate = m.games ? Math.round((m.won / m.games) * 100) : 0;
  const deal = (label: string, d: ManagerDeal | undefined, help?: Parameters<typeof hp>[0]) =>
    d && (
      <div className="po-row" {...(help ? hp(help) : {})}>
        <span className="grow">{label}<small className="block muted">{d.name} · {d.clubName}, {seasonLabel(d.season)}</small></span>
        <strong>{money(d.fee)}</strong>
      </div>
    );

  return (
    <main className="screen manager">
      <header className="screen-head">
        <div className="eyebrow">The manager</div>
        <h1>Your career</h1>
      </header>

      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>Profile</button>
        <button type="button" role="tab" aria-selected={tab === 'trophies'} onClick={() => setTab('trophies')}>Trophy room</button>
        <button type="button" role="tab" aria-selected={tab === 'offers'} onClick={() => setTab('offers')}>Job offers{offers.length ? ` (${offers.length})` : ''}</button>
      </div>

      {tab === 'profile' && (
        <>
          <section className="card">
            <p className="blurb">{careerBlurb(game)}</p>
          </section>

          <section className="card" {...hp('managerRecord')}>
            <div className="card-label"><span>Record</span><span>{winRate}% won</span></div>
            <div className="stat-grid">
              <div><small>Games</small><strong>{m.games}</strong></div>
              <div><small>Won</small><strong>{m.won}</strong></div>
              <div><small>Drawn</small><strong>{m.drawn}</strong></div>
              <div><small>Lost</small><strong>{m.lost}</strong></div>
              <div><small>Goals for</small><strong>{m.goalsFor}</strong></div>
              <div><small>Goals against</small><strong>{m.goalsAgainst}</strong></div>
            </div>
            {formation && (
              <p className="muted small" {...hp('preferredTactic')}>
                Preferred tactic: <strong>{formation}</strong>, {mentality}. Used in {m.formations[formation]} of {m.games} games.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-label"><span>Transfers</span><span>{m.signings} signed</span></div>
            <div className="ledger">
              <div {...hp('feesOut')}><span>Transfer fees out</span><b>{money(m.feesOut)}</b></div>
              <div {...hp('feesIn')}><span>Transfer fees in</span><b>{money(m.feesIn)}</b></div>
              <div><span>Net</span><b className={m.feesIn - m.feesOut >= 0 ? 'good' : 'warn'}>{m.feesIn - m.feesOut >= 0 ? '+' : '−'}{money(Math.abs(m.feesIn - m.feesOut))}</b></div>
              <div><span>Free transfers</span><b>{m.freeSignings}</b></div>
            </div>
            {deal('Highest fee paid', m.biggestSigning, 'biggestSigning')}
            {deal('Lowest fee paid', m.cheapestSigning, 'cheapestSigning')}
            {deal('Highest fee received', m.biggestSale)}
            {!m.biggestSigning && !m.biggestSale && <p className="muted small">No fees paid or received yet.</p>}
          </section>

          <section className="card" {...hp('bestXI')}>
            <div className="card-label"><span>Best XI</span><span>4-4-2</span></div>
            {(() => {
              const xi = bestXI(game);
              if (!xi.length) return <p className="muted small">Players who've played 10 games for you make the team.</p>;
              return (
                <ul className="best-xi">
                  {xi.map((p) => (
                    <li key={p.id}>
                      <span className="pos">{p.slot}</span>
                      <span className="grow">{p.name}<small className="block muted">{p.clubName} · {p.apps} games{p.goals ? ` · ${p.goals} goals` : ''}</small></span>
                      <b>{p.peak}</b>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>

          <section className="card">
            <div className="card-label"><span>Clubs managed</span><span>{new Set(spells.map((s) => s.clubId)).size}</span></div>
            {[...spells].reverse().map((s, i) => {
              const won = spellTrophies(game, s);
              const club = game.clubs[s.clubId];
              return (
                <div key={i} className="po-row">
                  {club && <ClubDot colours={club.colours} size={14} />}
                  <span className="grow">
                    {s.clubName}
                    <small className="block muted">
                      {seasonLabel(s.from)}{s.to && s.to !== s.from ? ` to ${seasonLabel(s.to)}` : s.to ? '' : ' to now'}
                      {won.length ? ` · ${won.length} troph${won.length === 1 ? 'y' : 'ies'}` : ''}
                    </small>
                  </span>
                  <strong className="muted small">{s.left === 'sacked' ? 'Sacked' : s.left === 'moved' ? 'Moved on' : s.to ? 'Left' : 'Current'}</strong>
                </div>
              );
            })}
          </section>
        </>
      )}

      {tab === 'trophies' && (
        <>
          <section className="card">
            <div className="card-label"><span>Team trophies</span><span>{trophies.length}</span></div>
            {trophies.length === 0 ? (
              <p className="muted small">Win a league or a cup and it goes here, with the club you won it with.</p>
            ) : (
              <ul className="trophies">
                {[...trophies].reverse().map((t, i) => (
                  <li key={i}>
                    {TROPHY_ICON}
                    <span className="grow"><strong>{t.name}</strong><small>{t.clubName} · {seasonLabel(t.season)}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(['manager', 'player'] as const).map((kind) => {
            const list = m.honours.filter((h) => h.kind === kind);
            return (
              <section key={kind} className="card">
                <div className="card-label"><span>{kind === 'manager' ? 'Manager awards' : "Your players' awards"}</span><span>{list.length}</span></div>
                {list.length === 0 ? (
                  <p className="muted small">
                    {kind === 'manager' ? 'Manager of the Month, and Manager of the Season for winning the league.' : 'Player of the Month and Season, Golden Boot, Golden Glove, Team of the Season, Ballon d\'Or and more, won by players you managed.'}
                  </p>
                ) : (
                  <ul className="trophies awards-list">
                    {[...list].reverse().map((h, i) => (
                      <li key={i}>
                        <span className="medal" aria-hidden="true">{kind === 'manager' ? '★' : '●'}</span>
                        <span className="grow">
                          <strong>{h.name}</strong>
                          <small>{h.who ? `${h.who} · ` : ''}{h.clubName} · {seasonLabel(h.season)}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      {tab === 'offers' && (
        <section className="card">
          <div className="card-label"><span>Job offers</span><span>{offers.length}</span></div>
          {offers.length === 0 ? (
            <p className="muted small">
              No one has been in touch. Do well (beat the board's target, win trophies) and bigger clubs come calling. Offers stay open for four weeks.
            </p>
          ) : (
            offers.map((o) => {
              const club = game.clubs[o.clubId];
              const d = divisionOf(game, club.id);
              const table = divisionTable(game, d.def.id);
              const pos = table.findIndex((r) => r.clubId === club.id) + 1;
              const weeksLeft = o.expires - (game.season * 100 + game.week);
              return (
                <div key={o.clubId} className="offer-card">
                  <div className="po-row">
                    <ClubDot colours={club.colours} size={22} />
                    <span className="grow">
                      <strong>{club.name}</strong>
                      <small className="block muted">
                        {d.def.name}{table.some((r) => r.played > 0) ? ` · ${ordinal(pos)}` : ''} · capacity {club.capacity.toLocaleString('en-GB')} · open {weeksLeft} more week{weeksLeft === 1 ? '' : 's'}
                      </small>
                    </span>
                  </div>
                  {confirm === o.clubId ? (
                    <div className="stack">
                      <p className="note bad"><span aria-hidden="true">▼</span>You'll leave {game.clubs[game.userClubId].name} straight away and take over {club.name}'s squad, ground and finances.</p>
                      <div className="grid-2">
                        <button type="button" className="btn primary" onClick={() => accept(o.clubId)}>Take the job</button>
                        <button type="button" className="btn secondary" onClick={() => setConfirm(null)}>Not yet</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid-2">
                      <button type="button" className="btn primary" onClick={() => setConfirm(o.clubId)}>Accept</button>
                      <button type="button" className="btn secondary" onClick={() => decline(o.clubId)}>Turn down</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}
    </main>
  );
}
