import { useMemo, useState } from 'react';
import { WAGE_TO_TRANSFER, budgetsOf, moneyPw, wageBill } from '../../engine/economy/finance';
import { POSITION_ORDER, positionsLabel } from '../../engine/players/ratings';
import {
  askingPrice, interestIn, isKnown, openInboxItems, ratingRange, transferWindow, wageDemand, type Interest,
} from '../../engine/transfers/market';
import type { Player, Position } from '../../engine/types';
import { divisionOf, squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { activeChallenge, challengeSigningRule } from '../../engine/club/challenge';
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
const MAX_VALUES = [0, 100_000, 500_000, 1_000_000, 5_000_000, 20_000_000, 50_000_000];
type SortKey = 'value' | 'ability' | 'age' | 'name' | 'price';
const SORTS: { k: SortKey; label: string }[] = [
  { k: 'value', label: 'Value' },
  { k: 'ability', label: 'Ability' },
  { k: 'age', label: 'Age' },
  { k: 'name', label: 'Name' },
  { k: 'price', label: 'Price' },
];
const PAGE = 50;
const INTEREST_DOT: Record<Interest, string> = { keen: 'Keen', open: 'Open', reluctant: 'Reluctant', no: 'Big wage' };

export function Transfers() {
  const game = useGame((s) => s.game)!;
  const rev = useGame((s) => s.rev);
  const adjust = useGame((s) => s.adjustBudgets);
  const [tab, setTab] = useState<Tab>('search');
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position | 'ANY'>('ANY');
  const [age, setAge] = useState<Age>('any');
  const [division, setDivision] = useState<string>('any');
  const [maxValue, setMaxValue] = useState(0);
  const [listedOnly, setListedOnly] = useState(false);
  const [affordable, setAffordable] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'value', desc: true });
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Player | null>(null);
  const [budgetSheet, setBudgetSheet] = useState(false);

  const club = game.clubs[game.userClubId];
  const window = transferWindow(game);
  const budgets = budgetsOf(game, club);
  const bill = wageBill(game, club);

  const wageRoom = Math.max(0, budgets.wage - bill);
  const avgWage = bill / Math.max(1, club.playerIds.length);

  // Every player in the game (CM 01/02 style), most valuable first unless re-sorted.
  const results = useMemo(() => {
    const ageTest = AGES.find((a) => a.v === age)!.test;
    const q = name.trim().toLowerCase();
    const levelOf = new Map(game.divisions.flatMap((d) => d.clubIds.map((id) => [id, d] as const)));
    const out: { p: Player; known: boolean; est: number; fee: number }[] = [];
    for (const p of Object.values(game.players)) {
      if (p.clubId === club.id) continue;
      if (division === 'free' ? p.clubId : division !== 'any' && levelOf.get(p.clubId ?? '')?.def.id !== division) continue;
      if (position !== 'ANY' && !p.positions.includes(position)) continue;
      if (!ageTest(p.age)) continue;
      if (maxValue && p.value > maxValue) continue;
      if (listedOnly && !p.listed && !p.transferRequest) continue;
      if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) continue;
      // Challenge age rules: only show players you're allowed to sign.
      if (challengeSigningRule(game, p)) continue;
      const needFee = sort.key === 'price' || affordable;
      const fee = needFee && p.clubId ? askingPrice(game, p) : 0;
      if (affordable) {
        if (fee > budgets.transfer * 1.1) continue;
        // Wages you could fit in, at most by moving on one typical earner.
        if (wageDemand(game, club, p) > wageRoom + avgWage) continue;
      }
      const known = isKnown(game, club, p);
      const [lo, hi] = ratingRange(p);
      out.push({ p, known, est: known ? p.overall : (lo + hi) / 2, fee });
    }
    const dir = sort.desc ? -1 : 1;
    const key = {
      value: (x: (typeof out)[number]) => x.p.value,
      ability: (x: (typeof out)[number]) => x.est,
      age: (x: (typeof out)[number]) => x.p.age,
      price: (x: (typeof out)[number]) => x.fee,
      name: () => 0,
    }[sort.key];
    if (sort.key === 'name') out.sort((a, b) => dir * `${a.p.lastName} ${a.p.firstName}`.localeCompare(`${b.p.lastName} ${b.p.firstName}`));
    else out.sort((a, b) => dir * (key(a) - key(b)) || b.p.value - a.p.value);
    return out;
  }, [rev, name, position, age, division, maxValue, listedOnly, affordable, sort]); // `rev` marks engine changes to `game`

  const pickSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, desc: !s.desc } : { key: k, desc: k !== 'name' }));
    setShown(PAGE);
  };
  // Any change of filter starts the list from the top again.
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE);
  };

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
          <div className="search-filters">
            <label className="field search-name">
              <span className="visually-hidden">Player name</span>
              <input type="search" placeholder="Search by name" value={name} onChange={(e) => filter(setName)(e.target.value)} />
            </label>
            <div className="grid-3">
              <label className="field">
                <span>Position</span>
                <select value={position} onChange={(e) => filter(setPosition)(e.target.value as Position | 'ANY')}>
                  <option value="ANY">Any</option>
                  {POSITION_ORDER.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Age</span>
                <select value={age} onChange={(e) => filter(setAge)(e.target.value as Age)}>
                  {AGES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Max value</span>
                <select value={maxValue} onChange={(e) => filter(setMaxValue)(Number(e.target.value))}>
                  {MAX_VALUES.map((v) => <option key={v} value={v}>{v ? money(v) : 'Any'}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Division</span>
              <select value={division} onChange={(e) => filter(setDivision)(e.target.value)}>
                <option value="any">All divisions</option>
                {game.divisions.map((d) => <option key={d.def.id} value={d.def.id}>{d.def.name}</option>)}
                <option value="free">Free agents</option>
              </select>
            </label>
            <div className="pills compact">
              <button type="button" className="pill" aria-pressed={listedOnly} onClick={() => filter(setListedOnly)(!listedOnly)}>Transfer listed</button>
              <button type="button" className="pill" aria-pressed={affordable} onClick={() => filter(setAffordable)(!affordable)}>Realistic targets</button>
            </div>
          </div>
          {activeChallenge(game) === 'kids' && <p className="note neutral"><span aria-hidden="true">•</span>Challenge: only players aged 21 or under are shown.</p>}
          {activeChallenge(game) === 'old' && <p className="note neutral"><span aria-hidden="true">•</span>Challenge: only players aged 30 or over are shown.</p>}
          {activeChallenge(game) === 'embargo' && <p className="note bad"><span aria-hidden="true">▼</span>Transfer embargo: no fees. Sign free agents, or open a player to ask about a loan.</p>}
          {!window.open && <p className="hint left">The window is closed, so only free agents can join right now.</p>}

          <div className="sort-bar" role="group" aria-label="Sort by">
            <span className="muted small">{results.length.toLocaleString('en-GB')} players</span>
            {SORTS.map(({ k, label }) => (
              <button key={k} type="button" className="sort-btn" aria-pressed={sort.key === k} onClick={() => pickSort(k)}>
                {label}{sort.key === k ? (sort.desc ? ' ▼' : ' ▲') : ''}
              </button>
            ))}
          </div>

          <ul className="player-list">
            {results.slice(0, shown).map(({ p, known, fee }) => {
              const [lo, hi] = ratingRange(p);
              const from = p.clubId ? game.clubs[p.clubId] : null;
              const interest = interestIn(game, club, p);
              return (
                <li key={p.id}>
                  <button type="button" className="player-row" onClick={() => setOpen(p)}>
                    <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                    <span className={`ovr ${known ? '' : 'range'}`}>{known ? p.overall : `${lo}–${hi}`}</span>
                    <span className="who">
                      <strong>{p.firstName} {p.lastName}{p.listed || p.transferRequest ? <small className="warn"> Listed</small> : null}</strong>
                      <small>
                        {p.age} yrs · {from ? `${from.name} · ${divisionOf(game, from.id).def.name}` : 'Free agent'}
                      </small>
                    </span>
                    <span className="role">
                      {money(p.value)}
                      <small>{sort.key === 'price' && from ? `Asking ${money(fee)}` : from ? '' : 'Free'}</small>
                      <small className={`interest-text interest-${interest}`}>{INTEREST_DOT[interest]}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {results.length > shown && (
            <button type="button" className="btn secondary" onClick={() => setShown(shown + PAGE)}>
              Show more ({(results.length - shown).toLocaleString('en-GB')} left)
            </button>
          )}
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
