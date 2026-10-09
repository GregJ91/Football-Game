import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGame } from './state/store';
import { ResultPopup } from './ui/components/ResultPopup';
import { TabBar } from './ui/components/TabBar';
import { Toast } from './ui/components/Toast';
import { TopBar } from './ui/components/TopBar';
import { Club } from './ui/screens/Club';
import { Cups } from './ui/screens/Cups';
import { Inbox } from './ui/screens/Inbox';
import { CreateClub } from './ui/screens/CreateClub';
import { Fixtures } from './ui/screens/Fixtures';
import { Hub } from './ui/screens/Hub';
import { League } from './ui/screens/League';
import { Match } from './ui/screens/Match';
import { PreMatch } from './ui/screens/PreMatch';
import { SeasonEnd } from './ui/screens/SeasonEnd';
import { Squad } from './ui/screens/Squad';
import { Start } from './ui/screens/Start';
import { Tactics } from './ui/screens/Tactics';
import { Transfers } from './ui/screens/Transfers';
export function App() {
    const screen = useGame((s) => s.screen);
    const hasGame = useGame((s) => s.game !== null);
    if (screen === 'start' || !hasGame)
        return screen === 'create' ? _jsx(CreateClub, {}) : _jsx(Start, {});
    if (screen === 'create')
        return _jsx(CreateClub, {});
    if (screen === 'seasonEnd')
        return _jsx(SeasonEnd, {});
    if (screen === 'match')
        return _jsx(Match, {});
    if (screen === 'prematch')
        return _jsx(PreMatch, {});
    return (_jsxs("div", { className: "app-shell", children: [_jsx(TopBar, {}), _jsxs("div", { className: "app-body", children: [screen === 'inbox' && _jsx(Inbox, {}), screen === 'hub' && _jsx(Hub, {}), screen === 'squad' && _jsx(Squad, {}), screen === 'tactics' && _jsx(Tactics, {}), screen === 'transfers' && _jsx(Transfers, {}), screen === 'club' && _jsx(Club, {}), screen === 'league' && _jsx(League, {}), screen === 'fixtures' && _jsx(Fixtures, {}), screen === 'cups' && _jsx(Cups, {})] }), _jsx(TabBar, {}), _jsx(ResultPopup, {}), _jsx(Toast, {})] }));
}
