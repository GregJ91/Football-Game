export type CountryId = 'eng' | 'sco';
export type Region = 'N' | 'S';

export type Position = 'GK' | 'DR' | 'DL' | 'DC' | 'DMC' | 'MR' | 'ML' | 'MC' | 'AMC' | 'ST';
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

export const ATTRIBUTE_KEYS = [
  'finishing',
  'passing',
  'dribbling',
  'tackling',
  'heading',
  'positioning',
  'vision',
  'workRate',
  'composure',
  'pace',
  'strength',
  'stamina',
  'handling',
  'reflexes',
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
/** Attribute values are 1–100. */
export type Attributes = Record<AttributeKey, number>;

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  attributes: Attributes;
  /** Cached overall (1–100), recomputed when attributes change. */
  overall: number;
  /** Ceiling the player can develop towards (1–100). */
  potential: number;
  clubId: string | null;
  wage: number; // per week, £
  value: number; // £
  /** Last season of the contract: it runs out at the end of this season. */
  contractEnd: number;
  morale: number; // 0–100
  fitness: number; // 0–100
  form: number; // rolling match rating, 1–10
  injuryWeeks: number;
  suspendedMatches: number;
  ambition: number; // 1–20
  loyalty: number; // 1–20
  seasonStats: { apps: number; goals: number; assists: number; ratingSum: number };
  /** Placed on the transfer list by their club. */
  listed?: boolean;
}

export type KitPattern = 'plain' | 'stripes' | 'hoops' | 'halves' | 'sash';

export interface ClubColours {
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  colours: ClubColours;
  stadiumName: string;
  capacity: number;
  region: Region;
  /** 1–100: how big the club is (drives AI squad quality, crowds, money). */
  reputation: number;
  balance: number;
  isUser: boolean;
  playerIds: string[];
  tactics: Tactics;
  /** The user's chosen XI (player ids per formation slot); unset = auto-pick. */
  lineup?: (string | null)[];
  history: SeasonRecord[];
  /** This season's money in and out. */
  ledger?: Ledger;
  /** Players this club has scouted (exact ratings known). */
  scouted?: Record<string, true>;
  /** Board-set budgets for the season (user club). */
  budgets?: Budgets;
  // Chairman side (user club).
  stadium?: Stadium;
  facilities?: Record<FacilityKind, number>;
  board?: Board;
  /** Ticket price for this season (£); unset = the guide price. */
  ticketPrice?: number;
  sponsor?: SponsorDeal;
  sponsorOffers?: SponsorDeal[];
  loan?: Loan;
  /** Weekly parachute payment after relegation, and the season it covers. */
  parachute?: { weekly: number; season: number };
}

export interface Budgets {
  /** Money available for fees. */
  transfer: number;
  /** Maximum total wage bill, per week. */
  wage: number;
}

export interface Ledger {
  gate: number;
  tv: number;
  transfersIn: number; // fees received
  transfersOut: number; // fees paid
  wages: number;
  other: number; // pay-offs and the like (negative = cost)
  sponsor?: number;
  prize?: number;
  /** Stadium and facility building costs. */
  building?: number;
  /** Facility running costs. */
  upkeep?: number;
  /** Loan received (positive) and repayments (negative). */
  loan?: number;
}

// ---------------------------------------------------------------- chairman

export interface Stand {
  name: string;
  capacity: number;
  seats: number;
  roof: boolean;
}

export type StadiumWork = 'extend' | 'seats' | 'roof' | 'floodlights';
export type FacilityKind = 'training' | 'youth' | 'medical';

export interface Build {
  kind: StadiumWork | 'facility';
  stand?: number;
  /** Places added, for an extension. */
  size?: number;
  facility?: FacilityKind;
  weeksLeft: number;
  totalWeeks: number;
  cost: number;
}

export interface Stadium {
  stands: Stand[];
  floodlights: boolean;
  builds: Build[];
}

export interface SeasonTarget {
  label: string;
  /** Finish at or above this league position. */
  position: number;
}

export interface Board {
  confidence: number; // 0–100
  fans: number; // 0–100
  target?: SeasonTarget;
  /** Already warned about the ground this season. */
  gradingWarned?: boolean;
}

export interface SponsorDeal {
  name: string;
  weekly: number;
  upfront: number;
  promotionBonus: number;
  /** Last season the deal covers. */
  endsSeason: number;
  style: 'steady' | 'upfront' | 'bonus';
}

export interface Loan {
  remaining: number;
  weekly: number;
}

export type InboxKind = 'bid' | 'info' | 'contract';
export type InboxCategory = 'transfers' | 'training' | 'medical' | 'scouting' | 'club' | 'match';

export interface InboxItem {
  id: string;
  season: number;
  week: number;
  /** Day of the week it arrived (0 = Sunday … 6 = Saturday). */
  day?: number;
  kind: InboxKind;
  category?: InboxCategory;
  /** Short heading shown in the inbox list. */
  subject?: string;
  text: string;
  read?: boolean;
  /** For bids: the offer on the table. */
  bid?: { playerId: string; fromClubId: string; fee: number; countered?: boolean };
  /** Week (in this season) after which an unanswered bid lapses. */
  expiresWeek?: number;
  resolved?: boolean;
}

export interface TransferRecord {
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  fromClubId: string | null;
  toClubId: string | null;
  fee: number;
}

export interface SeasonRecord {
  season: number;
  divisionId: string;
  position: number;
  outcome: 'champions' | 'promoted' | 'relegated' | 'stayed';
}

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2';
export type Mentality = 'defensive' | 'balanced' | 'attacking';
export type Pressing = 'low' | 'medium' | 'high';

export interface Tactics {
  formation: Formation;
  mentality: Mentality;
  pressing: Pressing;
}

export interface PromotionRule {
  /** Top N promoted automatically. */
  auto: number;
  /** Inclusive league positions entering the play-off, e.g. [3, 6]. */
  playoff: [number, number] | null;
}

export interface DivisionDef {
  id: string;
  name: string;
  level: number; // 1 = top
  size: number;
  /** How many times each pair meets (2 = home & away). */
  rounds: number;
  promotion: PromotionRule | null; // null at the top level
  relegation: number; // 0 at the bottom level
  region?: Region;
  /** Average player overall for a mid-table side at this level. */
  quality: number;
}

export interface CountryDef {
  id: CountryId;
  name: string;
  divisions: DivisionDef[];
}

export interface Fixture {
  id: string;
  divisionId: string;
  week: number;
  homeId: string;
  awayId: string;
  result: MatchResult | null;
}

/** `attack` is commentary colour only and is never stored with a result. */
export type MatchEventType = 'goal' | 'chance' | 'save' | 'yellow' | 'red' | 'injury' | 'sub' | 'attack';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side: 'home' | 'away';
  playerId: string;
  assistId?: string;
  /** For `sub`: the player coming on (playerId is the one going off). */
  inId?: string;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  /** Set when a knockout tie went to penalties. */
  penalties?: { home: number; away: number };
  events: MatchEvent[];
  homeXI: string[];
  awayXI: string[];
  ratings: Record<string, number>;
  possessionHome: number; // 0–100
  shotsHome: number;
  shotsAway: number;
  attendance: number;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface PlayoffTie {
  divisionId: string;
  round: 'semi' | 'final';
  homeId: string;
  awayId: string;
  result: MatchResult;
  winnerId: string;
}

export interface SeasonSummary {
  season: number;
  champions: Record<string, string>; // divisionId -> clubId
  promoted: Record<string, string[]>;
  relegated: Record<string, string[]>;
  playoffs: PlayoffTie[];
  finalTables: Record<string, TableRow[]>;
  /** The user won promotion but their ground didn't meet the rules. */
  deniedPromotion?: { clubId: string; replacementId: string };
}

export interface Division {
  def: DivisionDef;
  clubIds: string[];
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  country: CountryId;
  season: number; // starting year, e.g. 2026 for 2026/27
  week: number; // next week to be played (0-based)
  totalWeeks: number;
  userClubId: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  divisions: Division[];
  fixtures: Fixture[];
  /** Filled when the regular season has ended. */
  lastSummary: SeasonSummary | null;
  phase: 'season' | 'seasonEnd';
  nextId: number;
  settings?: GameSettings;
  inbox?: InboxItem[];
  transfers?: TransferRecord[];
  /** Scout reports the user can still request this week. */
  scoutReportsLeft?: number;
  /** Day of the current week, 0 = Sunday … 6 = Saturday (matchday); -1 = the Saturday evening just gone. */
  day?: number;
  half?: 'am' | 'pm';
  /** Scouts out watching players; reports arrive on `dueDay` (week * 7 + day). */
  scoutAssignments?: { playerId: string; dueDay: number }[];
}

export interface GameSettings {
  /** Let the assistant manager pick tactics for simulated matches. */
  assistantTactics: boolean;
  /** Testing aid: the user's club never runs out of money. */
  unlimitedMoney?: boolean;
  /** Bank balance before unlimited money was switched on, restored when it's switched off. */
  balanceBeforeUnlimited?: number;
}
