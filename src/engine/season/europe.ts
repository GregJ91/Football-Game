import { cupDef } from '../../data/cups';
import { EURO_COMPS, EURO_SLOTS, euroDef, type EuroCompDef } from '../../data/europe';
import { dateIn, formatDate } from '../calendar';
import { addGate, crowdFill, ledgerOf } from '../economy/finance';
import { simulateMatch, type SimOptions } from '../match/engine';
import type { Rng } from '../rng';
import type { Club, CupRound, CupState, CupTie, EuroEntry, EuroStage, EuropeState, GameState, MatchResult, SeasonSummary } from '../types';
import { addInbox, trimFreeAgents } from '../transfers/market';
import { pickTeam } from '../match/selection';
import { attr100 } from '../players/ratings';
import { newId, squadOf, withRng } from '../world';
import { createForeignClubs, ensureForeignSquads, rolloverForeignSquads, setForeignStrengths } from './foreign';
import { applyMatchToPlayers, creditCleanSheet, teamSheet, xiStrength } from './season';
import { buildTable } from './table';

const LEAGUE_SIZE = 36;
/** European nights sell at a premium. */
const EURO_TICKET_FACTOR = 1.5;

export const STAGE_NAMES: Record<EuroStage, string> = {
  playoff: 'Play-off round',
  league: 'League phase',
  koPlayoff: 'Knockout play-off',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
};

/** Lower-case stage name for sentences ("in the round of 16"). */
function stageText(stage: EuroStage) {
  return STAGE_NAMES[stage].toLowerCase();
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function money(n: number) {
  return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
}

export function compOf(game: GameState, id: string): CupState {
  return game.europe!.comps.find((c) => c.id === id)!;
}

/** Three-letter nation code for any club. */
export function nationOf(game: GameState, clubId: string): string {
  const c = game.clubs[clubId];
  return c.foreign ? c.foreign.nation : game.country === 'eng' ? 'ENG' : 'SCO';
}

function strengthOf(game: GameState, club: Club): number {
  return club.foreign ? club.foreign.strength : xiStrength(game, club);
}

// ---------------------------------------------------------------- setup and qualification

/** The Europe state, with its pool of foreign clubs, created the first time it's needed. */
export function ensureEurope(game: GameState): EuropeState {
  if (!game.europe) {
    const foreignIds = withRng(game, (rng) => createForeignClubs(game, rng));
    game.europe = { foreignIds, entries: [], comps: [], players: {}, squads: {}, winners: [] };
  }
  return game.europe;
}

/** Hand out the country's European places from a top-flight finishing order and the domestic cup winners. */
export function allocatePlaces(game: GameState, order: string[], cupWinners: Record<string, string | undefined>): EuroEntry[] {
  const top = game.divisions.find((d) => d.def.level === 1)!.def;
  const used = new Set<string>();
  const out: EuroEntry[] = [];
  const nextInLeague = () => {
    const i = order.findIndex((id) => !used.has(id));
    return { clubId: order[i], reason: `${ordinal(i + 1)} in the ${top.name}` };
  };
  for (const slot of EURO_SLOTS[game.country]) {
    let pick: { clubId: string; reason: string };
    const winner = slot.cup ? cupWinners[slot.cup] : undefined;
    if (slot.league && !used.has(order[slot.league - 1])) pick = { clubId: order[slot.league - 1], reason: `${ordinal(slot.league)} in the ${top.name}` };
    else if (slot.cup && winner && !used.has(winner)) pick = { clubId: winner, reason: `${cupDef(game.country, slot.cup).name} winners` };
    else pick = nextInLeague();
    if (!pick.clubId) continue;
    used.add(pick.clubId);
    out.push({ ...pick, compId: slot.compId, playoff: !!slot.playoff });
  }
  return out;
}

/** Places earned from a finished season: the top-flight table and this season's cup winners. */
function placesFromSeason(game: GameState, summary: SeasonSummary): EuroEntry[] {
  const top = game.divisions.find((d) => d.def.level === 1)!;
  const order = summary.finalTables[top.def.id].map((r) => r.clubId);
  const winners = Object.fromEntries((game.cups ?? []).map((c) => [c.id, c.winnerId]));
  return allocatePlaces(game, order, winners);
}

/** Before any season has been played, the biggest top-flight clubs take the places. */
function initialPlaces(game: GameState): EuroEntry[] {
  const top = game.divisions.find((d) => d.def.level === 1)!;
  const order = [...top.clubIds].sort((a, b) => game.clubs[b].reputation - game.clubs[a].reputation);
  return allocatePlaces(game, order, {}).map((e) => ({ ...e, reason: 'Qualified last season' }));
}

function planRounds(game: GameState, def: EuroCompDef): CupRound[] {
  const W = game.totalWeeks;
  const plan: { stage: EuroStage; leg?: 1 | 2; name: string; f: number }[] = [
    { stage: 'playoff', leg: 1, name: 'Play-off round, 1st leg', f: 0.05 },
    { stage: 'playoff', leg: 2, name: 'Play-off round, 2nd leg', f: 0.07 },
  ];
  for (let i = 0; i < def.leagueGames; i++) {
    plan.push({ stage: 'league', name: `Matchday ${i + 1}`, f: 0.14 + ((0.52 - 0.14) * i) / (def.leagueGames - 1) });
  }
  for (const [stage, f] of [['koPlayoff', 0.58], ['r16', 0.66], ['qf', 0.75], ['sf', 0.84]] as const) {
    plan.push({ stage, leg: 1, name: `${STAGE_NAMES[stage]}, 1st leg`, f });
    plan.push({ stage, leg: 2, name: `${STAGE_NAMES[stage]}, 2nd leg`, f: f + 0.02 });
  }
  plan.push({ stage: 'final', name: 'Final', f: 0.96 });
  let prev = -1;
  return plan.map((p) => {
    const week = Math.min(W - 1, Math.max(prev + 1, Math.round(W * p.f)));
    prev = week;
    return { name: p.name, week, day: def.day, ties: [], byes: [], drawn: false, played: false, stage: p.stage, leg: p.leg };
  });
}

/** Start of the season: this season's entrants, the round dates and the play-off draw. */
export function setupEurope(game: GameState) {
  const eu = ensureEurope(game);
  const firstSeason = eu.comps.length === 0;
  eu.entries = eu.next ?? (game.lastSummary ? placesFromSeason(game, game.lastSummary) : initialPlaces(game));
  eu.next = undefined;
  eu.comps = EURO_COMPS.map((def) => ({ id: def.id, season: game.season, rounds: planRounds(game, def) }));
  withRng(game, (rng) => {
    eu.shift = ratingShift(game);
    setForeignStrengths(game, rng, eu.shift, !firstSeason);
    if (!firstSeason) rolloverForeignSquads(game, rng);
    ensureForeignSquads(game);
    trimFreeAgents(game);
    drawPlayoffs(game, rng);
  });
  const mine = eu.entries.find((e) => e.clubId === game.userClubId);
  if (mine && !mine.playoff) {
    const def = euroDef(mine.compId);
    addInbox(game, 'info', `We're in the ${def.name} (${mine.reason}). We go straight into the league phase; the draw is made after the play-off round.`, {
      category: 'match',
      subject: `${def.name}: we're in`,
    });
  }
}

/**
 * How far the domestic top flight's ratings sit from the scale foreign clubs
 * are rated on (an average top-flight side at its starting level).
 */
function ratingShift(game: GameState): number {
  const top = game.divisions.find((d) => d.def.level === 1)!;
  const avg = top.clubIds.reduce((s, id) => s + xiStrength(game, game.clubs[id]), 0) / top.clubIds.length;
  // Foreign ratings assume an average Premier League side of 76; Scotland's top flight starts ten lower on the same scale.
  const reference = top.def.quality + 2;
  return Math.round((avg - reference) * 10) / 10;
}

/** Every club already in a European competition this season. */
function usedThisSeason(game: GameState): Set<string> {
  const eu = game.europe!;
  const used = new Set(eu.entries.map((e) => e.clubId));
  for (const comp of eu.comps) {
    for (const id of comp.league ?? []) used.add(id);
    for (const r of comp.rounds) for (const t of r.ties) used.add(t.homeId).add(t.awayId);
  }
  return used;
}

function pickForeign(game: GameState, rng: Rng, used: Set<string>, [lo, hi]: [number, number]): string {
  const free = game.europe!.foreignIds.filter((id) => !used.has(id));
  const inBand = free.filter((id) => {
    const s = game.clubs[id].foreign!.strength;
    return s >= lo && s <= hi;
  });
  if (inBand.length) return rng.pick(inBand);
  const mid = (lo + hi) / 2;
  const near = free.sort((a, b) => Math.abs(game.clubs[a].foreign!.strength - mid) - Math.abs(game.clubs[b].foreign!.strength - mid));
  return rng.pick(near.slice(0, 5));
}

function addTie(game: GameState, comp: CupState, r: number, homeId: string, awayId: string, extra: Partial<CupTie> = {}): CupTie {
  const tie: CupTie = {
    id: newId(game, 'eu'),
    divisionId: comp.id,
    cupId: comp.id,
    round: r,
    week: comp.rounds[r].week,
    homeId,
    awayId,
    neutral: false,
    result: null,
    ...extra,
  };
  comp.rounds[r].ties.push(tie);
  return tie;
}

/** A two-legged tie: first leg at `firstHome`, second leg the other way round. */
function addTwoLegs(game: GameState, comp: CupState, r: number, firstHome: string, secondHome: string) {
  const first = addTie(game, comp, r, firstHome, secondHome, { leg: 1 });
  addTie(game, comp, r + 1, secondHome, firstHome, { leg: 2, firstLegId: first.id });
}

function stageIndex(comp: CupState, stage: EuroStage): number {
  return comp.rounds.findIndex((r) => r.stage === stage);
}

function drawPlayoffs(game: GameState, rng: Rng) {
  const eu = game.europe!;
  const used = usedThisSeason(game);
  for (const def of EURO_COMPS) {
    const comp = compOf(game, def.id);
    const r = stageIndex(comp, 'playoff');
    for (const e of eu.entries.filter((x) => x.compId === def.id && x.playoff)) {
      const shift = eu.shift ?? 0;
      const opp = pickForeign(game, rng, used, [def.playoffBand[0] + shift, def.playoffBand[1] + shift]);
      used.add(opp);
      if (rng.chance(0.5)) addTwoLegs(game, comp, r, e.clubId, opp);
      else addTwoLegs(game, comp, r, opp, e.clubId);
    }
    comp.rounds[r].drawn = comp.rounds[r + 1].drawn = true;
    announceTwoLegDraw(game, comp, r, `${def.name}: play-off round draw`,
      `${def.name}: ${userEntry(game)?.reason ?? 'we qualified'}, so we start in the play-off round. Win it and we're in the league phase${def.dropTo ? `; lose and we drop into the ${euroDef(def.dropTo).name}` : ''}.`);
  }
}

function userEntry(game: GameState) {
  return game.europe?.entries.find((e) => e.clubId === game.userClubId);
}

/** Inbox message for the user's two-legged tie, if they're in one. */
function announceTwoLegDraw(game: GameState, comp: CupState, r: number, subject: string, intro?: string) {
  const user = game.userClubId;
  const first = comp.rounds[r].ties.find((t) => t.homeId === user || t.awayId === user);
  if (!first) return;
  const opp = game.clubs[first.homeId === user ? first.awayId : first.homeId];
  const d1 = formatDate(dateIn(game.season, comp.rounds[r].week, comp.rounds[r].day));
  const d2 = formatDate(dateIn(game.season, comp.rounds[r + 1].week, comp.rounds[r + 1].day));
  const legs = first.homeId === user ? `First leg at home on ${d1}, second leg away on ${d2}.` : `First leg away on ${d1}, second leg at home on ${d2}.`;
  addInbox(game, 'info', `${intro ? `${intro} ` : ''}We've drawn ${opp.name} (${nationOf(game, opp.id)}). ${legs}`, { category: 'match', subject });
}

// ---------------------------------------------------------------- league phase

/** Pairings for the league phase: every club plays `games` different opponents, half at home. */
export function leagueMatchdays(clubs: string[], games: number): [string, string][][] {
  const n = clubs.length;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const days: [string, string][][] = [];
  // Each offset joins clubs into even cycles; alternate edges of a cycle make two matchdays.
  for (const k of games === 8 ? [1, 2, 3, 5] : [1, 2, 3]) {
    const a: [string, string][] = [];
    const b: [string, string][] = [];
    for (let s = 0; s < gcd(n, k); s++) {
      const cycle: number[] = [];
      let x = s;
      do {
        cycle.push(x);
        x = (x + k) % n;
      } while (x !== s);
      cycle.forEach((v, j) => (j % 2 === 0 ? a : b).push([clubs[v], clubs[cycle[(j + 1) % cycle.length]]]));
    }
    days.push(a, b);
  }
  return days;
}

/** Shuffle the league so clubs from the same country rarely meet. */
function arrangeLeague(game: GameState, rng: Rng, clubs: string[], games: number): string[] {
  let best = rng.shuffle([...clubs]);
  let bestClash = Infinity;
  for (let i = 0; i < 40 && bestClash > 0; i++) {
    const order = i === 0 ? best : rng.shuffle([...clubs]);
    const clash = leagueMatchdays(order, games).flat().filter(([h, a]) => nationOf(game, h) === nationOf(game, a)).length;
    if (clash < bestClash) {
      best = order;
      bestClash = clash;
    }
  }
  return best;
}

/** The top club of `count` smaller nations (outside the ten strongest), picked at random. */
function championsPath(game: GameState, rng: Rng, free: string[], count: number): string[] {
  const best: Record<string, string> = {};
  for (const id of free) {
    const n = game.clubs[id].foreign!.nation;
    if (!best[n] || game.clubs[id].foreign!.strength > game.clubs[best[n]].foreign!.strength) best[n] = id;
  }
  const nations = Object.keys(best).sort((a, b) => game.clubs[best[b]].foreign!.base - game.clubs[best[a]].foreign!.base);
  return rng.shuffle(nations.slice(10)).slice(0, count).map((n) => best[n]);
}

function maybeDrawLeaguePhase(game: GameState, rng: Rng) {
  const comps = game.europe!.comps;
  const ready = comps.every((c) => c.rounds[stageIndex(c, 'playoff') + 1].played);
  if (!ready || comps.some((c) => c.league)) return;
  const used = usedThisSeason(game);
  const dropIns: Record<string, string[]> = {};
  for (const def of EURO_COMPS) {
    const comp = compOf(game, def.id);
    const legs = comp.rounds[stageIndex(comp, 'playoff') + 1].ties;
    const winners = legs.map((t) => t.winnerId!);
    const losers = legs.map((t) => (t.winnerId === t.homeId ? t.awayId : t.homeId));
    if (def.dropTo) dropIns[def.dropTo] = losers;
    const direct = game.europe!.entries.filter((e) => e.compId === def.id && !e.playoff).map((e) => e.clubId);
    const clubs = [...direct, ...winners, ...(dropIns[def.id] ?? [])];
    // The strongest foreign clubs not already placed fill the rest, with a little luck.
    const free = game.europe!.foreignIds.filter((id) => !used.has(id)).sort((a, b) => strengthOf(game, game.clubs[b]) - strengthOf(game, game.clubs[a]));
    const need = Math.max(0, LEAGUE_SIZE - clubs.length);
    // Champions League: the champions of smaller nations come through their own path.
    const champions = def.id === 'ucl' ? championsPath(game, rng, free, Math.min(8, need)) : [];
    const rest = free.filter((id) => !champions.includes(id));
    const fill = [...champions, ...rng.shuffle(rest.slice(0, need - champions.length + 8)).slice(0, need - champions.length)];
    for (const id of fill) used.add(id);
    clubs.push(...fill);
    comp.league = arrangeLeague(game, rng, clubs, def.leagueGames);
    const days = rng.shuffle(leagueMatchdays(comp.league, def.leagueGames));
    const first = stageIndex(comp, 'league');
    days.forEach((pairs, i) => {
      for (const [h, a] of pairs) addTie(game, comp, first + i, h, a);
      comp.rounds[first + i].drawn = true;
    });
    for (const id of comp.league) pay(game, id, def.prize.entry);
    announceLeagueDraw(game, comp, def);
  }
}

function announceLeagueDraw(game: GameState, comp: CupState, def: EuroCompDef) {
  const user = game.userClubId;
  if (!comp.league?.includes(user)) return;
  const games = comp.rounds
    .filter((r) => r.stage === 'league')
    .map((r) => r.ties.find((t) => t.homeId === user || t.awayId === user)!)
    .filter(Boolean);
  const list = games.map((t) => {
    const home = t.homeId === user;
    const opp = game.clubs[home ? t.awayId : t.homeId];
    return `${opp.name} (${nationOf(game, opp.id)}, ${home ? 'H' : 'A'})`;
  });
  const board = (game.clubs[user].board ??= { confidence: 60, fans: 60 });
  board.fans = Math.min(100, board.fans + 4);
  addInbox(game, 'info', `${def.name} league phase draw. Our ${games.length} opponents: ${list.join(', ')}. Top 8 go straight into the round of 16; 9th to 24th go into a knockout play-off. Entry is worth ${money(def.prize.entry)}.`, {
    category: 'match',
    subject: `${def.name}: league phase draw`,
  });
}

export function leagueTable(comp: CupState) {
  const ties = comp.rounds.filter((r) => r.stage === 'league').flatMap((r) => r.ties);
  return buildTable(comp.league ?? [], ties);
}

// ---------------------------------------------------------------- knockouts

function drawKnockoutPlayoff(game: GameState, comp: CupState) {
  const def = euroDef(comp.id);
  const order = leagueTable(comp).map((r) => r.clubId);
  const r = stageIndex(comp, 'koPlayoff');
  const ko = order.slice(8, 24);
  // 9th plays 24th, 10th plays 23rd…; the higher-placed club is at home in the second leg.
  for (let i = 0; i < 8; i++) addTwoLegs(game, comp, r, ko[15 - i], ko[i]);
  comp.rounds[r].drawn = comp.rounds[r + 1].drawn = true;
  for (const id of order.slice(0, 8)) reach(game, comp, id, 'r16');

  const pos = order.indexOf(game.userClubId) + 1;
  if (pos > 0) {
    const text = pos <= 8
      ? `We finished ${ordinal(pos)} in the ${def.name} league phase and go straight into the round of 16.`
      : pos <= 24
        ? `We finished ${ordinal(pos)} in the ${def.name} league phase, so it's the knockout play-off.`
        : `We finished ${ordinal(pos)} in the ${def.name} league phase and we're out.`;
    addInbox(game, 'info', text, { category: 'match', subject: `${def.name}: league phase over` });
  }
  announceTwoLegDraw(game, comp, r, `${def.name}: knockout play-off draw`);
}

const NEXT_STAGE: Partial<Record<EuroStage, EuroStage>> = { koPlayoff: 'r16', r16: 'qf', qf: 'sf', sf: 'final' };

function drawNextKnockout(game: GameState, rng: Rng, comp: CupState, from: EuroStage) {
  const def = euroDef(comp.id);
  const stage = NEXT_STAGE[from]!;
  const legs = comp.rounds[stageIndex(comp, from) + 1].ties;
  const winners = legs.map((t) => t.winnerId!);
  const r = stageIndex(comp, stage);
  if (stage === 'final') {
    const [a, b] = rng.shuffle(winners);
    addTie(game, comp, r, a, b, { neutral: true });
    comp.rounds[r].drawn = true;
  } else if (stage === 'r16') {
    // League-phase top 8 against the play-off winners, seeded clubs at home second.
    const seeded = leagueTable(comp).slice(0, 8).map((x) => x.clubId);
    const others = rng.shuffle(winners);
    seeded.forEach((s, i) => addTwoLegs(game, comp, r, others[i], s));
    comp.rounds[r].drawn = comp.rounds[r + 1].drawn = true;
  } else {
    const pool = rng.shuffle(winners);
    for (let i = 0; i < pool.length; i += 2) addTwoLegs(game, comp, r, pool[i], pool[i + 1]);
    comp.rounds[r].drawn = comp.rounds[r + 1].drawn = true;
  }
  for (const id of winners) reach(game, comp, id, stage as 'r16' | 'qf' | 'sf' | 'final');

  if (stage === 'final') {
    const tie = comp.rounds[r].ties[0];
    if (tie.homeId === game.userClubId || tie.awayId === game.userClubId) {
      const opp = game.clubs[tie.homeId === game.userClubId ? tie.awayId : tie.homeId];
      addInbox(game, 'info', `We're in the ${def.name} final! ${opp.name} (${nationOf(game, opp.id)}) at a neutral ground on ${formatDate(dateIn(game.season, comp.rounds[r].week, comp.rounds[r].day))}.`, {
        category: 'match',
        subject: `${def.name}: the final`,
      });
    }
  } else announceTwoLegDraw(game, comp, r, `${def.name}: ${stageText(stage)} draw`);
}

/** Prize money, reputation and fans for reaching a knockout round. */
function reach(game: GameState, comp: CupState, clubId: string, stage: 'r16' | 'qf' | 'sf' | 'final') {
  const def = euroDef(comp.id);
  pay(game, clubId, def.prize[stage]);
  const club = game.clubs[clubId];
  if (club.isUser) {
    club.reputation += 1;
    const board = (club.board ??= { confidence: 60, fans: 60 });
    board.fans = Math.min(100, board.fans + 3);
    board.confidence = Math.min(100, board.confidence + 2);
  }
}

function pay(game: GameState, clubId: string, amount: number) {
  const club = game.clubs[clubId];
  if (club.foreign || !amount) return;
  club.balance += amount;
  const l = ledgerOf(club);
  l.prize = (l.prize ?? 0) + amount;
}

function crown(game: GameState, comp: CupState) {
  const def = euroDef(comp.id);
  const final = comp.rounds[stageIndex(comp, 'final')].ties[0];
  comp.winnerId = final.winnerId;
  const club = game.clubs[comp.winnerId!];
  game.europe!.winners.push({ season: game.season, compId: comp.id, clubId: club.id });
  if (club.foreign) return;
  (club.trophies ??= []).push({ season: game.season, name: def.name });
  pay(game, club.id, def.prize.winner);
  if (club.isUser) {
    club.reputation += 3;
    const board = (club.board ??= { confidence: 60, fans: 60 });
    board.fans = Math.min(100, board.fans + 12);
    board.confidence = Math.min(100, board.confidence + 10);
    addInbox(game, 'info', `European champions! We've won the ${def.name}.`, { category: 'match', subject: `${def.name} winners` });
  }
}

// ---------------------------------------------------------------- playing matches

function findTie(comp: CupState, id: string): CupTie | undefined {
  for (const r of comp.rounds) for (const t of r.ties) if (t.id === id) return t;
  return undefined;
}

/** Match options for a European tie: knockout rules, the first-leg score, crowd. */
export function euroMatchOptions(game: GameState, tie: CupTie): SimOptions {
  const comp = compOf(game, tie.cupId);
  const round = comp.rounds[tie.round];
  const home = game.clubs[tie.homeId];
  const first = tie.firstLegId ? findTie(comp, tie.firstLegId) : undefined;
  return {
    neutral: tie.neutral,
    knockout: round.stage === 'final' || tie.leg === 2,
    firstLeg: first?.result ? { home: first.result.awayGoals, away: first.result.homeGoals } : undefined,
    capacity: tie.neutral ? euroDef(comp.id).finalCapacity : home.capacity,
    crowdFill: home.foreign ? 0.92 : Math.min(1, crowdFill(game, home) * 1.3),
  };
}

/** Aggregate score of a second leg, from this match's home side's point of view. */
export function aggregate(game: GameState, tie: CupTie): { home: number; away: number } | null {
  if (!tie.firstLegId || !tie.result) return null;
  const first = findTie(compOf(game, tie.cupId), tie.firstLegId);
  if (!first?.result) return null;
  return { home: tie.result.homeGoals + first.result.awayGoals, away: tie.result.awayGoals + first.result.homeGoals };
}

function poisson(rng: Rng, lambda: number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > l);
  return k - 1;
}

/**
 * A quick result for games the user isn't in, from the two sides' strengths.
 * Calibrated against the full match engine.
 */
export function quickResult(rng: Rng, home: number, away: number, opts: SimOptions): MatchResult {
  const d = home - away;
  const lh = (opts.neutral ? 1.25 : 1.33) * Math.exp(0.072 * d);
  const la = (opts.neutral ? 1.25 : 1.17) * Math.exp(-0.074 * d);
  let hg = poisson(rng, lh);
  let ag = poisson(rng, la);
  const fl = opts.firstLeg ?? { home: 0, away: 0 };
  const level = () => hg + fl.home === ag + fl.away;
  let penalties: MatchResult['penalties'];
  if (opts.knockout && level()) {
    hg += poisson(rng, lh / 3);
    ag += poisson(rng, la / 3);
    if (level()) {
      let ph = 0;
      let pa = 0;
      for (let i = 0; i < 5; i++) {
        if (rng.chance(0.76)) ph++;
        if (rng.chance(0.76)) pa++;
      }
      while (ph === pa) {
        if (rng.chance(0.76)) ph++;
        if (rng.chance(0.76)) pa++;
      }
      penalties = { home: ph, away: pa };
    }
  }
  const attendance = opts.neutral
    ? Math.round(opts.capacity * (0.7 + rng.next() * 0.3))
    : Math.min(opts.capacity, Math.round(opts.capacity * opts.crowdFill * (0.88 + rng.next() * 0.24)));
  return {
    homeGoals: hg,
    awayGoals: ag,
    penalties,
    events: [],
    homeXI: [],
    awayXI: [],
    ratings: {},
    possessionHome: Math.max(30, Math.min(70, Math.round(50 + d * 1.2 + rng.normal() * 4))),
    shotsHome: hg * 2 + rng.int(4, 10),
    shotsAway: ag * 2 + rng.int(3, 9),
    attendance,
  };
}

/** Gate money for the home club (shared at a neutral final); foreign clubs aren't tracked. */
function euroGate(game: GameState, tie: CupTie, result: MatchResult) {
  const sides = tie.neutral ? [tie.homeId, tie.awayId] : [tie.homeId];
  for (const id of sides) {
    const club = game.clubs[id];
    if (!club.foreign) addGate(game, club, (result.attendance * EURO_TICKET_FACTOR) / sides.length, { atHome: !tie.neutral });
  }
}

function playEuroMatch(game: GameState, rng: Rng, tie: CupTie): MatchResult {
  const opts = euroMatchOptions(game, tie);
  const home = game.clubs[tie.homeId];
  const away = game.clubs[tie.awayId];
  let result: MatchResult;
  if (home.isUser || away.isUser) {
    // The user's games use the full match engine, with real squads on both sides.
    result = simulateMatch(rng, teamSheet(game, home, away, { home: true }), teamSheet(game, away, home), opts);
    applyMatchToPlayers(game, rng, result, home, away, tie.cupId);
  } else {
    result = quickResult(rng, strengthOf(game, home), strengthOf(game, away), opts);
    // A quick result has no line-ups: the first-choice keeper gets any clean sheet.
    for (const [club, conceded] of [[home, result.awayGoals], [away, result.homeGoals]] as const) {
      if (conceded > 0) continue;
      const keeper = pickTeam(squadOf(game, club.id), club.tactics.formation).xi.find((p) => p.position === 'GK');
      if (keeper) creditCleanSheet(game, keeper, tie.cupId);
    }
    // Domestic clubs feel a European night in their legs, just as the user's players do.
    for (const club of [home, away]) if (!club.foreign) tireFirstTeam(game, club);
  }
  euroGate(game, tie, result);
  return result;
}

/** The same fitness cost as playing a match, for the eleven who would have played. */
function tireFirstTeam(game: GameState, club: Club) {
  const xi = pickTeam(squadOf(game, club.id), club.tactics.formation).xi;
  for (const p of xi) p.fitness = Math.max(40, p.fitness - (24 - attr100(p, 'stamina') / 10));
}

/** After a European match: league-phase prize money, or the winner of a finished tie. */
function afterTie(game: GameState, comp: CupState, tie: CupTie) {
  const def = euroDef(comp.id);
  const round = comp.rounds[tie.round];
  const r = tie.result!;
  if (round.stage === 'league') {
    if (r.homeGoals === r.awayGoals) {
      pay(game, tie.homeId, def.prize.draw);
      pay(game, tie.awayId, def.prize.draw);
    } else pay(game, r.homeGoals > r.awayGoals ? tie.homeId : tie.awayId, def.prize.win);
    return;
  }
  if (tie.leg === 1) return;
  const agg = aggregate(game, tie) ?? { home: r.homeGoals, away: r.awayGoals };
  const homeWon = agg.home !== agg.away ? agg.home > agg.away : r.penalties ? r.penalties.home > r.penalties.away : true;
  tie.winnerId = homeWon ? tie.homeId : tie.awayId;
  const first = tie.firstLegId ? findTie(comp, tie.firstLegId) : undefined;
  if (first) first.winnerId = tie.winnerId;

  const user = game.userClubId;
  if (tie.homeId !== user && tie.awayId !== user) return;
  const won = tie.winnerId === user;
  const opp = game.clubs[tie.homeId === user ? tie.awayId : tie.homeId];
  const usAgg = tie.homeId === user ? agg.home : agg.away;
  const themAgg = tie.homeId === user ? agg.away : agg.home;
  const score = `${tie.leg === 2 ? `${usAgg}–${themAgg} on aggregate` : `${usAgg}–${themAgg}`}${r.penalties ? ', on penalties' : ''}`;
  const stage = round.stage!;
  const board = (game.clubs[user].board ??= { confidence: 60, fans: 60 });
  if (won && stage !== 'final') {
    board.fans = Math.min(100, board.fans + 3);
    const next = stage === 'playoff' ? 'into the league phase' : `into the ${stageText(NEXT_STAGE[stage]!)}`;
    addInbox(game, 'info', `Through in the ${def.name}! We beat ${opp.name} ${score} and go ${next}.`, { category: 'match', subject: `${def.name}: through` });
  } else if (!won) {
    board.fans = Math.max(0, board.fans - 1);
    const drop = stage === 'playoff' && def.dropTo ? ` We drop into the ${euroDef(def.dropTo).name} league phase.` : '';
    addInbox(game, 'info', `Out of the ${def.name}: beaten by ${opp.name} ${score} in the ${stageText(stage)}.${drop}`, { category: 'match', subject: `${def.name}: knocked out` });
  }
}

function finishRound(game: GameState, rng: Rng, comp: CupState, r: number) {
  const round = comp.rounds[r];
  round.played = true;
  const stage = round.stage!;
  if (stage === 'playoff') {
    if (round.leg === 2) maybeDrawLeaguePhase(game, rng);
  } else if (stage === 'league') {
    if (comp.rounds[r + 1]?.stage !== 'league') drawKnockoutPlayoff(game, comp);
  } else if (stage === 'final') crown(game, comp);
  else if (round.leg === 2) drawNextKnockout(game, rng, comp, stage);
}

/** Play every unplayed match in a European round, then move the competition on. */
export function playEuroRound(game: GameState, rng: Rng, comp: CupState, r: number) {
  for (const tie of comp.rounds[r].ties) {
    if (tie.result) continue;
    tie.result = playEuroMatch(game, rng, tie);
    afterTie(game, comp, tie);
  }
  finishRound(game, rng, comp, r);
}

/** After the user's European match was played live: gate, outcome, then the rest of the round. */
export function completeUserEuroTie(game: GameState, tie: CupTie) {
  const comp = compOf(game, tie.cupId);
  euroGate(game, tie, tie.result!);
  afterTie(game, comp, tie);
  withRng(game, (rng) => playEuroRound(game, rng, comp, tie.round));
}

// ---------------------------------------------------------------- end of season

/** Season end: record the winners and hand out next season's places. */
export function europeSeasonEnd(game: GameState, summary: SeasonSummary) {
  const eu = ensureEurope(game);
  eu.next = placesFromSeason(game, summary);
  summary.europe = {
    winners: eu.comps.filter((c) => c.winnerId).map((c) => ({ compId: c.id, clubId: c.winnerId! })),
    qualified: eu.next,
  };
  const mine = eu.next.find((e) => e.clubId === game.userClubId);
  if (mine) {
    const def = euroDef(mine.compId);
    addInbox(game, 'info', `We've qualified for the ${def.name} next season (${mine.reason})${mine.playoff ? ', starting in the play-off round' : ''}.`, {
      category: 'match',
      subject: `Europe: ${def.name}`,
    });
  }
}
