import { playerName } from '../players/generate';
import type { Rng } from '../rng';
import { divisionTable } from '../season/table';
import type { Club, GameState, JobOffer, ManagerDeal, ManagerHonour, ManagerRecord, MatchResult, Player } from '../types';
import { addInbox } from '../transfers/market';
import { divisionOf, domesticClubs, withRng } from '../world';
import { careerOf, handOver, spellTrophies } from './career';
import { boardOf, shiftConfidence } from './chairman';

/**
 * The manager's own record across every club: results, tactics, transfer
 * dealings, the players he's managed and the individual awards won. Started
 * lazily, so older saves pick up from the current league table.
 */
export function managerOf(game: GameState): ManagerRecord {
  if (game.manager) return game.manager;
  const club = game.clubs[game.userClubId];
  const rec: ManagerRecord = {
    games: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
    formations: {}, mentalities: {}, feesIn: 0, feesOut: 0, signings: 0, freeSignings: 0, players: {}, honours: [],
  };
  // An older save: count this season's league games so far.
  if (club && !game.unemployed) {
    const row = divisionTable(game, divisionOf(game, club.id).def.id).find((r) => r.clubId === club.id);
    if (row) Object.assign(rec, { games: row.played, won: row.won, drawn: row.drawn, lost: row.lost, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst });
  }
  game.manager = rec;
  return rec;
}

// ---------------------------------------------------------------- matches

/** After any match: if it was ours, it goes on the record. */
export function recordManagerMatch(game: GameState, homeId: string, awayId: string, r: MatchResult) {
  const user = game.userClubId;
  if (game.unemployed || (homeId !== user && awayId !== user)) return;
  const m = managerOf(game);
  const home = homeId === user;
  const us = home ? r.homeGoals : r.awayGoals;
  const them = home ? r.awayGoals : r.homeGoals;
  m.games++;
  m.goalsFor += us;
  m.goalsAgainst += them;
  if (us > them) m.won++;
  else if (us < them) m.lost++;
  else m.drawn++;
  const club = game.clubs[user];
  m.formations[club.tactics.formation] = (m.formations[club.tactics.formation] ?? 0) + 1;
  m.mentalities[club.tactics.mentality] = (m.mentalities[club.tactics.mentality] ?? 0) + 1;
  // Everyone who played for us: apps, goals and the best he's been rated under us.
  const ours = new Set(home ? r.homeXI : r.awayXI);
  for (const id of ours) {
    const p = game.players[id];
    if (!p) continue;
    const e = (m.players[id] ??= { name: playerName(p), position: p.position, peak: p.overall, apps: 0, goals: 0, clubName: club.name });
    e.apps++;
    e.peak = Math.max(e.peak, p.overall);
    e.position = p.position;
    e.clubName = club.name;
  }
  for (const e of r.events) if (e.type === 'goal' && ours.has(e.playerId) && m.players[e.playerId]) m.players[e.playerId].goals++;
}

// ---------------------------------------------------------------- transfers

function deal(game: GameState, p: Player, fee: number, club: Club): ManagerDeal {
  return { name: playerName(p), fee, season: game.season, clubName: club.name };
}

/** A transfer in or out of the user's club. */
export function recordManagerTransfer(game: GameState, p: Player, fromId: string | null, toId: string, fee: number) {
  if (game.unemployed) return;
  const user = game.userClubId;
  if (toId !== user && fromId !== user) return;
  const m = managerOf(game);
  const club = game.clubs[user];
  if (toId === user) {
    m.signings++;
    m.feesOut += fee;
    if (fee === 0) m.freeSignings++;
    else {
      if (!m.biggestSigning || fee > m.biggestSigning.fee) m.biggestSigning = deal(game, p, fee, club);
      if (!m.cheapestSigning || fee < m.cheapestSigning.fee) m.cheapestSigning = deal(game, p, fee, club);
    }
  } else {
    m.feesIn += fee;
    if (fee > 0 && (!m.biggestSale || fee > m.biggestSale.fee)) m.biggestSale = deal(game, p, fee, club);
  }
}

// ---------------------------------------------------------------- honours

/** An individual award for the manager or one of his players. */
export function addHonour(game: GameState, h: Omit<ManagerHonour, 'clubId' | 'clubName' | 'season'> & { season?: number }) {
  if (game.unemployed) return;
  const club = game.clubs[game.userClubId];
  managerOf(game).honours.push({ season: h.season ?? game.season, clubId: club.id, clubName: club.name, ...h });
}

/** Team trophies won in every job, with the club. */
export function teamTrophies(game: GameState) {
  return careerOf(game).flatMap((s) => spellTrophies(game, s).map((t) => ({ ...t, clubName: s.clubName })));
}

// ---------------------------------------------------------------- the career in words

const MENTALITY_WORD = { defensive: 'defensive', balanced: 'balanced', attacking: 'attacking' } as const;

/** Most-used formation and mentality. */
export function preferredTactic(m: ManagerRecord): { formation?: string; mentality?: string } {
  const top = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { formation: top(m.formations), mentality: top(m.mentalities) };
}

export function careerBlurb(game: GameState): string {
  const m = managerOf(game);
  const spells = careerOf(game);
  const clubs = new Set(spells.map((s) => s.clubId)).size;
  const first = spells[0]?.from ?? game.season;
  const seasons = game.season - first + 1;
  const trophies = teamTrophies(game).length;
  const winRate = m.games ? Math.round((m.won / m.games) * 100) : 0;
  const { formation, mentality } = preferredTactic(m);
  const current = game.unemployed ? 'Currently out of work.' : `Now in charge of ${game.clubs[game.userClubId].name}.`;
  const parts = [
    `${seasons} season${seasons === 1 ? '' : 's'} in management at ${clubs} club${clubs === 1 ? '' : 's'}${clubs > 1 ? ` (${spells.map((s) => s.clubName).join(', ')})` : ''}. ${current}`,
    m.games ? `${m.games} games: ${m.won} won, ${m.drawn} drawn, ${m.lost} lost, a ${winRate}% win rate.` : 'No games in charge yet.',
    formation ? `Favours a ${MENTALITY_WORD[mentality as keyof typeof MENTALITY_WORD] ?? 'balanced'} ${formation}.` : '',
    trophies ? `${trophies} trophie${trophies === 1 ? '' : 's'} won${m.honours.length ? `, and ${m.honours.length} individual award${m.honours.length === 1 ? '' : 's'}` : ''}.` : m.honours.length ? `${m.honours.length} individual award${m.honours.length === 1 ? '' : 's'}, still waiting for a first trophy.` : 'Still waiting for a first trophy.',
  ];
  return parts.filter(Boolean).join(' ');
}

/** The best XI of players you've managed (at least 10 games), in a 4-4-2. */
export function bestXI(game: GameState) {
  const m = managerOf(game);
  const SLOTS = ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'] as const;
  const fits: Record<string, string[]> = { GK: ['GK'], DR: ['DR'], DL: ['DL'], DC: ['DC'], MR: ['MR', 'ML'], ML: ['ML', 'MR'], MC: ['MC', 'DMC', 'AMC'], ST: ['ST', 'AMC'] };
  const pool = Object.entries(m.players).filter(([, e]) => e.apps >= 10).sort((a, b) => b[1].peak - a[1].peak || b[1].apps - a[1].apps);
  const used = new Set<string>();
  const xi: { slot: string; id: string; name: string; peak: number; apps: number; goals: number; clubName: string }[] = [];
  for (const slot of SLOTS) {
    const pick = pool.find(([id, e]) => !used.has(id) && fits[slot].includes(e.position));
    if (!pick) continue;
    used.add(pick[0]);
    xi.push({ slot, id: pick[0], ...pick[1] });
  }
  return xi;
}

// ---------------------------------------------------------------- job offers while in work

const OFFER_WEEKS = 4;
const absWeek = (game: GameState) => game.season * 100 + game.week;

export function jobOffers(game: GameState): JobOffer[] {
  const m = managerOf(game);
  m.offers = (m.offers ?? []).filter((o) => o.expires > absWeek(game) && game.clubs[o.clubId] && !game.clubs[o.clubId].isUser);
  return m.offers;
}

/**
 * Doing well gets you noticed: now and then a bigger club, struggling or
 * ambitious, asks you to take over. More often after a strong spell or a
 * trophy. No offers during a challenge.
 */
export function maybeJobOffer(game: GameState, rng: Rng, boost = 0) {
  if (game.unemployed || game.challenge?.status === 'active' || game.phase !== 'season') return;
  const offers = jobOffers(game);
  if (offers.length >= 2) return;
  const user = game.clubs[game.userClubId];
  const div = divisionOf(game, user.id);
  const table = divisionTable(game, div.def.id);
  const pos = table.findIndex((r) => r.clubId === user.id) + 1;
  const played = table.find((r) => r.clubId === user.id)?.played ?? 0;
  const target = boardOf(user).target?.position ?? Math.ceil(table.length / 2);
  const flying = played >= 6 && pos <= target - 2;
  const trophies = teamTrophies(game).length;
  // Nobody calls a manager who's struggling; beat the target and they start to.
  const struggling = played >= 6 && pos > target + 2;
  if (struggling && !boost) return;
  const chance = boost + (flying ? 0.12 : 0.02) + (played >= 6 && pos <= Math.ceil(table.length / 4) ? 0.1 : 0) + Math.min(0.15, trophies * 0.05);
  if (!rng.chance(chance)) return;
  const level = div.def.level;
  const reach = trophies >= 2 ? 2 : 1;
  const candidates = domesticClubs(game).filter((c) => {
    if (c.id === user.id || c.isUser || offers.some((o) => o.clubId === c.id)) return false;
    const l = divisionOf(game, c.id).def.level;
    // A step or two up, or a bigger club at the same level. A trophy winner is wanted by
    // the other big clubs in his league too (at the top there's nowhere higher to go).
    const peer = trophies > 0 ? c.reputation >= user.reputation - 15 : c.reputation > user.reputation + 3;
    return (l < level && l >= level - reach) || (l === level && peer);
  });
  if (!candidates.length) return;
  const club = rng.weighted(candidates, (c) => {
    const t = divisionTable(game, divisionOf(game, c.id).def.id);
    const p = t.findIndex((r) => r.clubId === c.id) + 1;
    // Clubs in the bottom half are the ones changing manager.
    return p > t.length / 2 ? 2 : 0.6;
  });
  offers.push({ clubId: club.id, expires: absWeek(game) + OFFER_WEEKS });
  const d = divisionOf(game, club.id).def;
  addInbox(game, 'contract', `${club.name} (${d.name}) have asked permission to speak to you about becoming their manager. See Manager → Job offers. The offer is open for ${OFFER_WEEKS} weeks.`, {
    category: 'club',
    subject: `Job offer: ${club.name}`,
  });
}

/** Take a job offer while in work: you leave for the new club straight away. */
export function acceptJobOffer(game: GameState, clubId: string): string | null {
  if (!jobOffers(game).some((o) => o.clubId === clubId)) return 'That offer is no longer open.';
  const old = game.clubs[game.userClubId];
  const spell = careerOf(game).at(-1)!;
  spell.to = game.season;
  spell.left = 'moved';
  old.isUser = false;
  delete old.lineup;
  delete old.bench;
  for (const item of game.inbox ?? []) if (item.kind === 'bid') item.resolved = true;
  managerOf(game).offers = [];
  const club = game.clubs[clubId];
  handOver(game, club);
  addInbox(game, 'info', `You've left ${old.name} to become manager of ${club.name}. The squad, the ground and the finances are yours. Good luck.`, {
    category: 'club',
    subject: 'New job',
  });
  return null;
}

/** Turn an offer down: the board appreciate the loyalty. */
export function declineJobOffer(game: GameState, clubId: string) {
  const m = managerOf(game);
  if (!m.offers?.some((o) => o.clubId === clubId)) return;
  m.offers = m.offers.filter((o) => o.clubId !== clubId);
  shiftConfidence(game, 3, true);
  addInbox(game, 'info', `You turned down ${game.clubs[clubId].name}. The board are pleased you're staying.`, { category: 'club', subject: 'Staying put' });
}

/** Monthly: maybe an approach. A trophy-winning season makes one likely in the summer. */
export function monthlyJobOffers(game: GameState) {
  withRng(game, (rng) => maybeJobOffer(game, rng));
}
