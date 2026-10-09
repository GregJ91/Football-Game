import { useGame } from './state/store';
import { ResultPopup } from './ui/components/ResultPopup';
import { TabBar } from './ui/components/TabBar';
import { CreateClub } from './ui/screens/CreateClub';
import { Fixtures } from './ui/screens/Fixtures';
import { Hub } from './ui/screens/Hub';
import { League } from './ui/screens/League';
import { Match } from './ui/screens/Match';
import { PreMatch } from './ui/screens/PreMatch';
import { SeasonEnd } from './ui/screens/SeasonEnd';
import { Squad } from './ui/screens/Squad';
import { Start } from './ui/screens/Start';

export function App() {
  const screen = useGame((s) => s.screen);
  const hasGame = useGame((s) => s.game !== null);

  if (screen === 'start' || !hasGame) return screen === 'create' ? <CreateClub /> : <Start />;
  if (screen === 'create') return <CreateClub />;
  if (screen === 'seasonEnd') return <SeasonEnd />;
  if (screen === 'match') return <Match />;
  if (screen === 'prematch') return <PreMatch />;

  return (
    <div className="app-shell">
      <div className="app-body">
        {screen === 'hub' && <Hub />}
        {screen === 'squad' && <Squad />}
        {screen === 'league' && <League />}
        {screen === 'fixtures' && <Fixtures />}
      </div>
      <TabBar />
      <ResultPopup />
    </div>
  );
}
