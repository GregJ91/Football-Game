import { useEffect, useMemo, useState } from 'react';
import { describeEvent, playerLabel, type CommentaryLine } from '../../engine/match/commentary';
import { ENGINE, playerEnergy, type TeamTalk } from '../../engine/match/engine';
import { useGame, userSide } from '../../state/store';
import { positionsLabel } from '../../engine/players/ratings';
import { ClubDot, matchKits } from '../components/ClubArt';
import { TacticsPicker } from '../components/TacticsPicker';

type Speed = 'normal' | 'fast';
const TICK_MS: Record<Speed, number> = { normal: 280, fast: 60 };

const TALKS: { talk: TeamTalk; label: string; hint: string }[] = [
  { talk: 'praise', label: 'Praise', hint: "Well done, keep it up." },
  { talk: 'calm', label: 'Calm', hint: 'Keep your heads, stick to the plan.' },
  { talk: 'rally', label: 'Rally', hint: "I want more. Get stuck in!" },
];

export function Match() {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const live = useGame((s) => s.live);
  const fixture = useGame((s) => s.liveFixture);
  const notes = useGame((s) => s.liveNotes);
  const tick = useGame((s) => s.liveTick);
  const teamTalk = useGame((s) => s.liveTeamTalk);
  const setLiveTactics = useGame((s) => s.liveSetTactics);
  // Legends: the formation is locked for the whole game.
  const locked = game.legends?.formations?.[game.userClubId];
  const sub = useGame((s) => s.liveSub);
  const skip = useGame((s) => s.liveSkip);
  const finish = useGame((s) => s.liveFinish);

  const [speed, setSpeed] = useState<Speed>('normal');
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<'tactics' | 'subs' | null>(null);
  const [subOut, setSubOut] = useState<string | null>(null);

  const running = !!live && !live.finished && !live.halfTimePending && !paused && sheet === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, TICK_MS[speed]);
    return () => clearInterval(id);
  }, [running, speed, tick]);

  const lines = useMemo(() => {
    if (!live || !fixture) return [];
    const name = (id: string | undefined) => playerLabel(id ? live.players[id] : undefined);
    const clubName = (side: 'home' | 'away') => game.clubs[side === 'home' ? fixture.homeId : fixture.awayId].name;
    const out: CommentaryLine[] = [];
    for (const e of live.events) {
      const l = describeEvent(e, name, clubName);
      if (l) out.push(l);
    }
    for (const n of notes) out.push({ minute: n.minute, kind: 'info', text: n.text });
    // Newest first; within a minute keep insertion order reversed too.
    return out.map((l, i) => ({ l, i })).sort((a, b) => b.l.minute - a.l.minute || b.i - a.i).map((x) => x.l);
  }, [live, live?.events.length, notes, fixture, game]);

  if (!live || !fixture) return null;
  const home = game.clubs[fixture.homeId];
  const away = game.clubs[fixture.awayId];
  const kits = matchKits(home, away);
  const side = userSide(game, fixture);
  const ours = live[side];
  const possession = Math.round((live.homePossession / Math.max(1, live.ticks)) * 100);
  const progress = Math.min(100, (live.minute / live.endMinute) * 100);

  return (
    <main className="screen match">
      <section className="scoreboard">
        <div className="score-row">
          <div className="team"><ClubDot colours={kits.home} size={20} /><span>{home.name}</span></div>
          <div className="score big">{live.homeGoals} – {live.awayGoals}</div>
          <div className="team right"><ClubDot colours={kits.away} size={20} /><span>{away.name}</span></div>
        </div>
        {live.opts.firstLeg && (
          <div className="agg">Aggregate {live.homeGoals + live.opts.firstLeg.home} – {live.awayGoals + live.opts.firstLeg.away}</div>
        )}
        <div className="clock">
          <span className="minute">{live.finished ? 'FT' : live.halfTimePending ? 'HT' : `${live.minute}'`}</span>
          <span className="track"><i style={{ width: `${progress}%` }} /></span>
        </div>
        <div className="poss">
          <div className="poss-labels"><span>Possession {possession}%</span><span>Shots {live.shotsHome} – {live.shotsAway}</span><span>{100 - possession}%</span></div>
          <span className="poss-bar"><i style={{ width: `${possession}%` }} /></span>
        </div>
        {live.penalties && <div className="pens">{live.penalties.home} – {live.penalties.away} on penalties</div>}
      </section>

      <ol className="ticker" aria-live="polite">
        {lines.map((l, i) => (
          <li key={i} className={`line line-${l.kind} ${l.side ? (l.side === side ? 'ours' : 'theirs') : ''}`}>
            <span className="min">{l.minute}'</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ol>

      {live.finished ? (
        <div className="match-controls">
          <button type="button" className="btn primary big" onClick={finish}>Continue</button>
        </div>
      ) : (
        <div className="match-controls">
          <div className="pills compact">
            <button type="button" className="pill" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>
            <button type="button" className="pill" aria-pressed={speed === 'normal'} onClick={() => setSpeed('normal')}>Normal</button>
            <button type="button" className="pill" aria-pressed={speed === 'fast'} onClick={() => setSpeed('fast')}>Fast</button>
          </div>
          <div className="grid-3">
            <button type="button" className="btn tile" onClick={() => setSheet('subs')}>Subs ({ours.subsUsed}/{ENGINE.maxSubs})</button>
            <button type="button" className="btn tile" onClick={() => setSheet('tactics')}>Tactics</button>
            <button type="button" className="btn primary" onClick={skip}>Skip to FT</button>
          </div>
        </div>
      )}

      {live.halfTimePending && (
        <div className="sheet-backdrop center">
          <div className="popup" role="dialog" aria-modal="true" aria-label="Half-time team talk">
            <div className="eyebrow">Half time · {live.homeGoals}–{live.awayGoals}</div>
            <h2>Team talk</h2>
            <p className="muted">What do you say to the players?</p>
            <div className="stack">
              {TALKS.map((t) => (
                <button key={t.talk} type="button" className="choice" onClick={() => teamTalk(t.talk)}>
                  <strong>{t.label}</strong>
                  <small>"{t.hint}"</small>
                </button>
              ))}
            </div>
            <button type="button" className="link-btn" onClick={() => setSheet('tactics')}>Change tactics first</button>
          </div>
        </div>
      )}

      {sheet === 'tactics' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Tactics" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong className="grow">Tactics</strong><button type="button" className="link-btn" onClick={() => setSheet(null)}>Done</button></div>
            <TacticsPicker tactics={ours.tactics} onChange={(t) => setLiveTactics(locked ? { ...t, formation: locked } : t)} locked={locked} />
            {ours.mods.notes.length > 0 && (
              <ul className="notes">
                {ours.mods.notes.map((n, i) => (
                  <li key={i} className={`note ${n.effect > 0.005 ? 'good' : n.effect < -0.005 ? 'bad' : 'neutral'}`}>
                    <span aria-hidden="true">{n.effect > 0.005 ? '▲' : n.effect < -0.005 ? '▼' : '•'}</span>{n.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {sheet === 'subs' && (
        <div className="sheet-backdrop" onClick={() => { setSheet(null); setSubOut(null); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Substitutions" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong className="grow">{subOut ? 'Bring on…' : 'Take off…'}</strong>
              <button type="button" className="link-btn" onClick={() => { setSheet(null); setSubOut(null); }}>Done</button>
            </div>
            {ours.subsUsed >= ENGINE.maxSubs && <p className="muted">All substitutions used.</p>}
            <ul className="player-list">
              {(subOut ? ours.bench.map((p) => ({ player: p, slot: p.position })) : ours.onPitch).map(({ player, slot }) => (
                <li key={player.id}>
                  <button
                    type="button"
                    className="player-row"
                    disabled={ours.subsUsed >= ENGINE.maxSubs}
                    aria-pressed={subOut === player.id}
                    onClick={() => {
                      if (!subOut) setSubOut(player.id);
                      else {
                        sub(subOut, player.id);
                        setSubOut(null);
                        setSheet(null);
                      }
                    }}
                  >
                    <span className={`pos pos-${slot}`}>{slot}</span>
                    <span className="ovr">{player.overall}</span>
                    <span className="who"><strong>{playerLabel(player)}</strong><small>{positionsLabel(player)}{ours.booked.has(player.id) ? ' · Booked' : ''}</small></span>
                    <span className="role"><small>Energy</small>{Math.round(playerEnergy(live, side, player.id))}%</span>
                  </button>
                </li>
              ))}
            </ul>
            {subOut && <button type="button" className="link-btn" onClick={() => setSubOut(null)}>← Pick a different player</button>}
          </div>
        </div>
      )}
    </main>
  );
}
