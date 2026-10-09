import { effectiveRating, positionFit, ratingAt } from '../players/ratings';
import type { Rng } from '../rng';
import type { MatchEvent, MatchResult, Mentality, Player, Position } from '../types';
import type { Selection } from './selection';

/** Tunable constants; calibrated by tests/match.test.ts. */
export const ENGINE = {
  homeBoost: 1.03,
  possessionExp: 1.4,
  baseChance: 0.22,
  chanceExp: 1.4,
  baseGoal: 0.14,
  goalExp: 0.5,
  yellowPerMinute: 0.019,
  redPerMinute: 0.0006,
  injuryPerMinute: 0.0011,
  maxSubs: 5,
  redCardPenalty: 0.88,
  /** Caps how lopsided a mismatch can get (cup ties across levels). */
  minRatio: 0.6,
  maxRatio: 1.7,
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
  GK: 0, DC: 0.6, DR: 0.4, DL: 0.4, DMC: 0.6, MC: 1.2, MR: 2, ML: 2, AMC: 3, ST: 6,
};

const MENTALITY: Record<Mentality, { def: number; att: number }> = {
  defensive: { def: 1.06, att: 0.93 },
  balanced: { def: 1, att: 1 },
  attacking: { def: 0.94, att: 1.07 },
};

export interface TeamSheet {
  selection: Selection;
  mentality: Mentality;
}

interface LiveSide {
  onPitch: { player: Player; slot: Position }[];
  bench: Player[];
  subsUsed: number;
  zones: Record<Zone, number>;
  mentality: Mentality;
  boost: number;
  redCards: number;
  booked: Set<string>;
  sentOff: Set<string>;
  usedIds: Set<string>;
}

function computeZones(side: LiveSide) {
  const sums: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
  const weights: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
  for (const { player, slot } of side.onPitch) {
    const r = effectiveRating(player, slot);
    const zw = ZONE_WEIGHTS[slot];
    for (const z of ['def', 'mid', 'att'] as Zone[]) {
      const w = zw[z] ?? 0;
      sums[z] += r * w;
      weights[z] += w;
    }
  }
  const m = MENTALITY[side.mentality];
  const red = Math.pow(ENGINE.redCardPenalty, side.redCards);
  side.zones = {
    def: ((sums.def / (weights.def || 1)) || 20) * m.def * side.boost * red,
    mid: ((sums.mid / (weights.mid || 1)) || 20) * side.boost * red,
    att: ((sums.att / (weights.att || 1)) || 20) * m.att * side.boost * red,
  };
}

function makeSide(sheet: TeamSheet, boost: number): LiveSide {
  const side: LiveSide = {
    onPitch: sheet.selection.xi.map((player, i) => ({ player, slot: sheet.selection.slots[i] })),
    bench: [...sheet.selection.bench],
    subsUsed: 0,
    zones: { def: 0, mid: 0, att: 0 },
    mentality: sheet.mentality,
    boost,
    redCards: 0,
    booked: new Set(),
    sentOff: new Set(),
    usedIds: new Set(sheet.selection.xi.map((p) => p.id)),
  };
  computeZones(side);
  return side;
}

function keeperRating(side: LiveSide): number {
  const gk = side.onPitch.find((o) => o.slot === 'GK');
  if (!gk) return 25;
  return ratingAt(gk.player.attributes, 'GK') * positionFit(gk.player.position, 'GK');
}

function substitute(rng: Rng, side: LiveSide, outIdx: number): Player | null {
  if (side.subsUsed >= ENGINE.maxSubs || side.bench.length === 0) return null;
  const slot = side.onPitch[outIdx].slot;
  let best = side.bench[0];
  for (const b of side.bench) if (effectiveRating(b, slot) > effectiveRating(best, slot)) best = b;
  side.bench = side.bench.filter((b) => b !== best);
  side.onPitch[outIdx] = { player: best, slot };
  side.subsUsed++;
  side.usedIds.add(best.id);
  void rng;
  return best;
}

export interface SimOptions {
  neutral?: boolean;
  /** Knockout tie: extra time and penalties if level. */
  knockout?: boolean;
  capacity: number;
  /** 0–1 how full the ground tends to be. */
  crowdFill: number;
}

export function simulateMatch(rng: Rng, home: TeamSheet, away: TeamSheet, opts: SimOptions): MatchResult {
  const h = makeSide(home, opts.neutral ? 1 : ENGINE.homeBoost);
  const a = makeSide(away, 1);
  const events: MatchEvent[] = [];
  let homeGoals = 0;
  let awayGoals = 0;
  let homePossession = 0;
  let ticks = 0;
  let shotsHome = 0;
  let shotsAway = 0;

  const playMinutes = (from: number, to: number) => {
    for (let minute = from; minute <= to; minute++) {
      ticks++;
      const pHome = Math.pow(h.zones.mid, ENGINE.possessionExp) /
        (Math.pow(h.zones.mid, ENGINE.possessionExp) + Math.pow(a.zones.mid, ENGINE.possessionExp));
      const homeAttacks = rng.next() < pHome;
      if (homeAttacks) homePossession++;
      const att = homeAttacks ? h : a;
      const def = homeAttacks ? a : h;
      const sideName = homeAttacks ? 'home' : 'away';

      const ratio = Math.min(ENGINE.maxRatio, Math.max(ENGINE.minRatio, att.zones.att / def.zones.def));
      if (rng.chance(ENGINE.baseChance * Math.pow(ratio, ENGINE.chanceExp))) {
        const shooter = rng.weighted(att.onPitch, (o) => SHOOT_WEIGHT[o.slot] * (o.player.attributes.finishing / 50)).player;
        if (homeAttacks) shotsHome++;
        else shotsAway++;
        const finish = shooter.attributes.finishing / Math.max(20, keeperRating(def));
        const pGoal = ENGINE.baseGoal * Math.pow(ratio, ENGINE.goalExp) * Math.pow(finish, 0.7);
        if (rng.chance(pGoal)) {
          let assistId: string | undefined;
          if (rng.chance(0.72)) {
            const others = att.onPitch.filter((o) => o.player !== shooter && o.slot !== 'GK');
            if (others.length) assistId = rng.weighted(others, (o) => o.player.attributes.passing).player.id;
          }
          events.push({ minute, type: 'goal', side: sideName, playerId: shooter.id, assistId });
          if (homeAttacks) homeGoals++;
          else awayGoals++;
        } else if (rng.chance(0.45)) {
          const gk = def.onPitch.find((o) => o.slot === 'GK');
          if (gk) events.push({ minute, type: 'save', side: homeAttacks ? 'away' : 'home', playerId: gk.player.id });
        } else {
          events.push({ minute, type: 'chance', side: sideName, playerId: shooter.id });
        }
      }

      for (const [side, name] of [[h, 'home'], [a, 'away']] as const) {
        if (rng.chance(ENGINE.yellowPerMinute)) {
          const outfield = side.onPitch.filter((o) => o.slot !== 'GK');
          if (outfield.length) {
            const culprit = rng.weighted(outfield, (o) => 30 + o.player.attributes.tackling).player;
            if (side.booked.has(culprit.id)) sendOff(side, culprit, minute, name);
            else {
              side.booked.add(culprit.id);
              events.push({ minute, type: 'yellow', side: name, playerId: culprit.id });
            }
          }
        } else if (rng.chance(ENGINE.redPerMinute)) {
          const outfield = side.onPitch.filter((o) => o.slot !== 'GK');
          if (outfield.length) sendOff(side, rng.pick(outfield).player, minute, name);
        }
        if (rng.chance(ENGINE.injuryPerMinute)) {
          const idx = rng.int(0, side.onPitch.length - 1);
          const hurt = side.onPitch[idx].player;
          events.push({ minute, type: 'injury', side: name, playerId: hurt.id });
          if (!substitute(rng, side, idx)) {
            side.onPitch.splice(idx, 1);
            side.redCards++; // a man down, same effect as a red
          }
          computeZones(side);
        }
      }
    }
  };

  const sendOff = (side: LiveSide, p: Player, minute: number, name: 'home' | 'away') => {
    events.push({ minute, type: 'red', side: name, playerId: p.id });
    side.sentOff.add(p.id);
    side.onPitch = side.onPitch.filter((o) => o.player !== p);
    side.redCards++;
    computeZones(side);
  };

  playMinutes(1, 90);
  let penalties: MatchResult['penalties'];
  if (opts.knockout && homeGoals === awayGoals) {
    playMinutes(91, 120);
    if (homeGoals === awayGoals) penalties = shootout(rng);
  }

  const used = (side: LiveSide) => [...side.usedIds];
  const ratings = rateplayers(rng, h, a, homeGoals, awayGoals, events);
  const attendance = opts.neutral
    ? Math.round(opts.capacity * (0.7 + rng.next() * 0.3))
    : Math.min(opts.capacity, Math.round(opts.capacity * opts.crowdFill * (0.88 + rng.next() * 0.24)));

  return {
    homeGoals,
    awayGoals,
    penalties,
    events,
    homeXI: used(h),
    awayXI: used(a),
    ratings,
    possessionHome: Math.round((homePossession / ticks) * 100),
    shotsHome,
    shotsAway,
    attendance,
  };
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

function rateplayers(rng: Rng, h: LiveSide, a: LiveSide, hg: number, ag: number, events: MatchEvent[]) {
  const ratings: Record<string, number> = {};
  const rateSide = (side: LiveSide, scored: number, conceded: number) => {
    const resultAdj = scored > conceded ? 0.5 : scored < conceded ? -0.5 : 0;
    for (const id of side.usedIds) {
      const p = [...side.onPitch.map((o) => o.player), ...side.bench].find((x) => x.id === id);
      let r = 6.3 + resultAdj + rng.normal() * 0.45;
      const slot = side.onPitch.find((o) => o.player.id === id)?.slot ?? p?.position;
      if (slot === 'GK' || slot === 'DC' || slot === 'DR' || slot === 'DL') {
        r += conceded === 0 ? 0.5 : -0.15 * conceded;
      }
      ratings[id] = r;
    }
  };
  rateSide(h, hg, ag);
  rateSide(a, ag, hg);
  for (const e of events) {
    if (e.type === 'goal') {
      ratings[e.playerId] = (ratings[e.playerId] ?? 6) + 1;
      if (e.assistId) ratings[e.assistId] = (ratings[e.assistId] ?? 6) + 0.5;
    } else if (e.type === 'save') ratings[e.playerId] = (ratings[e.playerId] ?? 6) + 0.2;
    else if (e.type === 'red') ratings[e.playerId] = (ratings[e.playerId] ?? 6) - 1.5;
  }
  for (const id in ratings) ratings[id] = Math.round(Math.max(3, Math.min(10, ratings[id])) * 10) / 10;
  return ratings;
}
