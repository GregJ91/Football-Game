import { useState } from 'react';
import { boardOf, difficultyOf, loanOptions } from '../../engine/club/chairman';
import { FACILITY_INFO, MAX_FACILITY, facilitiesOf, facilityBusy, facilityUpgrade, facilityUpkeep, totalUpkeep } from '../../engine/club/facilities';
import {
  floodlightOption, nextLevelGrading, stadiumBusy, stadiumOf, standOptions, totalCapacity, totalSeats, type WorkOption,
} from '../../engine/club/stadium';
import { crowdFill, guideTicketPrice, ledgerOf, moneyPw, ticketPrice, wageBill, weeklyTv } from '../../engine/economy/finance';
import { divisionTable } from '../../engine/season/table';
import type { Build, FacilityKind, Stand, StaffRole } from '../../engine/types';
import { STAFF_INFO, STAFF_ROLES, staffCandidates, staffWages } from '../../engine/club/staff';
import { divisionOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { money, ordinal, seasonLabel } from '../format';

type Tab = 'ground' | 'facilities' | 'money' | 'board' | 'honours';
const TABS: { t: Tab; label: string }[] = [
  { t: 'ground', label: 'Ground' },
  { t: 'facilities', label: 'Staff' },
  { t: 'money', label: 'Money' },
  { t: 'board', label: 'Board' },
  { t: 'honours', label: 'Honours' },
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
  const [staffSheet, setStaffSheet] = useState<StaffRole | null>(null);
  const hire = useGame((s) => s.hireStaff);

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

  const table = divisionTable(game, div.def.id);
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
    ['Staff wages', ledger.staff ?? 0],
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
          <div className="card-label"><span>Backroom staff</span><span>{moneyPw(staffWages(club))}</span></div>
          {STAFF_ROLES.map((role) => {
            const s = club.staff?.[role];
            return (
              <section key={role} className="card staff-card">
                <div className="facility-head">
                  <span>
                    <strong>{STAFF_INFO[role].name}</strong>
                    <small className="block muted">{s ? `${s.name} · ${moneyPw(s.wage)}` : 'Vacant'}</small>
                  </span>
                  <span className={`staff-rating ${s && s.rating >= 15 ? 'a-top' : s && s.rating >= 11 ? 'a-good' : s && s.rating >= 6 ? 'a-avg' : 'a-poor'}`}>{s?.rating ?? '–'}</span>
                </div>
                <p className="muted small">{STAFF_INFO[role].effect}</p>
                <button type="button" className="btn tile" onClick={() => setStaffSheet(role)}>Find a replacement</button>
              </section>
            );
          })}
          <div className="card-label"><span>Facilities</span></div>
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

      {staffSheet && (
        <div className="sheet-backdrop" onClick={() => setStaffSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Hire a ${STAFF_INFO[staffSheet].name}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">{STAFF_INFO[staffSheet].name}</strong>
              <button type="button" className="link-btn" onClick={() => setStaffSheet(null)}>Close</button>
            </div>
            <p className="muted small">
              This month's shortlist. {club.staff?.[staffSheet] ? `${club.staff[staffSheet]!.name} (rated ${club.staff[staffSheet]!.rating}) leaves if you hire someone.` : ''} A new shortlist comes every month.
            </p>
            <ul className="player-list">
              {staffCandidates(game, staffSheet).map((c, i) => (
                <li key={c.name + i}>
                  <button
                    type="button"
                    className="player-row"
                    onClick={() => {
                      const err = hire(staffSheet, i);
                      showToast(err ?? `${c.name} joins as ${STAFF_INFO[staffSheet].name.toLowerCase()}.`);
                      if (!err) setStaffSheet(null);
                    }}
                  >
                    <span className={`ovr ${c.rating >= 15 ? 'a-top' : c.rating >= 11 ? 'a-good' : c.rating >= 6 ? 'a-avg' : 'a-poor'}`}>{c.rating}</span>
                    <span className="who"><strong>{c.name}</strong><small>Rating {c.rating} of 20</small></span>
                    <span className="role">{moneyPw(c.wage)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
          {(() => {
            const difficulty = difficultyOf(game);
            const status = board.warning === 'final'
              ? { tone: 'bad', text: difficulty === 'hard' ? "Final warning: turn things round within a month or you'll be sacked." : 'Final warning: the board are furious, but they are standing by you.' }
              : board.warning === 'concerned'
                ? { tone: 'bad', text: 'The board are concerned about results.' }
                : board.confidence >= 60
                  ? { tone: 'good', text: 'The board are happy with you.' }
                  : { tone: 'neutral', text: 'The board are keeping an eye on things.' };
            return (
              <section className="card">
                <div className="card-label">
                  <span>Your job</span>
                  <span>{difficulty[0].toUpperCase() + difficulty.slice(1)}</span>
                </div>
                <p className={`note ${status.tone}`}><span aria-hidden="true">{status.tone === 'good' ? '▲' : status.tone === 'bad' ? '▼' : '•'}</span>{status.text}</p>
                <p className="muted small">
                  {difficulty === 'hard'
                    ? 'On hard the board can sack you: below 20 confidence you get a final warning, and a month later (or at the end of the season) you are out if it has not recovered. New managers get their first season.'
                    : difficulty === 'normal'
                      ? 'On normal the board will warn you if results are poor, but they will not sack you.'
                      : 'On easy the board are patient and will not sack you.'}
                </p>
              </section>
            );
          })()}
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
              <li>Each month they check your league position against the target.</li>
              <li>Being in debt worries them.</li>
              <li>Promotion lifts both meters; relegation hits them hard.</li>
              <li>Fans dislike ticket prices above the going rate and love new stands.</li>
              <li>Big loans worry the board.</li>
              <li>A confident board sets bigger transfer and wage budgets each summer.</li>
            </ul>
          </section>
        </>
      )}

      {tab === 'honours' && (() => {
        const trophies = club.trophies ?? [];
        const counts = new Map<string, number[]>();
        for (const t of trophies) counts.set(t.name, [...(counts.get(t.name) ?? []), t.season]);
        return (
          <>
            <section className="card">
              <div className="card-label"><span>Trophy cabinet</span><span>{trophies.length}</span></div>
              {trophies.length === 0 ? (
                <p className="muted small">Empty for now. Win a league or a cup to start filling it.</p>
              ) : (
                <ul className="trophies">
                  {[...counts.entries()].map(([name, seasons]) => (
                    <li key={name}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z M12 14 V18 M8 20 H16 M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11" />
                      </svg>
                      <span className="grow"><strong>{name}</strong><small>{seasons.map(seasonLabel).join(', ')}</small></span>
                      {seasons.length > 1 && <b>×{seasons.length}</b>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {(() => {
              const legends = Object.values(club.legends ?? {});
              const r = club.records ?? {};
              const byApps = [...legends].sort((a, b) => b.apps - a.apps).slice(0, 8);
              const byGoals = [...legends].filter((l) => l.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 8);
              const span = (l: { from: number; to: number }) => (l.from === l.to ? seasonLabel(l.from) : `${seasonLabel(l.from)} to ${seasonLabel(l.to)}`);
              return (
                <>
                  <section className="card">
                    <div className="card-label"><span>Club records</span></div>
                    {!r.biggestWin && !r.recordAttendance ? (
                      <p className="muted small">Records are set as you play.</p>
                    ) : (
                      <>
                        {r.biggestWin && <div className="po-row"><span className="grow">Biggest win<small className="block muted">v {r.biggestWin.opponent}, {seasonLabel(r.biggestWin.season)}</small></span><strong>{r.biggestWin.score}</strong></div>}
                        {r.heaviestDefeat && <div className="po-row"><span className="grow">Heaviest defeat<small className="block muted">v {r.heaviestDefeat.opponent}, {seasonLabel(r.heaviestDefeat.season)}</small></span><strong>{r.heaviestDefeat.score}</strong></div>}
                        {r.recordAttendance && <div className="po-row"><span className="grow">Record attendance<small className="block muted">v {r.recordAttendance.opponent}, {seasonLabel(r.recordAttendance.season)}</small></span><strong>{r.recordAttendance.attendance.toLocaleString('en-GB')}</strong></div>}
                      </>
                    )}
                  </section>
                  <section className="card">
                    <div className="card-label"><span>Hall of Fame</span><span>Most appearances</span></div>
                    {byApps.length === 0 ? (
                      <p className="muted small">Filled in at the end of each season.</p>
                    ) : (
                      <ol className="scorers-list">
                        {byApps.map((l, i) => (
                          <li key={i}>
                            <span className="grow">{l.name}<small className="block muted">{l.position} · {span(l)}{l.awards?.length ? ` · ${l.awards.join(', ')}` : ''}</small></span>
                            <b>{l.apps}</b>
                          </li>
                        ))}
                      </ol>
                    )}
                    {byGoals.length > 0 && (
                      <>
                        <div className="card-label"><span>Top scorers</span></div>
                        <ol className="scorers-list">
                          {byGoals.map((l, i) => (
                            <li key={i}>
                              <span className="grow">{l.name}<small className="block muted">{l.apps} apps · {span(l)}</small></span>
                              <b>{l.goals}</b>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </section>
                </>
              );
            })()}
            <section className="card">
              <div className="card-label"><span>Club history</span></div>
              {club.history.length === 0 ? (
                <p className="muted small">Your first season is under way.</p>
              ) : (
                <ul className="history-list">
                  {[...club.history].reverse().map((h) => (
                    <li key={h.season}>
                      <span className="season">{seasonLabel(h.season)}</span>
                      <span className="grow">{game.divisions.find((d) => d.def.id === h.divisionId)?.def.name ?? h.divisionId}</span>
                      <b>{ordinal(h.position)}</b>
                      <span className={`outcome outcome-${h.outcome}`}>{h.outcome === 'stayed' ? '' : h.outcome[0].toUpperCase() + h.outcome.slice(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        );
      })()}

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
