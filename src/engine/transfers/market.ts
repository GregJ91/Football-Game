import { SALE_REINVEST, budgetsOf, ledgerOf, wageBill, weeklyIncomeEstimate } from '../economy/finance';
import { pickTeam } from '../match/selection';
import { generatePlayer, playerName } from '../players/generate';
import { playerWage, roundMoney } from '../players/ratings';
import type { Rng } from '../rng';
import type { Club, GameState, InboxItem, InboxKind, Player, Position } from '../types';
import { divisionOf, newId, squadOf } from '../world';

export const SQUAD_MAX = 30;
export const SQUAD_MIN = 16;
export const SCOUT_REPORTS_PER_WEEK = 5;
const SUMMER_WEEKS = 6;
const JANUARY_WEEKS = 4;
const FREE_AGENT_CAP = 250;

// ---------------------------------------------------------------- inbox

export function addInbox(game: GameState, kind: InboxKind, text: string, extra: Partial<InboxItem> = {}): InboxItem {
  const item: InboxItem = { id: newId(game, 'm'), season: game.season, week: game.week, kind, text, ...extra };
  game.inbox ??= [];
  game.inbox.unshift(item);
  if (game.inbox.length > 80) game.inbox.length = 80;
  return item;
}

export function openInboxItems(game: GameState): InboxItem[] {
  return (game.inbox ?? []).filter((i) => i.kind === 'bid' && !i.resolved);
}

// ---------------------------------------------------------------- windows

function januaryStart(game: GameState) {
  return Math.floor(game.totalWeeks * 0.5);
}

export interface WindowStatus {
  open: boolean;
  name: 'summer' | 'january' | null;
  weeksLeft: number;
  label: string;
}

export function transferWindow(game: GameState): WindowStatus {
  if (game.phase !== 'season') return { open: false, name: null, weeksLeft: 0, label: 'Window opens at the start of next season' };
  if (game.week < SUMMER_WEEKS) {
    const left = SUMMER_WEEKS - game.week;
    return { open: true, name: 'summer', weeksLeft: left, label: `Summer window open · ${left} week${left === 1 ? '' : 's'} left` };
  }
  const j = januaryStart(game);
  if (game.week >= j && game.week < j + JANUARY_WEEKS) {
    const left = j + JANUARY_WEEKS - game.week;
    return { open: true, name: 'january', weeksLeft: left, label: `January window open · ${left} week${left === 1 ? '' : 's'} left` };
  }
  const until = game.week < j ? j - game.week : 0;
  return {
    open: false,
    name: null,
    weeksLeft: 0,
    label: until ? `Window closed · January window opens in ${until} weeks` : 'Window closed until the summer',
  };
}

// ---------------------------------------------------------------- knowledge

export function isKnown(game: GameState, club: Club, p: Player): boolean {
  if (p.clubId === club.id || club.scouted?.[p.id]) return true;
  if (!p.clubId) return false;
  return divisionOf(game, p.clubId) === divisionOf(game, club.id);
}

function hash(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** What an unscouted player looks like: a range that contains the truth. */
export function ratingRange(p: Player): [number, number] {
  const width = 8;
  const lo = p.overall - (hash(p.id) % (width + 1));
  return [Math.max(1, lo), Math.max(1, lo) + width];
}

/** Potential as 1–5 stars relative to their current ability. */
export function potentialStars(p: Player): number {
  const gap = p.potential - p.overall;
  return Math.max(1, Math.min(5, Math.round(1 + gap / 4)));
}

export function scoutPlayer(game: GameState, playerId: string): boolean {
  const club = game.clubs[game.userClubId];
  if (club.scouted?.[playerId]) return true;
  const left = game.scoutReportsLeft ?? SCOUT_REPORTS_PER_WEEK;
  if (left <= 0) return false;
  club.scouted = { ...club.scouted, [playerId]: true };
  game.scoutReportsLeft = left - 1;
  return true;
}

// ---------------------------------------------------------------- valuation

export type Interest = 'keen' | 'open' | 'reluctant' | 'no';

function levelOf(game: GameState, clubId: string) {
  return divisionOf(game, clubId).def.level;
}

/** How willing a player is to join `buyer`. */
export function interestIn(game: GameState, buyer: Club, p: Player): Interest {
  const buyerDiv = divisionOf(game, buyer.id).def;
  let score = 0;
  if (p.clubId) {
    const levelDiff = levelOf(game, p.clubId) - buyerDiv.level; // > 0: a step up for them
    score += levelDiff;
    if (levelDiff < 0) score -= Math.max(0, p.ambition - 10) / 10;
  } else {
    score += 1; // free agents want a club
  }
  const gap = p.overall - buyerDiv.quality;
  if (gap > 10) score -= (gap - 10) / 3;
  if (p.age >= 31) score += 0.5;
  if (p.listed) score += 1;
  return score >= 1 ? 'keen' : score >= 0 ? 'open' : score >= -1.5 ? 'reluctant' : 'no';
}

export function askingPrice(game: GameState, p: Player): number {
  if (!p.clubId) return 0;
  const squad = squadOf(game, p.clubId).map((x) => x.overall).sort((a, b) => b - a);
  const key = p.overall >= (squad[10] ?? 0);
  let mult = key ? 1.35 : 1.05;
  const yearsLeft = p.contractEnd - game.season;
  if (yearsLeft <= 0) mult *= 0.6;
  else if (yearsLeft === 1) mult *= 0.85;
  if (p.listed) mult *= 0.8;
  return roundMoney(Math.max(500, p.value * mult));
}

const INTEREST_WAGE: Record<Interest, number> = { keen: 1, open: 1.15, reluctant: 1.4, no: 2 };

/** The going rate at a club's level: clubs lower down can't pay top-flight wages. */
export function fairWage(game: GameState, club: Club, p: Player): number {
  const quality = divisionOf(game, club.id).def.quality;
  return playerWage(Math.min(p.overall, quality + 6));
}

export function wageDemand(game: GameState, buyer: Club, p: Player): number {
  const fair = fairWage(game, buyer, p);
  // A good player expects to be paid like one, wherever he goes.
  const base = Math.max(Math.min(p.wage * 1.1, fair * 1.5), fair, playerWage(p.overall) * 0.6);
  return roundMoney(base * INTEREST_WAGE[interestIn(game, buyer, p)]);
}

// ---------------------------------------------------------------- buying

/** Why the user can't sign this player right now, or null if they can. */
export function cannotBuy(game: GameState, p: Player): string | null {
  const club = game.clubs[game.userClubId];
  if (p.clubId === club.id) return 'Already at your club.';
  if (p.clubId && !transferWindow(game).open) return 'The transfer window is closed. You can still sign free agents.';
  if (club.playerIds.length >= SQUAD_MAX) return `Your squad is full (${SQUAD_MAX}). Sell or release someone first.`;
  if (interestIn(game, club, p) === 'no') return `${p.lastName} isn't interested in joining a club at your level.`;
  return null;
}

/** Why the user can't offer this fee, or null if the budget covers it. */
export function feeProblem(game: GameState, fee: number): string | null {
  const club = game.clubs[game.userClubId];
  const budget = budgetsOf(game, club).transfer;
  if (fee > budget) return `That's more than your transfer budget of ${formatFee(budget)}.`;
  if (fee > Math.max(0, club.balance)) return `The club only has ${formatFee(Math.max(0, club.balance))} in the bank.`;
  return null;
}

export type BidResponse = { result: 'accepted' | 'countered' | 'rejected'; asking: number };

export function bidFor(game: GameState, p: Player, fee: number): BidResponse {
  const asking = askingPrice(game, p);
  if (fee >= asking) return { result: 'accepted', asking };
  if (fee >= asking * 0.75) return { result: 'countered', asking };
  return { result: 'rejected', asking };
}

/** The player's answer when offered less than they asked for. */
export function acceptsLowerWage(game: GameState, rng: Rng, buyer: Club, p: Player): boolean {
  const i = interestIn(game, buyer, p);
  return i === 'keen' || (i === 'open' && rng.chance(0.5));
}

function removeFromClub(game: GameState, p: Player) {
  if (!p.clubId) return;
  const club = game.clubs[p.clubId];
  club.playerIds = club.playerIds.filter((id) => id !== p.id);
  if (club.lineup) club.lineup = club.lineup.map((id) => (id === p.id ? null : id));
}

export function completeTransfer(game: GameState, p: Player, toClubId: string, fee: number, wage: number, years: number) {
  const fromId = p.clubId;
  const buyer = game.clubs[toClubId];
  if (fromId) {
    const seller = game.clubs[fromId];
    seller.balance += fee;
    ledgerOf(seller).transfersIn += fee;
    if (seller.isUser) budgetsOf(game, seller).transfer += Math.round(fee * SALE_REINVEST);
    removeFromClub(game, p);
  }
  if (buyer.isUser) budgetsOf(game, buyer).transfer = Math.max(0, budgetsOf(game, buyer).transfer - fee);
  buyer.balance -= fee;
  ledgerOf(buyer).transfersOut += fee;
  buyer.playerIds.push(p.id);
  p.clubId = toClubId;
  p.wage = wage;
  p.contractEnd = game.season + years - 1;
  p.listed = false;
  p.morale = Math.max(p.morale, 75);
  game.transfers ??= [];
  game.transfers.unshift({ season: game.season, week: game.week, playerId: p.id, playerName: playerName(p), fromClubId: fromId, toClubId, fee });
  if (game.transfers.length > 300) game.transfers.length = 300;
}

/** Weeks left on a contract from now. */
export function weeksLeftOnContract(game: GameState, p: Player): number {
  return Math.max(0, game.totalWeeks - game.week + (p.contractEnd - game.season) * game.totalWeeks);
}

/** Paying up half the remaining wages to end a contract early. */
export function releaseCost(game: GameState, p: Player): number {
  return roundMoney(p.wage * weeksLeftOnContract(game, p) * 0.5);
}

export function cannotRelease(game: GameState, p: Player): string | null {
  const club = game.clubs[game.userClubId];
  if (club.playerIds.length <= SQUAD_MIN) return `You need at least ${SQUAD_MIN} players.`;
  const keepers = squadOf(game, club.id).filter((x) => x.position === 'GK');
  if (p.position === 'GK' && keepers.length <= 1) return "He's your only goalkeeper.";
  return null;
}

export function releasePlayer(game: GameState, p: Player) {
  const club = p.clubId ? game.clubs[p.clubId] : null;
  if (!club) return;
  const cost = club.isUser ? releaseCost(game, p) : 0;
  club.balance -= cost;
  ledgerOf(club).other -= cost;
  removeFromClub(game, p);
  p.clubId = null;
  p.listed = false;
}

// ---------------------------------------------------------------- contracts

export function renewalDemand(game: GameState, p: Player): { wage: number; refuses: string | null } {
  const club = game.clubs[p.clubId!];
  const quality = divisionOf(game, club.id).def.quality;
  const base = Math.max(Math.min(p.wage * 1.1, fairWage(game, club, p) * 1.5), fairWage(game, club, p));
  const moraleMult = p.morale < 40 ? 1.25 : 1;
  const ageMult = p.age >= 31 ? 0.9 : 1;
  const refuses =
    p.overall > quality + 8 && p.ambition >= 14
      ? `${p.lastName} wants to play at a higher level and won't sign a new deal.`
      : null;
  return { wage: roundMoney(base * moraleMult * ageMult), refuses };
}

export function renewContract(game: GameState, p: Player, wage: number, years: number) {
  p.wage = wage;
  p.contractEnd = Math.max(p.contractEnd, game.season) + years;
  p.morale = Math.min(100, p.morale + 5);
}

/** End of season: expiring contracts. The user's unrenewed players leave; AI clubs renew most. */
export function handleContractExpiries(game: GameState, rng: Rng) {
  const leaving: string[] = [];
  for (const p of Object.values(game.players)) {
    if (!p.clubId || p.contractEnd > game.season) continue;
    const club = game.clubs[p.clubId];
    if (club.isUser) {
      leaving.push(playerName(p));
      releasePlayer(game, p);
    } else if (p.age >= 33 || club.playerIds.length > 26 || rng.chance(0.2)) {
      releasePlayer(game, p);
    } else {
      p.contractEnd = game.season + rng.int(1, 3);
      p.wage = fairWage(game, club, p);
    }
  }
  if (leaving.length) addInbox(game, 'info', `Out of contract and gone: ${leaving.join(', ')}.`);
}

export function expiringUserContracts(game: GameState): Player[] {
  return squadOf(game, game.userClubId).filter((p) => p.contractEnd <= game.season);
}

// ---------------------------------------------------------------- AI market

function signFreeOrYouth(game: GameState, rng: Rng, club: Club, position: Position) {
  const quality = divisionOf(game, club.id).def.quality;
  const free = Object.values(game.players)
    .filter((p) => !p.clubId && p.position === position && p.overall <= quality + 6)
    .sort((a, b) => b.overall - a.overall)[0];
  if (free) {
    completeTransfer(game, free, club.id, 0, fairWage(game, club, free), rng.int(1, 2));
    return;
  }
  const p = generatePlayer(rng, { id: newId(game, 'p'), position, quality: quality - 10, clubId: club.id, season: game.season, age: rng.int(17, 19) });
  game.players[p.id] = p;
  club.playerIds.push(p.id);
}

/** One AI club tries to strengthen its weakest starting position. */
function aiBuy(game: GameState, rng: Rng, buyer: Club) {
  const squad = squadOf(game, buyer.id);
  const xi = pickTeam(squad, buyer.tactics.formation).xi;
  if (!xi.length) return;
  const weakest = xi.reduce((a, b) => (a.overall <= b.overall ? a : b));
  const budget = buyer.balance * 0.5;
  const quality = divisionOf(game, buyer.id).def.quality;
  // Don't take on wages the club can't carry.
  const wageRoom = weeklyIncomeEstimate(game, buyer) * 0.9 - wageBill(game, buyer) + weakest.wage;
  const candidates: { p: Player; fee: number }[] = [];
  for (const p of Object.values(game.players)) {
    if (p.clubId === buyer.id || p.clubId === game.userClubId || p.position !== weakest.position) continue;
    if (p.overall < weakest.overall + 3 || p.overall > quality + 8 || p.age > 32) continue;
    const fee = askingPrice(game, p);
    if (fee > budget) continue;
    if (interestIn(game, buyer, p) === 'no') continue;
    if (wageDemand(game, buyer, p) > wageRoom) continue;
    candidates.push({ p, fee });
  }
  if (!candidates.length) return;
  candidates.sort((a, b) => b.p.overall - a.p.overall);
  const { p, fee } = rng.pick(candidates.slice(0, 3));
  const seller = p.clubId ? game.clubs[p.clubId] : null;
  completeTransfer(game, p, buyer.id, fee, wageDemand(game, buyer, p), rng.int(2, 4));
  if (seller && !seller.isUser && seller.playerIds.length < 18) signFreeOrYouth(game, rng, seller, p.position);
  // Make room: the weakest player goes (on the list if the window allows, else released).
  if (buyer.playerIds.length > 25) releasePlayer(game, squadOf(game, buyer.id).sort((a, b) => a.overall - b.overall)[0]);
}

/** AI clubs in debt cut their wage bill by letting a costly squad player go. */
function aiBalanceBooks(game: GameState, club: Club) {
  if (club.balance >= 0 || club.playerIds.length <= 18) return;
  if (wageBill(game, club) <= weeklyIncomeEstimate(game, club)) return;
  const squad = squadOf(game, club.id);
  const xi = new Set(pickTeam(squad, club.tactics.formation).xi.map((p) => p.id));
  const spare = squad.filter((p) => !xi.has(p.id)).sort((a, b) => b.wage - a.wage)[0];
  if (spare) releasePlayer(game, spare);
}

/** Season rollover: AI squads trimmed to a manageable size. */
export function trimAiSquads(game: GameState) {
  for (const club of Object.values(game.clubs)) {
    if (club.isUser) continue;
    while (club.playerIds.length > 25) {
      const worst = squadOf(game, club.id).sort((a, b) => a.overall - b.overall || b.age - a.age)[0];
      releasePlayer(game, worst);
    }
  }
}

/** AI clubs see a player of yours they like, or one you've listed. */
function aiBidForUser(game: GameState, rng: Rng) {
  const user = game.clubs[game.userClubId];
  const userQuality = divisionOf(game, user.id).def.quality;
  const pending = new Set(openInboxItems(game).map((i) => i.bid!.playerId));
  const squad = squadOf(game, user.id).filter((p) => !pending.has(p.id));
  const listed = squad.filter((p) => p.listed && rng.chance(0.45));
  const standout = squad.filter((p) => !p.listed && p.overall > userQuality + 2 && rng.chance(0.06));
  for (const p of [...listed, ...standout].slice(0, 2)) {
    const fee = roundMoney(p.value * (p.listed ? 0.75 + rng.next() * 0.3 : 0.95 + rng.next() * 0.35));
    const userLevel = divisionOf(game, user.id).def.level;
    const bidders = game.divisions
      .filter((d) => d.def.level <= userLevel && d.def.quality >= p.overall - 6 && d.def.quality <= p.overall + 4)
      .flatMap((d) => d.clubIds)
      .map((id) => game.clubs[id])
      .filter((c) => !c.isUser && c.balance >= fee * 1.2);
    if (!bidders.length) continue;
    const from = rng.pick(bidders);
    addInbox(game, 'bid', `${from.name} bid ${formatFee(fee)} for ${playerName(p)} (${p.position}, ${p.overall}).`, {
      bid: { playerId: p.id, fromClubId: from.id, fee },
      expiresWeek: game.week + 2,
    });
  }
}

function formatFee(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `£${Math.round(n / 1000)}k`;
  return `£${n}`;
}

/** Weekly market activity across the world while a window is open. */
export function marketWeek(game: GameState, rng: Rng) {
  expireBids(game);
  game.scoutReportsLeft = SCOUT_REPORTS_PER_WEEK;
  for (const club of Object.values(game.clubs)) if (!club.isUser) aiBalanceBooks(game, club);
  if (!transferWindow(game).open) return;
  for (const club of Object.values(game.clubs)) {
    if (club.isUser || club.balance <= 0) continue;
    if (club.playerIds.length < 18 || rng.chance(0.1)) aiBuy(game, rng, club);
  }
  aiBidForUser(game, rng);
}

// ---------------------------------------------------------------- bids for your players

export function expireBids(game: GameState) {
  const open = transferWindow(game).open;
  for (const item of openInboxItems(game)) {
    const p = game.players[item.bid!.playerId];
    const gone = !p || p.clubId !== game.userClubId;
    if (gone || !open || (item.expiresWeek !== undefined && game.week > item.expiresWeek)) {
      item.resolved = true;
      if (!gone) addInbox(game, 'info', `${game.clubs[item.bid!.fromClubId].name} withdrew their offer for ${playerName(p)}.`);
    }
  }
}

export type BidAction = 'accept' | 'counter' | 'reject';

/** Answer an AI club's bid for one of your players; returns a line to show. */
export function answerBid(game: GameState, rng: Rng, itemId: string, action: BidAction): string {
  const item = (game.inbox ?? []).find((i) => i.id === itemId);
  if (!item?.bid || item.resolved) return 'That offer is no longer on the table.';
  const p = game.players[item.bid.playerId];
  const from = game.clubs[item.bid.fromClubId];
  if (action === 'reject') {
    item.resolved = true;
    return `You turned down ${from.name}.`;
  }
  if (action === 'accept') {
    if (!transferWindow(game).open) {
      item.resolved = true;
      return 'The window has closed.';
    }
    if (cannotRelease(game, p)) {
      return cannotRelease(game, p)!;
    }
    item.resolved = true;
    completeTransfer(game, p, from.id, item.bid.fee, Math.max(p.wage, fairWage(game, from, p)), 3);
    return `${playerName(p)} joins ${from.name} for ${formatFee(item.bid.fee)}.`;
  }
  // Counter: ask for 25% more, once.
  if (item.bid.countered) return 'They have already made their final offer.';
  const ask = roundMoney(item.bid.fee * 1.25);
  if (ask <= p.value * 1.6 && rng.chance(0.6) && from.balance >= ask) {
    item.bid = { ...item.bid, fee: ask, countered: true };
    item.text = `${from.name} raised their offer to ${formatFee(ask)} for ${playerName(p)}. Final offer.`;
    return `${from.name} agreed to ${formatFee(ask)}.`;
  }
  item.resolved = true;
  return `${from.name} walked away.`;
}

// ---------------------------------------------------------------- free agents

export function freeAgents(game: GameState): Player[] {
  return Object.values(game.players).filter((p) => !p.clubId);
}

/** Keep the free agent pool a sensible size and spread across levels. */
export function maintainFreeAgents(game: GameState, rng: Rng) {
  let pool = freeAgents(game);
  if (pool.length > FREE_AGENT_CAP) {
    pool.sort((a, b) => a.overall - b.overall);
    for (const p of pool.slice(0, pool.length - FREE_AGENT_CAP)) delete game.players[p.id];
    pool = freeAgents(game);
  }
  const target = 40;
  const positions: Position[] = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'MR', 'ML', 'AMC', 'ST'];
  const qualities = game.divisions.map((d) => d.def.quality);
  for (let i = pool.length; i < target; i++) {
    const p = generatePlayer(rng, {
      id: newId(game, 'p'),
      position: rng.pick(positions),
      quality: rng.pick(qualities) - 3 + rng.normal() * 3,
      clubId: null,
      season: game.season,
      age: rng.int(21, 33),
    });
    game.players[p.id] = p;
  }
}
