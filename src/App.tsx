import { useGame } from './state/store';
import { ResultPopup } from './ui/components/ResultPopup';
import { TabBar } from './ui/components/TabBar';
import { Toast } from './ui/components/Toast';
import { TopBar } from './ui/components/TopBar';
import { Club } from './ui/screens/Club';
import { Cups } from './ui/screens/Cups';
import { Europe } from './ui/screens/Europe';
import { Inbox } from './ui/screens/Inbox';
import { CreateClub } from './ui/screens/CreateClub';
import { Fixtures } from './ui/screens/Fixtures';
import { Hub } from './ui/screens/Hub';
import { League } from './ui/screens/League';
import { Match } from './ui/screens/Match';
import { PreMatch } from './ui/screens/PreMatch';
import { SeasonEnd } from './ui/screens/SeasonEnd';
import { Unemployed } from './ui/screens/Unemployed';
import { Squad } from './ui/screens/Squad';
import { Start } from './ui/screens/Start';
import { Tactics } from './ui/screens/Tactics';
import { Transfers } from './ui/screens/Transfers';

export function App() {
  const screen = useGame((s) => s.screen);
  const hasGame = useGame((s) => s.game !== null);
  const unemployed = useGame((s) => !!s.game?.unemployed);

  if (screen === 'start' || !hasGame) return screen === 'create' ? <CreateClub /> : <Start />;
  if (screen === 'create') return <CreateClub />;
  // Sacked: out of work until you take a job (or start again).
  if (unemployed) return <Unemployed />;
  if (screen === 'seasonEnd') return <SeasonEnd />;
  if (screen === 'match') return <Match />;
  if (screen === 'prematch') return <PreMatch />;

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        {screen === 'inbox' && <Inbox />}
        {screen === 'hub' && <Hub />}
        {screen === 'squad' && <Squad />}
        {screen === 'tactics' && <Tactics />}
        {screen === 'transfers' && <Transfers />}
        {screen === 'club' && <Club />}
        {screen === 'league' && <League />}
        {screen === 'fixtures' && <Fixtures />}
        {screen === 'cups' && <Cups />}
        {screen === 'europe' && <Europe />}
      </div>
      <TabBar />
      <ResultPopup />
      <Toast />
    </div>
  );
}
