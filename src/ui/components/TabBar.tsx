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
  {
    screen: 'tactics',
    label: 'Tactics',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 12 H21" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  { screen: 'transfers', label: 'Transfers', icon: <path d="M4 8 H18 L14 4 M20 16 H6 L10 20" /> },
  {
    screen: 'club',
    label: 'Club',
    icon: (
      <>
        <path d="M3 20 V10 L12 5 L21 10 V20" />
        <path d="M8 20 V14 H16 V20" />
      </>
    ),
  },
];

export function TabBar() {
  const current = useGame((s) => s.screen);
  // League and fixtures are reached from the Hub.
  const screen = current === 'fixtures' || current === 'league' || current === 'cups' || current === 'inbox' ? 'hub' : current;
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
