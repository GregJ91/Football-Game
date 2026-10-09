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
  contractEnd: number; // season year the contract expires
  morale: number; // 0–100
  fitness: number; // 0–100
  form: number; // rolling match rating, 1–10
  injuryWeeks: number;
  suspendedMatches: number;
  ambition: number; // 1–20
  loyalty: number; // 1–20
  seasonStats: { apps: number; goals: number; assists: number; ratingSum: number };
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
}

export interface GameSettings {
  /** Let the assistant manager pick tactics for simulated matches. */
  assistantTactics: boolean;
}
