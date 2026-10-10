import { useEffect, useState } from 'react';
import { listSaves, type SaveMeta } from '../../state/persistence';
import { useGame } from '../../state/store';
import { seasonLabel } from '../format';
import { formatDate } from '../../engine/calendar';
import { ACHIEVEMENTS } from '../../engine/achievements';
import { APP_BUILT_AT, APP_VERSION } from '../../version';
import { isAndroid, isInstalled, isIos, isSamsungBrowser, useInstall, useOfflineReady, useOnline } from '../../offline';

export function Start() {
  const go = useGame((s) => s.go);
  const continueGame = useGame((s) => s.continueGame);
  const setChallengeDraft = useGame((s) => s.setChallengeDraft);
  const [save, setSave] = useState<SaveMeta | null>(null);
  const achievements = useGame((s) => s.achievements);
  const loadAchievements = useGame((s) => s.loadAchievements);
  const done = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);
  const online = useOnline();
  const offlineReady = useOfflineReady();
  const { canPrompt, install } = useInstall();
  const installed = isInstalled();
  const [checking, setChecking] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);

  // Ask for the latest version now rather than waiting for the next launch.
  const checkForUpdates = async () => {
    setUpdateNote(null);
    if (!navigator.onLine) {
      setUpdateNote("No signal, so we can't check for updates. You can still play: everything's saved on this device.");
      return;
    }
    setChecking(true);
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (!reg) {
        setUpdateNote("You're on the latest version.");
        return;
      }
      await reg.update();
      if (reg.installing || reg.waiting) {
        setUpdateNote('A new version is downloading. The game will restart in a moment.');
        // The new version takes over and reloads by itself; this is a fallback.
        window.setTimeout(() => window.location.reload(), 5000);
      } else setUpdateNote("You're on the latest version.");
    } catch {
      setUpdateNote("Couldn't check: are you online?");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    listSaves()
      .then((saves) => setSave(saves[0] ?? null))
      .catch(() => setSave(null));
  }, []);

  return (
    <main className="screen start">
      {!online && (
        <p className="offline-banner" role="status">
          ✈ No signal: playing offline. Your game saves on this device as normal.
        </p>
      )}
      <div className="start-hero">
        <svg width="96" height="110" viewBox="0 0 84 96" aria-hidden="true">
          <path d="M42 4 L78 14 L78 48 C78 72 60 86 42 92 C24 86 6 72 6 48 L6 14 Z" fill="#B3202A" stroke="#F2B632" strokeWidth="4" />
          <path d="M42 26 L50 42 L68 44 L54 56 L58 74 L42 64 L26 74 L30 56 L16 44 L34 42 Z" fill="#F5F1E6" />
        </svg>
        <h1>
          <small>The journey of a</small>
          Football Manager
        </h1>
        <p>Found a club at the bottom of the pyramid. Take it to the top.</p>
      </div>
      <div className="stack">
        {save && (
          <button type="button" className="btn primary big" onClick={() => void continueGame()}>
            Continue
            <small>
              {save.clubName} · {seasonLabel(save.season)}
            </small>
          </button>
        )}
        <button type="button" className={`btn big ${save ? 'secondary' : 'primary'}`} onClick={() => {
          setChallengeDraft(null);
          go('create');
        }}>
          New game
        </button>
        <button type="button" className="btn big secondary" onClick={() => go('challenges')}>
          Challenge mode
        </button>
        <button type="button" className="card achievements-link" onClick={() => go('achievements')}>
          <span className="grow">
            <strong>🏆 Achievements</strong>
            <span className="track"><i style={{ width: `${Math.round((done / ACHIEVEMENTS.length) * 100)}%` }} /></span>
          </span>
          <b>{done} / {ACHIEVEMENTS.length}</b>
        </button>
        {save && <p className="hint">Starting a new game replaces your current save.</p>}
      </div>

      {offlineReady !== null && (offlineReady === false ? null : (
        <section className={`card offline-card ${installed ? 'installed' : ''}`}>
          <div className="card-label">
            <span>Play offline</span>
            <span className="good">✓ Ready</span>
          </div>
          {installed ? (
            <p className="small">Installed. The whole game is on this device, so it plays with no signal, on a plane or anywhere. Saves stay on the device.</p>
          ) : (
            <>
              <p className="small">The whole game is stored on this device. Install it to your home screen to play with no signal, on a plane or anywhere.</p>
              {canPrompt ? (
                <button type="button" className="btn primary" onClick={() => void install()}>Install the app</button>
              ) : isSamsungBrowser() ? (
                <p className="small muted">
                  On Samsung Internet: tap the menu <span aria-hidden="true">☰</span> at the bottom right, then <strong>Add page to</strong> → <strong>Home screen</strong>
                  {' '}(or tap the install icon <span aria-hidden="true">⤓</span> in the address bar). Open it once with signal before you fly.
                </p>
              ) : isAndroid() ? (
                <p className="small muted">
                  On Android (Samsung, Pixel and others) in Chrome: tap the menu <span aria-hidden="true">⋮</span> at the top right, then <strong>Install app</strong> or
                  {' '}<strong>Add to Home screen</strong>. Open it once with signal before you fly.
                </p>
              ) : isIos() ? (
                <p className="small muted">On iPhone: tap the Share button <span aria-hidden="true">⎙</span> in Safari, then <strong>Add to Home Screen</strong>. Open it once with signal before you fly.</p>
              ) : (
                <p className="small muted">Use your browser's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. Open it once with signal before you fly.</p>
              )}
            </>
          )}
        </section>
      ))}

      <footer className="version">
        <span>
          Version v{APP_VERSION}
          <small>Updated {formatDate(APP_BUILT_AT, true)}</small>
        </span>
        <button type="button" className="link-btn" disabled={checking} onClick={() => void checkForUpdates()}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {updateNote && <p className="hint">{updateNote}</p>}
      </footer>
    </main>
  );
}
