import { useEffect } from 'react';
import { ACHIEVEMENTS, type AchievementCategory } from '../../engine/achievements';
import { useGame } from '../../state/store';
import { seasonLabel } from '../format';

const CATEGORIES: AchievementCategory[] = ['Career', 'Climbing the pyramid', 'Silverware', 'Europe', 'Big moments', 'Players and transfers', 'Chairman', 'Challenges'];

/** Every achievement: unlocked ones with where and when, locked ones with what to do. */
export function Achievements() {
  const unlocked = useGame((s) => s.achievements);
  const load = useGame((s) => s.loadAchievements);
  const go = useGame((s) => s.go);
  const hasGame = useGame((s) => s.game !== null);
  useEffect(() => {
    void load();
  }, [load]);
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const pct = Math.round((done / ACHIEVEMENTS.length) * 100);

  return (
    <main className="screen achievements">
      <header className="screen-head">
        <button type="button" className="link-btn" onClick={() => go(hasGame ? 'manager' : 'start')}>← Back</button>
        <div className="eyebrow">Across all your careers</div>
        <h1>Achievements</h1>
      </header>

      <section className="card achievement-progress">
        <div className="card-label"><span>Unlocked</span><span>{done} of {ACHIEVEMENTS.length}</span></div>
        <span className="track"><i style={{ width: `${pct}%` }} /></span>
        <p className="muted small">Kept on this device, whichever club or challenge you play. Testing options (the top-flight giant start, unlimited money, all players interested) don't earn them.</p>
      </section>

      {CATEGORIES.map((cat) => {
        const list = ACHIEVEMENTS.filter((a) => a.category === cat);
        const got = list.filter((a) => unlocked[a.id]).length;
        return (
          <section key={cat} className="card">
            <div className="card-label"><span>{cat}</span><span>{got}/{list.length}</span></div>
            <ul className="achievement-list">
              {list.map((a) => {
                const u = unlocked[a.id];
                return (
                  <li key={a.id} className={u ? 'got' : 'locked'}>
                    <span className="badge-icon" aria-hidden="true">{u ? '🏆' : '🔒'}</span>
                    <span className="grow">
                      <strong>{a.name}</strong>
                      <small>{a.description}</small>
                      {u && <small className="when">{u.clubName} · {seasonLabel(u.season)}</small>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
