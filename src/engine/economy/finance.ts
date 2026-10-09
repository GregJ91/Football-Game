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

/** The typical price at the club's level. */
export function guideTicketPrice(game: GameState, club: Club): number {
  const level = divisionOf(game, club.id).def.level;
  return TICKET[game.country][level] ?? 6;
}

export function ticketPrice(game: GameState, club: Club): number {
  return club.ticketPrice ?? guideTicketPrice(game, club);
}

/**
 * How full the ground tends to be (0–1). Bigger clubs draw more; for the
 * user's club the ticket price, fan mood and roofs matter too.
 */
export function crowdFill(game: GameState, club: Club): number {
  let fill = 0.3 + club.reputation / 120;
  if (club.isUser) {
    const priceFactor = Math.max(0.4, Math.min(1.3, Math.pow(guideTicketPrice(game, club) / ticketPrice(game, club), 0.9)));
    const fans = club.board?.fans ?? 60;
    const s = club.stadium;
    const cap = s ? s.stands.reduce((n, x) => n + x.capacity, 0) : 0;
    const roofed = s && cap ? s.stands.reduce((n, x) => n + (x.roof ? x.capacity : 0), 0) / cap : 0.5;
    fill *= priceFactor * (0.85 + (fans / 100) * 0.3) * (0.95 + roofed * 0.08);
  }
  return Math.max(0.05, Math.min(1, fill));
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
  return weeklyTv(game, club) + (club.capacity * crowdFill(game, club) * ticketPrice(game, club)) / 2;
}

export function addGate(game: GameState, club: Club, attendance: number) {
  // Seats sell for a quarter more than terracing.
  const s = club.stadium;
  const cap = s ? s.stands.reduce((n, x) => n + x.capacity, 0) : 0;
  const seatedShare = s && cap ? s.stands.reduce((n, x) => n + x.seats, 0) / cap : 0;
  const gate = Math.round(attendance * ticketPrice(game, club) * (1 + 0.25 * seatedShare));
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
/** Topped up to this while unlimited money is on. */
export const UNLIMITED_BANK = 1_000_000_000;

/** Testing aid: keep the user's bank and budgets full while unlimited money is on. */
export function topUpUnlimited(game: GameState) {
  if (!game.settings?.unlimitedMoney) return;
  const club = game.clubs[game.userClubId];
  club.balance = Math.max(club.balance, UNLIMITED_BANK);
  club.budgets = { transfer: UNLIMITED_BANK, wage: UNLIMITED_BANK / 10 };
}

export function setUnlimitedMoney(game: GameState, on: boolean) {
  const club = game.clubs[game.userClubId];
  const settings = { assistantTactics: false, ...game.settings };
  if (on && !settings.unlimitedMoney) settings.balanceBeforeUnlimited = club.balance;
  if (!on && settings.unlimitedMoney) {
    club.balance = settings.balanceBeforeUnlimited ?? 0;
    settings.balanceBeforeUnlimited = undefined;
  }
  settings.unlimitedMoney = on;
  game.settings = settings;
  if (on) topUpUnlimited(game);
  else setBoardBudgets(game, club);
}

export function setBoardBudgets(game: GameState, club: Club): Budgets {
  if (club.isUser && game.settings?.unlimitedMoney) {
    topUpUnlimited(game);
    return club.budgets!;
  }
  const bill = wageBill(game, club);
  const income = weeklyIncomeEstimate(game, club);
  const step = income > 100_000 ? 1000 : income > 10_000 ? 100 : 10;
  // A confident board is more generous.
  const confidence = club.board?.confidence ?? 60;
  const wage = roundTo(Math.max(bill * 1.15, income * 0.75 * (0.88 + confidence / 500)), step);
  const transfer = roundTo(Math.max(0, club.balance * (0.36 + confidence / 250)), step * 10);
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
