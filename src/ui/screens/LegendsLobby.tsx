import { useState } from 'react';
import type { LegendsDifficulty } from '../../engine/types';
import { useGame } from '../../state/store';

const DIFFICULTIES: { d: LegendsDifficulty; label: string }[] = [
  { d: 'easy', label: 'Easy' },
  { d: 'medium', label: 'Medium' },
  { d: 'hard', label: 'Hard' },
];

/** Online Legends: the room before the draft. The host shares the code and starts; friends wait. */
export function LegendsLobby() {
  const online = useGame((s) => s.online);
  const start = useGame((s) => s.startOnlineLegends);
  const leave = useGame((s) => s.leaveOnline);
  const showToast = useGame((s) => s.showToast);
  const [difficulty, setDifficulty] = useState<LegendsDifficulty>('medium');
  if (!online) return null;
  const host = online.role === 'host';
  const seats = online.lobby?.seats ?? [];

  const share = async () => {
    const text = `Join my Legends draft in The Journey of a Football Manager. Code: ${online.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(online.code);
        showToast('Code copied.');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="screen legends-lobby">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={leave}>← Leave</button>
        <div className="eyebrow">Legends online</div>
        <h1>{host ? 'Your room' : online.connected ? "You're in" : 'Finding the host…'}</h1>
      </header>

      <section className="card room-code">
        <small className="muted">Room code</small>
        <strong>{online.code}</strong>
        {host && <button type="button" className="btn secondary" onClick={() => void share()}>Share the code</button>}
      </section>

      <section className="card">
        <div className="card-label"><span>Players</span><span>{seats.length} of 20 teams</span></div>
        {seats.length === 0 && <p className="muted small">Waiting for the host to answer. Keep this screen open.</p>}
        {seats.map((s) => (
          <div key={s.pid} className="po-row">
            <span className={`dot ${s.connected ? 'on' : ''}`} aria-hidden="true" />
            <span className="grow">
              <strong>{s.teamName}</strong>
              <small className="block muted">{s.name}{s.host ? ' · host' : ''}</small>
            </span>
          </div>
        ))}
        <p className="muted small">The AI takes the other {Math.max(0, 20 - seats.length)} teams. Everyone needs signal while you play; the host's phone runs the game, so keep it open.</p>
      </section>

      {host ? (
        <>
          <fieldset className="field">
            <legend>AI difficulty</legend>
            <div className="grid-3">
              {DIFFICULTIES.map(({ d, label }) => (
                <button key={d} type="button" className="choice" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="btn primary big" onClick={() => start(difficulty)}>
            Start the draft ({seats.length} {seats.length === 1 ? 'person' : 'people'})
          </button>
        </>
      ) : (
        <p className="hint">The host starts the draft when everyone's in.</p>
      )}
    </main>
  );
}

/** On the Hub in an online game: who's here and who's ready for the next matchday. */
export function OnlineCard() {
  const online = useGame((s) => s.online);
  const game = useGame((s) => s.game);
  const setReady = useGame((s) => s.setReady);
  if (!online || !game) return null;
  const seats = online.lobby?.seats ?? [];
  const me = seats.find((s) => s.clubId === game.userClubId);
  return (
    <section className="card online-card">
      <div className="card-label">
        <span>Online · {online.code}</span>
        <span className={online.connected ? 'good' : 'warn'}>{online.connected ? 'Connected' : 'Reconnecting…'}</span>
      </div>
      <div className="ready-list">
        {seats.map((s) => (
          <span key={s.pid} className={s.host ? 'host' : s.ready ? 'ready' : ''} title={s.name}>
            {s.host ? '★' : s.ready ? '✓' : '…'} {s.teamName}
          </span>
        ))}
      </div>
      {online.role === 'guest' ? (
        <button type="button" className={`btn ${me?.ready ? 'secondary' : 'primary'}`} onClick={() => setReady(!me?.ready)}>
          {me?.ready ? 'Ready ✓ (tap to undo)' : "Set your team, then tap I'm ready"}
        </button>
      ) : (
        <p className="muted small">{online.allReady ? 'Everyone is ready.' : 'Waiting for friends to tap Ready.'} You play the matches for everyone: Continue, Sim match or Play match as normal.</p>
      )}
    </section>
  );
}
