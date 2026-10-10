import { useGame } from './state/store';
import { ResultPopup } from './ui/components/ResultPopup';
import { TabBar } from './ui/components/TabBar';
import { Toast } from './ui/components/Toast';
import { TopBar } from './ui/components/TopBar';
import { Club } from './ui/screens/Club';
import { Cups } from './ui/screens/Cups';
import { Europe } from './ui/screens/Europe';
import { Awards } from './ui/screens/Awards';
import { Inbox } from './ui/screens/Inbox';
import { CreateClub } from './ui/screens/CreateClub';
import { Fixtures } from './ui/screens/Fixtures';
import { Hub } from './ui/screens/Hub';
import { League } from './ui/screens/League';
import { Match } from './ui/screens/Match';
import { PreMatch } from './ui/screens/PreMatch';
import { SeasonEnd } from './ui/screens/SeasonEnd';
import { Unemployed } from './ui/screens/Unemployed';
import { Challenges } from './ui/screens/Challenges';
import { ChallengeResult } from './ui/screens/ChallengeResult';
import { Squad } from './ui/screens/Squad';
import { Start } from './ui/screens/Start';
import { Tactics } from './ui/screens/Tactics';
import { Transfers } from './ui/screens/Transfers';
import { Manager } from './ui/screens/Manager';
import { Achievements } from './ui/screens/Achievements';
import { Legends, LegendsSeasonEnd } from './ui/screens/Legends';
import { LegendsDraft } from './ui/screens/LegendsDraft';
import { LegendsSetup } from './ui/screens/LegendsSetup';

export function App() {
  const screen = useGame((s) => s.screen);
  const hasGame = useGame((s) => s.game !== null);
  const unemployed = useGame((s) => !!s.game?.unemployed);
  // A challenge won (and not carried on) or lost.
  const challengeOver = useGame((s) => {
    const c = s.game?.challenge;
    return !!c && (c.status === 'lost' || (c.status === 'won' && !c.continued));
  });

  const legendsDraft = useGame((s) => !!s.game?.legends?.draft);
  const legends = useGame((s) => s.game?.mode === 'legends');

  if (screen === 'challenges') return <Challenges />;
  if (screen === 'legendsSetup') return <LegendsSetup />;
  if (screen === 'achievements') return <Achievements />;
  if (screen === 'start' || !hasGame) return screen === 'create' ? <CreateClub /> : <Start />;
  if (screen === 'create') return <CreateClub />;
  // Sacked: out of work until you take a job (or start again).
  if (unemployed) return <Unemployed />;
  if (challengeOver && screen !== 'match') return <ChallengeResult />;
  if (legends && legendsDraft) return <LegendsDraft />;
  if (screen === 'seasonEnd') return legends ? <LegendsSeasonEnd /> : <SeasonEnd />;
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
        {screen === 'awards' && <Awards />}
        {screen === 'manager' && <Manager />}
        {screen === 'legends' && <Legends />}
      </div>
      <TabBar />
      <ResultPopup />
      <Toast />
    </div>
  );
}
