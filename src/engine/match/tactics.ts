import type { Formation, Mentality, Pressing, Tactics } from '../types';

/** The structural features of a formation that matter in a match-up. */
interface Shape {
  centralMids: number;
  wide: boolean;
  strikers: number;
  centreBacks: number;
}

export const SHAPES: Record<Formation, Shape> = {
  '4-4-2': { centralMids: 2, wide: true, strikers: 2, centreBacks: 2 },
  '4-3-3': { centralMids: 3, wide: true, strikers: 1, centreBacks: 2 },
  '4-2-3-1': { centralMids: 3, wide: true, strikers: 1, centreBacks: 2 },
  '3-5-2': { centralMids: 3, wide: true, strikers: 2, centreBacks: 3 },
  '5-3-2': { centralMids: 3, wide: false, strikers: 2, centreBacks: 3 },
};

export const MENTALITY_MODS: Record<Mentality, { def: number; att: number }> = {
  defensive: { def: 1.06, att: 0.93 },
  balanced: { def: 1, att: 1 },
  attacking: { def: 0.94, att: 1.07 },
};

export interface TacticalNote {
  text: string;
  /** Positive = helps us. */
  effect: number;
}

export interface TacticalMods {
  def: number;
  mid: number;
  att: number;
  /** Extra midfield bonus from a high press, which fades after the hour. */
  pressMid: number;
  notes: TacticalNote[];
}

export interface MatchupContext {
  ourDefPace: number;
  theirAttPace: number;
}

const MAX_SWING = 0.15;
const clampMod = (x: number) => Math.max(1 - MAX_SWING, Math.min(1 + MAX_SWING, x));

/**
 * How our tactics fare against theirs, as multipliers on our zone strengths
 * (mentality excluded; it is applied separately). Notes explain each effect
 * so the assistant manager can talk the player through it.
 */
export function tacticalModifiers(us: Tactics, them: Tactics, ctx: MatchupContext): TacticalMods {
  const a = SHAPES[us.formation];
  const b = SHAPES[them.formation];
  let def = 1;
  let mid = 1;
  let att = 1;
  let pressMid = 0;
  const notes: TacticalNote[] = [];

  const midDiff = a.centralMids - b.centralMids;
  if (midDiff !== 0) {
    mid += 0.06 * midDiff;
    notes.push(
      midDiff > 0
        ? { text: `Our midfield ${a.centralMids} should outnumber their ${b.centralMids} in the middle.`, effect: 0.06 * midDiff }
        : { text: `We'll be outnumbered in central midfield, ${a.centralMids} against ${b.centralMids}.`, effect: 0.06 * midDiff },
    );
  }

  if (a.strikers >= 2 && b.centreBacks === 2) {
    att += 0.06;
    notes.push({ text: 'Two strikers can go one-on-one with their two centre-backs.', effect: 0.06 });
  } else if (a.strikers === 1 && b.centreBacks === 3) {
    att -= 0.07;
    notes.push({ text: 'A lone striker will be crowded out by their back three.', effect: -0.07 });
  } else if (a.strikers === 2 && b.centreBacks === 3) {
    att -= 0.03;
    notes.push({ text: 'Their three centre-backs can handle our front two.', effect: -0.03 });
  }

  if (a.wide && b.centreBacks === 3 && them.formation === '3-5-2') {
    att += 0.06;
    notes.push({ text: 'Our wide players can get in behind their wing-backs.', effect: 0.06 });
  }
  if (a.wide && !b.wide) {
    mid += 0.05;
    notes.push({ text: "They're narrow, so we should control the flanks.", effect: 0.05 });
  } else if (!a.wide && b.wide) {
    def -= 0.05;
    notes.push({ text: 'Their width could stretch our narrow shape.', effect: -0.05 });
  }

  applyPressing(us.pressing, them.mentality, ctx, notes, (d, m, at, pm) => {
    def += d;
    mid += m;
    att += at;
    pressMid += pm;
  });

  return { def: clampMod(def), mid: clampMod(mid), att: clampMod(att), pressMid, notes };
}

function applyPressing(
  pressing: Pressing,
  theirMentality: Mentality,
  ctx: MatchupContext,
  notes: TacticalNote[],
  add: (def: number, mid: number, att: number, pressMid: number) => void,
) {
  if (pressing === 'high') {
    add(0, 0, 0, 0.09);
    notes.push({ text: 'A high press should win the ball early, but legs will tire after the hour.', effect: 0.06 });
    if (ctx.theirAttPace > ctx.ourDefPace + 3) {
      add(-0.08, 0, 0, 0);
      notes.push({ text: 'Their quick forwards could punish a high line.', effect: -0.08 });
    }
  } else if (pressing === 'low') {
    add(0.08, -0.06, 0, 0);
    notes.push({ text: 'Sitting deep keeps us compact, but we will see less of the ball.', effect: 0.02 });
    if (theirMentality === 'attacking') {
      add(0, 0, 0.08, 0);
      notes.push({ text: "They'll come at us, leaving space to hit them on the counter.", effect: 0.08 });
    }
  }
}

/** Approximate net effect of a set of notes, for display. */
export function netEdge(mods: TacticalMods): number {
  return (mods.def - 1) + (mods.mid - 1 + mods.pressMid * 0.6) + (mods.att - 1);
}
