import { crowdFill, ledgerOf, ticketPrice } from '../economy/finance';
import { roundMoney } from '../players/ratings';
import type { Club, CountryId, GameState } from '../types';
import { divisionOf } from '../world';

/**
 * Matchday business for the user's club: season tickets, food and drink,
 * VIP hospitality and the club shop. Food and VIP are parts of the ground
 * the chairman builds and upgrades.
 */

export interface CommercialLevel {
  name: string;
  /** What it is, for the ground screen. */
  about: string;
  cost: number;
  weeks: number;
  /** Running costs per week. */
  upkeep: number;
}

export interface FoodLevel extends CommercialLevel {
  /** Average spend per fan per home game (£). */
  spend: number;
}

export interface VipLevel extends CommercialLevel {
  /** Hospitality places sold each home game. */
  guests: number;
  /** Ground size needed before it can be built. */
  minCapacity: number;
}

export const FOOD_LEVELS: FoodLevel[] = [
  { name: 'Tea hut', about: 'A hatch selling tea, pies and crisps.', spend: 1, cost: 0, weeks: 0, upkeep: 0 },
  { name: 'Burger vans', about: 'Hot food vans behind the stands.', spend: 2, cost: 5_000, weeks: 2, upkeep: 40 },
  { name: 'Kiosks', about: 'Food and drink kiosks in every stand.', spend: 3.5, cost: 25_000, weeks: 4, upkeep: 150 },
  { name: 'Food court', about: 'A proper concourse with a choice of food and a bar.', spend: 5, cost: 90_000, weeks: 6, upkeep: 450 },
  { name: 'Bars and restaurants', about: 'Bars and restaurants open on matchdays and through the week.', spend: 7, cost: 300_000, weeks: 10, upkeep: 1_200 },
];

export const VIP_LEVELS: VipLevel[] = [
  { name: 'None', about: 'No hospitality yet.', guests: 0, minCapacity: 0, cost: 0, weeks: 0, upkeep: 0 },
  { name: "Sponsors' lounge", about: 'A room for local businesses: a meal, a programme and a seat.', guests: 20, minCapacity: 400, cost: 12_000, weeks: 3, upkeep: 80 },
  { name: 'Hospitality suite', about: 'Matchday packages with dining before the game.', guests: 60, minCapacity: 1_200, cost: 50_000, weeks: 5, upkeep: 250 },
  { name: 'Executive boxes', about: 'Private boxes overlooking the pitch, sold for the season.', guests: 150, minCapacity: 3_000, cost: 180_000, weeks: 8, upkeep: 700 },
  { name: 'Premium lounges', about: 'Fine dining, padded seats and a tunnel view.', guests: 400, minCapacity: 8_000, cost: 600_000, weeks: 12, upkeep: 2_000 },
];

/** What a hospitality guest pays per home game (£), by level. */
const VIP_PRICE: Record<CountryId, number[]> = {
  eng: [0, 400, 180, 110, 80, 60, 50, 40],
  sco: [0, 150, 80, 60, 50, 40],
};

export interface CorporateLevel extends CommercialLevel {
  /** Weekly takings from conferences, meetings and events (before the league's pull). */
  weekly: number;
  minCapacity: number;
}

/** Corporate and conference rooms: let out all week, matchday or not. */
export const CORPORATE_LEVELS: CorporateLevel[] = [
  { name: 'None', about: 'No rooms to hire out yet.', weekly: 0, minCapacity: 0, cost: 0, weeks: 0, upkeep: 0 },
  { name: 'Meeting rooms', about: 'A couple of rooms hired out to local businesses through the week.', weekly: 300, minCapacity: 0, cost: 30_000, weeks: 4, upkeep: 60 },
  { name: 'Conference centre', about: 'A conference hall and breakout rooms: business events, training days and awards nights.', weekly: 1_200, minCapacity: 3_000, cost: 150_000, weeks: 8, upkeep: 250 },
  { name: 'Events and banqueting suite', about: 'Weddings, gala dinners and big corporate events, every day of the week.', weekly: 4_000, minCapacity: 10_000, cost: 600_000, weeks: 12, upkeep: 800 },
];

export function corporateLevel(club: Club): number {
  return club.stadium?.corporate ?? 0;
}

/** Weekly takings from the corporate rooms: a bigger club draws bigger events. */
export function weeklyCorporate(game: GameState, club: Club, level = corporateLevel(club)): number {
  const div = divisionOf(game, club.id).def.level;
  return Math.round(CORPORATE_LEVELS[level].weekly * (1 + (8 - div) * 0.4) * costScale(game.country));
}

export function costScale(country: CountryId) {
  return country === 'eng' ? 1 : 0.7;
}

export function foodLevel(club: Club): number {
  return club.stadium?.food ?? 0;
}

export function vipLevel(club: Club): number {
  return club.stadium?.vip ?? 0;
}

export function vipPrice(game: GameState, club: Club): number {
  const level = divisionOf(game, club.id).def.level;
  return VIP_PRICE[game.country][level] ?? 30;
}

/** Share of hospitality places sold: bigger, better-loved clubs sell out. */
function vipFill(club: Club): number {
  return Math.min(1, 0.45 + club.reputation / 200 + (club.board?.fans ?? 60) / 400);
}

/** Expected VIP takings per home game. */
export function vipTakings(game: GameState, club: Club, level = vipLevel(club)): number {
  return Math.round(VIP_LEVELS[level].guests * vipFill(club) * vipPrice(game, club));
}

/** Expected food and drink takings for a crowd. */
export function foodTakings(club: Club, attendance: number, level = foodLevel(club)): number {
  return Math.round(attendance * FOOD_LEVELS[level].spend);
}

/** Weekly running costs of the food outlets, hospitality and corporate rooms. */
export function commercialUpkeep(club: Club): number {
  return FOOD_LEVELS[foodLevel(club)].upkeep + VIP_LEVELS[vipLevel(club)].upkeep + CORPORATE_LEVELS[corporateLevel(club)].upkeep;
}

/** The average home crowd at today's prices. */
export function expectedCrowd(game: GameState, club: Club): number {
  return Math.min(club.capacity, Math.round(club.capacity * crowdFill(game, club)));
}

// ---------------------------------------------------------------- season tickets

/** Home league games this season. */
function homeLeagueGames(game: GameState, club: Club): number {
  return game.fixtures.filter((f) => f.homeId === club.id && f.divisionId).length;
}

/** Season tickets: sold in the summer at a fifth off, paid up front. */
export function seasonTicketOffer(game: GameState, club: Club): { holders: number; price: number } {
  const crowd = expectedCrowd(game, club);
  const share = Math.min(0.75, 0.35 + (club.board?.fans ?? 60) / 300 + club.reputation / 400);
  const holders = Math.round(crowd * share);
  const price = roundMoney(ticketPrice(game, club) * homeLeagueGames(game, club) * 0.8);
  return { holders, price };
}

/** Sell the season's tickets (once a season, as the fixtures come out). */
export function sellSeasonTickets(game: GameState): number {
  const club = game.clubs[game.userClubId];
  if (club.seasonTickets?.season === game.season) return 0;
  const { holders, price } = seasonTicketOffer(game, club);
  const revenue = holders * price;
  club.seasonTickets = { season: game.season, holders, price, revenue };
  club.balance += revenue;
  const l = ledgerOf(club);
  l.seasonTickets = (l.seasonTickets ?? 0) + revenue;
  return revenue;
}

/** Season-ticket holders at this season's home league games. */
export function seasonTicketHolders(game: GameState, club: Club): number {
  return club.seasonTickets?.season === game.season ? club.seasonTickets.holders : 0;
}

// ---------------------------------------------------------------- matchday

/**
 * Food, drink and hospitality at one of the user's home games. Gate money
 * is handled with the ticket sales; this is everything else.
 */
export function homeMatchExtras(game: GameState, club: Club, attendance: number) {
  const food = foodTakings(club, attendance);
  const vip = vipTakings(game, club);
  club.balance += food + vip;
  const l = ledgerOf(club);
  l.food = (l.food ?? 0) + food;
  l.hospitality = (l.hospitality ?? 0) + vip;
  return { food, vip };
}

/** Shirts, scarves and the club shop: steady weekly sales that grow with the club. */
export function weeklyMerchandise(game: GameState, club: Club): number {
  const level = divisionOf(game, club.id).def.level;
  const fans = expectedCrowd(game, club) * (1 + club.reputation / 100);
  return Math.round(fans * 0.25 * (1 + (8 - level) * 0.5));
}

// ---------------------------------------------------------------- building

export type Commercial = 'food' | 'vip' | 'corporate';

export interface CommercialOption {
  kind: Commercial;
  level: number;
  name: string;
  about: string;
  cost: number;
  weeks: number;
  upkeep: number;
  /** Why it can't be built yet, if it can't. */
  blocked?: string;
}

/** The next upgrade for food or hospitality, or null at the top level. */
export function commercialUpgrade(game: GameState, club: Club, kind: Commercial): CommercialOption | null {
  const levels: CommercialLevel[] = kind === 'food' ? FOOD_LEVELS : kind === 'vip' ? VIP_LEVELS : CORPORATE_LEVELS;
  const next = (kind === 'food' ? foodLevel(club) : kind === 'vip' ? vipLevel(club) : corporateLevel(club)) + 1;
  if (next >= levels.length) return null;
  const l = levels[next];
  const cap = club.stadium ? club.stadium.stands.reduce((n, s) => n + s.capacity, 0) : club.capacity;
  const min = kind === 'food' ? 0 : (l as VipLevel | CorporateLevel).minCapacity;
  return {
    kind,
    level: next,
    name: l.name,
    about: l.about,
    cost: Math.round(l.cost * costScale(game.country)),
    weeks: l.weeks,
    upkeep: l.upkeep,
    blocked: cap < min ? `Needs a ground of ${min.toLocaleString('en-GB')}.` : undefined,
  };
}

export function commercialBusy(club: Club, kind: Commercial): boolean {
  return !!club.stadium?.builds.some((b) => b.kind === kind);
}
