import { positionFit, positionsOf } from '../players/ratings';
import { Rng } from '../rng';
import type { Formation, Mentality, Player, Pressing, Tactics } from '../types';
import { ENGINE, chanceRatio, createLiveMatch, refreshZones, type LiveMatch, type SideName, type TeamSheet } from './engine';
import { FORMATIONS, pickTeam, type Selection } from './selection';
import { netEdge, type TacticalNote } from './tactics';

export interface MatchupPreview {
  /** Expected goals for each side from current strengths and tactics. */
  xgHome: number;
  xgAway: number;
  notes: TacticalNote[];
  edge: number;
  /** 0–1: how well our players suit the formation's slots. */
  squadFit: number;
  strengthHome: number;
  strengthAway: number;
}

function sideXg(m: LiveMatch, us: SideName): number {
  const a = m[us];
  const b = m[us === 'home' ? 'away' : 'home'];
  const pUs = Math.pow(a.zones.mid, ENGINE.possessionExp) /
    (Math.pow(a.zones.mid, ENGINE.possessionExp) + Math.pow(b.zones.mid, ENGINE.possessionExp));
  const ratio = chanceRatio(a, b);
  return 90 * pUs * ENGINE.baseChance * Math.pow(ratio, ENGINE.chanceExp) * ENGINE.baseGoal * Math.pow(ratio, ENGINE.goalExp);
}

export function squadFit(sheet: TeamSheet): number {
  const { xi, slots } = sheet.selection;
  if (!xi.length) return 0;
  return xi.reduce((s, p, i) => s + positionFit(positionsOf(p), slots[i]), 0) / 11;
}

function strength(sheet: TeamSheet): number {
  const { xi } = sheet.selection;
  return xi.length ? Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length) : 0;
}

/** Analyse a fixture from `us`'s point of view, without consuming game randomness. */
export function previewMatch(home: TeamSheet, away: TeamSheet, us: SideName, neutral = false): MatchupPreview {
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

const MENTALITIES: Mentality[] = ['defensive', 'balanced', 'attacking'];
const PRESSING: Pressing[] = ['low', 'medium', 'high'];

/** The assistant manager's pick: the tactics with the best expected goal difference. */
export function recommendTactics(
  squad: Player[],
  opponent: TeamSheet,
  us: SideName,
  neutral = false,
  /** How we'd line up in a given formation; defaults to the best XI. */
  selectFor: (formation: Formation) => Selection = (f) => pickTeam(squad, f),
): { tactics: Tactics; xgDiff: number } {
  let best: { tactics: Tactics; xgDiff: number } | null = null;
  for (const formation of Object.keys(FORMATIONS) as Formation[]) {
    const selection = selectFor(formation);
    for (const mentality of MENTALITIES) {
      for (const pressing of PRESSING) {
        const ours: TeamSheet = { selection, tactics: { formation, mentality, pressing } };
        const p = us === 'home' ? previewMatch(ours, opponent, 'home', neutral) : previewMatch(opponent, ours, 'away', neutral);
        const xgDiff = us === 'home' ? p.xgHome - p.xgAway : p.xgAway - p.xgHome;
        if (!best || xgDiff > best.xgDiff + 1e-9) best = { tactics: ours.tactics, xgDiff };
      }
    }
  }
  return best!;
}
