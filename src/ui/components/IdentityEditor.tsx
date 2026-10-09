import type { ClubColours, CrestDesign, KitPattern } from '../../engine/types';
import { CREST_ICONS, CREST_SHAPES, Crest, Kit } from './ClubArt';

export const PRIMARIES = [
  ['Red', '#B3202A'], ['Royal blue', '#1F4FB8'], ['Claret', '#6B1832'], ['Green', '#1E7A43'],
  ['Black', '#111111'], ['Amber', '#F2B632'], ['Purple', '#5B2A86'], ['White', '#F5F1E6'],
  ['Sky', '#8EC5F0'], ['Navy', '#14234D'], ['Tangerine', '#F07A1F'], ['Gold', '#E8C04A'],
] as const;
const PATTERNS: KitPattern[] = ['plain', 'stripes', 'hoops', 'halves', 'sash'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export interface Identity {
  colours: ClubColours;
  awayKit: ClubColours;
  crest: CrestDesign;
}

function KitPicker({ title, kit, onChange }: { title: string; kit: ClubColours; onChange: (k: ClubColours) => void }) {
  const swatches = (key: 'primary' | 'secondary') => (
    <div className="swatches">
      {PRIMARIES.map(([label, hex]) => (
        <button
          key={hex}
          type="button"
          aria-label={`${title} ${key === 'primary' ? 'main' : 'second'} colour: ${label}`}
          aria-pressed={kit[key] === hex}
          className="swatch"
          style={{ background: hex }}
          onClick={() => onChange({ ...kit, [key]: hex })}
        />
      ))}
    </div>
  );
  return (
    <fieldset className="field">
      <legend>{title}</legend>
      <small className="muted">Main colour</small>
      {swatches('primary')}
      <small className="muted">Second colour</small>
      {swatches('secondary')}
      <div className="pills compact">
        {PATTERNS.map((p) => (
          <button key={p} type="button" className="pill" aria-pressed={kit.pattern === p} onClick={() => onChange({ ...kit, pattern: p })}>
            {cap(p)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Crest, home kit and away kit: a preview and the pickers. */
export function IdentityEditor({ value, onChange, shortName }: { value: Identity; onChange: (v: Identity) => void; shortName: string }) {
  const { colours, awayKit, crest } = value;
  return (
    <div className="identity">
      <div className="identity-preview">
        <Crest colours={colours} size={64} design={crest} initials={shortName} />
        <Kit colours={colours} size={72} label="Home kit" />
        <Kit colours={awayKit} size={72} label="Away kit" />
      </div>

      <fieldset className="field">
        <legend>Crest</legend>
        <div className="crest-grid" role="group" aria-label="Crest shape">
          {CREST_SHAPES.map((shape) => (
            <button key={shape} type="button" className="crest-pick" aria-pressed={crest.shape === shape} aria-label={`${cap(shape)} crest`} onClick={() => onChange({ ...value, crest: { ...crest, shape } })}>
              <Crest colours={colours} size={34} design={{ ...crest, shape }} initials={shortName} />
            </button>
          ))}
        </div>
        <div className="crest-grid" role="group" aria-label="Crest icon">
          {CREST_ICONS.map((icon) => (
            <button key={icon} type="button" className="crest-pick" aria-pressed={crest.icon === icon} aria-label={icon === 'none' ? 'No icon' : `${cap(icon)} icon`} onClick={() => onChange({ ...value, crest: { ...crest, icon } })}>
              <Crest colours={colours} size={34} design={{ ...crest, icon }} initials={shortName} />
            </button>
          ))}
        </div>
        <label className="toggle no-rule" htmlFor="crest-initials">
          <input id="crest-initials" type="checkbox" checked={!!crest.initials} onChange={(e) => onChange({ ...value, crest: { ...crest, initials: e.target.checked } })} />
          <span>Show {shortName || 'the short name'} on the crest</span>
        </label>
      </fieldset>

      <KitPicker title="Home kit" kit={colours} onChange={(k) => onChange({ ...value, colours: k })} />
      <KitPicker title="Away kit" kit={awayKit} onChange={(k) => onChange({ ...value, awayKit: k })} />
    </div>
  );
}
