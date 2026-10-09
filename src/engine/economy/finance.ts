import type { Budgets, Club, CountryId, GameState, Ledger } from '../types';
import { divisionOf, squadOf } from '../world';

/** Typical ticket price by level (£). */
const TICKET: Record<CountryId, number[]> = {
  eng: [0, 45, 30, 24, 20, 16, 12, 8],
  sco: [0, 28, 16, 12, 10, 7],
};

/** Weekly TV, prize-pool share and sponsorship by level (£). */
const TV: Record<CountryId, number[]> = {
  eng: [0, 1_400_000, 220_000, 60_000, 30_000, 8_000, 3_000, 1_200],
  sco: [0, 120_000, 20_000, 5_000, 2_500, 900],
};

export function emptyLedger(): Ledger {
  return { gate: 0, tv: 0, transfersIn: 0, transfersOut: 0, wages: 0, other: 0 };
}

export function ledgerOf(club: Club): Ledger {
  club.ledger ??= emptyLedger();
  return club.ledger;
}

export function ticketPrice(game: GameState, club: Club): number {
  const level = divisionOf(game, club.id).def.level;
  return TICKET[game.country][level] ?? 6;
}

export function weeklyTv(game: GameState, club: Club): number {
  const level = divisionOf(game, club.id).def.level;
  return TV[game.country][level] ?? 800;
}

export function wageBill(game: GameState, club: Club): number {
  return squadOf(game, club.id).reduce((s, p) => s + p.wage, 0);
}

/** Rough weekly income: TV every week, a home gate every other week. */
export function weeklyIncomeEstimate(game: GameState, club: Club): number {
  const fill = Math.min(1, 0.3 + club.reputation / 120);
  return weeklyTv(game, club) + (club.capacity * fill * ticketPrice(game, club)) / 2;
}

export function addGate(game: GameState, club: Club, attendance: number) {
  const gate = Math.round(attendance * ticketPrice(game, club));
  club.balance += gate;
  ledgerOf(club).gate += gate;
}

/** Pay wages and collect TV money for every club, once per week. */
export function weeklyFinances(game: GameState) {
  for (const club of Object.values(game.clubs)) {
    const tv = weeklyTv(game, club);
    const wages = wageBill(game, club);
    club.balance += tv - wages;
    const l = ledgerOf(club);
    l.tv += tv;
    l.wages += wages;
  }
}

export function resetLedgers(game: GameState) {
  for (const club of Object.values(game.clubs)) club.ledger = emptyLedger();
}

// ---------------------------------------------------------------- board budgets

/** £ of transfer budget per £1 p/w of wage budget when moving money between them. */
export const WAGE_TO_TRANSFER = 30;
/** Share of a sale fee the board adds back to the transfer budget. */
export const SALE_REINVEST = 0.75;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The board sets the season's budgets from income and the bank balance. */
export function setBoardBudgets(game: GameState, club: Club): Budgets {
  const bill = wageBill(game, club);
  const income = weeklyIncomeEstimate(game, club);
  const step = income > 100_000 ? 1000 : income > 10_000 ? 100 : 10;
  const wage = roundTo(Math.max(bill * 1.15, income * 0.75), step);
  const transfer = roundTo(Math.max(0, club.balance * 0.6), step * 10);
  club.budgets = { transfer, wage };
  return club.budgets;
}

export function budgetsOf(game: GameState, club: Club): Budgets {
  return club.budgets ?? setBoardBudgets(game, club);
}

/** Move money between budgets: positive = more wage budget, less transfer budget. */
export function adjustBudgets(game: GameState, club: Club, wageDelta: number): Budgets {
  const b = budgetsOf(game, club);
  const minWage = wageBill(game, club);
  const maxWage = b.wage + b.transfer / WAGE_TO_TRANSFER;
  const wage = Math.max(minWage, Math.min(maxWage, b.wage + wageDelta));
  const transfer = Math.max(0, b.transfer - (wage - b.wage) * WAGE_TO_TRANSFER);
  club.budgets = { wage: Math.round(wage), transfer: Math.round(transfer) };
  return club.budgets;
}

/** Why a new or changed wage would break the wage budget, or null if it fits. */
export function wageBudgetProblem(game: GameState, club: Club, newWage: number, replacingWage = 0): string | null {
  const b = budgetsOf(game, club);
  const after = wageBill(game, club) - replacingWage + newWage;
  if (after <= b.wage) return null;
  return `That would take wages to ${moneyPw(after)}, over your budget of ${moneyPw(b.wage)}.`;
}

export function moneyPw(n: number): string {
  const s = n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : n >= 10_000 ? `£${Math.round(n / 1000)}k` : n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${Math.round(n)}`;
  return `${s} p/w`;
}
