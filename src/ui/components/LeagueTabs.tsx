import { useGame } from '../../state/store';

/** Switch between the league table, your fixtures, the cups and Europe (all under the League tab). */
export function LeagueTabs() {
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  return (
    <div className="segmented" role="tablist">
      <button type="button" role="tab" aria-selected={screen === 'league'} onClick={() => go('league')}>Table</button>
      <button type="button" role="tab" aria-selected={screen === 'fixtures'} onClick={() => go('fixtures')}>Fixtures</button>
      <button type="button" role="tab" aria-selected={screen === 'cups'} onClick={() => go('cups')}>Cups</button>
      <button type="button" role="tab" aria-selected={screen === 'europe'} onClick={() => go('europe')}>Europe</button>
    </div>
  );
}
