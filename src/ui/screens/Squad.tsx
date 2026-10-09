import { hp } from '../help';
import { useState } from 'react';
import { userSelection } from '../../engine/season/season';
import { playerName } from '../../engine/players/generate';
import { POSITION_ORDER, positionsLabel } from '../../engine/players/ratings';
import type { Player } from '../../engine/types';
import { squadOf, userClub } from '../../engine/world';
import { useGame } from '../../state/store';
import { PlayerSheet } from '../components/PlayerSheet';
import { MedicalReport } from '../components/MedicalReport';
import { TrainingPlan } from '../components/TrainingPlan';
import { moneyPw } from '../../engine/economy/finance';
import { ROLE_LABEL, TIRED, moodOf, roleOf } from '../../engine/players/squad';

function status(p: Player): string | null {
  if (p.injuryWeeks > 0) return `${p.injuryName ?? 'Injured'} ${p.injuryWeeks}w`;
  if (p.suspendedMatches > 0) return 'Suspended';
  return null;
}

export function Squad() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const go = useGame((s) => s.go);
  const [selected, setSelected] = useState<Player | null>(null);
  const [tab, setTab] = useState<'players' | 'training' | 'medical'>('players');
  const club = userClub(game);
  const squad = squadOf(game, club.id).sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.overall - a.overall,
  );
  const { selection } = userSelection(game);
  const starters = new Set(selection.xi.map((p) => p.id));
  const bench = new Set(selection.bench.map((p) => p.id));

  return (
    <main className="screen squad">
      <header className="screen-head">
        <h1>Squad</h1>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'players'} onClick={() => setTab('players')}>Players</button>
          <button type="button" role="tab" aria-selected={tab === 'training'} onClick={() => setTab('training')} {...hp('training')}>Training</button>
          <button type="button" role="tab" aria-selected={tab === 'medical'} onClick={() => setTab('medical')} {...hp('medical')}>
            Medical{squad.some((p) => p.injuryWeeks > 0) ? ` (${squad.filter((p) => p.injuryWeeks > 0).length})` : ''}
          </button>
        </div>
      </header>

      {tab === 'medical' && <MedicalReport onOpen={setSelected} />}
      {tab === 'training' && <TrainingPlan />}
      {tab === 'players' && (<>

      <button type="button" className="card link-card" onClick={() => go('tactics')}>
        <span>
          <strong>Starting XI and tactics</strong>
          <small>{club.tactics.formation} · {club.lineup ? 'your chosen XI' : 'best XI picked automatically'}</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>

      <ul className="player-list">
        {squad.map((p) => {
          const st = status(p);
          const apps = p.seasonStats.apps;
          return (
            <li key={p.id}>
              <button type="button" className="player-row" onClick={() => setSelected(p)}>
                <span className={`pos pos-${p.position}`} {...hp('position')}>{positionsLabel(p)}</span>
                <span className="ovr" {...hp('ovr')}>{p.overall}</span>
                <span className="who">
                  <strong><i className={`mood-dot mood-${moodOf(p)}`} aria-label={moodOf(p)} {...hp('morale')} />{playerName(p)}</strong>
                  <small>
                    {ROLE_LABEL[roleOf(p)]} · <span className={p.fitness < TIRED ? 'warn' : undefined} {...hp('fitness')}>Fit {Math.round(p.fitness)}%</span> · {p.age} yrs · {apps} apps{p.seasonStats.goals ? ` · ${p.seasonStats.goals} gls` : ''}
                    {apps ? ` · ${(p.seasonStats.ratingSum / apps).toFixed(1)} avg` : ''}
                  </small>
                </span>
                <span className="role">
                  {st ? <em className="warn">{st}</em> : p.loanFrom ? <em>On loan</em> : p.transferRequest ? <em className="warn">Wants away</em> : p.listed ? <em className="warn">Listed</em> : starters.has(p.id) ? 'XI' : bench.has(p.id) ? 'Sub' : ''}
                  <small {...hp('wage')}>{moneyPw(p.wage)}</small>
                  {p.contractEnd <= game.season && <small className="warn">Contract ends</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      </>)}

      {selected && <PlayerSheet player={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
