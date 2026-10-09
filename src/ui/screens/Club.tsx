import { useState } from 'react';
import { boardOf, loanOptions } from '../../engine/club/chairman';
import { FACILITY_INFO, MAX_FACILITY, facilitiesOf, facilityBusy, facilityUpgrade, facilityUpkeep, totalUpkeep } from '../../engine/club/facilities';
import {
  floodlightOption, nextLevelGrading, stadiumBusy, stadiumOf, standOptions, totalCapacity, totalSeats, type WorkOption,
} from '../../engine/club/stadium';
import { crowdFill, guideTicketPrice, ledgerOf, moneyPw, ticketPrice, wageBill, weeklyTv } from '../../engine/economy/finance';
import { buildTable } from '../../engine/season/table';
import type { Build, FacilityKind, Stand } from '../../engine/types';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { money, ordinal } from '../format';

type Tab = 'ground' | 'facilities' | 'money' | 'board';
const TABS: { t: Tab; label: string }[] = [
  { t: 'ground', label: 'Ground' },
  { t: 'facilities', label: 'Facilities' },
  { t: 'money', label: 'Money' },
  { t: 'board', label: 'Board' },
];

const STYLE_LABEL = { steady: 'Steady deal', upfront: 'Cash up front', bonus: 'Promotion bonus' } as const;

function buildLabel(b: Build, stands: Stand[]) {
  if (b.kind === 'facility') return `${FACILITY_INFO[b.facility!].name} upgrade`;
  if (b.kind === 'floodlights') return 'Floodlights';
  const stand = stands[b.stand!].name;
  if (b.kind === 'extend') return `${stand}: +${b.size!.toLocaleString('en-GB')} places`;
  if (b.kind === 'seats') return `${stand}: seating`;
  return `${stand}: roof`;
}

export function Club() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const build = useGame((s) => s.buildStadium);
  const upgrade = useGame((s) => s.upgradeFacility);
  const setTicketPrice = useGame((s) => s.setTicketPrice);
  const pickSponsor = useGame((s) => s.pickSponsor);
  const borrow = useGame((s) => s.borrow);
  const repay = useGame((s) => s.repay);
  const showToast = useGame((s) => s.showToast);
  const setUnlimited = useGame((s) => s.setUnlimitedMoney);
  const [tab, setTab] = useState<Tab>('ground');
  const [standSheet, setStandSheet] = useState<number | null>(null);

  const club = userClub(game);
  const stadium = stadiumOf(club);
  const grading = nextLevelGrading(game);
  const busy = stadiumBusy(club);
  const facilities = facilitiesOf(club);
  const board = boardOf(club);
  const ledger = ledgerOf(club);
  const div = divisionOf(game, club.id);
  const price = ticketPrice(game, club);
  const guide = guideTicketPrice(game, club);
  const expectedCrowd = Math.min(club.capacity, Math.round(club.capacity * crowdFill(game, club)));

  const act = (err: string | null, ok: string) => showToast(err ?? ok);
  const start = (opt: WorkOption) => {
    act(build(opt), `Work has started: ${opt.label.toLowerCase()}.`);
    setStandSheet(null);
  };

  // Stand layout around the pitch: Main (west), North, East, South.
  const standButton = (i: number, area: string) => {
    const s = stadium.stands[i];
    const work = stadium.builds.find((b) => b.stand === i);
    return (
      <button type="button" className={`stand stand-${area} ${work ? 'building' : ''}`} onClick={() => setStandSheet(i)}>
        <strong>{s.name}</strong>
        <span>{s.capacity.toLocaleString('en-GB')}{s.seats ? ` · ${s.seats.toLocaleString('en-GB')} seated` : ' · terrace'}</span>
        {s.roof && <em>Roofed</em>}
        {work && <em className="busy">Building · {work.weeksLeft} wk{work.weeksLeft === 1 ? '' : 's'}</em>}
      </button>
    );
  };

  const table = buildTable(div.clubIds, game.fixtures.filter((f) => f.divisionId === div.def.id));
  const started = table.some((r) => r.played > 0);
  const pos = table.findIndex((r) => r.clubId === club.id) + 1;

  const income = [
    ['Gate receipts', ledger.gate],
    ['TV and prize money', ledger.tv + (ledger.prize ?? 0)],
    ['Sponsorship', ledger.sponsor ?? 0],
    ['Player sales', ledger.transfersIn],
  ] as const;
  const spending = [
    ['Wages', ledger.wages],
    ['Transfer fees', ledger.transfersOut],
    ['Building work', ledger.building ?? 0],
    ['Facility upkeep', ledger.upkeep ?? 0],
    ['Pay-offs', Math.max(0, -ledger.other)],
  ] as const;
  const loanNet = ledger.loan ?? 0;

  return (
    <main className="screen club-screen">
      <header className="screen-head">
        <div className="eyebrow">Chairman's office</div>
        <h1>{club.stadiumName}</h1>
      </header>

      <div className="segmented" role="tablist">
        {TABS.map(({ t, label }) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'ground' && (
        <>
          <section className="ground" aria-label="Stadium">
            {standButton(1, 'north')}
            {standButton(0, 'west')}
            <div className="ground-pitch" aria-hidden="true"><i /></div>
            {standButton(2, 'east')}
            {standButton(3, 'south')}
          </section>

          <div className="stat-row">
            <div><small>Capacity</small><strong>{totalCapacity(stadium).toLocaleString('en-GB')}</strong>{club.capacity < totalCapacity(stadium) && <small>{club.capacity.toLocaleString('en-GB')} during work</small>}</div>
            <div><small>Seats</small><strong>{totalSeats(stadium).toLocaleString('en-GB')}</strong></div>
            <div><small>Floodlights</small><strong>{stadium.floodlights ? 'Yes' : 'No'}</strong></div>
          </div>

          {!stadium.floodlights && !stadium.builds.some((b) => b.kind === 'floodlights') && (() => {
            const opt = floodlightOption(game);
            return (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => start(opt)}>
                Install floodlights · {money(opt.cost)} · {opt.weeks} weeks
              </button>
            );
          })()}

          {stadium.builds.length > 0 && (
            <section className="card">
              <div className="card-label"><span>Under construction</span></div>
              {stadium.builds.map((b, i) => (
                <div key={i} className="progress-row">
                  <span className="grow">{buildLabel(b, stadium.stands)}</span>
                  <span className="track"><i style={{ width: `${((b.totalWeeks - b.weeksLeft) / b.totalWeeks) * 100}%` }} /></span>
                  <small>{b.weeksLeft} wk{b.weeksLeft === 1 ? '' : 's'}</small>
                </div>
              ))}
            </section>
          )}

          {grading && (
            <section className={`card grading ${grading.ok ? 'ok' : 'not-ok'}`}>
              <div className="card-label">
                <span>Ground rules for the level above</span>
                <span>{grading.ok ? 'Passes' : 'Not yet'}</span>
              </div>
              {grading.items.map((it) => (
                <div key={it.label} className="grading-row">
                  <span aria-hidden="true">{it.ok ? '✓' : '✗'}</span>
                  <span className="grow">{it.label}</span>
                  <span>{it.have} / {it.need}</span>
                </div>
              ))}
              {!grading.ok && <p className="muted small">You can't be promoted until the ground passes. Builds must be finished by the end of the season.</p>}
            </section>
          )}
          <p className="hint left">Tap a stand to extend it, add seats or put a roof on. One stadium project at a time.</p>
        </>
      )}

      {tab === 'facilities' && (
        <>
          {(Object.keys(FACILITY_INFO) as FacilityKind[]).map((kind) => {
            const level = facilities[kind];
            const next = level < MAX_FACILITY ? facilityUpgrade(game, level + 1) : null;
            const inProgress = stadium.builds.find((b) => b.kind === 'facility' && b.facility === kind);
            return (
              <section key={kind} className="card facility">
                <div className="facility-head">
                  <strong>{FACILITY_INFO[kind].name}</strong>
                  <span className="pips" aria-label={`Level ${level} of ${MAX_FACILITY}`}>
                    {Array.from({ length: MAX_FACILITY }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
                  </span>
                </div>
                <p className="muted small">{FACILITY_INFO[kind].effect} Running cost {moneyPw(facilityUpkeep(level))}.</p>
                {inProgress ? (
                  <p className="small">Upgrading to level {level + 1}: {inProgress.weeksLeft} weeks to go.</p>
                ) : next ? (
                  <button type="button" className="btn tile" disabled={facilityBusy(club)} onClick={() => act(upgrade(kind), `${FACILITY_INFO[kind].name} upgrade started.`)}>
                    Upgrade to level {level + 1} · {money(next.cost)} · {next.weeks} wks · then {moneyPw(next.upkeep)}
                  </button>
                ) : (
                  <p className="small">Top level.</p>
                )}
              </section>
            );
          })}
          <p className="hint left">One facility upgrade at a time. Total running costs {moneyPw(totalUpkeep(club))}.</p>
        </>
      )}

      {tab === 'money' && (
        <>
          <div className="stat-row">
            <div><small>Bank</small><strong>{money(club.balance)}</strong></div>
            <div><small>Wages</small><strong>{moneyPw(wageBill(game, club))}</strong></div>
            <div><small>TV & sponsors</small><strong>{moneyPw(weeklyTv(game, club) + (club.sponsor?.weekly ?? 0))}</strong></div>
          </div>

          <section className="card">
            <div className="card-label"><span>Ticket price</span><span>Typical at this level £{guide}</span></div>
            <div className="stepper">
              <button type="button" aria-label="Lower ticket price" onClick={() => setTicketPrice(price - 1)}>−</button>
              <label className="visually-hidden" htmlFor="ticket-price">Ticket price</label>
              <input id="ticket-price" inputMode="numeric" value={`£${price}`} onChange={(e) => setTicketPrice(Number(e.target.value.replace(/[^0-9]/g, '')) || 1)} />
              <button type="button" aria-label="Raise ticket price" onClick={() => setTicketPrice(price + 1)}>+</button>
            </div>
            <p className="muted small">
              Expected crowd {expectedCrowd.toLocaleString('en-GB')} of {club.capacity.toLocaleString('en-GB')}, about {money(expectedCrowd * price)} a home game.
              {price > guide ? ' Fans grumble about prices above the going rate.' : ''}
            </p>
          </section>

          <section className="card">
            <div className="card-label"><span>Shirt sponsor</span></div>
            {club.sponsorOffers ? (
              <div className="stack">
                <p className="muted small">Pick one before the summer window shuts, or the board takes the steady deal.</p>
                {club.sponsorOffers.map((o, i) => (
                  <button key={i} type="button" className="choice" onClick={() => pickSponsor(i)}>
                    <strong>{o.name}</strong>
                    <small>
                      {STYLE_LABEL[o.style]}:{' '}
                      {o.style === 'steady' && `${moneyPw(o.weekly)} for two seasons`}
                      {o.style === 'upfront' && `${money(o.upfront)} now, this season only`}
                      {o.style === 'bonus' && `${moneyPw(o.weekly)} plus ${money(o.promotionBonus)} if promoted`}
                    </small>
                  </button>
                ))}
              </div>
            ) : club.sponsor ? (
              <p className="small">
                <strong>{club.sponsor.name}</strong> · {STYLE_LABEL[club.sponsor.style]}
                {club.sponsor.weekly ? ` · ${moneyPw(club.sponsor.weekly)}` : ''}
                {club.sponsor.promotionBonus ? ` · ${money(club.sponsor.promotionBonus)} if promoted` : ''} · until summer {club.sponsor.endsSeason + 1}
              </p>
            ) : (
              <p className="muted small">No sponsor this season.</p>
            )}
          </section>

          <section className="card">
            <div className="card-label"><span>Bank loan</span></div>
            {club.loan ? (
              <>
                <p className="small">{money(club.loan.remaining)} left to repay at {moneyPw(club.loan.weekly)}.</p>
                <button type="button" className="btn tile" onClick={() => act(repay(), 'Loan paid off.')}>Pay it all off now</button>
              </>
            ) : (
              <div className="stack">
                <p className="muted small">Borrow for building work. Repaid weekly over two seasons, 8% interest.</p>
                {loanOptions(game, club).map((o) => (
                  <button key={o.amount} type="button" className="btn tile" onClick={() => act(borrow(o.amount), `${money(o.amount)} borrowed.`)}>
                    Borrow {money(o.amount)} · repay {moneyPw(o.weekly)}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <label className="toggle no-rule" htmlFor="unlimited-money">
              <input
                id="unlimited-money"
                type="checkbox"
                checked={!!game.settings?.unlimitedMoney}
                onChange={(e) => setUnlimited(e.target.checked)}
              />
              <span>
                Unlimited money (testing)
                <small>Bank and budgets stay topped up at £1bn. Switch off to go back to your real balance.</small>
              </span>
            </label>
          </section>

          <section className="card">
            <div className="card-label"><span>This season</span></div>
            <div className="ledger">
              <h3>Money in</h3>
              {income.map(([label, v]) => <div key={label}><span>{label}</span><b>{money(v)}</b></div>)}
              {loanNet > 0 && <div><span>Loan (net)</span><b>{money(loanNet)}</b></div>}
              <h3>Money out</h3>
              {spending.map(([label, v]) => <div key={label}><span>{label}</span><b>{money(v)}</b></div>)}
              {loanNet < 0 && <div><span>Loan repayments</span><b>{money(-loanNet)}</b></div>}
            </div>
          </section>
        </>
      )}

      {tab === 'board' && (
        <>
          <section className="card meters">
            <div className="meter">
              <div className="meter-head"><span>Board confidence</span><b>{Math.round(board.confidence)}</b></div>
              <span className="track"><i style={{ width: `${board.confidence}%` }} /></span>
            </div>
            <div className="meter">
              <div className="meter-head"><span>Fan mood</span><b>{Math.round(board.fans)}</b></div>
              <span className="track fans"><i style={{ width: `${board.fans}%` }} /></span>
            </div>
          </section>
          {board.target && (
            <section className="card">
              <div className="card-label"><span>Season target</span></div>
              <p className="target">{board.target.label}</p>
              <p className="muted small">
                Finish {ordinal(board.target.position)} or better. {started ? `You're ${ordinal(pos)} right now.` : 'The season has not started yet.'}
              </p>
            </section>
          )}
          <section className="card">
            <div className="card-label"><span>What moves them</span></div>
            <ul className="plain-list">
              <li>Results, and how you finish against the target.</li>
              <li>Promotion lifts both meters; relegation hits them hard.</li>
              <li>Fans dislike ticket prices above the going rate and love new stands.</li>
              <li>Big loans worry the board.</li>
              <li>A confident board sets bigger transfer and wage budgets each summer.</li>
            </ul>
          </section>
        </>
      )}

      {standSheet !== null && (
        <div className="sheet-backdrop" onClick={() => setStandSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={stadium.stands[standSheet].name} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">{stadium.stands[standSheet].name}</strong>
              <button type="button" className="link-btn" onClick={() => setStandSheet(null)}>Close</button>
            </div>
            <p className="muted small">
              {stadium.stands[standSheet].capacity.toLocaleString('en-GB')} capacity, {stadium.stands[standSheet].seats.toLocaleString('en-GB')} seated,
              {stadium.stands[standSheet].roof ? ' roofed' : ' open to the weather'}. Bank {money(club.balance)}.
              {busy ? ' Builders are busy on another job.' : ' A stand under construction holds half its fans.'}
            </p>
            <div className="stack">
              {standOptions(game, club, standSheet).map((o) => (
                <button key={`${o.kind}-${o.size ?? ''}`} type="button" className="work-option" disabled={busy || o.cost > club.balance} onClick={() => start(o)}>
                  <strong>{o.label}</strong>
                  <span>{money(o.cost)} · {o.weeks} weeks</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
