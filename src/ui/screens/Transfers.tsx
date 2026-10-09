import { useMemo, useState } from 'react';
import { WAGE_TO_TRANSFER, budgetsOf, moneyPw, wageBill } from '../../engine/economy/finance';
import { POSITION_GROUP, positionsLabel } from '../../engine/players/ratings';
import {
  askingPrice, interestIn, isKnown, openInboxItems, ratingRange, transferWindow, wageDemand, type Interest,
} from '../../engine/transfers/market';
import type { Player, PositionGroup } from '../../engine/types';
import { divisionOf, squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { BidCard } from '../components/BidCard';
import { PlayerSheet } from '../components/PlayerSheet';
import { money } from '../format';

type Tab = 'search' | 'yours' | 'recent';
type Age = 'any' | 'u21' | 'u24' | 'prime' | 'vet';
const AGES: { v: Age; label: string; test: (a: number) => boolean }[] = [
  { v: 'any', label: 'Any age', test: () => true },
  { v: 'u21', label: 'Under 21', test: (a) => a <= 21 },
  { v: 'u24', label: 'Under 24', test: (a) => a <= 23 },
  { v: 'prime', label: '24–29', test: (a) => a >= 24 && a <= 29 },
  { v: 'vet', label: '30+', test: (a) => a >= 30 },
];
const GROUPS: (PositionGroup | 'ALL')[] = ['ALL', 'GK', 'DEF', 'MID', 'ATT'];
const INTEREST_DOT: Record<Interest, string> = { keen: 'Keen', open: 'Open', reluctant: 'Reluctant', no: 'Big wage' };

export function Transfers() {
  const game = useGame((s) => s.game)!;
  const rev = useGame((s) => s.rev);
  const adjust = useGame((s) => s.adjustBudgets);
  const [tab, setTab] = useState<Tab>('search');
  const [group, setGroup] = useState<PositionGroup | 'ALL'>('ALL');
  const [age, setAge] = useState<Age>('any');
  const [freeOnly, setFreeOnly] = useState(false);
  const [affordable, setAffordable] = useState(true);
  const [open, setOpen] = useState<Player | null>(null);
  const [budgetSheet, setBudgetSheet] = useState(false);

  const club = game.clubs[game.userClubId];
  const window = transferWindow(game);
  const budgets = budgetsOf(game, club);
  const bill = wageBill(game, club);

  const wageRoom = Math.max(0, budgets.wage - bill);
  const avgWage = bill / Math.max(1, club.playerIds.length);

  const results = useMemo(() => {
    const ageTest = AGES.find((a) => a.v === age)!.test;
    const out: { p: Player; known: boolean; est: number; interest: Interest; fee: number }[] = [];
    for (const p of Object.values(game.players)) {
      if (p.clubId === club.id) continue;
      if (freeOnly && p.clubId) continue;
      if (group !== 'ALL' && POSITION_GROUP[p.position] !== group) continue;
      if (!ageTest(p.age)) continue;
      const interest = interestIn(game, club, p);
      const fee = p.clubId ? askingPrice(game, p) : 0;
      if (affordable && fee > budgets.transfer * 1.1) continue;
      // Wages you could fit in, at most by moving on one typical earner.
      if (affordable && wageDemand(game, club, p) > wageRoom + avgWage) continue;
      const known = isKnown(game, club, p);
      const [lo, hi] = ratingRange(p);
      out.push({ p, known, est: known ? p.overall : (lo + hi) / 2, interest, fee });
    }
    return out.sort((a, b) => b.est - a.est).slice(0, 40);
  }, [rev, group, age, freeOnly, affordable]); // `rev` marks engine changes to `game`

  const bids = openInboxItems(game);
  const listed = squadOf(game, club.id).filter((p) => p.listed);
  const recent = (game.transfers ?? []).filter((t) => t.toClubId === club.id || t.fromClubId === club.id).slice(0, 20);
  const bigMoves = (game.transfers ?? []).filter((t) => t.season === game.season && t.fee > 0).sort((a, b) => b.fee - a.fee).slice(0, 8);

  const maxWage = budgets.wage + budgets.transfer / WAGE_TO_TRANSFER;
  const step = Math.max(10, Math.round(budgets.wage / 50 / 10) * 10);

  return (
    <main className="screen transfers">
      <header className="screen-head">
        <div className="eyebrow">{window.label}</div>
        <h1>Transfers</h1>
      </header>

      <button type="button" className="card budgets" onClick={() => setBudgetSheet(true)}>
        <span>
          <small>Transfer budget</small>
          <strong>{money(budgets.transfer)}</strong>
        </span>
        <span>
          <small>Wages</small>
          <strong>{moneyPw(bill)}</strong>
          <small>of {moneyPw(budgets.wage)}</small>
        </span>
        <span className="adjust">Adjust</span>
      </button>

      <div className="segmented" role="tablist">
        {(['search', 'yours', 'recent'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'search' ? 'Search' : t === 'yours' ? `Offers${bids.length ? ` (${bids.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <div className="pills compact">
            {GROUPS.map((g) => (
              <button key={g} type="button" className="pill" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g === 'ALL' ? 'All' : g}
              </button>
            ))}
          </div>
          <div className="pills compact">
            {AGES.map((a) => (
              <button key={a.v} type="button" className="pill" aria-pressed={age === a.v} onClick={() => setAge(a.v)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="pills compact">
            <button type="button" className="pill" aria-pressed={affordable} onClick={() => setAffordable(!affordable)}>Realistic targets</button>
            <button type="button" className="pill" aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>Free agents only</button>
          </div>
          {!window.open && <p className="hint left">The window is closed, so only free agents can join right now.</p>}
          <ul className="player-list">
            {results.map(({ p, known, interest, fee }) => {
              const [lo, hi] = ratingRange(p);
              const from = p.clubId ? game.clubs[p.clubId] : null;
              return (
                <li key={p.id}>
                  <button type="button" className="player-row" onClick={() => setOpen(p)}>
                    <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                    <span className={`ovr ${known ? '' : 'range'}`}>{known ? p.overall : `${lo}–${hi}`}</span>
                    <span className="who">
                      <strong>{p.firstName} {p.lastName}</strong>
                      <small>
                        {p.age} yrs · {from ? `${from.name} · L${divisionOf(game, from.id).def.level}` : 'Free agent'}
                      </small>
                    </span>
                    <span className="role">
                      {from ? money(fee) : 'Free'}
                      <small className={`interest-text interest-${interest}`}>{INTEREST_DOT[interest]}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {results.length === 0 && <p className="hint">No players match. Try fewer filters.</p>}
        </>
      )}

      {tab === 'yours' && (
        <>
          {bids.length === 0 && <p className="hint left">No offers for your players right now. Transfer-list a player to attract bids during a window.</p>}
          {bids.map((item) => <BidCard key={item.id} item={item} />)}
          <section className="card">
            <div className="card-label"><span>On the transfer list</span></div>
            {listed.length === 0 ? (
              <p className="muted small">Nobody. List players from their profile in Squad.</p>
            ) : (
              <ul className="player-list">
                {listed.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="player-row" onClick={() => setOpen(p)}>
                      <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                      <span className="ovr">{p.overall}</span>
                      <span className="who"><strong>{p.firstName} {p.lastName}</strong><small>Value {money(p.value)}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'recent' && (
        <>
          <section className="card">
            <div className="card-label"><span>Your deals</span></div>
            {recent.length === 0 ? (
              <p className="muted small">No deals yet.</p>
            ) : (
              recent.map((t, i) => (
                <div key={i} className="po-row">
                  <span className={t.toClubId === club.id ? 'in' : 'out'}>{t.toClubId === club.id ? 'IN' : 'OUT'}</span>
                  <span className="grow">{t.playerName}</span>
                  <strong>{t.fee ? money(t.fee) : 'Free'}</strong>
                </div>
              ))
            )}
          </section>
          <section className="card">
            <div className="card-label"><span>Biggest deals this season</span></div>
            {bigMoves.length === 0 && <p className="muted small">None yet.</p>}
            {bigMoves.map((t, i) => (
              <div key={i} className="po-row">
                <span className="grow">
                  {t.playerName}
                  <small className="block muted">
                    {t.fromClubId ? game.clubs[t.fromClubId].name : 'Free'} → {t.toClubId ? game.clubs[t.toClubId].name : 'Released'}
                  </small>
                </span>
                <strong>{money(t.fee)}</strong>
              </div>
            ))}
          </section>
        </>
      )}

      {open && <PlayerSheet player={open} onClose={() => setOpen(null)} />}

      {budgetSheet && (
        <div className="sheet-backdrop" onClick={() => setBudgetSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Budgets" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong className="grow">Budgets</strong><button type="button" className="link-btn" onClick={() => setBudgetSheet(false)}>Done</button></div>
            <p className="muted small">
              Move money between transfers and wages. Every {moneyPw(1)} of wage budget costs £{WAGE_TO_TRANSFER} of transfer budget.
              You get back 75% of what you sell for.
            </p>
            <div className="budget-split">
              <div><small>Transfers</small><strong>{money(budgets.transfer)}</strong></div>
              <div><small>Wage budget</small><strong>{moneyPw(budgets.wage)}</strong></div>
            </div>
            <label className="field" htmlFor="wage-budget">
              <span>Wage budget</span>
              <input
                id="wage-budget"
                type="range"
                min={Math.round(bill)}
                max={Math.round(maxWage)}
                step={step}
                value={budgets.wage}
                onChange={(e) => adjust(Number(e.target.value) - budgets.wage)}
              />
            </label>
            <p className="muted small">Current wage bill {moneyPw(bill)}. The wage budget can't go below it.</p>
          </div>
        </div>
      )}
    </main>
  );
}
