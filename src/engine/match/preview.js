import { positionFit, positionsOf } from '../players/ratings';
import { Rng } from '../rng';
import { ENGINE, chanceRatio, createLiveMatch, refreshZones } from './engine';
import { FORMATIONS, pickTeam } from './selection';
import { netEdge } from './tactics';
function sideXg(m, us) {
    const a = m[us];
    const b = m[us === 'home' ? 'away' : 'home'];
    const pUs = Math.pow(a.zones.mid, ENGINE.possessionExp) /
        (Math.pow(a.zones.mid, ENGINE.possessionExp) + Math.pow(b.zones.mid, ENGINE.possessionExp));
    const ratio = chanceRatio(a, b);
    return 90 * pUs * ENGINE.baseChance * Math.pow(ratio, ENGINE.chanceExp) * ENGINE.baseGoal * Math.pow(ratio, ENGINE.goalExp);
}
export function squadFit(sheet) {
    const { xi, slots } = sheet.selection;
    if (!xi.length)
        return 0;
    return xi.reduce((s, p, i) => s + positionFit(positionsOf(p), slots[i]), 0) / 11;
}
function strength(sheet) {
    const { xi } = sheet.selection;
    return xi.length ? Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length) : 0;
}
/** Analyse a fixture from `us`'s point of view, without consuming game randomness. */
export function previewMatch(home, away, us, neutral = false) {
    const m = createLiveMatch(new Rng(0), home, away, { capacity: 0, crowdFill: 0, neutral });
    // High-press bonuses fade after the hour, so weight the early and late phases.
    const early = { h: sideXg(m, 'home'), a: sideXg(m, 'away') };
    m.minute = 61;
    refreshZones(m);
    const late = { h: sideXg(m, 'home'), a: sideXg(m, 'away') };
    const ours = m[us];
    return {
        xgHome: (early.h * 2 + late.h) / 3,
        xgAway: (early.a * 2 + late.a) / 3,
        notes: ours.mods.notes,
        edge: netEdge(ours.mods),
        squadFit: squadFit(us === 'home' ? home : away),
        strengthHome: strength(home),
        strengthAway: strength(away),
    };
}
const MENTALITIES = ['defensive', 'balanced', 'attacking'];
const PRESSING = ['low', 'medium', 'high'];
/** The assistant manager's pick: the tactics with the best expected goal difference. */
export function recommendTactics(squad, opponent, us, neutral = false, 
/** How we'd line up in a given formation; defaults to the best XI. */
selectFor = (f) => pickTeam(squad, f)) {
    let best = null;
    for (const formation of Object.keys(FORMATIONS)) {
        const selection = selectFor(formation);
        for (const mentality of MENTALITIES) {
            for (const pressing of PRESSING) {
                const ours = { selection, tactics: { formation, mentality, pressing } };
                const p = us === 'home' ? previewMatch(ours, opponent, 'home', neutral) : previewMatch(opponent, ours, 'away', neutral);
                const xgDiff = us === 'home' ? p.xgHome - p.xgAway : p.xgAway - p.xgHome;
                if (!best || xgDiff > best.xgDiff + 1e-9)
                    best = { tactics: ours.tactics, xgDiff };
            }
        }
    }
    return best;
}
