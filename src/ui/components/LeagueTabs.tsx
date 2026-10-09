import { useGame } from '../../state/store';

/** Switch between the league table and your fixtures (both under the League tab). */
export function LeagueTabs() {
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  return (
    <div className="segmented" role="tablist">
      <button type="button" role="tab" aria-selected={screen === 'league'} onClick={() => go('league')}>Table</button>
      <button type="button" role="tab" aria-selected={screen === 'fixtures'} onClick={() => go('fixtures')}>Your fixtures</button>
    </div>
  );
}
