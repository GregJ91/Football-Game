import { LEGENDS_PLAYERS } from '../data/legendsPlayers';
import { FORMATIONS } from './match/selection';
import { generateAttributes } from './players/generate';
import { computeOverall, ratingAt } from './players/ratings';
import { assignRoles } from './players/squad';
import { Rng } from './rng';
import { awardLeagueTitles, setupCups } from './season/cups';
import { seasonAwards } from './season/awards';
import { scheduleSeason } from './season/season';
import { divisionTable } from './season/table';
import type {
  ClubColours, CrestDesign, DraftGroup, DraftSlot, Formation, GameState, KitPattern, LegendsDifficulty, LegendsDraft, Player, Position, SeasonSummary,
} from './types';
import { squadOf, withRng } from './world';

/**
 * Legends: a separate mode. The best players of the last 40 years, all aged
 * 20 at their peak, are drafted by 20 teams into a Super League. They age a
 * year each season but stay at their peak. No transfers,
 * no money, no relegation: ten seasons of league, Super League Cup, Super FA
 * Cup and Super Cup, with a two-round draft each summer (champions first).
 */

export const LEGENDS_SEASONS = 10;
export const LEGENDS_SQUAD = 23;
export const LEGENDS_TEAMS = 20;
/** Each summer: everyone releases this many, then drafts this many. */
export const SUMMER_ROUNDS = 2;
export const LEGENDS_DIVISION = 'legends-league';
const START_SEASON = 2026;

const AI_TEAMS: [string, string, string, string, KitPattern][] = [
  ['Galácticos', 'GAL', '#F4F1E8', '#C9A227', 'plain'],
  ['Invincibles', 'INV', '#C8102E', '#FFFFFF', 'plain'],
  ['Total Football', 'TOT', '#F36C21', '#FFFFFF', 'plain'],
  ['Samba Stars', 'SAM', '#F7D117', '#1E7A43', 'plain'],
  ['Catenaccio', 'CAT', '#1B3F94', '#111111', 'stripes'],
  ['Tiki-Taka', 'TIK', '#A50044', '#004D98', 'stripes'],
  ['Gegenpress', 'GEG', '#FDE100', '#111111', 'plain'],
  ['Class of 92', 'C92', '#DA291C', '#111111', 'plain'],
  ['Dream Team', 'DRM', '#14234D', '#FFFFFF', 'plain'],
  ['Joga Bonito', 'JOG', '#1E7A43', '#F7D117', 'hoops'],
  ['Golden Boots', 'GBT', '#C9A227', '#111111', 'plain'],
  ['The Maestros', 'MAE', '#7A1E3A', '#95BFE5', 'plain'],
  ['Number Nines', 'NIN', '#6CABDD', '#FFFFFF', 'plain'],
  ['Kings of Europe', 'KOE', '#FFFFFF', '#14234D', 'sash'],
  ['Northern Lights', 'NOR', '#0B6E4F', '#E8F1F2', 'halves'],
  ['Southern Cross', 'SOU', '#0A2240', '#F2C230', 'plain'],
  ['Iron Wall', 'IRN', '#4A4A4A', '#E03A3E', 'plain'],
  ['Flying Wingers', 'FLY', '#00A3E0', '#FFFFFF', 'stripes'],
  ['Playmakers', 'PLY', '#5B2C83', '#F4F1E8', 'plain'],
];

export interface LegendsConfig extends LegendsTeam {
  seed: number;
  difficulty: LegendsDifficulty;
  /** Online: the other people's teams (they take the next club ids; AI fills the rest). */
  others?: LegendsTeam[];
}

export interface LegendsTeam {
  teamName: string;
  shortName: string;
  /** Locked for all ten seasons; it decides how many of each position you draft. */
  formation?: Formation;
  stadiumName?: string;
  colours: ClubColours;
  awayKit?: ClubColours;
  crest?: CrestDesign;
}

/** Parse the real-player list: name, positions (main first) and peak rating. */
export function legendsPool(): { name: string; positions: Position[]; rating: number }[] {
  return LEGENDS_PLAYERS.map((line) => {
    const [name, pos, rating] = line.split('|');
    return { name, positions: pos.split(',') as Position[], rating: Number(rating) };
  });
}

/** Attributes for a real player that come out at exactly his peak rating. */
function legendAttributes(rng: Rng, position: Position, alsoPlays: Position[], rating: number) {
  const attributes = generateAttributes(rng, position, rating, alsoPlays);
  for (let i = 0; i < 60; i++) {
    const overall = computeOverall({ attributes, position });
    if (overall === rating) break;
    const keys = Object.keys(attributes) as (keyof typeof attributes)[];
    const step = overall < rating ? 1 : -1;
    const candidates = keys.filter((k) => ratingAt({ ...attributes, [k]: attributes[k] + step }, position) !== ratingAt(attributes, position));
    const k = rng.pick(candidates.length ? candidates : keys);
    attributes[k] = Math.max(1, Math.min(20, attributes[k] + step));
  }
  return attributes;
}

function makeLegend(rng: Rng, id: string, name: string, positions: Position[], rating: number): Player {
  const parts = name.split(' ');
  const single = parts.length === 1;
  const attributes = legendAttributes(rng, positions[0], positions.slice(1), rating);
  const overall = computeOverall({ attributes, position: positions[0] });
  return {
    id,
    firstName: single ? '' : parts.slice(0, -1).join(' '),
    lastName: single ? name : parts.at(-1)!,
    age: 20,
    position: positions[0],
    positions,
    attributes,
    overall,
    potential: overall,
    clubId: null,
    wage: 0,
    value: 0,
    contractEnd: 9999,
    morale: 75,
    fitness: 100,
    form: 6.5,
    injuryWeeks: 0,
    suspendedMatches: 0,
    ambition: 10,
    loyalty: 20,
    seasonStats: { apps: 0, goals: 0, assists: 0, ratingSum: 0 },
    careerStats: [0, 0, 0, 0],
  };
}

export function createLegendsGame(config: LegendsConfig): GameState {
  const rng = new Rng(config.seed);
  const game: GameState = {
    version: 1,
    seed: config.seed,
    rngState: 0,
    country: 'eng',
    mode: 'legends',
    season: START_SEASON,
    startSeason: START_SEASON,
    week: 0,
    totalWeeks: 0,
    userClubId: 'L0',
    clubs: {},
    players: {},
    divisions: [],
    fixtures: [],
    lastSummary: null,
    phase: 'season',
    nextId: 1,
    day: 1,
    half: 'am',
    settings: { assistantTactics: false, difficulty: 'normal' },
    legends: { difficulty: config.difficulty, humans: ['L0'], draft: null, pool: [], roll: [] },
  };
  const people: LegendsTeam[] = [config, ...(config.others ?? [])].slice(0, LEGENDS_TEAMS);
  const teams: [string, string, string, string, KitPattern][] = [
    ...people.map((t): [string, string, string, string, KitPattern] => [t.teamName, t.shortName, t.colours.primary, t.colours.secondary, t.colours.pattern]),
    ...AI_TEAMS,
  ].slice(0, LEGENDS_TEAMS);
  game.legends!.humans = people.map((_, i) => `L${i}`);
  teams.forEach(([name, short, primary, secondary, pattern], i) => {
    const id = `L${i}`;
    game.clubs[id] = {
      id,
      name,
      shortName: short,
      colours: { primary, secondary, pattern },
      stadiumName: people[i]?.stadiumName || `${name} ${i === 0 ? 'Arena' : 'Park'}`,
      capacity: 60_000,
      region: 'N',
      reputation: 90,
      balance: 0,
      isUser: i === 0,
      playerIds: [],
      tactics: { formation: people[i]?.formation ?? '4-3-3', mentality: 'balanced', pressing: 'medium' },
      history: [],
    };
  });
  people.forEach((t, i) => {
    game.clubs[`L${i}`].awayKit = t.awayKit;
    game.clubs[`L${i}`].crest = t.crest;
  });
  game.divisions.push({
    def: { id: LEGENDS_DIVISION, name: 'Super League', level: 1, size: LEGENDS_TEAMS, rounds: 2, promotion: null, relegation: 0, quality: 90 },
    clubIds: Object.keys(game.clubs),
  });
  legendsPool().forEach((p, i) => {
    const id = `LP${i}`;
    game.players[id] = makeLegend(rng, id, p.name, p.positions, p.rating);
    game.legends!.pool.push(id);
  });
  // The AI teams pick a formation too; everyone keeps theirs for all ten seasons.
  for (const club of Object.values(game.clubs)) if (Number(club.id.slice(1)) >= people.length) club.tactics.formation = rng.pick(AI_FORMATIONS);
  game.legends!.formations = Object.fromEntries(Object.values(game.clubs).map((c) => [c.id, c.tactics.formation]));
  // The opening draft: a random order that snakes back each round,
  // keepers first, then defenders, midfielders and attackers.
  const order = rng.shuffle(Object.keys(game.clubs));
  game.rngState = rng.state;
  game.legends!.draft = {
    kind: 'initial',
    order,
    rounds: LEGENDS_SQUAD,
    snake: true,
    pick: 0,
    picks: [],
    slots: phasedSlots(order, (id) => squadNeeds(game.legends!.formations![id])),
  };
  runAiPicks(game);
  return game;
}

// ---------------------------------------------------------------- the draft

export function isLegends(game: GameState): boolean {
  return game.mode === 'legends';
}

/** Total picks in the draft. */
export function draftLength(d: LegendsDraft): number {
  return d.slots.length;
}

/** Who is on the clock for pick n (0-based). */
export function clubOnTheClock(d: LegendsDraft, n = d.pick): string | null {
  return d.slots[n]?.clubId ?? null;
}

export function draftRound(d: LegendsDraft, n = d.pick): number {
  return d.slots[n]?.round ?? d.slots.at(-1)?.round ?? 1;
}

/** Which kind of player this pick must be. */
export function draftGroup(d: LegendsDraft, n = d.pick): DraftGroup {
  return d.slots[n]?.group ?? 'ANY';
}

/** The draft's position groups, in order. */
export const DRAFT_GROUPS: Exclude<DraftGroup, 'ANY'>[] = ['GK', 'DEF', 'MID', 'ATT'];
export const GROUP_NAME: Record<DraftGroup, string> = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', ATT: 'Attackers', ANY: 'Any position' };

export function groupOf(pos: Position): Exclude<DraftGroup, 'ANY'> {
  return pos === 'GK' ? 'GK' : pos === 'ST' ? 'ATT' : pos === 'DC' || pos === 'DR' || pos === 'DL' ? 'DEF' : 'MID';
}

/** How many of each group a formation drafts: three keepers and two for every outfield place (23). */
export function squadNeeds(formation: Formation): Record<Exclude<DraftGroup, 'ANY'>, number> {
  const out = { GK: 3, DEF: 0, MID: 0, ATT: 0 };
  for (const pos of FORMATIONS[formation]) if (pos !== 'GK') out[groupOf(pos)] += 2;
  return out;
}

/** The pick order: each group in turn, snaking, with teams that are full for a group skipped. */
export function phasedSlots(order: string[], needs: (clubId: string) => Record<Exclude<DraftGroup, 'ANY'>, number>): DraftSlot[] {
  const slots: DraftSlot[] = [];
  let round = 0;
  for (const group of DRAFT_GROUPS) {
    const most = Math.max(...order.map((id) => needs(id)[group]));
    for (let k = 0; k < most; k++, round++) {
      const pass = round % 2 ? [...order].reverse() : order;
      for (const clubId of pass) if (needs(clubId)[group] > k) slots.push({ clubId, round: round + 1, group });
    }
  }
  return slots;
}

export function isHuman(game: GameState, clubId: string): boolean {
  return !!game.legends?.humans.includes(clubId);
}

/** Players who can be picked right now (the current round's group), best first. */
export function draftOptions(game: GameState): Player[] {
  const d = game.legends?.draft;
  const group = d ? draftGroup(d) : 'ANY';
  return draftPool(game).filter((p) => group === 'ANY' || groupOf(p.position) === group);
}

/** Players still to be drafted, best first. */
export function draftPool(game: GameState): Player[] {
  return game.legends!.pool.map((id) => game.players[id]).sort((a, b) => b.overall - a.overall);
}

const AI_FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-3-3', '4-2-3-1', '4-2-3-1', '3-5-2', '5-3-2'];

/** How many more a team wants at a position: two per place in its formation (three keepers). */
function positionNeed(game: GameState, clubId: string, squad: Player[], pos: Position): number {
  const formation = game.legends?.formations?.[clubId] ?? game.clubs[clubId].tactics.formation;
  const want = pos === 'GK' ? 3 : FORMATIONS[formation].filter((x) => x === pos).length * 2;
  const have = squad.filter((p) => p.position === pos).length + 0.5 * squad.filter((p) => p.position !== pos && p.positions.includes(pos)).length;
  return want - have;
}

/** An AI team's pick: the best player for what it's missing, more or less carefully by difficulty. */
export function aiChoice(game: GameState, clubId: string, rng: Rng): Player {
  const diff = game.legends!.difficulty;
  const noise = diff === 'easy' ? 9 : diff === 'medium' ? 4 : 1.2;
  const squad = squadOf(game, clubId);
  const d = game.legends!.draft;
  const group = d ? draftGroup(d) : 'ANY';
  const all = draftPool(game);
  const pool = (group === 'ANY' ? all : all.filter((p) => groupOf(p.position) === group)).slice(0, 80);
  let best = pool[0] ?? all[0];
  let bestScore = -Infinity;
  for (const p of pool) {
    // The best position he can fill for this team.
    // In a defenders' round only defensive places count, and so on.
    const places = p.positions.filter((pos) => group === 'ANY' || groupOf(pos) === group);
    const need = Math.max(...places.map((pos) => positionNeed(game, clubId, squad, pos) - (pos === p.position ? 0 : 0.5)));
    if (group === 'ANY' && p.position === 'GK' && need <= 0) continue;
    const score = p.overall + (need > 0 ? 3 + need * 1.5 : need * 4) + rng.normal() * noise;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function take(game: GameState, clubId: string, playerId: string) {
  const L = game.legends!;
  const d = L.draft!;
  const p = game.players[playerId];
  L.pool = L.pool.filter((id) => id !== playerId);
  p.clubId = clubId;
  game.clubs[clubId].playerIds.push(playerId);
  d.picks.push({ clubId, playerId, round: draftRound(d), pick: d.pick + 1 });
  d.pick++;
}

/** The AI teams pick until it's a human's turn (or the draft is over). */
export function runAiPicks(game: GameState) {
  const d = game.legends!.draft;
  if (!d) return;
  withRng(game, (rng) => {
    for (let club = clubOnTheClock(d); club && !isHuman(game, club); club = clubOnTheClock(d)) take(game, club, aiChoice(game, club, rng).id);
  });
  if (d.pick >= draftLength(d)) finishDraft(game);
}

/** A human's pick. Returns an error message, or null. */
export function makePick(game: GameState, clubId: string, playerId: string): string | null {
  const d = game.legends?.draft;
  if (!d) return 'The draft is over.';
  if (clubOnTheClock(d) !== clubId) return "It isn't your pick.";
  if (!game.legends!.pool.includes(playerId)) return 'That player has already gone.';
  const group = draftGroup(d);
  if (group !== 'ANY' && groupOf(game.players[playerId].position) !== group) return `This round is for ${GROUP_NAME[group].toLowerCase()}.`;
  take(game, clubId, playerId);
  runAiPicks(game);
  return null;
}

/** Let the AI make a human's pick (the "auto pick" button). */
export function autoPick(game: GameState, clubId: string): string | null {
  const d = game.legends?.draft;
  if (!d || clubOnTheClock(d) !== clubId) return "It isn't your pick.";
  const choice = withRng(game, (rng) => aiChoice({ ...game, legends: { ...game.legends!, difficulty: 'hard' } }, clubId, rng));
  return makePick(game, clubId, choice.id);
}

function finishDraft(game: GameState) {
  const L = game.legends!;
  const kind = L.draft!.kind;
  L.lastDraft = L.draft!;
  L.draft = null;
  for (const club of Object.values(game.clubs)) {
    const squad = squadOf(game, club.id);
    // Formations are locked for the whole game.
    club.tactics = { ...club.tactics, formation: L.formations?.[club.id] ?? club.tactics.formation };
    // Reputation follows the strength of the best XI (crowds, the first Super Cup).
    const top = squad.map((p) => p.overall).sort((a, b) => b - a).slice(0, 11);
    club.reputation = Math.round(top.reduce((n, x) => n + x, 0) / Math.max(1, top.length));
    assignRoles(game, club);
  }
  if (kind === 'initial') startLegendsCampaign(game);
  else beginLegendsSeason(game);
}

function startLegendsCampaign(game: GameState) {
  game.week = 0;
  game.day = 1;
  game.half = 'am';
  game.phase = 'season';
  scheduleSeason(game);
  setupCups(game);
}

// ---------------------------------------------------------------- the season

/** AI teams play a little better or worse than their players by difficulty. */
export function legendsAiBoost(game: GameState): number {
  const d = game.legends?.difficulty;
  return d === 'easy' ? 0.96 : d === 'hard' ? 1.04 : 1;
}

/** The end of a Legends season: table, history, trophies and awards. */
export function endLegendsSeason(game: GameState) {
  const table = divisionTable(game, LEGENDS_DIVISION);
  const summary: SeasonSummary = {
    season: game.season,
    champions: { [LEGENDS_DIVISION]: table[0].clubId },
    promoted: { [LEGENDS_DIVISION]: [] },
    relegated: { [LEGENDS_DIVISION]: [] },
    playoffs: [],
    finalTables: { [LEGENDS_DIVISION]: table },
  };
  table.forEach((row, i) => {
    game.clubs[row.clubId].history.push({ season: game.season, divisionId: LEGENDS_DIVISION, position: i + 1, outcome: i === 0 ? 'champions' : 'stayed' });
  });
  for (const id in game.players) game.players[id].monthStats = undefined;
  awardLeagueTitles(game, summary.champions);
  seasonAwards(game, summary);
  game.legends!.roll.push({
    season: game.season,
    champions: table[0].clubId,
    cups: (game.cups ?? []).filter((c) => c.winnerId).map((c) => ({ id: c.id, winnerId: c.winnerId! })),
    positions: Object.fromEntries(table.map((r, i) => [r.clubId, i + 1])),
  });
  game.lastSummary = summary;
  game.phase = 'seasonEnd';
  if (seasonsPlayed(game) >= LEGENDS_SEASONS) game.legends!.finished = true;
}

export function seasonsPlayed(game: GameState): number {
  return game.legends?.roll.length ?? 0;
}

/**
 * The summer: every team lets two players go back into the pool (humans
 * choose theirs; otherwise the weakest go), then a two-round draft in order
 * of the final table, champions first.
 */
export function startSummerDraft(game: GameState, released: Record<string, string[]> = {}) {
  const L = game.legends!;
  if (L.finished || game.phase !== 'seasonEnd' || !game.lastSummary) return;
  for (const club of Object.values(game.clubs)) {
    const squad = squadOf(game, club.id);
    const chosen = (released[club.id] ?? []).filter((id) => club.playerIds.includes(id)).slice(0, SUMMER_ROUNDS);
    const keepers = squad.filter((p) => p.position === 'GK').length;
    const weakest = [...squad]
      .sort((a, b) => a.overall - b.overall)
      .filter((p) => !chosen.includes(p.id) && (p.position !== 'GK' || keepers > 2));
    const out = [...chosen, ...weakest.map((p) => p.id)].slice(0, SUMMER_ROUNDS);
    for (const id of out) {
      club.playerIds = club.playerIds.filter((x) => x !== id);
      game.players[id].clubId = null;
      L.pool.push(id);
    }
    if (club.lineup) club.lineup = club.lineup.map((id) => (id && out.includes(id) ? null : id));
    if (club.bench) club.bench = club.bench.filter((id) => !out.includes(id));
  }
  const order = game.lastSummary.finalTables[LEGENDS_DIVISION].map((r) => r.clubId);
  const slots: DraftSlot[] = [];
  for (let r = 1; r <= SUMMER_ROUNDS; r++) for (const clubId of order) slots.push({ clubId, round: r, group: 'ANY' });
  L.draft = { kind: 'summer', order, rounds: SUMMER_ROUNDS, snake: false, pick: 0, picks: [], slots };
  runAiPicks(game);
}

/** After the summer draft: a fresh season. */
function beginLegendsSeason(game: GameState) {
  for (const p of Object.values(game.players)) {
    const s = p.seasonStats;
    const c = p.careerStats ?? [0, 0, 0, 0];
    p.careerStats = [c[0] + s.apps, c[1] + s.goals, c[2] + s.assists, (c[3] ?? 0) + (s.cleanSheets ?? 0)];
    p.seasonStats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
    p.fitness = 100;
    p.injuryWeeks = 0;
    p.injuryName = undefined;
    p.suspendedMatches = 0;
    p.form = 6.5;
    p.morale = 75;
    // A year older every season, but still at their peak.
    p.age++;
  }
  game.cleanSheets = {};
  game.deductions = {};
  game.season++;
  game.recoveredTo = undefined;
  startLegendsCampaign(game);
}

/** The final standings across all ten seasons: trophies, then titles, then average finish. */
export function legendsStandings(game: GameState) {
  const roll = game.legends!.roll;
  return Object.values(game.clubs)
    .map((c) => {
      const titles = roll.filter((r) => r.champions === c.id).length;
      const cups = roll.reduce((n, r) => n + r.cups.filter((x) => x.winnerId === c.id).length, 0);
      const avg = roll.length ? roll.reduce((n, r) => n + (r.positions[c.id] ?? 20), 0) / roll.length : 0;
      return { club: c, titles, cups, trophies: titles + cups, avgFinish: avg };
    })
    .sort((a, b) => b.trophies - a.trophies || b.titles - a.titles || a.avgFinish - b.avgFinish);
}

/**
 * A drafted squad laid out in its formation: the best player who can play
 * each place (natural position first), and everyone else in reserve.
 */
export function draftedTeam(game: GameState, clubId: string) {
  const formation = game.legends?.formations?.[clubId] ?? game.clubs[clubId].tactics.formation;
  const slots = FORMATIONS[formation];
  const squad = [...squadOf(game, clubId)].sort((a, b) => b.overall - a.overall);
  const xi: (Player | null)[] = slots.map(() => null);
  const used = new Set<string>();
  // Natural positions first, then players who can cover.
  for (const natural of [true, false]) {
    slots.forEach((slot, i) => {
      if (xi[i]) return;
      const p = squad.find((x) => !used.has(x.id) && (natural ? x.position === slot : x.positions.includes(slot)));
      if (p) {
        xi[i] = p;
        used.add(p.id);
      }
    });
  }
  return { formation, slots, xi, reserves: squad.filter((p) => !used.has(p.id)) };
}
