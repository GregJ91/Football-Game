import { hp } from '../help';
import { useState } from 'react';
import { dateIn, formatDate, scoutDueDate } from '../../engine/calendar';
import { scoutReportsPerWeek, staffRating } from '../../engine/club/staff';
import { POSITION_ORDER, positionsLabel } from '../../engine/players/ratings';
import { isKnown, ratingRange } from '../../engine/transfers/market';
import {
  INTEREST_TEXT, MAX_MISSIONS, REGION_LABEL, VERDICT_TEXT, cannotSendMission, missionDays, missionFinds, missionLabel, scoutReports,
  shortlistPlayers,
} from '../../engine/transfers/scouting';
import type { Player, Position, ScoutRegion, ScoutVerdict } from '../../engine/types';
import { leagueNameOf, playerById } from '../../engine/world';
import { useGame } from '../../state/store';
import { money } from '../format';

const AGES = [{ v: 99, label: 'Any age' }, { v: 18, label: '18 or under' }, { v: 21, label: '21 or under' }, { v: 24, label: '24 or under' }, { v: 29, label: '29 or under' }];
const VALUES = [0, 100_000, 500_000, 1_000_000, 5_000_000, 20_000_000, 50_000_000];
const REGIONS: ScoutRegion[] = ['any', 'home', 'abroad', 'free'];
const VERDICT_SHORT: Record<ScoutVerdict, string> = { star: 'Star', starter: 'Starter', squad: 'Squad', no: 'Not for us' };
type ReportFilter = 'all' | 'recommended' | 'young';

export function ScoutingPanel({ onOpen }: { onOpen: (p: Player) => void }) {
  const game = useGame((s) => s.game)!;
  useGame((s) => s.rev);
  const send = useGame((s) => s.sendScoutMission);
  const cancel = useGame((s) => s.cancelScoutMission);
  const showToast = useGame((s) => s.showToast);
  const [position, setPosition] = useState<Position | 'ANY'>('ANY');
  const [maxAge, setMaxAge] = useState(99);
  const [maxValue, setMaxValue] = useState(0);
  const [region, setRegion] = useState<ScoutRegion>('any');
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [shown, setShown] = useState(20);

  const club = game.clubs[game.userClubId];
  const chief = club.staff?.scout;
  const rating = staffRating(club, 'scout');
  const left = game.scoutReportsLeft ?? 0;
  const missions = game.scoutMissions ?? [];
  const watching = (game.scoutAssignments ?? []).map((a) => playerById(game, a.playerId)).filter((p): p is Player => !!p);
  const shortlist = shortlistPlayers(game);
  const blocked = cannotSendMission(game);
  const reports = scoutReports(game).filter(({ p, r }) =>
    filter === 'recommended' ? r.verdict === 'star' || r.verdict === 'starter' : filter === 'young' ? p.age <= 21 && r.potential >= 4 : true,
  );

  const go = () => {
    const problem = send({ position, maxAge, maxValue, region });
    showToast(problem ?? 'Scouts sent out. Their findings will be in your inbox.');
  };

  return (
    <>
      <section className="card scout-team" {...hp('chiefScout')}>
        <div className="card-label">
          <span>Chief scout</span>
          <span>{left} of {scoutReportsPerWeek(club)} reports left this week</span>
        </div>
        <p className="scout-chief">
          <strong>{chief ? chief.name : 'No chief scout'}</strong>
          <span className="muted small"> · rating {rating}/20 · missions take {missionDays(game)} days and find {missionFinds(game)} players</span>
        </p>
        {!chief && <p className="muted small">Hire a chief scout in Club → Staff for more and quicker reports.</p>}
      </section>

      <section className="card">
        <div className="card-label" {...hp('scoutMission')}><span>New scouting mission</span><span>{missions.length}/{MAX_MISSIONS} out</span></div>
        <p className="muted small">Tell your scouts what you need. They come back with the best players who fit and would consider joining.</p>
        <div className="grid-3">
          <label className="field">
            <span>Position</span>
            <select value={position} onChange={(e) => setPosition(e.target.value as Position | 'ANY')}>
              <option value="ANY">Any</option>
              {POSITION_ORDER.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Age</span>
            <select value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))}>
              {AGES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Max value</span>
            <select value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))}>
              {VALUES.map((v) => <option key={v} value={v}>{v ? money(v) : 'Any'}</option>)}
            </select>
          </label>
        </div>
        <div className="pills compact" role="group" aria-label="Where to look">
          {REGIONS.map((r) => (
            <button key={r} type="button" className="pill" aria-pressed={region === r} onClick={() => setRegion(r)}>{REGION_LABEL[r]}</button>
          ))}
        </div>
        <button type="button" className="btn primary" disabled={!!blocked} onClick={go}>Send scouts</button>
        {blocked && <p className="muted small">{blocked}</p>}
      </section>

      {(missions.length > 0 || watching.length > 0) && (
        <section className="card">
          <div className="card-label"><span>Out scouting</span></div>
          {missions.map((m) => (
            <div key={m.id} className="po-row">
              <span className="grow">
                {missionLabel(m)}
                <small className="block muted">Back {formatDate(dateIn(game.season, Math.floor(m.dueDay / 7), m.dueDay % 7))}</small>
              </span>
              <button type="button" className="link-btn" onClick={() => cancel(m.id)}>Recall</button>
            </div>
          ))}
          {watching.map((p) => (
            <button key={p.id} type="button" className="po-row as-button" onClick={() => onOpen(p)}>
              <span className="grow">
                Watching {p.firstName} {p.lastName}
                <small className="block muted">{p.position} · report due {formatDate(scoutDueDate(game, p.id)!)}</small>
              </span>
            </button>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-label" {...hp('shortlist')}><span>Shortlist</span><span>{shortlist.length}</span></div>
        {shortlist.length === 0 ? (
          <p className="muted small">Star a player from his profile to keep an eye on him here.</p>
        ) : (
          <ul className="player-list">{shortlist.map((p) => <ScoutRow key={p.id} p={p} onOpen={onOpen} />)}</ul>
        )}
      </section>

      <section className="card">
        <div className="card-label"><span>Scout reports</span><span>{reports.length}</span></div>
        <div className="pills compact" role="group" aria-label="Filter reports">
          {(['all', 'recommended', 'young'] as ReportFilter[]).map((f) => (
            <button key={f} type="button" className="pill" aria-pressed={filter === f} onClick={() => { setFilter(f); setShown(20); }}>
              {f === 'all' ? 'All' : f === 'recommended' ? 'Recommended' : 'Young talent'}
            </button>
          ))}
        </div>
        {reports.length === 0 && <p className="muted small">No reports yet. Send the scouts on a mission, or scout a player from his profile.</p>}
        <ul className="player-list">
          {reports.slice(0, shown).map(({ p, r }) => {
            const from = p.clubId ? game.clubs[p.clubId] : null;
            return (
              <li key={p.id}>
                <button type="button" className="player-row report-row" onClick={() => onOpen(p)}>
                  <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
                  <span className="ovr">{p.overall}</span>
                  <span className="who">
                    <strong>{p.firstName} {p.lastName}</strong>
                    <small>{p.age} yrs · {from ? `${from.name} · ${leagueNameOf(game, from.id)}` : 'Free agent'}</small>
                    <small className="muted">{VERDICT_TEXT[r.verdict]} {INTEREST_TEXT[r.interest]}</small>
                  </span>
                  <span className="role">
                    <span className={`verdict verdict-${r.verdict}`}>{VERDICT_SHORT[r.verdict]}</span>
                    <small className="stars">{'★'.repeat(r.potential)}{'☆'.repeat(5 - r.potential)}</small>
                    <small>{r.price ? money(r.price) : 'Free'}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {reports.length > shown && <button type="button" className="btn secondary" onClick={() => setShown(shown + 20)}>Show more</button>}
      </section>
    </>
  );
}

function ScoutRow({ p, onOpen }: { p: Player; onOpen: (p: Player) => void }) {
  const game = useGame((s) => s.game)!;
  const club = game.clubs[game.userClubId];
  const known = isKnown(game, club, p);
  const [lo, hi] = ratingRange(p);
  const from = p.clubId ? game.clubs[p.clubId] : null;
  return (
    <li>
      <button type="button" className="player-row" onClick={() => onOpen(p)}>
        <span className={`pos pos-${p.position}`}>{positionsLabel(p)}</span>
        <span className={`ovr ${known ? '' : 'range'}`}>{known ? p.overall : `${lo}–${hi}`}</span>
        <span className="who">
          <strong>{p.firstName} {p.lastName}{p.listed || p.transferRequest ? <small className="warn"> Listed</small> : null}</strong>
          <small>{p.age} yrs · {from ? from.name : 'Free agent'}</small>
        </span>
        <span className="role">{money(p.value)}</span>
      </button>
    </li>
  );
}
