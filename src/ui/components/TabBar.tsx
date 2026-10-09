import type { ReactNode } from 'react';
import { useGame, type Screen } from '../../state/store';

const TABS: { screen: Screen; label: string; icon: ReactNode }[] = [
  { screen: 'hub', label: 'Hub', icon: <path d="M3 11 L12 4 L21 11 V20 H3 Z" /> },
  {
    screen: 'squad',
    label: 'Squad',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20 C2 15 16 15 16 20" />
        <circle cx="17" cy="9" r="2.5" />
      </>
    ),
  },
  { screen: 'league', label: 'League', icon: <path d="M4 6 H20 M4 12 H20 M4 18 H20" /> },
  {
    screen: 'fixtures',
    label: 'Fixtures',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10 H20 M9 3 V7 M15 3 V7" />
      </>
    ),
  },
];

export function TabBar() {
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.screen}
          type="button"
          className={screen === t.screen ? 'active' : undefined}
          aria-current={screen === t.screen ? 'page' : undefined}
          onClick={() => go(t.screen)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {t.icon}
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
