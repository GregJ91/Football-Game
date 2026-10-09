import { hp } from '../help';
import { INTEREST_TEXT, VERDICT_TEXT, isShortlisted } from '../../engine/transfers/scouting';
import { useState } from 'react';
import { WAGE_TO_TRANSFER, budgetsOf, moneyPw, wageBill } from '../../engine/economy/finance';
import { formatDate, scoutDueDate } from '../../engine/calendar';
import { playerName } from '../../engine/players/generate';
import { positionsLabel, roundMoney } from '../../engine/players/ratings';
import {
  SCOUT_REPORTS_PER_WEEK, cannotBuy, interestIn, isKnown, potentialStars, ratingRange,
  releaseCost, renewalDemand, wageDemand, type Interest,
} from '../../engine/transfers/market';
import { GOALKEEPING, MENTAL, PHYSICAL, TECHNICAL, type AttributeKey, type Player } from '../../engine/types';
import { leagueNameOf } from '../../engine/world';
import { ROLES, ROLE_LABEL, ROLE_SHARE, happinessText, moodOf, roleOf } from '../../engine/players/squad';
import { cannotLoan } from '../../engine/transfers/loans';
import { useGame } from '../../state/store';
import { money } from '../format';
import { careerTotals } from '../../engine/players/generate';

// Goalkeepers see goalkeeping in place of the outfield technical column, as in CM.
const groupsFor = (p: Player): { title: string; keys: readonly AttributeKey[] }[] => [
  p.position === 'GK' ? { title: 'Goalkeeping', keys: GOALKEEPING } : { title: 'Technical', keys: TECHNICAL },
  { title: 'Mental', keys: MENTAL },
  { title: 'Physical', keys: PHYSICAL },
];

const LABELS: Partial<Record<AttributeKey, string>> = {
  longShots: 'Long shots',
  offTheBall: 'Off the ball',
  workRate: 'Work rate',
  oneOnOnes: 'One on ones',
  aerialAbility: 'Aerial ability',
};
const label = (k: AttributeKey) => LABELS[k] ?? k[0].toUpperCase() + k.slice(1);

/** CM-style colour band for a 1–20 attribute. */
const tier = (v: number) => (v >= 16 ? 'a-top' : v >= 11 ? 'a-good' : v >= 6 ? 'a-avg' : 'a-poor');

const INTEREST_LABEL: Record<Interest, string> = {
  keen: 'Keen to join',
  open: 'Open to a move',
  reluctant: 'Reluctant',
  no: 'Needs a big wage to drop down',
};

type Step =
  | { kind: 'view' }
  | { kind: 'fee'; message?: string; counter?: number }
  | { kind: 'terms'; fee: number; message?: string; lowered?: boolean }
  | { kind: 'renew'; message?: string }
  | { kind: 'done'; message: string };

function feeStep(value: number) {
  if (value >= 1_000_000) return 50_000;
  if (value >= 100_000) return 5_000;
  if (value >= 10_000) return 500;
  return 100;
}

export function PlayerSheet({ player, onClose }: { player: Player; onClose: () => void }) {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const scout = useGame((s) => s.scout);
  const bid = useGame((s) => s.bid);
  const sign = useGame((s) => s.sign);
  const offerLowerWage = useGame((s) => s.offerLowerWage);
  const toggleListed = useGame((s) => s.toggleListed);
  const release = useGame((s) => s.release);
  const renew = useGame((s) => s.renew);
  const showToast = useGame((s) => s.showToast);
  const adjustBudgets = useGame((s) => s.adjustBudgets);
  const setPlayerRole = useGame((s) => s.setPlayerRole);
  const loanPlayer = useGame((s) => s.loanPlayer);
  const sendBackLoan = useGame((s) => s.sendBackLoan);
  const toggleShortlist = useGame((s) => s.toggleShortlist);

  const p = player;
  const club = game.clubs[game.userClubId];
  const own = p.clubId === club.id;
  const known = isKnown(game, club, p);
  const shortlisted = isShortlisted(game, p.id);
  const report = own ? undefined : club.scoutReports?.[p.id];
  const [lo, hi] = ratingRange(p);
  const currentClub = p.clubId ? game.clubs[p.clubId] : null;
  const interest = own ? null : interestIn(game, club, p);
  const budgets = budgetsOf(game, club);
  const bill = wageBill(game, club);

  const [step, setStep] = useState<Step>({ kind: 'view' });
  const [fee, setFee] = useState(() => (p.clubId ? Math.round(p.value / feeStep(p.value)) * feeStep(p.value) : 0));
  const [years, setYears] = useState(p.age >= 30 ? 2 : 3);
  const [talksOff, setTalksOff] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const blocker = own ? null : cannotBuy(game, p);
  const demand = own ? 0 : wageDemand(game, club, p);
  const renewal = own ? renewalDemand(game, p) : null;
  const stepSize = feeStep(Math.max(p.value, 1000));
  const lowerWage = roundMoney(demand * 0.85);

  const submitBid = (amount: number) => {
    const r = bid(p.id, amount);
    if ('error' in r) return setStep({ kind: 'fee', message: r.error });
    if (r.result === 'accepted') return setStep({ kind: 'terms', fee: amount, message: `${currentClub?.name} accept ${money(amount)}.` });
    if (r.result === 'countered') {
      // Their counter-offer goes straight into the fee box.
      setFee(r.asking);
      return setStep({ kind: 'fee', counter: r.asking, message: `${currentClub?.name} want ${money(r.asking)}.` });
    }
    return setStep({ kind: 'fee', message: `Rejected. ${currentClub?.name} would want around ${money(r.asking)}.` });
  };

  const agree = (feeAmount: number, wage: number) => {
    const err = sign(p.id, feeAmount, wage, years);
    if (err) setStep({ kind: 'terms', fee: feeAmount, message: err });
    else setStep({ kind: 'done', message: `${playerName(p)} has signed on ${moneyPw(wage)} until summer ${game.season + years}.` });
  };

  const YearsPicker = (
    <div className="pills compact" role="group" aria-label="Contract length">
      {[1, 2, 3, 4].map((y) => (
        <button key={y} type="button" className="pill" aria-pressed={years === y} onClick={() => setYears(y)}>
          {y} yr{y > 1 ? 's' : ''}
        </button>
      ))}
    </div>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={playerName(p)} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="ovr big" {...hp('ovr')}>{known ? p.overall : `${lo}–${hi}`}</span>
          <div className="grow">
            <strong>{playerName(p)}</strong>
            <small>
              {positionsLabel(p)} · {p.age} yrs · {currentClub ? `${currentClub.name} (${leagueNameOf(game, currentClub.id)})` : 'Free agent'}
            </small>
          </div>
          {!own && (
            <button
              type="button"
              className="star-btn"
              {...hp('shortlist')}
              aria-pressed={shortlisted}
              aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
              onClick={() => toggleShortlist(p.id)}
            >
              {shortlisted ? '★' : '☆'}
            </button>
          )}
          <button type="button" className="link-btn" onClick={onClose}>Close</button>
        </div>

        <div className="facts">
          {p.clubId && <span {...hp('value')}>Value {money(p.value)}</span>}
          <span {...hp('wage')}>Wage {moneyPw(p.wage)}</span>
          {p.clubId && <span {...hp('contract')}>Contract ends summer {p.contractEnd + 1}</span>}
          {own && <span {...hp('fitness')}>Fitness {Math.round(p.fitness)}%</span>}
          {own && <span {...hp('morale')}>Morale {Math.round(p.morale)}</span>}
          {own && <span {...hp('form')}>Form {p.form.toFixed(1)}</span>}
          {own && p.listed && <span className="warn">Transfer listed</span>}
          {own && p.loanFrom && <span className="warn">On loan from {game.clubs[p.loanFrom].name}</span>}
          {interest && <span className={`interest interest-${interest}`} {...hp('interest')}>{INTEREST_LABEL[interest]}</span>}
          {known && !own && <span {...hp('potential')}>Potential {'★'.repeat(potentialStars(p))}{'☆'.repeat(5 - potentialStars(p))}</span>}
        </div>

        {(() => {
          const c = careerTotals(p);
          const s = p.seasonStats;
          return (
            <div className="stat-totals">
              <div {...hp('seasonStats')}>
                <small>This season</small>
                <span><b>{s.apps}</b> games</span>
                <span><b>{s.goals}</b> goals</span>
                <span><b>{s.assists}</b> assists</span>
              </div>
              <div {...hp('careerStats')}>
                <small>Career</small>
                <span><b>{c.games}</b> games</span>
                <span><b>{c.goals}</b> goals</span>
                <span><b>{c.assists}</b> assists</span>
              </div>
            </div>
          );
        })()}

        {step.kind === 'view' && (
          <>
            {report && (
              <div className="card inset scout-report">
                <div className="card-label">
                  <span>Scout report</span>
                  <span>{report.season === game.season ? `Week ${report.week + 1}` : `${report.season}/${String(report.season + 1).slice(2)}`}</span>
                </div>
                <p>
                  <strong>{VERDICT_TEXT[report.verdict]}</strong> {INTEREST_TEXT[report.interest]}
                </p>
                <p className="muted small">
                  Rated {report.ability} then, potential {'★'.repeat(report.potential)}{'☆'.repeat(5 - report.potential)}
                  {report.price ? `, asking about ${money(report.price)}` : ''}.
                </p>
              </div>
            )}
            {own && (
              <div className="role-box">
                <div className="card-label">
                  <span {...hp('role')}>Squad role</span>
                  <span className={`mood mood-${moodOf(p)}`}>{moodOf(p)}</span>
                </div>
                <div className="pills compact" role="group" aria-label="Squad role">
                  {ROLES.map((r) => (
                    <button key={r} type="button" className="pill" aria-pressed={roleOf(p) === r} onClick={() => setPlayerRole(p.id, r)}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <p className="muted small">
                  {happinessText(game, p)} Expects about {Math.round(ROLE_SHARE[roleOf(p)] * 100)}% of games.
                </p>
              </div>
            )}
            {known ? (
              <div className="cm-attrs">
                {groupsFor(p).map((g) => (
                  <div key={g.title} className="cm-col">
                    <h3>{g.title}</h3>
                    {g.keys.map((k) => (
                      <div key={k} className="cm-attr">
                        <span>{label(k)}</span>
                        <b className={tier(p.attributes[k])}>{p.attributes[k]}</b>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card inset">
                {(() => {
                  const due = scoutDueDate(game, p.id);
                  if (due) return <p className="muted">A scout is watching him. Report due {formatDate(due)}.</p>;
                  return (
                    <>
                      <p className="muted">Your scouts haven't watched him yet. A report takes a few days and reveals his ability, potential and whether he'd suit you.</p>
                      <button
                        type="button"
                        className="btn secondary"
                        {...hp('scoutPlayer')}
                        disabled={(game.scoutReportsLeft ?? SCOUT_REPORTS_PER_WEEK) <= 0}
                        onClick={() => {
                          const r = scout(p.id);
                          if (r === 'none-left') showToast('No scouts free this week.');
                          else if (r === 'assigned') showToast(`Scout sent to watch ${p.lastName}.`);
                        }}
                      >
                        Send a scout ({game.scoutReportsLeft ?? SCOUT_REPORTS_PER_WEEK} free this week)
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {!own && (
              <div className="stack">
                {blocker || talksOff ? (
                  <p className="note bad"><span aria-hidden="true">▼</span>{talksOff ? `${p.lastName} has walked away from talks.` : blocker}</p>
                ) : p.clubId ? (
                  <button type="button" className="btn primary" onClick={() => setStep({ kind: 'fee' })} {...hp('offer')}>Make an offer</button>
                ) : (
                  <button type="button" className="btn primary" onClick={() => setStep({ kind: 'terms', fee: 0 })}>Offer a contract</button>
                )}
                {p.clubId && !talksOff && (() => {
                  const why = cannotLoan(game, p);
                  return why ? (
                    <p className="muted small">Loan: {why}</p>
                  ) : (
                    <button
                      type="button"
                      className="btn tile"
                      {...hp('loan')}
                      onClick={() => {
                        const err = loanPlayer(p.id);
                        setStep({ kind: 'done', message: err ?? `${playerName(p)} joins on loan until the end of the season. You pay his ${moneyPw(p.wage)}.` });
                      }}
                    >
                      Take on loan ({moneyPw(p.wage)}, until the summer)
                    </button>
                  );
                })()}
              </div>
            )}

            {own && p.loanFrom && (
              <div className="stack">
                <button
                  type="button"
                  className="btn tile"
                  onClick={() => {
                    sendBackLoan(p.id);
                    onClose();
                  }}
                >
                  Send him back to {game.clubs[p.loanFrom].name}
                </button>
              </div>
            )}

            {own && !p.loanFrom && (
              <div className="stack">
                <div className="grid-2">
                  <button type="button" className="btn tile" onClick={() => toggleListed(p.id)} {...hp('listed')}>
                    {p.listed ? 'Take off the list' : 'Transfer list'}
                  </button>
                  <button type="button" className="btn tile" onClick={() => setStep({ kind: 'renew' })} {...hp('renew')}>New contract</button>
                </div>
                {confirmRelease ? (
                  <div className="grid-2">
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => {
                        const err = release(p.id);
                        if (err) setProblem(err);
                        else onClose();
                      }}
                    >
                      Confirm release
                    </button>
                    <button type="button" className="btn tile" onClick={() => setConfirmRelease(false)}>Keep him</button>
                  </div>
                ) : (
                  <button type="button" className="link-btn" onClick={() => setConfirmRelease(true)} {...hp('release')}>
                    Release him (pay-off {money(releaseCost(game, p))})
                  </button>
                )}
                {problem && <p className="note bad"><span aria-hidden="true">▼</span>{problem}</p>}
              </div>
            )}
          </>
        )}

        {step.kind === 'fee' && (
          <div className="negotiate">
            <h3>Transfer offer</h3>
            <p className="muted small">
              Valued at {money(p.value)}. Your transfer budget is {money(budgets.transfer)}.
            </p>
            <div className="stepper">
              <button type="button" aria-label="Lower the offer" onClick={() => setFee(Math.max(0, fee - stepSize))}>−</button>
              <label className="visually-hidden" htmlFor="bid-fee">Fee</label>
              <input id="bid-fee" inputMode="numeric" value={`£${fee.toLocaleString('en-GB')}`} onChange={(e) => setFee(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
              <button type="button" aria-label="Raise the offer" onClick={() => setFee(fee + stepSize)}>+</button>
            </div>
            {step.message && <p className={`note ${step.counter ? 'neutral' : 'bad'}`}><span aria-hidden="true">•</span>{step.message}</p>}
            <div className="grid-2">
              <button type="button" className="btn primary" onClick={() => submitBid(fee)}>
                {step.counter && fee === step.counter ? `Agree ${money(fee)}` : 'Submit offer'}
              </button>
              <button type="button" className="btn tile" onClick={() => setStep({ kind: 'view' })}>Walk away</button>
            </div>
          </div>
        )}

        {step.kind === 'terms' && (() => {
          const wage = step.lowered ? lowerWage : demand;
          return (
            <div className="negotiate">
              <h3>Personal terms</h3>
              {step.message && <p className="note neutral"><span aria-hidden="true">•</span>{step.message}</p>}
              <p>
                {p.lastName} wants <strong>{moneyPw(demand)}</strong>.
              </p>
              {interest === 'no' && (
                <p className="muted small">He'd never normally drop this far, so this is what it takes. He won't haggle.</p>
              )}
              <p className="muted small">
                Wages would go to {moneyPw(bill + wage)} of your {moneyPw(budgets.wage)} budget.
              </p>
              {bill + wage > budgets.wage && (
                <OverBudget shortfall={bill + wage - budgets.wage} transfer={budgets.transfer} onMove={adjustBudgets} />
              )}
              {YearsPicker}
              <button type="button" className="btn primary" onClick={() => agree(step.fee, wage)}>
                Agree {moneyPw(wage)} for {years} yr{years > 1 ? 's' : ''}
              </button>
              {!step.lowered && (
                <button
                  type="button"
                  className="btn tile"
                  onClick={() => {
                    if (offerLowerWage(p.id)) setStep({ ...step, lowered: true, message: `He'll accept ${moneyPw(lowerWage)}.` });
                    else {
                      setTalksOff(true);
                      setStep({ kind: 'view' });
                    }
                  }}
                >
                  Offer {moneyPw(lowerWage)}
                </button>
              )}
              <button type="button" className="link-btn" onClick={() => setStep({ kind: 'view' })}>Walk away</button>
            </div>
          );
        })()}

        {step.kind === 'renew' && renewal && (
          <div className="negotiate">
            <h3>New contract</h3>
            {renewal.refuses ? (
              <p className="note bad"><span aria-hidden="true">▼</span>{renewal.refuses}</p>
            ) : (
              <>
                <p>
                  {p.lastName} wants <strong>{moneyPw(renewal.wage)}</strong> (now {moneyPw(p.wage)}).
                </p>
                <p className="muted small">
                  Wages would go to {moneyPw(bill - p.wage + renewal.wage)} of your {moneyPw(budgets.wage)} budget.
                </p>
                {bill - p.wage + renewal.wage > budgets.wage && (
                  <OverBudget shortfall={bill - p.wage + renewal.wage - budgets.wage} transfer={budgets.transfer} onMove={adjustBudgets} />
                )}
                {YearsPicker}
                {step.message && <p className="note bad"><span aria-hidden="true">▼</span>{step.message}</p>}
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    const err = renew(p.id, renewal.wage, years);
                    if (err) setStep({ kind: 'renew', message: err });
                    else setStep({ kind: 'done', message: `${p.lastName} has signed a new deal until summer ${p.contractEnd + 1}.` });
                  }}
                >
                  Agree {moneyPw(renewal.wage)} for {years} more yr{years > 1 ? 's' : ''}
                </button>
              </>
            )}
            <button type="button" className="link-btn" onClick={() => setStep({ kind: 'view' })}>Back</button>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="negotiate">
            <p className="note good"><span aria-hidden="true">▲</span>{step.message}</p>
            <button type="button" className="btn primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Over the wage budget: offer to move the difference over from the transfer budget. */
function OverBudget({ shortfall, transfer, onMove }: { shortfall: number; transfer: number; onMove: (wageDelta: number) => void }) {
  const cost = Math.ceil(shortfall) * WAGE_TO_TRANSFER;
  return (
    <div className="over-budget">
      <p className="note bad"><span aria-hidden="true">▼</span>That's {moneyPw(Math.ceil(shortfall))} over your wage budget.</p>
      {cost <= transfer ? (
        <button type="button" className="btn tile" onClick={() => onMove(Math.ceil(shortfall))}>
          Move {money(cost)} from transfers to wages
        </button>
      ) : (
        <p className="muted small">Sell or release a player to free up wages.</p>
      )}
    </div>
  );
}
