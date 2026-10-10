import { useState } from 'react';
import {
  DRAFT_GROUPS, GROUP_NAME, clubOnTheClock, draftGroup, draftLength, draftOptions, draftPool, draftRound, draftedTeam, groupOf, seasonsPlayed,
  squadNeeds,
} from '../../engine/legends';
import { playerName } from '../../engine/players/generate';
import type { DraftGroup, Player } from '../../engine/types';
import { squadOf } from '../../engine/world';
import { useGame } from '../../state/store';
import { ClubDot } from '../components/ClubArt';
import { PlayerSheet } from '../components/PlayerSheet';
import { PITCH_ROWS } from './Tactics';

type Filter = 'all' | Exclude<DraftGroup, 'ANY'>;

/**
 * The draft: your team on the pitch in its formation, filling up as you pick;
 * keepers first, then defenders, midfielders and attackers.
 */
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
  const mine = onClock === me;
  const group = draftGroup(d);
  const team = draftedTeam(game, me);
  const squad = squadOf(game, me);
  const needs = squadNeeds(team.formation);
  const have = (g: Exclude<DraftGroup, 'ANY'>) => squad.filter((p) => groupOf(p.position) === g).length;
  // Places in the starting XI still empty for this round's group.
  const open = team.slots.filter((slot, i) => !team.xi[i] && (group === 'ANY' || groupOf(slot) === group));
  const q = search.trim().toLowerCase();
  const pool = (group === 'ANY' ? draftPool(game).filter((p) => filter === 'all' || groupOf(p.position) === filter) : draftOptions(game))
    .filter((p) => !q || playerName(p).toLowerCase().includes(q))
    .slice(0, 60);
  const myLast = [...d.picks].reverse().findIndex((p) => p.clubId === me);
  const recent = (myLast === -1 ? d.picks : d.picks.slice(d.picks.length - myLast)).slice(-19).reverse();
  const myPicksLeft = d.slots.slice(d.pick).filter((s) => s.clubId === me && s.group === group).length;

  const draft = (p: Player) => {
    const err = pick(p.id);
    setConfirm(null);
    setSearch('');
    showToast(err ?? `${playerName(p)} joins ${game.clubs[me].name}.`);
  };

  return (
    <main className="screen legends-draft">
      <header className="screen-head">
        <div className="eyebrow">{d.kind === 'initial' ? `Legends draft · ${team.formation}` : `Summer draft · before season ${seasonsPlayed(game) + 1}`}</div>
        <h1>{GROUP_NAME[group]}</h1>
        <small className="muted">Round {draftRound(d)} · pick {d.pick + 1} of {draftLength(d)}{myPicksLeft ? ` · ${myPicksLeft} more for you in this group` : ''}</small>
      </header>

      {d.kind === 'initial' && (
        <div className="phase-steps">
          {DRAFT_GROUPS.map((g) => (
            <span key={g} className={`${g === group ? 'now' : ''} ${have(g) >= needs[g] ? 'done' : ''}`}>
              {GROUP_NAME[g]} <b>{have(g)}/{needs[g]}</b>
            </span>
          ))}
        </div>
      )}

      <section className={`card clock ${mine ? 'mine' : ''}`}>
        <ClubDot colours={game.clubs[onClock ?? me].colours} size={22} />
        <strong className="grow">{mine ? "You're on the clock" : `${game.clubs[onClock ?? me].name} are picking`}</strong>
        <button type="button" className="btn secondary small" disabled={!mine} onClick={() => showToast(autoPick() ?? 'Picked for you.')}>Auto pick</button>
      </section>

      <section className="pitch draft-pitch" aria-label={`Your team in a ${team.formation}`}>
        <div className="pitch-lines" aria-hidden="true">
          <i className="halfway" />
          <i className="circle" />
          <i className="box top" />
          <i className="box bottom" />
        </div>
        {PITCH_ROWS[team.formation].map((row, r) => (
          <div key={r} className="pitch-row">
            {row.map((i) => {
              const p = team.xi[i];
              const slot = team.slots[i];
              const wanted = !p && (group === 'ANY' || groupOf(slot) === group);
              return (
                <button key={i} type="button" className={`slot-chip ${p ? 'fit-good' : 'empty'} ${wanted ? 'wanted' : ''}`} onClick={() => p && setSelected(p)}>
                  <span className="slot-rating">{p ? p.overall : '–'}</span>
                  <span className="slot-name">{p ? p.lastName : wanted ? 'Pick' : ''}</span>
                  <span className="slot-pos">{slot}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-label"><span>Bench and reserves</span><span>{team.reserves.length}</span></div>
        {team.reserves.length === 0 ? (
          <p className="muted small">Your first pick at each position goes into the team; the next ones are your back-ups.</p>
        ) : (
          <div className="reserve-chips">
            {team.reserves.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p)}>
                <b>{p.overall}</b> {p.lastName} <small>{p.position}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="card-label draft-pool-label">
        <span>{group === 'ANY' ? 'Players left' : `${GROUP_NAME[group]} left`}</span>
        {open.length > 0 && <span>Your team needs: {open.join(', ')}</span>}
      </div>
      {group === 'ANY' && (
        <div className="segmented" role="tablist">
          {(['all', ...DRAFT_GROUPS] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f}</button>
          ))}
        </div>
      )}
      <label className="field">
        <span className="sr-only">Search</span>
        <input type="search" value={search} placeholder="Search players" onChange={(e) => setSearch(e.target.value)} />
      </label>

      <ul className="draft-pool">
        {pool.map((p) => {
          const fits = open.filter((slot) => p.positions.includes(slot));
          return (
            <li key={p.id}>
              <button type="button" className="draft-row" onClick={() => setConfirm(confirm === p.id ? null : p.id)}>
                <b className="rating">{p.overall}</b>
                <span className="grow">
                  <strong>{playerName(p)}</strong>
                  <small className="block muted">{p.positions.join(', ')}</small>
                </span>
                {fits.length > 0 && <em className="fits">Starts at {fits[0]}</em>}
              </button>
              {confirm === p.id && (
                <div className="grid-2 draft-confirm">
                  <button type="button" className="btn primary" disabled={!mine} onClick={() => draft(p)}>{mine ? `Draft ${p.lastName}` : 'Not your pick'}</button>
                  <button type="button" className="btn secondary" onClick={() => setSelected(p)}>Attributes</button>
                </div>
              )}
            </li>
          );
        })}
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
