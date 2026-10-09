import { canPlay, effectiveRating } from '../players/ratings';
export const FORMATIONS = {
    '4-4-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'],
    '4-3-3': ['GK', 'DR', 'DC', 'DC', 'DL', 'DMC', 'MC', 'MC', 'MR', 'ML', 'ST'],
    '4-2-3-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DMC', 'DMC', 'MR', 'AMC', 'ML', 'ST'],
    '3-5-2': ['GK', 'DC', 'DC', 'DC', 'MR', 'DMC', 'MC', 'MC', 'ML', 'ST', 'ST'],
    '5-3-2': ['GK', 'DR', 'DC', 'DC', 'DC', 'DL', 'DMC', 'MC', 'MC', 'ST', 'ST'],
};
export function isAvailable(p) {
    return p.injuryWeeks === 0 && p.suspendedMatches === 0;
}
/** Fill the scarcest slots first so a lone GK isn't wasted elsewhere. */
const FILL_ORDER = ['GK', 'ST', 'DC', 'DR', 'DL', 'AMC', 'DMC', 'MR', 'ML', 'MC'];
export function pickTeam(squad, formation, benchSize = 7) {
    const slots = FORMATIONS[formation];
    const pool = squad.filter(isAvailable);
    const chosen = new Array(slots.length);
    const used = new Set();
    // First, only players who can play the position: best pairings first.
    const pairs = [];
    slots.forEach((s, i) => {
        for (const p of pool)
            if (canPlay(p, s))
                pairs.push({ i, p, score: effectiveRating(p, s) });
    });
    pairs.sort((a, b) => b.score - a.score);
    for (const { i, p } of pairs) {
        if (chosen[i] || used.has(p.id))
            continue;
        chosen[i] = p;
        used.add(p.id);
    }
    // Any gaps: nobody who plays there is available, so the best stand-in.
    const slotIdx = slots.map((s, i) => ({ s, i }));
    slotIdx.sort((a, b) => FILL_ORDER.indexOf(a.s) - FILL_ORDER.indexOf(b.s));
    for (const { s, i } of slotIdx) {
        if (chosen[i])
            continue;
        let best;
        let bestScore = -1;
        for (const p of pool) {
            if (used.has(p.id))
                continue;
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
        if (chosen[i])
            continue;
        const fallback = squad.find((p) => !used.has(p.id) && p.suspendedMatches === 0);
        if (fallback) {
            chosen[i] = fallback;
            used.add(fallback.id);
        }
    }
    const xi = [];
    const xiSlots = [];
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
/** Turn a saved lineup into a match selection, covering unavailable picks. */
export function selectionFromLineup(squad, formation, lineup, benchSize = 7) {
    const slots = FORMATIONS[formation];
    const byId = new Map(squad.map((p) => [p.id, p]));
    const used = new Set();
    const chosen = new Array(slots.length);
    const covers = [];
    const gaps = [];
    slots.forEach((slot, i) => {
        const id = lineup[i];
        const p = id ? byId.get(id) : undefined;
        if (p && isAvailable(p) && !used.has(p.id)) {
            chosen[i] = p;
            used.add(p.id);
            return;
        }
        gaps.push(i);
        if (id)
            covers.push({ slotIndex: i, slot, outId: id, inId: null, reason: !p ? 'left' : p.injuryWeeks > 0 ? 'injured' : 'suspended' });
    });
    for (const i of gaps) {
        let best;
        for (const p of squad) {
            if (used.has(p.id) || !isAvailable(p))
                continue;
            if (!best || effectiveRating(p, slots[i]) > effectiveRating(best, slots[i]))
                best = p;
        }
        if (best) {
            chosen[i] = best;
            used.add(best.id);
            const cover = covers.find((c) => c.slotIndex === i);
            if (cover)
                cover.inId = best.id;
        }
    }
    const xi = [];
    const xiSlots = [];
    chosen.forEach((p, i) => {
        if (p) {
            xi.push(p);
            xiSlots.push(slots[i]);
        }
    });
    const rest = squad.filter((p) => !used.has(p.id) && isAvailable(p)).sort((a, b) => b.overall - a.overall);
    const subGk = rest.find((p) => p.position === 'GK');
    const outfield = rest.filter((p) => p !== subGk).slice(0, subGk ? benchSize - 1 : benchSize);
    return { selection: { xi, slots: xiSlots, bench: subGk ? [subGk, ...outfield] : outfield }, covers };
}
/** The auto-picked best XI as a lineup. */
export function autoLineup(squad, formation) {
    const sel = pickTeam(squad, formation, 0);
    return FORMATIONS[formation].map((_, i) => sel.xi[i]?.id ?? null);
}
/**
 * Keep the same chosen players when the formation changes, re-slotting them
 * to suit the new shape; any spare slots are left for the best available.
 */
export function remapLineup(squad, lineup, formation) {
    const ids = new Set(lineup.filter((id) => !!id));
    const picked = squad.filter((p) => ids.has(p.id));
    const slots = FORMATIONS[formation];
    const out = slots.map(() => null);
    const taken = new Set();
    // Natural positions first, then the best fit for what is left.
    const order = slots.map((s, i) => ({ s, i })).sort((a, b) => FILL_ORDER.indexOf(a.s) - FILL_ORDER.indexOf(b.s));
    for (const { s, i } of order) {
        const natural = picked
            .filter((p) => !taken.has(p.id) && canPlay(p, s))
            .sort((a, b) => effectiveRating(b, s) - effectiveRating(a, s))[0];
        if (natural) {
            out[i] = natural.id;
            taken.add(natural.id);
        }
    }
    for (const { s, i } of order) {
        if (out[i])
            continue;
        let best;
        for (const p of picked) {
            if (taken.has(p.id))
                continue;
            if (!best || effectiveRating(p, s) > effectiveRating(best, s))
                best = p;
        }
        if (best) {
            out[i] = best.id;
            taken.add(best.id);
        }
    }
    return out;
}
/** Put a player into a slot, swapping with wherever they were. */
export function assignToSlot(lineup, slotIndex, playerId) {
    const out = [...lineup];
    const from = out.indexOf(playerId);
    if (from >= 0)
        out[from] = out[slotIndex];
    out[slotIndex] = playerId;
    return out;
}
