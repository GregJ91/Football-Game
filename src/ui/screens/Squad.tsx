import { useState } from 'react';
import { pickTeam } from '../../engine/match/selection';
import { playerName } from '../../engine/players/generate';
import { POSITION_ORDER } from '../../engine/players/ratings';
import type { AttributeKey, Player } from '../../engine/types';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { TacticsPicker } from '../components/TacticsPicker';
import { money } from '../format';

const ATTR_GROUPS: { title: string; keys: AttributeKey[] }[] = [
  { title: 'Technical', keys: ['finishing', 'passing', 'dribbling', 'tackling', 'heading'] },
  { title: 'Mental', keys: ['positioning', 'vision', 'workRate', 'composure'] },
  { title: 'Physical', keys: ['pace', 'strength', 'stamina'] },
  { title: 'Goalkeeping', keys: ['handling', 'reflexes'] },
];

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function status(p: Player): string | null {
  if (p.injuryWeeks > 0) return `Injured ${p.injuryWeeks}w`;
  if (p.suspendedMatches > 0) return 'Suspended';
  return null;
}

export function Squad() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const setTactics = useGame((s) => s.setTactics);
  const setAssistantTactics = useGame((s) => s.setAssistantTactics);
  const [selected, setSelected] = useState<Player | null>(null);
  const club = userClub(game);
  const squad = squadOf(game, club.id).sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.overall - a.overall,
  );
  const selection = pickTeam(squad, club.tactics.formation);
  const starters = new Set(selection.xi.map((p) => p.id));
  const bench = new Set(selection.bench.map((p) => p.id));

  return (
    <main className="screen squad">
      <header className="screen-head">
        <h1>Squad</h1>
      </header>

      <section className="card">
        <div className="card-label">
          <span>Tactics</span>
          <span>Best XI picked automatically</span>
        </div>
        <TacticsPicker tactics={club.tactics} onChange={setTactics} />
        <label className="toggle">
          <input
            type="checkbox"
            checked={!!game.settings?.assistantTactics}
            onChange={(e) => setAssistantTactics(e.target.checked)}
          />
          <span>
            Let my assistant set tactics for simmed matches
            <small>He'll counter each opponent. Matches you play live use your own tactics.</small>
          </span>
        </label>
      </section>

      <ul className="player-list">
        {squad.map((p) => {
          const st = status(p);
          const apps = p.seasonStats.apps;
          return (
            <li key={p.id}>
              <button type="button" className="player-row" onClick={() => setSelected(p)}>
                <span className={`pos pos-${p.position}`}>{p.position}</span>
                <span className="ovr">{p.overall}</span>
                <span className="who">
                  <strong>{playerName(p)}</strong>
                  <small>
                    {p.age} yrs · {apps} apps{p.seasonStats.goals ? ` · ${p.seasonStats.goals} gls` : ''}
                    {apps ? ` · ${(p.seasonStats.ratingSum / apps).toFixed(1)} avg` : ''}
                  </small>
                </span>
                <span className="role">
                  {st ? <em className="warn">{st}</em> : starters.has(p.id) ? 'XI' : bench.has(p.id) ? 'Sub' : ''}
                  <small>Fit {Math.round(p.fitness)}%</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={playerName(selected)} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="ovr big">{selected.overall}</span>
              <div className="grow">
                <strong>{playerName(selected)}</strong>
                <small>
                  {selected.position} · {selected.age} yrs · Potential {selected.potential}
                </small>
              </div>
              <button type="button" className="link-btn" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="facts">
              <span>Value {money(selected.value)}</span>
              <span>Wage {money(selected.wage)}/wk</span>
              <span>Contract to {selected.contractEnd}</span>
              <span>Morale {Math.round(selected.morale)}</span>
              <span>Form {selected.form.toFixed(1)}</span>
            </div>
            <div className="attr-groups">
              {ATTR_GROUPS.filter((g) => g.title !== 'Goalkeeping' || selected.position === 'GK').map((g) => (
                <div key={g.title}>
                  <h3>{g.title}</h3>
                  {g.keys.map((k) => (
                    <div key={k} className="attr">
                      <span>{label(k)}</span>
                      <span className="bar">
                        <i style={{ width: `${selected.attributes[k]}%` }} />
                      </span>
                      <b>{selected.attributes[k]}</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
