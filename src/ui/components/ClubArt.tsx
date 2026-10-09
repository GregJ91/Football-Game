import { useId } from 'react';
import type { Club, ClubColours, CrestDesign, CrestIcon, CrestShape } from '../../engine/types';

const SHIRT = 'M30 10 L18 14 L4 30 L16 42 L24 36 L24 90 L72 90 L72 36 L80 42 L92 30 L78 14 L66 10 C62 18 34 18 30 10 Z';

export function Kit({ colours, size = 96, label = 'Home kit' }: { colours: ClubColours; size?: number; label?: string }) {
  const clip = useId();
  const { primary, secondary, pattern } = colours;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIRT} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="96" height="96" fill={primary} />
        {pattern === 'stripes' &&
          [14, 34, 54, 74].map((x) => <rect key={x} x={x} y="0" width="9" height="96" fill={secondary} />)}
        {pattern === 'hoops' && [28, 50, 72].map((y) => <rect key={y} x="0" y={y} width="96" height="11" fill={secondary} />)}
        {pattern === 'halves' && <rect x="48" y="0" width="48" height="96" fill={secondary} />}
        {pattern === 'sash' && <path d="M10 10 L30 10 L90 90 L70 90 Z" fill={secondary} />}
      </g>
      <path d={SHIRT} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <path d="M30 10 C34 18 62 18 66 10" fill="none" stroke={secondary} strokeWidth="4" />
    </svg>
  );
}

// ---------------------------------------------------------------- crests

export const CREST_SHAPES: CrestShape[] = ['shield', 'round', 'diamond', 'square', 'badge'];
export const CREST_ICONS: CrestIcon[] = ['star', 'ball', 'crown', 'castle', 'anchor', 'tree', 'bird', 'bolt', 'none'];
export const DEFAULT_CREST: CrestDesign = { shape: 'shield', icon: 'star' };

/** Outline of each crest shape, in an 84 × 96 box. */
const SHAPE_PATH: Record<CrestShape, string> = {
  shield: 'M42 4 L78 14 L78 48 C78 72 60 86 42 92 C24 86 6 72 6 48 L6 14 Z',
  round: 'M42 10 A38 38 0 1 1 41.99 10 Z',
  diamond: 'M42 4 L80 48 L42 92 L4 48 Z',
  square: 'M20 8 H64 A12 12 0 0 1 76 20 V76 A12 12 0 0 1 64 88 H20 A12 12 0 0 1 8 76 V20 A12 12 0 0 1 20 8 Z',
  badge: 'M22 6 H62 L80 24 V68 L62 90 H22 L4 68 V24 Z',
};

/** Each icon, drawn around the crest's middle (42, 46). */
function Icon({ icon, fill, back }: { icon: CrestIcon; fill: string; back: string }) {
  switch (icon) {
    case 'star':
      return <path d="M42 24 L50 40 L68 42 L54 54 L58 72 L42 62 L26 72 L30 54 L16 42 L34 40 Z" fill={fill} />;
    case 'ball':
      return (
        <g>
          <circle cx="42" cy="48" r="18" fill={fill} />
          <path d="M42 39 L50 45 L47 55 L37 55 L34 45 Z" fill={back} />
          <path d="M42 30 V39 M50 45 L58 42 M47 55 L52 63 M37 55 L32 63 M34 45 L26 42" stroke={back} strokeWidth="2" />
        </g>
      );
    case 'crown':
      return <path d="M22 62 L22 36 L32 48 L42 28 L52 48 L62 36 L62 62 Z M22 66 H62 V71 H22 Z" fill={fill} />;
    case 'castle':
      return <path d="M24 70 V40 H30 V33 H35 V40 H40 V33 H44 V40 H49 V33 H54 V40 H60 V70 H48 V58 A6 6 0 0 0 36 58 V70 Z" fill={fill} />;
    case 'anchor':
      return (
        <g fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round">
          <circle cx="42" cy="28" r="5" />
          <path d="M42 33 V70 M31 42 H53 M26 56 C26 66 34 71 42 71 C50 71 58 66 58 56" />
        </g>
      );
    case 'tree':
      return <path d="M42 22 L60 46 H51 L62 60 H22 L33 46 H24 Z M38 60 H46 V72 H38 Z" fill={fill} />;
    case 'bird':
      return <path d="M20 46 C28 34 38 38 42 46 C46 34 58 30 66 36 C58 38 52 44 50 52 C46 62 34 66 24 60 C31 58 36 55 38 51 C33 53 25 52 20 46 Z" fill={fill} />;
    case 'bolt':
      return <path d="M48 22 L28 52 H41 L35 74 L58 42 H45 Z" fill={fill} />;
    default:
      return null;
  }
}

export function Crest({ colours, size = 84, design = DEFAULT_CREST, initials }: { colours: ClubColours; size?: number; design?: CrestDesign; initials?: string }) {
  const text = design.initials && initials ? initials.slice(0, 3).toUpperCase() : null;
  return (
    <svg width={size} height={size * (96 / 84)} viewBox="0 0 84 96" role="img" aria-label="Club crest">
      <path d={SHAPE_PATH[design.shape]} fill={colours.primary} stroke={colours.secondary} strokeWidth="5" />
      <g transform={text ? 'translate(8.4 2) scale(0.8)' : undefined}>
        <Icon icon={design.icon} fill={colours.secondary} back={colours.primary} />
      </g>
      {text && (
        <text x="42" y={design.icon === 'none' ? 55 : 79} textAnchor="middle" fontSize={design.icon === 'none' ? 22 : 13} fontWeight="800" fill={colours.secondary} fontFamily="system-ui, sans-serif">
          {text}
        </text>
      )}
    </svg>
  );
}

/** A club's own crest. */
export function ClubCrest({ club, size }: { club: Club; size?: number }) {
  return <Crest colours={club.colours} size={size} design={club.crest} initials={club.shortName} />;
}

export function ClubDot({ colours, size = 14 }: { colours: ClubColours; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="club-dot"
      style={{ width: size, height: size, background: colours.primary, borderColor: colours.secondary }}
    />
  );
}

// ---------------------------------------------------------------- kit clashes

/** A club's away kit: its own, or the home colours swapped. */
export function awayKitOf(club: Club): ClubColours {
  return club.awayKit ?? { primary: club.colours.secondary, secondary: club.colours.primary, pattern: 'plain' };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clash(a: string, b: string): boolean {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 110;
}

/** What each side wears: the away side changes if its home shirt clashes. */
export function matchKits(home: Club, away: Club): { home: ClubColours; away: ClubColours } {
  return { home: home.colours, away: clash(home.colours.primary, away.colours.primary) ? awayKitOf(away) : away.colours };
}
