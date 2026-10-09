import { budgetsOf, wageBill } from '../economy/finance';
import { playerName } from '../players/generate';
import { roleOnArrival } from '../players/squad';
import type { GameState, Player } from '../types';
import { squadOf } from '../world';
import { challengeSigningRule } from '../club/challenge';
import { SQUAD_MAX, addInbox, interestIn, transferWindow } from './market';

/** Most players a club can have in on loan at once. */
export const MAX_LOANS = 4;

export function loansIn(game: GameState): Player[] {
  return squadOf(game, game.userClubId).filter((p) => p.loanFrom);
}

/**
 * Why the user can't take this player on loan, or null if they can. Clubs
 * lend players who aren't in their first team (or youngsters who need
 * games); you pay his wages for the rest of the season.
 */
export function cannotLoan(game: GameState, p: Player): string | null {
  const club = game.clubs[game.userClubId];
  if (!p.clubId) return 'Free agents sign permanently, not on loan.';
  if (p.clubId === club.id) return 'Already at your club.';
  if (p.loanFrom) return "He's already out on loan.";
  if (!transferWindow(game).open) return 'Loans can only be agreed while the transfer window is open.';
  if (club.playerIds.length >= SQUAD_MAX) return `Your squad is full (${SQUAD_MAX}).`;
  if (loansIn(game).length >= MAX_LOANS) return `You can only have ${MAX_LOANS} players in on loan at once.`;
  const rule = challengeSigningRule(game, p);
  if (rule) return rule;
  const parent = game.clubs[p.clubId];
  const rank = squadOf(game, parent.id).filter((x) => x.overall > p.overall).length;
  if (rank < 13 && p.age > 21) return `${parent.name} won't lend him: he's in their first team.`;
  if (interestIn(game, club, p) === 'no') return "He won't drop that far down, even on loan.";
  const budgets = budgetsOf(game, club);
  if (wageBill(game, club) + p.wage > budgets.wage) return 'His wages would take you over your wage budget.';
  return null;
}

/** Bring a player in on loan until the end of the season. */
export function loanIn(game: GameState, p: Player): string | null {
  const problem = cannotLoan(game, p);
  if (problem) return problem;
  const parent = game.clubs[p.clubId!];
  const club = game.clubs[game.userClubId];
  parent.playerIds = parent.playerIds.filter((id) => id !== p.id);
  if (parent.lineup) parent.lineup = parent.lineup.map((id) => (id === p.id ? null : id));
  club.playerIds.push(p.id);
  p.clubId = club.id;
  p.loanFrom = parent.id;
  p.listed = false;
  roleOnArrival(game, club, p);
  addInbox(game, 'info', `${playerName(p)} joins on loan from ${parent.name} until the end of the season. We pay his wages.`, {
    category: 'transfers',
    subject: `${p.lastName} in on loan`,
  });
  return null;
}

/** Send a loan player back to his club. */
export function endLoan(game: GameState, p: Player) {
  if (!p.loanFrom || !p.clubId) return;
  const club = game.clubs[p.clubId];
  const parent = game.clubs[p.loanFrom];
  club.playerIds = club.playerIds.filter((id) => id !== p.id);
  if (club.lineup) club.lineup = club.lineup.map((id) => (id === p.id ? null : id));
  if (club.bench) club.bench = club.bench.filter((id) => id !== p.id);
  parent.playerIds.push(p.id);
  p.clubId = parent.id;
  p.loanFrom = undefined;
  p.role = undefined;
}

/** End of the season: every loan ends and the players go home. */
export function returnLoans(game: GameState) {
  const back: string[] = [];
  for (const p of Object.values(game.players)) {
    if (!p.loanFrom) continue;
    if (p.clubId === game.userClubId) back.push(playerName(p));
    endLoan(game, p);
  }
  if (back.length) addInbox(game, 'info', `Loans over: ${back.join(', ')} ${back.length === 1 ? 'has' : 'have'} gone back to ${back.length === 1 ? 'his club' : 'their clubs'}.`, { category: 'transfers', subject: 'Loans ended' });
}
