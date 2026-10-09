import { hp } from '../help';
import { FORMATIONS } from '../../engine/match/selection';
import type { Formation, Mentality, Pressing, Tactics } from '../../engine/types';

const MENTALITIES: Mentality[] = ['defensive', 'balanced', 'attacking'];
const PRESSING: { value: Pressing; label: string }[] = [
  { value: 'low', label: 'Sit deep' },
  { value: 'medium', label: 'Mid block' },
  { value: 'high', label: 'High press' },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function TacticsPicker({ tactics, onChange }: { tactics: Tactics; onChange: (t: Tactics) => void }) {
  return (
    <div className="tactics-picker">
      <fieldset {...hp('formation')}>
        <legend>Formation</legend>
        <div className="pills">
          {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
            <button key={f} type="button" className="pill" aria-pressed={tactics.formation === f} onClick={() => onChange({ ...tactics, formation: f })}>
              {f}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset {...hp('mentality')}>
        <legend>Mentality</legend>
        <div className="pills">
          {MENTALITIES.map((m) => (
            <button key={m} type="button" className="pill" aria-pressed={tactics.mentality === m} onClick={() => onChange({ ...tactics, mentality: m })}>
              {cap(m)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset {...hp('pressing')}>
        <legend>Pressing</legend>
        <div className="pills">
          {PRESSING.map((p) => (
            <button key={p.value} type="button" className="pill" aria-pressed={tactics.pressing === p.value} onClick={() => onChange({ ...tactics, pressing: p.value })}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function tacticsLabel(t: Tactics): string {
  const press = PRESSING.find((p) => p.value === t.pressing)?.label ?? t.pressing;
  return `${t.formation} · ${cap(t.mentality)} · ${press}`;
}
