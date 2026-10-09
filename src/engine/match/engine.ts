import { attr100, effectiveRating, positionFit, positionsOf, ratingAt } from '../players/ratings';
import type { Rng } from '../rng';
import type { MatchEvent, MatchResult, Player, Position, Tactics } from '../types';
import { pickTeam, type Selection } from './selection';
import { MENTALITY_MODS, tacticalModifiers, type TacticalMods } from './tactics';

/** Tunable constants; calibrated by tests/match.test.ts. */
export const ENGINE = {
  homeBoost: 1.02,
  possessionExp: 1.4,
  baseChance: 0.2,
  chanceExp: 1.3,
  baseGoal: 0.14,
  goalExp: 0.5,
  yellowPerMinute: 0.019,
  redPerMinute: 0.0006,
  injuryPerMinute: 0.0015,
  maxSubs: 5,
  redCardPenalty: 0.88,
  /** Caps how lopsided a mismatch can get (cup ties across levels). */
  minRatio: 0.6,
  maxRatio: 1.7,
  /** How much midfield control sharpens chance quality. */
  midInfluence: 0.5,
  /** Commentary-only build-up moments per minute without a chance. */
  attackFlavour: 0.1,
};

type Zone = 'def' | 'mid' | 'att';
const ZONE_WEIGHTS: Record<Position, Partial<Record<Zone, number>>> = {
  GK: { def: 1.5 },
  DC: { def: 1 },
  DR: { def: 1, mid: 0.2 },
  DL: { def: 1, mid: 0.2 },
  DMC: { def: 0.5, mid: 1 },
  MC: { mid: 1, att: 0.2 },
  MR: { mid: 0.7, att: 0.5 },
  ML: { mid: 0.7, att: 0.5 },
  AMC: { mid: 0.5, att: 1 },
  ST: { att: 1 },
};

const SHOOT_WEIGHT: Record<Position, number> = {
  GK: 0, DC: 0.9, DR: 0.5, DL: 0.5, DMC: 0.8, MC: 1.5, MR: 2, ML: 2, AMC: 3, ST: 4.2,
};

const DEFENDERS: Position[] = ['DC', 'DR', 'DL'];

export interface TeamSheet {
  selection: Selection;
  tactics: Tactics;
  /** Extra sharpness on the day (match preparation in training): 1 = none. */
  boost?: number;
}

export type TeamTalk = 'praise' | 'calm' | 'rally';
export type SideName = 'home' | 'away';

/** A player on the pitch. Energy is derived from minutes played since `since`. */
export interface OnPitch {
  player: Player;
  slot: Position;
  start: number;
  since: number;
  drain: number;
}

export interface LiveSide {
  name: SideName;
  onPitch: OnPitch[];
  bench: Player[];
  subsUsed: number;
  tactics: Tactics;
  boost: number;
  redCards: number;
  booked: Set<string>;
  usedIds: Set<string>;
  talk: number;
  mods: TacticalMods;
  zones: Record<Zone, number>;
  /** Computer-managed: makes its own subs and half-time talk. */
  auto: boolean;
  /** Per player+slot rating at full energy, cached for the match. */
  baseRatings: Map<string, number>;
}

export interface LiveMatch {
  rng: Rng;
  opts: SimOptions;
  minute: number;
  endMinute: number;
  finished: boolean;
  /** Set on reaching 45'; the UI pauses for the team talk until cleared. */
  halfTimePending: boolean;
  home: LiveSide;
  away: LiveSide;
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
  homePossession: number;
  ticks: number;
  shotsHome: number;
  shotsAway: number;
  penalties?: { home: number; away: number };
  players: Record<string, Player>;
}

export interface SimOptions {
  neutral?: boolean;
  /** Knockout tie: extra time and penalties if level. */
  knockout?: boolean;
  /** Second leg of a two-legged tie: goals each side (this match's home and away) scored in the first leg. */
  firstLeg?: { home: number; away: number };
  capacity: number;
  /** 0–1 how full the ground tends to be. */
  crowdFill: number;
  /** Generate commentary-only build-up events. */
  commentary?: boolean;
  /** Sides managed by the player (no automatic subs or team talk). */
  manual?: Partial<Record<SideName, boolean>>;
}

function avgPace(side: LiveSide, slots: Position[]) {
  const ps = side.onPitch.filter((o) => slots.includes(o.slot));
  return ps.length ? ps.reduce((s, o) => s + attr100(o.player, 'pace'), 0) / ps.length : 50;
}

function refreshMods(m: LiveMatch) {
  const ctx = (us: LiveSide, them: LiveSide) => ({
    ourDefPace: avgPace(us, DEFENDERS),
    theirAttPace: avgPace(them, ['ST', 'AMC', 'MR', 'ML']),
  });
  m.home.mods = tacticalModifiers(m.home.tactics, m.away.tactics, ctx(m.home, m.away));
  m.away.mods = tacticalModifiers(m.away.tactics, m.home.tactics, ctx(m.away, m.home));
  computeZones(m, m.home);
  computeZones(m, m.away);
}

/** Recompute both sides' zone strengths for the current minute. */
export function refreshZones(m: LiveMatch) {
  computeZones(m, m.home);
  computeZones(m, m.away);
}

function computeZones(m: LiveMatch, side: LiveSide) {
  const sums: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
  const weights: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
  for (const o of side.onPitch) {
    const { player, slot } = o;
    const key = `${player.id}:${slot}`;
    let base = side.baseRatings.get(key);
    if (base === undefined) {
      // Energy-free rating for this slot; the energy factor is applied below.
      base = effectiveRating(player, slot, 100);
      side.baseRatings.set(key, base);
    }
    const r = base * (0.75 + 0.25 * (energyOf(m, o) / 100));
    const zw = ZONE_WEIGHTS[slot];
    for (const z of ['def', 'mid', 'att'] as Zone[]) {
      const w = zw[z] ?? 0;
      sums[z] += r * w;
      weights[z] += w;
    }
  }
  const mentality = MENTALITY_MODS[side.tactics.mentality];
  const red = Math.pow(ENGINE.redCardPenalty, side.redCards);
  const common = side.boost * red * side.talk;
  const press = m.minute <= 60 ? side.mods.pressMid : 0;
  side.zones = {
    def: (sums.def / (weights.def || 1) || 20) * mentality.def * side.mods.def * common,
    mid: (sums.mid / (weights.mid || 1) || 20) * (side.mods.mid + press) * common,
    att: (sums.att / (weights.att || 1) || 20) * mentality.att * side.mods.att * common,
  };
}

function makeSide(name: SideName, sheet: TeamSheet, boost: number, auto: boolean): LiveSide {
  return {
    name,
    onPitch: sheet.selection.xi.map((player, i) => ({
      player,
      slot: sheet.selection.slots[i],
      start: player.fitness,
      since: 0,
      drain: drainRate(player, sheet.tactics.pressing),
    })),
    bench: [...sheet.selection.bench],
    subsUsed: 0,
    tactics: { ...sheet.tactics },
    boost,
    redCards: 0,
    booked: new Set(),
    usedIds: new Set(sheet.selection.xi.map((p) => p.id)),
    talk: 1,
    mods: { def: 1, mid: 1, att: 1, pressMid: 0, notes: [] },
    zones: { def: 0, mid: 0, att: 0 },
    auto,
    baseRatings: new Map(),
  };
}

export function createLiveMatch(rng: Rng, home: TeamSheet, away: TeamSheet, opts: SimOptions): LiveMatch {
  const players: Record<string, Player> = {};
  for (const p of [...home.selection.xi, ...home.selection.bench, ...away.selection.xi, ...away.selection.bench]) players[p.id] = p;
  const m: LiveMatch = {
    rng,
    opts,
    minute: 0,
    endMinute: 90,
    finished: false,
    halfTimePending: false,
    home: makeSide('home', home, (opts.neutral ? 1 : ENGINE.homeBoost) * (home.boost ?? 1), !opts.manual?.home),
    away: makeSide('away', away, away.boost ?? 1, !opts.manual?.away),
    events: [],
    homeGoals: 0,
    awayGoals: 0,
    homePossession: 0,
    ticks: 0,
    shotsHome: 0,
    shotsAway: 0,
    players,
  };
  refreshMods(m);
  return m;
}

function keeperRating(side: LiveSide): number {
  const gk = side.onPitch.find((o) => o.slot === 'GK');
  if (!gk) return 25;
  return ratingAt(gk.player.attributes, 'GK') * positionFit(positionsOf(gk.player), 'GK');
}

function drainRate(p: Player, pressing: Tactics['pressing']): number {
  const press = pressing === 'high' ? 0.12 : pressing === 'low' ? -0.05 : 0;
  return 0.22 + (100 - attr100(p, 'stamina')) / 250 + press;
}

export function energyOf(m: Pick<LiveMatch, 'minute'>, o: OnPitch): number {
  return Math.max(0, o.start - o.drain * (m.minute - o.since));
}

/** Current energy for any player in the squad (bench players are fresh). */
export function playerEnergy(m: LiveMatch, side: SideName, playerId: string): number {
  const o = m[side].onPitch.find((x) => x.player.id === playerId);
  return o ? energyOf(m, o) : (m.players[playerId]?.fitness ?? 100);
}

/** Swap a player; returns false if not allowed. */
export function makeSub(m: LiveMatch, sideName: SideName, outId: string, inId: string): boolean {
  const side = m[sideName];
  const idx = side.onPitch.findIndex((o) => o.player.id === outId);
  const incoming = side.bench.find((b) => b.id === inId);
  if (idx < 0 || !incoming || side.subsUsed >= ENGINE.maxSubs) return false;
  side.bench = side.bench.filter((b) => b !== incoming);
  side.onPitch[idx] = {
    player: incoming,
    slot: side.onPitch[idx].slot,
    start: incoming.fitness,
    since: m.minute,
    drain: drainRate(incoming, side.tactics.pressing),
  };
  side.subsUsed++;
  side.usedIds.add(incoming.id);
  m.events.push({ minute: Math.max(1, m.minute), type: 'sub', side: sideName, playerId: outId, inId });
  computeZones(m, side);
  return true;
}

function bestBenchFor(side: LiveSide, slot: Position): Player | undefined {
  let best: Player | undefined;
  for (const b of side.bench) if (!best || effectiveRating(b, slot) > effectiveRating(best, slot)) best = b;
  return best;
}

function autoSub(m: LiveMatch, side: LiveSide) {
  if (side.subsUsed >= 3 || side.bench.length === 0) return;
  // Bring on fresh legs for the most tired outfield player.
  const outfield = side.onPitch.filter((o) => o.slot !== 'GK');
  if (!outfield.length) return;
  const tired = outfield.reduce((a, b) => (energyOf(m, a) <= energyOf(m, b) ? a : b));
  const sub = bestBenchFor(side, tired.slot);
  if (sub) makeSub(m, side.name, tired.player.id, sub.id);
}

/** Reorganise the players on the pitch into new tactics. */
export function changeTactics(m: LiveMatch, sideName: SideName, tactics: Tactics) {
  const side = m[sideName];
  const energy = new Map(side.onPitch.map((o) => [o.player.id, energyOf(m, o)]));
  const slots = new Map(side.onPitch.map((o) => [o.player.id, o.slot]));
  if (tactics.formation !== side.tactics.formation) {
    const sel = pickTeam(side.onPitch.map((o) => o.player), tactics.formation, 0);
    sel.xi.forEach((p, i) => slots.set(p.id, sel.slots[i]));
    side.onPitch = side.onPitch.filter((o) => sel.xi.includes(o.player));
  }
  // Rebase energy so a new pressing intensity applies from now on.
  side.onPitch = side.onPitch.map((o) => ({
    player: o.player,
    slot: slots.get(o.player.id)!,
    start: energy.get(o.player.id)!,
    since: m.minute,
    drain: drainRate(o.player, tactics.pressing),
  }));
  side.tactics = { ...tactics };
  refreshMods(m);
}

export function scoreFor(m: LiveMatch, sideName: SideName) {
  return sideName === 'home' ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals;
}

/** Half-time team talk. Returns how the players took it. */
export function giveTeamTalk(m: LiveMatch, sideName: SideName, talk: TeamTalk): 'well' | 'neutral' | 'badly' {
  const diff = scoreFor(m, sideName);
  const table: Record<TeamTalk, [number, number, number]> = {
    // [winning, drawing, losing]
    praise: [1.02, 1.02, 0.98],
    calm: [1.03, 1.0, 1.01],
    rally: [0.99, 1.025, 1.04],
  };
  const v = table[talk][diff > 0 ? 0 : diff === 0 ? 1 : 2];
  m[sideName].talk = v;
  computeZones(m, m[sideName]);
  return v > 1.015 ? 'well' : v < 1 ? 'badly' : 'neutral';
}

function bestTalk(m: LiveMatch, sideName: SideName): TeamTalk {
  return scoreFor(m, sideName) > 0 ? 'calm' : 'rally';
}

function sendOff(m: LiveMatch, side: LiveSide, p: Player, minute: number) {
  m.events.push({ minute, type: 'red', side: side.name, playerId: p.id });
  side.onPitch = side.onPitch.filter((o) => o.player !== p);
  side.redCards++;
  computeZones(m, side);
}

/** Cards, injuries and substitutions for one side in one minute. */
function sideMinute(m: LiveMatch, side: LiveSide, minute: number) {
  const rng = m.rng;
  if (rng.chance(ENGINE.yellowPerMinute)) {
    const outfield = side.onPitch.filter((o) => o.slot !== 'GK');
    if (outfield.length) {
      const culprit = rng.weighted(outfield, (o) => 30 + attr100(o.player, 'aggression')).player;
      if (side.booked.has(culprit.id)) sendOff(m, side, culprit, minute);
      else {
        side.booked.add(culprit.id);
        m.events.push({ minute, type: 'yellow', side: side.name, playerId: culprit.id });
      }
    }
  } else if (rng.chance(ENGINE.redPerMinute)) {
    const outfield = side.onPitch.filter((o) => o.slot !== 'GK');
    if (outfield.length) sendOff(m, side, rng.pick(outfield).player, minute);
  }
  if (rng.chance(ENGINE.injuryPerMinute) && side.onPitch.length) {
    const idx = rng.int(0, side.onPitch.length - 1);
    const hurt = side.onPitch[idx];
    m.events.push({ minute, type: 'injury', side: side.name, playerId: hurt.player.id });
    const sub = bestBenchFor(side, hurt.slot);
    // Injured players are always replaced when possible, even for the player's side.
    if (!(sub && makeSub(m, side.name, hurt.player.id, sub.id))) {
      side.onPitch.splice(idx, 1);
      side.redCards++; // a man down, same effect as a red
      computeZones(m, side);
    }
  }
  if (side.auto && minute >= 58 && minute <= 82 && rng.chance(0.09)) autoSub(m, side);
}

/** Attack vs defence, sharpened by who controls midfield. */
export function chanceRatio(att: Pick<LiveSide, 'zones'>, def: Pick<LiveSide, 'zones'>): number {
  const r = (att.zones.att / def.zones.def) * Math.pow(att.zones.mid / def.zones.mid, ENGINE.midInfluence);
  return Math.min(ENGINE.maxRatio, Math.max(ENGINE.minRatio, r));
}

/** Advance the match by one minute. */
export function stepMinute(m: LiveMatch) {
  if (m.finished || m.halfTimePending) return;
  const rng = m.rng;
  const minute = ++m.minute;
  const { home: h, away: a } = m;
  m.ticks++;

  const pHome = Math.pow(h.zones.mid, ENGINE.possessionExp) /
    (Math.pow(h.zones.mid, ENGINE.possessionExp) + Math.pow(a.zones.mid, ENGINE.possessionExp));
  const homeAttacks = rng.next() < pHome;
  if (homeAttacks) m.homePossession++;
  const att = homeAttacks ? h : a;
  const def = homeAttacks ? a : h;

  const ratio = chanceRatio(att, def);
  if (rng.chance(ENGINE.baseChance * Math.pow(ratio, ENGINE.chanceExp))) {
    // Finishing decides whether it goes in; it only nudges who takes the shot.
    const shooter = rng.weighted(att.onPitch, (o) => SHOOT_WEIGHT[o.slot] * (0.5 + attr100(o.player, 'finishing') / 100)).player;
    if (homeAttacks) m.shotsHome++;
    else m.shotsAway++;
    const finish = attr100(shooter, 'finishing') / Math.max(20, keeperRating(def));
    const pGoal = ENGINE.baseGoal * Math.pow(ratio, ENGINE.goalExp) * Math.pow(finish, 0.7);
    if (rng.chance(pGoal)) {
      let assistId: string | undefined;
      if (rng.chance(0.72)) {
        const others = att.onPitch.filter((o) => o.player !== shooter && o.slot !== 'GK');
        if (others.length) assistId = rng.weighted(others, (o) => o.player.attributes.passing + o.player.attributes.crossing).player.id;
      }
      m.events.push({ minute, type: 'goal', side: att.name, playerId: shooter.id, assistId });
      if (homeAttacks) m.homeGoals++;
      else m.awayGoals++;
    } else if (rng.chance(0.45)) {
      const gk = def.onPitch.find((o) => o.slot === 'GK');
      // For saves, assistId records the shooter so commentary can name them.
      if (gk) m.events.push({ minute, type: 'save', side: def.name, playerId: gk.player.id, assistId: shooter.id });
    } else {
      m.events.push({ minute, type: 'chance', side: att.name, playerId: shooter.id });
    }
  } else if (m.opts.commentary && rng.chance(ENGINE.attackFlavour)) {
    const carrier = rng.weighted(att.onPitch, (o) => (o.slot === 'GK' ? 0 : o.player.attributes.dribbling + o.player.attributes.passing)).player;
    m.events.push({ minute, type: 'attack', side: att.name, playerId: carrier.id });
  }

  sideMinute(m, h, minute);
  sideMinute(m, a, minute);

  if (minute % 10 === 0 || minute === 61) {
    computeZones(m, h);
    computeZones(m, a);
  }

  if (minute === 45) {
    for (const side of [h, a]) if (side.auto) giveTeamTalk(m, side.name, bestTalk(m, side.name));
    m.halfTimePending = !(h.auto && a.auto);
  }

  if (minute >= m.endMinute) {
    if (m.opts.knockout && isLevel(m) && m.endMinute === 90) m.endMinute = 120;
    else {
      if (m.opts.knockout && isLevel(m)) m.penalties = shootout(rng);
      m.finished = true;
    }
  }
}

/** Level in the match, or on aggregate in a second leg. */
export function isLevel(m: Pick<LiveMatch, 'homeGoals' | 'awayGoals' | 'opts'>): boolean {
  const first = m.opts.firstLeg;
  return m.homeGoals + (first?.home ?? 0) === m.awayGoals + (first?.away ?? 0);
}

export function runToEnd(m: LiveMatch) {
  while (!m.finished) {
    m.halfTimePending = false;
    stepMinute(m);
  }
  m.halfTimePending = false;
}

export function finishMatch(m: LiveMatch): MatchResult {
  const ratings = ratePlayers(m);
  const opts = m.opts;
  const attendance = opts.neutral
    ? Math.round(opts.capacity * (0.7 + m.rng.next() * 0.3))
    : Math.min(opts.capacity, Math.round(opts.capacity * opts.crowdFill * (0.88 + m.rng.next() * 0.24)));
  return {
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    penalties: m.penalties,
    events: m.events.filter((e) => e.type !== 'attack'),
    homeXI: [...m.home.usedIds],
    awayXI: [...m.away.usedIds],
    ratings,
    possessionHome: Math.round((m.homePossession / Math.max(1, m.ticks)) * 100),
    shotsHome: m.shotsHome,
    shotsAway: m.shotsAway,
    attendance,
  };
}

/** Instant result: the same engine, run straight through. */
export function simulateMatch(rng: Rng, home: TeamSheet, away: TeamSheet, opts: SimOptions): MatchResult {
  const m = createLiveMatch(rng, home, away, { ...opts, manual: undefined });
  runToEnd(m);
  return finishMatch(m);
}

function shootout(rng: Rng) {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(0.76)) home++;
    if (rng.chance(0.76)) away++;
  }
  while (home === away) {
    if (rng.chance(0.76)) home++;
    if (rng.chance(0.76)) away++;
  }
  return { home, away };
}

function ratePlayers(m: LiveMatch) {
  const ratings: Record<string, number> = {};
  const rateSide = (side: LiveSide, scored: number, conceded: number) => {
    const resultAdj = scored > conceded ? 0.5 : scored < conceded ? -0.5 : 0;
    for (const id of side.usedIds) {
      const p = m.players[id];
      let r = 6.3 + resultAdj + m.rng.normal() * 0.45;
      const slot = side.onPitch.find((o) => o.player.id === id)?.slot ?? p?.position;
      if (slot === 'GK' || (slot && DEFENDERS.includes(slot))) r += conceded === 0 ? 0.5 : -0.15 * conceded;
      ratings[id] = r;
    }
  };
  rateSide(m.home, m.homeGoals, m.awayGoals);
  rateSide(m.away, m.awayGoals, m.homeGoals);
  for (const e of m.events) {
    if (e.type === 'goal') {
      ratings[e.playerId] = (ratings[e.playerId] ?? 6) + 1;
      if (e.assistId) ratings[e.assistId] = (ratings[e.assistId] ?? 6) + 0.5;
    } else if (e.type === 'save') ratings[e.playerId] = (ratings[e.playerId] ?? 6) + 0.2;
    else if (e.type === 'red') ratings[e.playerId] = (ratings[e.playerId] ?? 6) - 1.5;
  }
  for (const id in ratings) ratings[id] = Math.round(Math.max(3, Math.min(10, ratings[id])) * 10) / 10;
  return ratings;
}
