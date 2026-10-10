export type CountryId = 'eng' | 'sco';
export type Region = 'N' | 'S';

export type Position = 'GK' | 'DR' | 'DL' | 'DC' | 'DMC' | 'MR' | 'ML' | 'MC' | 'AMC' | 'ST';
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

/** Championship Manager 01/02-style attributes, each 1–20. */
export const TECHNICAL = ['crossing', 'dribbling', 'finishing', 'heading', 'longShots', 'marking', 'passing', 'tackling', 'technique'] as const;
export const MENTAL = [
  'aggression', 'anticipation', 'bravery', 'creativity', 'decisions', 'determination', 'flair', 'offTheBall', 'positioning', 'teamwork', 'workRate',
] as const;
export const PHYSICAL = ['acceleration', 'agility', 'jumping', 'pace', 'stamina', 'strength'] as const;
export const GOALKEEPING = ['handling', 'reflexes', 'oneOnOnes', 'aerialAbility', 'kicking', 'communication'] as const;
export const ATTRIBUTE_KEYS = [...TECHNICAL, ...MENTAL, ...PHYSICAL, ...GOALKEEPING] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
/** Attribute values are 1–20, as in CM 01/02. */
export type Attributes = Record<AttributeKey, number>;

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  /** Main position. */
  position: Position;
  /** Every position he can play, main position first. */
  positions: Position[];
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
  /** What the current injury is, e.g. "Hamstring strain". */
  injuryName?: string;
  suspendedMatches: number;
  ambition: number; // 1–20
  loyalty: number; // 1–20
  seasonStats: { apps: number; goals: number; assists: number; ratingSum: number; cleanSheets?: number };
  /** Career games, goals, assists and clean sheets before this season. */
  careerStats?: [number, number, number, number?];
  /** This calendar month's games, for the monthly awards. */
  monthStats?: { apps: number; goals: number; assists: number; ratingSum: number };
  /** Placed on the transfer list by their club. */
  listed?: boolean;
  /** Where he stands in the squad, and so how much football he expects. */
  role?: SquadRole;
  /** The manager set the role himself (it isn't reset each summer). */
  roleSetByUser?: boolean;
  /** Playing-time checks in a row he's fallen short of what his role promises. */
  unhappy?: number;
  /** Has asked to leave. */
  transferRequest?: boolean;
  /** On loan at his current club from this one; he goes back at the end of the season. */
  loanFrom?: string;
  /** Individual training: unset = follow the team's focus. */
  trainingFocus?: IndividualFocus;
  /** Learning a new position: progress 0–100. */
  retrain?: { position: Position; progress: number };
}

export type SquadRole = 'key' | 'first' | 'rotation' | 'backup' | 'prospect';

export type TeamFocus = 'balanced' | 'attacking' | 'defending' | 'physical' | 'tactical' | 'matchPrep';
export type IndividualFocus = 'technical' | 'mental' | 'physical' | 'goalkeeping';
export type TrainingIntensity = 'light' | 'normal' | 'intense';

export interface TrainingSettings {
  focus: TeamFocus;
  intensity: TrainingIntensity;
}

export interface TrainingGain {
  season: number;
  week: number;
  playerId: string;
  name: string;
  attribute: AttributeKey | 'position';
  /** New attribute value, or the position learnt. */
  value: number | string;
}

export type KitPattern = 'plain' | 'stripes' | 'hoops' | 'halves' | 'sash';

export interface ClubColours {
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

export type CrestShape = 'shield' | 'round' | 'diamond' | 'square' | 'badge';
export type CrestIcon = 'star' | 'ball' | 'crown' | 'castle' | 'anchor' | 'tree' | 'bird' | 'bolt' | 'none';

export interface CrestDesign {
  shape: CrestShape;
  icon: CrestIcon;
  /** Show the club's short name on the crest. */
  initials?: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  /** Home kit (and the club's colours). */
  colours: ClubColours;
  /** Away kit; unset = the home colours swapped. */
  awayKit?: ClubColours;
  crest?: CrestDesign;
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
  /** The user's chosen substitutes, in order; unset = the best of the rest. */
  bench?: string[];
  /** Matches played this season (league, cups and Europe). */
  seasonGames?: number;
  history: SeasonRecord[];
  trophies?: Trophy[];
  /** This season's money in and out. */
  ledger?: Ledger;
  /** Players this club has scouted (exact ratings known). */
  scouted?: Record<string, true>;
  /** Saved scout reports on players (user club), by player id. */
  scoutReports?: Record<string, ScoutReport>;
  /** Players the manager is keeping an eye on (user club). */
  shortlist?: string[];
  /** Board-set budgets for the season (user club). */
  budgets?: Budgets;
  // Chairman side (user club).
  stadium?: Stadium;
  facilities?: Record<FacilityKind, number>;
  board?: Board;
  /** Ticket price for this season (£); unset = the guide price. */
  ticketPrice?: number;
  /** This season's season-ticket sales (user club). */
  seasonTickets?: { season: number; holders: number; price: number; revenue: number };
  sponsor?: SponsorDeal;
  sponsorOffers?: SponsorDeal[];
  loan?: Loan;
  /** The user's training schedule. */
  training?: TrainingSettings;
  /** Recent improvements from training, newest first. */
  trainingLog?: TrainingGain[];
  /** This season's injuries at the user's club, newest first. */
  injuryLog?: InjuryRecord[];
  /** All-time appearances and goals for the club (user's club). */
  legends?: Record<string, Legend>;
  records?: ClubRecords;
  /** The user's backroom staff. */
  staff?: Partial<Record<StaffRole, StaffMember>>;
  /** Weekly parachute payment after relegation, and the season it covers. */
  parachute?: { weekly: number; season: number };
  /** A club from abroad, met only in Europe. It has no division and its squad is made when needed. */
  foreign?: ForeignInfo;
}

export interface ForeignInfo {
  nation: string;
  nationName: string;
  style: string;
  /** Best-XI average this season. */
  strength: number;
  /** Long-run level, on a scale where an average Premier League side is 76. */
  base: number;
  /** This season's swing above or below that level. */
  form?: number;
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
  /** Season tickets sold in the summer. */
  seasonTickets?: number;
  /** Food and drink at home games. */
  food?: number;
  /** VIP hospitality at home games. */
  hospitality?: number;
  /** Shirts and the club shop. */
  merch?: number;
  /** Stadium and facility building costs. */
  building?: number;
  /** Facility running costs. */
  upkeep?: number;
  /** Backroom staff wages. */
  staff?: number;
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

export type StadiumWork = 'extend' | 'seats' | 'roof' | 'floodlights' | 'food' | 'vip';
export type FacilityKind = 'training' | 'youth' | 'medical';

export interface Build {
  kind: StadiumWork | 'facility';
  stand?: number;
  /** Places added, for an extension. */
  size?: number;
  facility?: FacilityKind;
  /** Food or VIP level being built. */
  level?: number;
  weeksLeft: number;
  totalWeeks: number;
  cost: number;
}

export interface Stadium {
  stands: Stand[];
  floodlights: boolean;
  /** Food and drink outlets, level 0 (tea hut) to 4. */
  food?: number;
  /** VIP hospitality, level 0 (none) to 4. */
  vip?: number;
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
  /** The board has warned you about results: concerned, then a final warning. */
  warning?: 'concerned' | 'final';
  /** When the final warning was given. */
  warnedSeason?: number;
  warnedWeek?: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export type StaffRole = 'assistant' | 'coach' | 'scout' | 'physio';

export interface StaffMember {
  name: string;
  /** 1–20, like player attributes. */
  rating: number;
  /** Per week, £. */
  wage: number;
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
export type ScoutVerdict = 'star' | 'starter' | 'squad' | 'no';

/** What a scout wrote about a player, as it was when he watched him. */
export interface ScoutReport {
  season: number;
  week: number;
  ability: number;
  potential: number; // stars, 1–5
  verdict: ScoutVerdict;
  interest: 'keen' | 'open' | 'reluctant' | 'no';
  price: number; // asking price then; 0 for a free agent
  /** The mission that found him, if any. */
  mission?: string;
}

export type ScoutRegion = 'any' | 'home' | 'abroad' | 'free';

/** A brief for the scouts: find players who fit. */
export interface ScoutMission {
  id: string;
  position: Position | 'ANY';
  maxAge: number;
  maxValue: number; // 0 = any
  region: ScoutRegion;
  dueDay: number;
}

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
  /** League division id; for a cup tie, the cup's id. */
  divisionId: string;
  week: number;
  homeId: string;
  awayId: string;
  result: MatchResult | null;
}

// ---------------------------------------------------------------- cups

export interface CupDef {
  id: string;
  name: string;
  /** Short label for fixture lists, e.g. FAC. */
  short: string;
  /** Pyramid level -> the round (0-based) that level's clubs join in. */
  entries: Record<number, number>;
  /** Day of the week ties are played (2 = Tuesday, 3 = Wednesday). */
  day: number;
  /** Part of the season the rounds are spread over (fractions of the season). */
  window: [number, number];
  /** Prize for winning a round in the first round; it doubles each round. */
  prize: number;
  /** Semi-finals at a neutral ground too, not just the final. */
  neutralSemis: boolean;
  /** Names for the early rounds (quarter-finals onwards are named by size). */
  roundNames?: string[];
  /** Inbox message when the user's club reaches a round (by index). */
  milestones?: Record<number, string>;
  /** A one-off final between last season's winners (Community Shield, Super Cup). */
  showpiece?: boolean;
}

export interface CupTie extends Fixture {
  cupId: string;
  round: number;
  neutral: boolean;
  winnerId?: string;
  /** Two-legged European ties: which leg, and (on the second leg) the first leg's id. */
  leg?: 1 | 2;
  firstLegId?: string;
}

export interface CupRound {
  name: string;
  week: number;
  day: number;
  ties: CupTie[];
  /** Through to the next round without playing (odd numbers). */
  byes: string[];
  drawn: boolean;
  played: boolean;
  /** European rounds: the stage and leg. */
  stage?: EuroStage;
  leg?: 1 | 2;
}

export interface CupState {
  id: string;
  season: number;
  rounds: CupRound[];
  winnerId?: string;
  /** European competitions: the 36 clubs in the league phase, once drawn. */
  league?: string[];
}

export type EuroStage = 'playoff' | 'league' | 'koPlayoff' | 'r16' | 'qf' | 'sf' | 'final';

/** A domestic club's place in Europe. */
export interface EuroEntry {
  clubId: string;
  compId: string;
  /** Starts in the play-off round. */
  playoff: boolean;
  /** How the place was earned, e.g. "4th in the Premier League". */
  reason: string;
}

export interface EuropeState {
  /** Foreign clubs (also in `clubs`). */
  foreignIds: string[];
  /** This season's domestic entrants. */
  entries: EuroEntry[];
  /** Places earned for next season (set at the end of the season). */
  next?: EuroEntry[];
  comps: CupState[];
  /** Squads of foreign clubs the user has met this season (kept apart from `players`). */
  players: Record<string, Player>;
  squads: Record<string, string[]>;
  winners: { season: number; compId: string; clubId: string }[];
  /** How far the domestic game's ratings have moved from the reference scale; foreign clubs move with it. */
  shift?: number;
}

export interface Trophy {
  season: number;
  name: string;
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
  /** Points taken off for breaking the rules (already removed from `points`). */
  deducted?: number;
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
  /** Player awards and the Team of the Season, by division. */
  awards?: Record<string, DivisionAwards>;
  /** Golden Glove (most clean sheets) in each cup and European competition. */
  cupGloves?: Record<string, AwardWinner>;
  /** European winners this season and the places earned for next season. */
  europe?: { winners: { compId: string; clubId: string }[]; qualified: EuroEntry[] };
}

export interface AwardWinner {
  playerId: string;
  name: string;
  clubId: string;
  /** Goals, assists or average rating, depending on the award. */
  value: number;
  /** Team of the Season: the position he's picked in. */
  position?: Position;
}

export interface MonthlyAwards {
  season: number;
  /** e.g. "September 2026". */
  month: string;
  divisionId: string;
  player?: AwardWinner;
  young?: AwardWinner;
  /** The club with the best league results that month. */
  manager?: { clubId: string; clubName: string; points: number; played: number };
}

/** One entry on the Ballon d'Or podium. */
export interface BallonDorPlace {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  nation: string;
  score: number;
}

/** The headline awards of a season, kept for the record. */
export interface YearAwards {
  season: number;
  ballonDor: BallonDorPlace[];
  playerOfYear?: AwardWinner;
  youngPlayerOfYear?: AwardWinner;
  goldenBoot?: AwardWinner;
  goldenGlove?: AwardWinner;
}

export interface DivisionAwards {
  player?: AwardWinner;
  young?: AwardWinner;
  topScorer?: AwardWinner;
  topAssists?: AwardWinner;
  /** Most clean sheets in the league. */
  goldenGlove?: AwardWinner;
  team: AwardWinner[];
}

/** A player in the user's club's all-time records. */
export interface Legend {
  name: string;
  position: Position;
  apps: number;
  goals: number;
  from: number;
  to: number;
  awards?: string[];
}

export interface InjuryRecord {
  playerId: string;
  name: string;
  injury: string;
  weeks: number;
  season: number;
  week: number;
  day: number;
  /** e.g. "v Bromwood Town" or "Training". */
  where: string;
}

export interface ClubRecords {
  biggestWin?: { season: number; opponent: string; score: string; margin: number };
  heaviestDefeat?: { season: number; opponent: string; score: string; margin: number };
  recordAttendance?: { season: number; opponent: string; attendance: number };
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
  /** The season the career started (for the board's first-season patience). */
  startSeason?: number;
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
  /** Set while you're out of work after being sacked: the world plays on and clubs may offer you a job. */
  unemployed?: Unemployed;
  /** The clubs you've managed, in order. */
  career?: CareerSpell[];
  /** The manager's own record (results, transfers, players, awards, job offers). */
  manager?: ManagerRecord;
  /** Started as a top-flight giant (testing): no achievements. */
  testingStart?: boolean;
  /** Points deductions this season, by club. */
  deductions?: Record<string, number>;
  /** Monthly awards this season, and the headline awards of past seasons. */
  awards?: { monthly: MonthlyAwards[]; history: YearAwards[] };
  /** Challenge mode: the challenge being played and how it's going. */
  challenge?: ChallengeState;
  nextId: number;
  settings?: GameSettings;
  inbox?: InboxItem[];
  transfers?: TransferRecord[];
  /** Scout reports the user can still request this week. */
  scoutReportsLeft?: number;
  /** Day of the current week, 0 = Sunday … 6 = Saturday (matchday); -1 = the Saturday evening just gone. */
  day?: number;
  half?: 'am' | 'pm';
  /** Day (week * 7 + day) players' fitness has recovered up to. */
  recoveredTo?: number;
  /** Scouts out watching players; reports arrive on `dueDay` (week * 7 + day). */
  scoutAssignments?: { playerId: string; dueDay: number }[];
  /** Scouts out on a brief to find players; they report back on `dueDay`. */
  scoutMissions?: ScoutMission[];
  /** This season's clean sheets by competition (league, cup or European id), then keeper id. */
  cleanSheets?: Record<string, Record<string, number>>;
  /** The game uses real club names (set when it's created). */
  realNames?: boolean;
  /** This season's cup competitions. */
  cups?: CupState[];
  /** European competitions and the foreign clubs in them. */
  europe?: EuropeState;
}

export type ChallengeId = 'sack' | 'kids' | 'embargo' | 'old' | 'relegation';

export interface ChallengeState {
  id: ChallengeId;
  status: 'active' | 'won' | 'lost';
  /** How it ended. */
  result?: string;
  startSeason: number;
  /** After winning, the player chose to carry on as a normal career. */
  continued?: boolean;
}

export interface JobOffer {
  clubId: string;
  /** Absolute week (season * 100 + week) after which the offer lapses. */
  expires: number;
}

export interface Unemployed {
  reason: string;
  season: number;
  week: number;
  /** The club that sacked you, and its level then. */
  fromClubId: string;
  level: number;
  offers: JobOffer[];
}

export interface CareerSpell {
  clubId: string;
  clubName: string;
  from: number;
  /** Last season in charge, once you've left. */
  to?: number;
  left?: 'sacked' | 'moved';
}

/** A transfer the manager made, for the record book. */
export interface ManagerDeal {
  name: string;
  fee: number;
  season: number;
  clubName: string;
}

/** An individual award: the manager's own, or one of his players'. */
export interface ManagerHonour {
  season: number;
  /** e.g. "Manager of the Month (September)", "Golden Boot". */
  name: string;
  kind: 'manager' | 'player';
  /** The player, for a player award. */
  who?: string;
  clubId: string;
  clubName: string;
}

/** The manager's career record across every club. */
export interface ManagerRecord {
  games: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Games played in each formation and mentality. */
  formations: Record<string, number>;
  mentalities: Record<string, number>;
  feesIn: number;
  feesOut: number;
  signings: number;
  freeSignings: number;
  biggestSigning?: ManagerDeal;
  cheapestSigning?: ManagerDeal;
  biggestSale?: ManagerDeal;
  /** Everyone who has played for you: apps, goals and the best rating he reached under you. */
  players: Record<string, { name: string; position: Position; peak: number; apps: number; goals: number; clubName: string }>;
  honours: ManagerHonour[];
  /** Clubs that want you while you're in work. */
  offers?: JobOffer[];
}

export interface GameSettings {
  /** Starting money and how patient the board is; on hard it can sack you. Unset = normal. */
  difficulty?: Difficulty;
  /** Let the assistant manager pick tactics for simulated matches. */
  assistantTactics: boolean;
  /** The assistant rests tired players in matches you sim. */
  autoRotate?: boolean;
  /** Testing aid: every player is keen to join the user's club. */
  allInterested?: boolean;
  /** Testing aid: the user's club never runs out of money. */
  unlimitedMoney?: boolean;
  /** Bank balance before unlimited money was switched on, restored when it's switched off. */
  balanceBeforeUnlimited?: number;
}
