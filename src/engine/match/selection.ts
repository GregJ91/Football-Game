import { effectiveRating } from '../players/ratings';
import type { Formation, Player, Position } from '../types';

export const FORMATIONS: Record<Formation, Position[]> = {
  '4-4-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'],
  '4-3-3': ['GK', 'DR', 'DC', 'DC', 'DL', 'DMC', 'MC', 'MC', 'MR', 'ML', 'ST'],
  '4-2-3-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DMC', 'DMC', 'MR', 'AMC', 'ML', 'ST'],
  '3-5-2': ['GK', 'DC', 'DC', 'DC', 'MR', 'DMC', 'MC', 'MC', 'ML', 'ST', 'ST'],
  '5-3-2': ['GK', 'DR', 'DC', 'DC', 'DC', 'DL', 'DMC', 'MC', 'MC', 'ST', 'ST'],
};

export interface Selection {
  /** Starting XI in slot order, aligned with `slots`. */
  xi: Player[];
  slots: Position[];
  bench: Player[];
}

export function isAvailable(p: Player): boolean {
  return p.injuryWeeks === 0 && p.suspendedMatches === 0;
}

/** Fill the scarcest slots first so a lone GK isn't wasted elsewhere. */
const FILL_ORDER: Position[] = ['GK', 'ST', 'DC', 'DR', 'DL', 'AMC', 'DMC', 'MR', 'ML', 'MC'];

export function pickTeam(squad: Player[], formation: Formation, benchSize = 7): Selection {
  const slots = FORMATIONS[formation];
  const pool = squad.filter(isAvailable);
  const chosen: (Player | undefined)[] = new Array(slots.length);
  const used = new Set<string>();

  const slotIdx = slots.map((s, i) => ({ s, i }));
  slotIdx.sort((a, b) => FILL_ORDER.indexOf(a.s) - FILL_ORDER.indexOf(b.s));
  for (const { s, i } of slotIdx) {
    let best: Player | undefined;
    let bestScore = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const score = effectiveRating(p, s);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      chosen[i] = best;
      used.add(best.id);
    }
  }

  // Short of fit players: field injured ones rather than play with ten.
  for (let i = 0; i < slots.length; i++) {
    if (chosen[i]) continue;
    const fallback = squad.find((p) => !used.has(p.id) && p.suspendedMatches === 0);
    if (fallback) {
      chosen[i] = fallback;
      used.add(fallback.id);
    }
  }

  const xi: Player[] = [];
  const xiSlots: Position[] = [];
  chosen.forEach((p, i) => {
    if (p) {
      xi.push(p);
      xiSlots.push(slots[i]);
    }
  });

  const bench = pool
    .filter((p) => !used.has(p.id))
    .sort((a, b) => b.overall - a.overall);
  // Always try to carry a substitute keeper.
  const subGk = bench.find((p) => p.position === 'GK');
  const outfield = bench.filter((p) => p !== subGk).slice(0, subGk ? benchSize - 1 : benchSize);
  return { xi, slots: xiSlots, bench: subGk ? [subGk, ...outfield] : outfield };
}
