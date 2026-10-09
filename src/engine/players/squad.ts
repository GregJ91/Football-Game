import { FORMATIONS, isAvailable, type Lineup, type Selection } from '../match/selection';
import { grievanceFactor } from '../club/staff';
import { addInbox } from '../transfers/market';
import type { Club, Formation, GameState, Player, SquadRole } from '../types';
import { squadOf } from '../world';
import { playerName } from './generate';
import { attr100, canPlay, effectiveRating } from './ratings';

// ---------------------------------------------------------------- fitness

/** Fitness a player gets back each day, from 3 to 5 depending on stamina. */
export function dailyRecovery(p: Player): number {
  return 3 + attr100(p, 'stamina') / 50;
}

/**
 * Players recover a little every day. Bring everyone's fitness up to date
 * with `day` (week * 7 + day of the week). One game a week leaves time to
 * recover fully; two a week slowly wears a side down unless it rotates.
 */
export function recoverTo(game: GameState, day: number) {
  if (game.recoveredTo === undefined) {
    game.recoveredTo = day;
    return;
  }
  const days = day - game.recoveredTo;
  if (days <= 0) return;
  for (const id in game.players) {
    const p = game.players[id];
    if (p.fitness < 100) p.fitness = Math.min(100, p.fitness + days * dailyRecovery(p));
  }
  game.recoveredTo = day;
}

/** Below this, a player is tired enough to be worth resting. */
export const TIRED = 75;

/**
 * Rest tired starters: a fresh player who plays the position and would do
 * about as well today comes in. Returns the new lineup and who was swapped.
 */
export function restTired(squad: Player[], formation: Formation, lineup: Lineup): { lineup: Lineup; swaps: { slotIndex: number; outId: string; inId: string }[] } {
  const slots = FORMATIONS[formation];
  const out = [...lineup];
  const inXi = new Set(out.filter((id): id is string => !!id));
  const swaps: { slotIndex: number; outId: string; inId: string }[] = [];
  const byId = new Map(squad.map((p) => [p.id, p]));
  slots.forEach((slot, i) => {
    const p = out[i] ? byId.get(out[i]!) : undefined;
    if (!p || !isAvailable(p) || p.fitness >= TIRED) return;
    const fresh = squad
      .filter((c) => !inXi.has(c.id) && isAvailable(c) && c.fitness >= 85 && canPlay(c, slot))
      .sort((a, b) => effectiveRating(b, slot) - effectiveRating(a, slot))[0];
    if (!fresh || effectiveRating(fresh, slot) < effectiveRating(p, slot) - 1) return;
    out[i] = fresh.id;
    inXi.delete(p.id);
    inXi.add(fresh.id);
    swaps.push({ slotIndex: i, outId: p.id, inId: fresh.id });
  });
  return { lineup: out, swaps };
}

// ---------------------------------------------------------------- bench

export const BENCH_SIZE = 7;

/** Put the manager's chosen substitutes on the bench, topping up with the best of the rest. */
export function withBench(selection: Selection, squad: Player[], benchIds: string[] | undefined): Selection {
  if (!benchIds?.length) return selection;
  const inXi = new Set(selection.xi.map((p) => p.id));
  const byId = new Map(squad.map((p) => [p.id, p]));
  const chosen = benchIds
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p && isAvailable(p) && !inXi.has(p.id))
    .slice(0, BENCH_SIZE);
  const taken = new Set([...inXi, ...chosen.map((p) => p.id)]);
  const rest = squad.filter((p) => !taken.has(p.id) && isAvailable(p)).sort((a, b) => b.overall - a.overall);
  return { ...selection, bench: [...chosen, ...rest].slice(0, BENCH_SIZE) };
}

/** Put a player on the bench at a position in the order, swapping if he's already there. */
export function assignToBench(bench: string[], index: number, playerId: string): string[] {
  const out = [...bench];
  const from = out.indexOf(playerId);
  if (from >= 0) out[from] = out[index];
  out[index] = playerId;
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- roles and happiness

export const ROLE_LABEL: Record<SquadRole, string> = {
  key: 'Key player',
  first: 'First team',
  rotation: 'Rotation',
  backup: 'Backup',
  prospect: 'Prospect',
};

/** Share of the club's games each role expects to play in. */
export const ROLE_SHARE: Record<SquadRole, number> = { key: 0.75, first: 0.55, rotation: 0.3, backup: 0.1, prospect: 0.05 };

export const ROLES: SquadRole[] = ['key', 'first', 'rotation', 'backup', 'prospect'];

function roleForRank(rank: number, age: number): SquadRole {
  if (rank < 5) return 'key';
  if (rank < 11) return 'first';
  if (rank < 16) return 'rotation';
  return age <= 20 ? 'prospect' : 'backup';
}

/** Give every player in the squad a role by how good he is, keeping roles the manager set. */
export function assignRoles(game: GameState, club: Club) {
  const ranked = squadOf(game, club.id).sort((a, b) => b.overall - a.overall);
  ranked.forEach((p, i) => {
    if (!p.roleSetByUser) p.role = roleForRank(i, p.age);
  });
}

/** A new arrival's role: where he ranks in his new squad. */
export function roleOnArrival(game: GameState, club: Club, p: Player) {
  const rank = squadOf(game, club.id).filter((x) => x.id !== p.id && x.overall > p.overall).length;
  p.role = roleForRank(rank, p.age);
  p.roleSetByUser = false;
  p.unhappy = 0;
  p.transferRequest = false;
}

export function roleOf(p: Player): SquadRole {
  return p.role ?? 'rotation';
}

/** The manager changes a player's role: he's pleased to be promoted, and hurt to be dropped. */
export function setRole(p: Player, role: SquadRole) {
  const before = ROLES.indexOf(roleOf(p));
  const after = ROLES.indexOf(role);
  if (after < before) {
    p.morale = Math.min(100, p.morale + 6);
    p.unhappy = 0;
  } else if (after > before) p.morale = Math.max(0, p.morale - (before === 0 ? 12 : 7));
  p.role = role;
  p.roleSetByUser = true;
}

export type Mood = 'happy' | 'content' | 'unhappy';

export function moodOf(p: Player): Mood {
  if (p.transferRequest || p.morale < 45) return 'unhappy';
  return p.morale >= 70 ? 'happy' : 'content';
}

/** How the player feels about his football, in a sentence. */
export function happinessText(game: GameState, p: Player): string {
  const games = game.clubs[p.clubId ?? '']?.seasonGames ?? 0;
  const apps = p.seasonStats.apps;
  if (p.transferRequest) return `Has asked to leave: ${apps} of ${games} games this season.`;
  if (p.unhappy) return `Wants more football: ${apps} of ${games} games as a ${ROLE_LABEL[roleOf(p)].toLowerCase()}.`;
  const mood = moodOf(p);
  return mood === 'happy' ? 'Happy at the club.' : mood === 'content' ? 'Settled.' : 'Not happy at the moment.';
}

/**
 * Every few weeks the user's players weigh their football against their role.
 * Those short of it lose morale and say so; keep it up and they ask to leave.
 * Those getting their games are happier.
 */
export function playingTimeCheck(game: GameState) {
  const club = game.clubs[game.userClubId];
  const games = club.seasonGames ?? 0;
  if (games < 6) return;
  const complaints: string[] = [];
  for (const p of squadOf(game, club.id)) {
    // Injured players know why they aren't playing.
    if (p.injuryWeeks > 1) continue;
    const role = roleOf(p);
    const share = p.seasonStats.apps / games;
    if (share + 0.2 < ROLE_SHARE[role]) {
      p.unhappy = (p.unhappy ?? 0) + 1;
      p.morale = Math.max(0, p.morale - (6 + (p.ambition >= 15 ? 3 : 0)) * grievanceFactor(club));
      if (p.unhappy === 1) complaints.push(`${playerName(p)} (${ROLE_LABEL[role].toLowerCase()}, ${p.seasonStats.apps} of ${games})`);
      if (p.unhappy >= 3 && !p.transferRequest) {
        p.transferRequest = true;
        addInbox(game, 'info', `${playerName(p)} has handed in a transfer request. He's played ${p.seasonStats.apps} of our ${games} games and wants to play somewhere he'll be first choice. Pick him, change his role, or sell him.`, {
          category: 'club',
          subject: `${p.lastName} wants to leave`,
        });
      }
    } else {
      if (p.unhappy) {
        p.unhappy = Math.max(0, p.unhappy - 1);
        if (!p.unhappy && p.transferRequest) {
          p.transferRequest = false;
          addInbox(game, 'info', `${playerName(p)} is getting his games now and has withdrawn his transfer request.`, { category: 'club', subject: `${p.lastName} happy again` });
        }
      }
      p.morale = Math.min(100, p.morale + 2);
    }
  }
  if (complaints.length) {
    addInbox(game, 'info', `Some of the squad want more football: ${complaints.join(', ')}. Give them games, or change their role in their player profile.`, {
      category: 'club',
      subject: 'Unhappy with playing time',
    });
  }
}
