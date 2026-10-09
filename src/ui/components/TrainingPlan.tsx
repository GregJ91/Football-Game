import { useState } from 'react';
import { facilitiesOf } from '../../engine/club/facilities';
import { playerName } from '../../engine/players/generate';
import { POSITION_ORDER, positionsLabel } from '../../engine/players/ratings';
import { INDIVIDUAL_FOCUS, INTENSITY, TEAM_FOCUS, focusAttributes, retrainWeeks, trainingOf } from '../../engine/players/training';
import type { AttributeKey, IndividualFocus, Player, TeamFocus, TrainingIntensity } from '../../engine/types';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';

const LABELS: Partial<Record<AttributeKey, string>> = { longShots: 'Long shots', offTheBall: 'Off the ball', workRate: 'Work rate', oneOnOnes: 'One on ones', aerialAbility: 'Aerial ability' };
const label = (k: string) => LABELS[k as AttributeKey] ?? k[0].toUpperCase() + k.slice(1);

/** The training ground: team focus, intensity, individual plans and recent progress. */
export function TrainingPlan() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const setTraining = useGame((s) => s.setTraining);
  const setPlayerTraining = useGame((s) => s.setPlayerTraining);
  const setRetrain = useGame((s) => s.setRetrain);
  const [editing, setEditing] = useState<Player | null>(null);
  const club = userClub(game);
  const t = trainingOf(club);
  const squad = squadOf(game, club.id).sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.overall - a.overall);
  const coach = club.staff?.coach;
  const log = club.trainingLog ?? [];

  const focusLabel = (p: Player) => (p.trainingFocus ? INDIVIDUAL_FOCUS[p.trainingFocus].name : p.position === 'GK' ? 'Goalkeeping' : 'Team');

  return (
    <div className="training">
      <section className="card">
        <div className="card-label"><span>Team focus</span></div>
        <div className="focus-grid">
          {(Object.keys(TEAM_FOCUS) as TeamFocus[]).map((f) => (
            <button key={f} type="button" className="choice" aria-pressed={t.focus === f} onClick={() => setTraining({ ...t, focus: f })}>
              <strong>{TEAM_FOCUS[f].name}</strong>
              <small>{TEAM_FOCUS[f].effect}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-label"><span>Intensity</span></div>
        <div className="segmented" role="radiogroup" aria-label="Training intensity">
          {(Object.keys(INTENSITY) as TrainingIntensity[]).map((i) => (
            <button key={i} type="button" role="radio" aria-checked={t.intensity === i} aria-selected={t.intensity === i} onClick={() => setTraining({ ...t, intensity: i })}>
              {INTENSITY[i].name}
            </button>
          ))}
        </div>
        <p className="muted small">{INTENSITY[t.intensity].effect}</p>
        <p className="muted small">
          Coach: {coach ? `${coach.name} (rated ${coach.rating})` : 'vacant'} · Training ground level {facilitiesOf(club).training}. Both speed up progress.
        </p>
      </section>

      <section className="card">
        <div className="card-label"><span>Individual training</span><span>Tap to change</span></div>
        <ul className="med-list">
          {squad.map((p) => (
            <li key={p.id}>
              <button type="button" className="med-row" onClick={() => setEditing(p)}>
                <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                <span className="grow">
                  <strong>{playerName(p)}</strong>
                  {p.retrain ? (
                    <>
                      <small className="block muted">Learning {p.retrain.position}: {Math.round(p.retrain.progress)}%</small>
                      <span className="fit-bar mid"><i style={{ width: `${p.retrain.progress}%` }} /></span>
                    </>
                  ) : (
                    <small className="block muted">{p.age} yrs · potential {p.potential > p.overall + 4 ? 'still growing' : 'near his peak'}</small>
                  )}
                </span>
                <span className={`chip ${p.trainingFocus ? 'chip-accent' : ''}`}>{focusLabel(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-label"><span>Recent progress</span><span>{log.length}</span></div>
        {log.length === 0 ? (
          <p className="muted small">Improvements from training show here. Young players with room to grow improve most.</p>
        ) : (
          <ul className="med-list">
            {log.slice(0, 15).map((g, i) => (
              <li key={i} className="med-log">
                <span className="grow"><strong>{g.name}</strong><small className="block muted">Week {g.week + 1}</small></span>
                <span className="good">{g.attribute === 'position' ? `Can now play ${g.value}` : `${label(g.attribute)} ↑ ${g.value}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Training for ${playerName(editing)}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">{playerName(editing)}</strong>
              <button type="button" className="link-btn" onClick={() => setEditing(null)}>Done</button>
            </div>
            <div className="card-label"><span>Focus</span></div>
            <div className="pills compact">
              <button type="button" className="pill" aria-pressed={!editing.trainingFocus} onClick={() => setPlayerTraining(editing.id, null)}>
                {editing.position === 'GK' ? 'Goalkeeping (default)' : 'Follow the team'}
              </button>
              {(Object.keys(INDIVIDUAL_FOCUS) as IndividualFocus[]).filter((f) => f !== 'goalkeeping' || editing.position === 'GK').map((f) => (
                <button key={f} type="button" className="pill" aria-pressed={editing.trainingFocus === f} onClick={() => setPlayerTraining(editing.id, f)}>
                  {INDIVIDUAL_FOCUS[f].name}
                </button>
              ))}
            </div>
            <p className="muted small">Working on: {focusAttributes(club, editing).map(label).join(', ') || 'match preparation only'}.</p>
            <div className="card-label"><span>Learn a new position</span></div>
            <label className="field">
              <span className="visually-hidden">New position</span>
              <select value={editing.retrain?.position ?? ''} onChange={(e) => setRetrain(editing.id, (e.target.value || null) as never)}>
                <option value="">None</option>
                {POSITION_ORDER.filter((pos) => !editing.positions.includes(pos) && (pos === 'GK') === (editing.position === 'GK')).map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </label>
            <p className="muted small">
              Plays {positionsLabel(editing)} now. Learning a new position takes about {retrainWeeks(editing)} weeks of training at his age.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
