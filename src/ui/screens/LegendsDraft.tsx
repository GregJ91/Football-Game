import { useMemo, useState } from 'react';
import { clubOnTheClock, draftLength, draftPool, draftRound, seasonsPlayed } from '../../engine/legends';
import { playerName } from '../../engine/players/generate';
import type { Player, Position } from '../../engine/types';
import { squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { PlayerSheet } from '../components/PlayerSheet';

type Filter = 'all' | 'GK' | 'DEF' | 'MID' | 'ATT';
const GROUPS: Record<Exclude<Filter, 'all'>, Position[]> = {
  GK: ['GK'],
  DEF: ['DC', 'DR', 'DL'],
  MID: ['DMC', 'MC', 'MR', 'ML', 'AMC'],
  ATT: ['ST'],
};
const SHAPE: [string, Position[], number][] = [
  ['GK', ['GK'], 3],
  ['DC', ['DC'], 5],
  ['FB', ['DR', 'DL'], 4],
  ['DM', ['DMC'], 2],
  ['CM', ['MC'], 3],
  ['Wide', ['MR', 'ML'], 2],
  ['AM', ['AMC'], 1],
  ['ST', ['ST'], 3],
];

/** The draft board: who's on the clock, your squad so far, and the players left. */
export function LegendsDraft() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const pick = useGame((s) => s.legendsPick);
  const autoPick = useGame((s) => s.legendsAutoPick);
  const showToast = useGame((s) => s.showToast);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Player | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const d = game.legends!.draft!;
  const me = game.userClubId;
  const onClock = clubOnTheClock(d);
  const mine = squadOf(game, me);
  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return draftPool(game)
      .filter((p) => filter === 'all' || p.positions.some((x) => GROUPS[filter].includes(x)))
      .filter((p) => !q || playerName(p).toLowerCase().includes(q))
      .slice(0, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, filter, search, d.pick]);
  // Picks made since our last one (or the start).
  const myLast = [...d.picks].reverse().findIndex((p) => p.clubId === me);
  const recent = (myLast === -1 ? d.picks : d.picks.slice(d.picks.length - myLast)).slice(-19).reverse();

  const draft = (p: Player) => {
    const err = pick(p.id);
    setConfirm(null);
    showToast(err ?? `${playerName(p)} joins ${game.clubs[me].name}.`);
  };

  return (
    <main className="screen legends-draft">
      <header className="screen-head">
        <div className="eyebrow">{d.kind === 'initial' ? 'Legends draft' : `Summer draft · before season ${seasonsPlayed(game) + 1}`}</div>
        <h1>Round {draftRound(d)} of {d.rounds}</h1>
        <small className="muted">Pick {d.pick + 1} of {draftLength(d)} · {d.snake ? 'snake order' : 'champions pick first'}</small>
      </header>

      <section className={`card clock ${onClock === me ? 'mine' : ''}`}>
        <ClubDot colours={game.clubs[onClock ?? me].colours} size={22} />
        <strong className="grow">{onClock === me ? "You're on the clock" : `${game.clubs[onClock ?? me].name} are picking`}</strong>
        <button type="button" className="btn secondary small" disabled={onClock !== me} onClick={() => showToast(autoPick() ?? 'Picked for you.')}>Auto pick</button>
      </section>

      <section className="card">
        <div className="card-label"><span>Your squad</span><span>{mine.length} / {d.kind === 'initial' ? d.rounds : mine.length + d.rounds - d.picks.filter((p) => p.clubId === me).length}</span></div>
        <div className="need-chips">
          {SHAPE.map(([label, positions, want]) => {
            const have = mine.filter((p) => positions.includes(p.position)).length;
            return (
              <span key={label} className={have >= want ? 'done' : ''}>
                {label} <b>{have}/{want}</b>
              </span>
            );
          })}
        </div>
        {mine.length > 0 && (
          <p className="muted small">{[...mine].sort((a, b) => b.overall - a.overall).map((p) => `${p.lastName} (${p.position})`).join(', ')}</p>
        )}
      </section>

      <div className="segmented" role="tablist">
        {(['all', 'GK', 'DEF', 'MID', 'ATT'] as Filter[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f}</button>
        ))}
      </div>
      <label className="field">
        <span className="sr-only">Search</span>
        <input type="search" value={search} placeholder="Search players" onChange={(e) => setSearch(e.target.value)} />
      </label>

      <ul className="draft-pool">
        {pool.map((p) => (
          <li key={p.id}>
            <button type="button" className="draft-row" onClick={() => setConfirm(confirm === p.id ? null : p.id)}>
              <b className="rating">{p.overall}</b>
              <span className="grow">
                <strong>{playerName(p)}</strong>
                <small className="block muted">{p.positions.join(', ')}</small>
              </span>
            </button>
            {confirm === p.id && (
              <div className="grid-2 draft-confirm">
                <button type="button" className="btn primary" disabled={onClock !== me} onClick={() => draft(p)}>Draft {p.lastName}</button>
                <button type="button" className="btn secondary" onClick={() => setSelected(p)}>Attributes</button>
              </div>
            )}
          </li>
        ))}
        {pool.length === 0 && <li className="muted small">Nobody left who matches.</li>}
      </ul>

      {recent.length > 0 && (
        <section className="card">
          <div className="card-label"><span>Latest picks</span></div>
          {recent.map((x) => {
            const p = game.players[x.playerId];
            const c = game.clubs[x.clubId];
            return (
              <div key={x.pick} className="po-row">
                <small className="muted">#{x.pick}</small>
                <ClubDot colours={c.colours} size={12} />
                <span className="grow">{playerName(p)} <small className="muted">({p.position}, {p.overall})</small></span>
                <small className="muted">{c.shortName}</small>
              </div>
            );
          })}
        </section>
      )}

      {selected && <PlayerSheet player={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
