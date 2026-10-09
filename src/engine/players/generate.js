import { FIRST_NAMES, LAST_NAMES } from '../../data/names';
import { ATTRIBUTE_KEYS } from '../types';
import { POSITION_WEIGHTS, computeOverall, playerValue, playerWage } from './ratings';
/** A balanced 22-man squad. */
export const SQUAD_TEMPLATE = [
    'GK', 'GK',
    'DR', 'DR', 'DC', 'DC', 'DC', 'DC', 'DL', 'DL',
    'DMC', 'DMC', 'MC', 'MC', 'MC', 'MR', 'ML',
    'AMC', 'AMC', 'ST', 'ST', 'ST',
];
const clamp = (n, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));
const clamp20 = (n) => Math.max(1, Math.min(20, Math.round(n)));
const GK_SKILLS = ['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'];
/** CM-style 1–20 attributes centred on a 1–100 quality target for the position. */
export function generateAttributes(rng, position, target, alsoPlays = []) {
    const weights = POSITION_WEIGHTS[position];
    const t = target / 5;
    const attrs = {};
    for (const key of ATTRIBUTE_KEYS) {
        const isKey = weights[key] !== undefined;
        if (isKey)
            attrs[key] = clamp20(t + rng.normal() * 1.1);
        else if (GK_SKILLS.includes(key))
            attrs[key] = clamp20(position === 'GK' ? t - 2 + rng.normal() * 1.5 : 2 + rng.normal());
        else
            attrs[key] = clamp20(t - 2.4 + rng.normal() * 1.7);
    }
    // He's listed at his other positions because he can do the job there.
    for (const other of alsoPlays) {
        for (const key in POSITION_WEIGHTS[other]) {
            const k = key;
            attrs[k] = Math.max(attrs[k], clamp20(t - 0.8 + rng.normal() * 0.8));
        }
    }
    return attrs;
}
/** Other positions a player can also play, CM style (e.g. DC/DMC, AMC/ST). */
const ALSO_PLAYS = {
    GK: [],
    DR: [['DL', 0.3], ['MR', 0.15], ['DC', 0.1]],
    DL: [['DR', 0.3], ['ML', 0.15], ['DC', 0.1]],
    DC: [['DMC', 0.25], ['DR', 0.08], ['DL', 0.08]],
    DMC: [['MC', 0.45], ['DC', 0.25]],
    MC: [['DMC', 0.35], ['AMC', 0.3]],
    MR: [['ML', 0.35], ['AMC', 0.15], ['DR', 0.12]],
    ML: [['MR', 0.35], ['AMC', 0.15], ['DL', 0.12]],
    AMC: [['MC', 0.4], ['ST', 0.3], ['MR', 0.1], ['ML', 0.1]],
    ST: [['AMC', 0.3]],
};
export function generatePositions(rng, primary) {
    const out = [primary];
    for (const [pos, chance] of ALSO_PLAYS[primary])
        if (rng.chance(chance))
            out.push(pos);
    return out;
}
export function generatePlayer(rng, opts) {
    const age = opts.age ?? clamp(rng.int(17, 34) + rng.normal() * 2, 16, 37);
    const positions = generatePositions(rng, opts.position);
    const attributes = generateAttributes(rng, opts.position, opts.quality, positions.slice(1));
    const overall = computeOverall({ attributes, position: opts.position });
    const headroom = age <= 19 ? rng.int(5, 25) : age <= 22 ? rng.int(2, 15) : age <= 26 ? rng.int(0, 7) : rng.int(0, 2);
    const potential = clamp(overall + headroom);
    return {
        id: opts.id,
        firstName: rng.pick(FIRST_NAMES),
        lastName: rng.pick(LAST_NAMES),
        age,
        position: opts.position,
        positions,
        attributes,
        overall,
        potential,
        clubId: opts.clubId,
        wage: playerWage(overall),
        value: playerValue(overall, age, potential),
        contractEnd: opts.season + rng.int(1, 4),
        morale: 70,
        fitness: 100,
        form: 6.5,
        injuryWeeks: 0,
        suspendedMatches: 0,
        ambition: rng.int(1, 20),
        loyalty: rng.int(1, 20),
        seasonStats: { apps: 0, goals: 0, assists: 0, ratingSum: 0 },
    };
}
export function playerName(p) {
    return `${p.firstName} ${p.lastName}`;
}
export function shortName(p) {
    return `${p.firstName[0]}. ${p.lastName}`;
}
