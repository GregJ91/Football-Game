import { useState } from 'react';
import { FORMATIONS } from '../../engine/match/selection';
import { effectiveRating, positionFit } from '../../engine/players/ratings';
import { userSelection } from '../../engine/season/season';
import type { Formation, Player, Position } from '../../engine/types';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { TacticsPicker } from '../components/TacticsPicker';

/** Pitch rows (attack at the top) as indexes into each formation's slots, left to right. */
const PITCH_ROWS: Record<Formation, number[][]> = {
  '4-4-2': [[9, 10], [8, 6, 7, 5], [4, 2, 3, 1], [0]],
  '4-3-3': [[9, 10, 8], [6, 7], [5], [4, 2, 3, 1], [0]],
  '4-2-3-1': [[10], [9, 8, 7], [5, 6], [4, 2, 3, 1], [0]],
  '3-5-2': [[9, 10], [8, 6, 7, 4], [5], [1, 2, 3], [0]],
  '5-3-2': [[9, 10], [7, 8], [6], [5, 2, 3, 4, 1], [0]],
};

const surname = (p: Player) => p.lastName;

function fitClass(p: Player, slot: Position) {
  const fit = positionFit(p.position, slot);
  return fit >= 1 ? 'fit-good' : fit >= 0.85 ? 'fit-ok' : 'fit-poor';
}

function statusOf(p: Player): string | null {
  if (p.injuryWeeks > 0) return `Injured ${p.injuryWeeks}w`;
  if (p.suspendedMatches > 0) return 'Suspended';
  return null;
}

export function Tactics() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const setTactics = useGame((s) => s.setTactics);
  const setLineupSlot = useGame((s) => s.setLineupSlot);
  const resetLineup = useGame((s) => s.resetLineup);
  const setAssistantTactics = useGame((s) => s.setAssistantTactics);
  const [picking, setPicking] = useState<number | null>(null);

  const club = userClub(game);
  const formation = club.tactics.formation;
  const slots = FORMATIONS[formation];
  const squad = squadOf(game, club.id);
  const { selection, covers } = userSelection(game);
  // Selection drops empty slots; map back to slot indexes for the pitch.
  const bySlot: (Player | undefined)[] = [];
  {
    let k = 0;
    slots.forEach((slot, i) => {
      if (selection.slots[k] === slot && selection.xi[k]) {
        bySlot[i] = selection.xi[k];
        k++;
      }
    });
  }
  const starters = new Set(selection.xi.map((p) => p.id));
  const avg = Math.round(selection.xi.reduce((s, p, i) => s + effectiveRating(p, selection.slots[i]), 0) / Math.max(1, selection.xi.length));
  const manual = !!club.lineup;

  const pickingSlot = picking !== null ? slots[picking] : null;
  const candidates = pickingSlot
    ? [...squad].sort((a, b) => {
        const ua = statusOf(a) ? 1 : 0;
        const ub = statusOf(b) ? 1 : 0;
        return ua - ub || effectiveRating(b, pickingSlot) - effectiveRating(a, pickingSlot);
      })
    : [];

  return (
    <main className="screen tactics">
      <header className="screen-head row">
        <h1 className="grow">Tactics</h1>
        <span className={`chip ${manual ? 'chip-accent' : ''}`}>{manual ? 'Your XI' : 'Auto XI'}</span>
      </header>

      <section className="pitch" aria-label={`Starting eleven in a ${formation}`}>
        <div className="pitch-lines" aria-hidden="true">
          <i className="halfway" />
          <i className="circle" />
          <i className="box top" />
          <i className="box bottom" />
        </div>
        {PITCH_ROWS[formation].map((row, r) => (
          <div key={r} className="pitch-row">
            {row.map((i) => {
              const p = bySlot[i];
              const slot = slots[i];
              return (
                <button key={i} type="button" className={`slot-chip ${p ? fitClass(p, slot) : 'empty'}`} onClick={() => setPicking(i)}>
                  <span className="slot-rating">{p ? Math.round(effectiveRating(p, slot)) : '–'}</span>
                  <span className="slot-name">{p ? surname(p) : 'Pick'}</span>
                  <span className="slot-pos">{slot}{p && p.position !== slot ? ` (${p.position})` : ''}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <div className="pitch-meta">
        <span>Team rating <strong>{avg}</strong></span>
        <span className="legend"><i className="fit-good" /> Natural <i className="fit-ok" /> Can cover <i className="fit-poor" /> Out of position</span>
      </div>

      {covers.length > 0 && (
        <section className="card warn-card">
          {covers.map((c) => {
            const out = game.players[c.outId];
            const inn = c.inId ? game.players[c.inId] : null;
            const why = c.reason === 'left' ? 'has left the club' : `is ${c.reason}`;
            return (
              <p key={c.slotIndex} className="note bad">
                <span aria-hidden="true">▼</span>
                {out ? `${out.firstName} ${out.lastName}` : 'A chosen player'} {why}. {inn ? `${inn.lastName} covers at ${c.slot}.` : ''}
              </p>
            );
          })}
        </section>
      )}

      <div className="grid-2">
        <button type="button" className="btn secondary" onClick={resetLineup} disabled={!manual}>
          Pick best XI
        </button>
        <div className="hint left">Tap a player on the pitch to change who plays there.</div>
      </div>

      <section className="card">
        <TacticsPicker tactics={club.tactics} onChange={setTactics} />
        <label className="toggle">
          <input
            id="assistant-tactics"
            type="checkbox"
            checked={!!game.settings?.assistantTactics}
            onChange={(e) => setAssistantTactics(e.target.checked)}
          />
          <span>
            Let my assistant set tactics for simmed matches
            <small>He'll counter each opponent using your chosen players. Matches you play live use your own tactics.</small>
          </span>
        </label>
      </section>

      <section className="card">
        <div className="card-label"><span>Substitutes</span><span>Best of the rest</span></div>
        <ul className="bench-list">
          {selection.bench.map((p) => (
            <li key={p.id}><span className={`pos pos-${p.position}`}>{p.position}</span>{p.firstName} {p.lastName}<b>{p.overall}</b></li>
          ))}
        </ul>
      </section>

      {picking !== null && pickingSlot && (
        <div className="sheet-backdrop" onClick={() => setPicking(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Choose a player for ${pickingSlot}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">Who plays {pickingSlot}?</strong>
              <button type="button" className="link-btn" onClick={() => setPicking(null)}>Close</button>
            </div>
            <p className="muted small">Rating shown is for this position, including fitness.</p>
            <ul className="player-list">
              {candidates.map((p) => {
                const st = statusOf(p);
                const current = bySlot[picking]?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="player-row"
                      aria-pressed={current}
                      disabled={!!st}
                      onClick={() => {
                        setLineupSlot(picking, p.id);
                        setPicking(null);
                      }}
                    >
                      <span className={`pos pos-${p.position}`}>{p.position}</span>
                      <span className={`ovr ${fitClass(p, pickingSlot)}`}>{Math.round(effectiveRating(p, pickingSlot))}</span>
                      <span className="who">
                        <strong>{p.firstName} {p.lastName}</strong>
                        <small>{p.age} yrs · OVR {p.overall} · Fit {Math.round(p.fitness)}%</small>
                      </span>
                      <span className="role">
                        {st ? <em className="warn">{st}</em> : current ? 'Here' : starters.has(p.id) ? 'In XI' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
