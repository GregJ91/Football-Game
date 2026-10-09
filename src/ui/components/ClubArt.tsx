import { useId } from 'react';
import type { ClubColours } from '../../engine/types';

const SHIRT = 'M30 10 L18 14 L4 30 L16 42 L24 36 L24 90 L72 90 L72 36 L80 42 L92 30 L78 14 L66 10 C62 18 34 18 30 10 Z';

export function Kit({ colours, size = 96 }: { colours: ClubColours; size?: number }) {
  const clip = useId();
  const { primary, secondary, pattern } = colours;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Home kit">
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

export function Crest({ colours, size = 84 }: { colours: ClubColours; size?: number }) {
  return (
    <svg width={size} height={size * (96 / 84)} viewBox="0 0 84 96" role="img" aria-label="Club crest">
      <path d="M42 4 L78 14 L78 48 C78 72 60 86 42 92 C24 86 6 72 6 48 L6 14 Z" fill={colours.primary} stroke={colours.secondary} strokeWidth="5" />
      <path d="M42 26 L50 42 L68 44 L54 56 L58 74 L42 64 L26 74 L30 56 L16 44 L34 42 Z" fill={colours.secondary} />
    </svg>
  );
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
