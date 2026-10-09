import { ledgerOf } from '../economy/finance';
import type { Build, Club, CountryId, GameState, Stadium, StadiumWork } from '../types';
import { divisionOf } from '../world';
import { FOOD_LEVELS, VIP_LEVELS, commercialBusy, commercialUpgrade, costScale, type Commercial } from './matchday';

export const STAND_NAMES = ['Main Stand', 'North End', 'East Terrace', 'South End'];
export const MAX_STAND = 20_000;
export const EXTEND_SIZES = [250, 1000, 5000];

export function createStadium(): Stadium {
  return {
    stands: [
      { name: STAND_NAMES[0], capacity: 200, seats: 60, roof: true },
      { name: STAND_NAMES[1], capacity: 100, seats: 0, roof: false },
      { name: STAND_NAMES[2], capacity: 100, seats: 0, roof: false },
      { name: STAND_NAMES[3], capacity: 100, seats: 0, roof: false },
    ],
    floodlights: false,
    builds: [],
  };
}

export function stadiumOf(club: Club): Stadium {
  club.stadium ??= createStadium();
  return club.stadium;
}

function standUnderWork(stadium: Stadium, i: number) {
  return stadium.builds.some((b) => b.stand === i && b.stand !== undefined);
}

/** Stand and floodlight work (food and VIP have their own builders). */
function isGroundWork(b: Build) {
  return b.kind !== 'facility' && b.kind !== 'food' && b.kind !== 'vip';
}

/** Usable capacity: a stand being worked on holds half its fans. */
export function effectiveCapacity(stadium: Stadium): number {
  return stadium.stands.reduce((n, s, i) => n + (standUnderWork(stadium, i) ? Math.round(s.capacity / 2) : s.capacity), 0);
}

export function totalCapacity(stadium: Stadium) {
  return stadium.stands.reduce((n, s) => n + s.capacity, 0);
}

export function totalSeats(stadium: Stadium) {
  return stadium.stands.reduce((n, s) => n + s.seats, 0);
}

export function roofedShare(stadium: Stadium) {
  const cap = totalCapacity(stadium);
  return cap ? stadium.stands.reduce((n, s) => n + (s.roof ? s.capacity : 0), 0) / cap : 0;
}

export function syncCapacity(club: Club) {
  if (club.stadium) club.capacity = effectiveCapacity(club.stadium);
}

// ---------------------------------------------------------------- grading

export interface GroundRule {
  capacity: number;
  seats: number;
  floodlights: boolean;
}

/** Minimum ground needed to play at each level (simplified real rules). */
const GRADING: Record<CountryId, Record<number, GroundRule>> = {
  eng: {
    1: { capacity: 20_000, seats: 20_000, floodlights: true },
    2: { capacity: 10_000, seats: 10_000, floodlights: true },
    3: { capacity: 7_500, seats: 2_000, floodlights: true },
    4: { capacity: 5_000, seats: 1_000, floodlights: true },
    5: { capacity: 4_000, seats: 500, floodlights: true },
    6: { capacity: 1_300, seats: 250, floodlights: true },
  },
  sco: {
    1: { capacity: 6_000, seats: 2_000, floodlights: true },
    2: { capacity: 3_000, seats: 500, floodlights: true },
    3: { capacity: 2_000, seats: 300, floodlights: true },
    4: { capacity: 1_000, seats: 100, floodlights: true },
  },
};

export function groundRule(country: CountryId, level: number): GroundRule | null {
  return GRADING[country][level] ?? null;
}

export interface GradingCheck {
  level: number;
  ok: boolean;
  items: { label: string; have: string; need: string; ok: boolean }[];
}

/** Does the user's ground meet the rules for `level`? (Finished stands only.) */
export function checkGrading(game: GameState, club: Club, level: number): GradingCheck | null {
  const rule = groundRule(game.country, level);
  if (!rule) return null;
  const s = stadiumOf(club);
  const cap = totalCapacity(s);
  const seats = totalSeats(s);
  const items = [
    { label: 'Capacity', have: cap.toLocaleString('en-GB'), need: rule.capacity.toLocaleString('en-GB'), ok: cap >= rule.capacity },
    { label: 'Seats', have: seats.toLocaleString('en-GB'), need: rule.seats.toLocaleString('en-GB'), ok: seats >= rule.seats },
    { label: 'Floodlights', have: s.floodlights ? 'Yes' : 'No', need: rule.floodlights ? 'Yes' : 'No', ok: s.floodlights || !rule.floodlights },
  ];
  return { level, ok: items.every((i) => i.ok), items };
}

/** The grading check for the level above the user's current one. */
export function nextLevelGrading(game: GameState): GradingCheck | null {
  const club = game.clubs[game.userClubId];
  const level = divisionOf(game, club.id).def.level;
  return level > 1 ? checkGrading(game, club, level - 1) : null;
}

// ---------------------------------------------------------------- building

export interface WorkOption {
  kind: StadiumWork;
  stand?: number;
  size?: number;
  label: string;
  /** What the work does for the club. */
  about: string;
  cost: number;
  weeks: number;
  /** Extra weekly running cost once it's built. */
  upkeep: number;
}

// ---------------------------------------------------------------- running costs

/** Weekly upkeep per terrace place, per seat, per roofed place, and for floodlights (£). */
const UPKEEP = { place: 0.04, seat: 0.02, roof: 0.02, floodlights: 40 };

/** Weekly cost of keeping the ground itself in order (stewarding, repairs, pitch, power). */
export function groundUpkeep(game: GameState, club: Club): number {
  const s = stadiumOf(club);
  const k = costScale(game.country);
  const roofed = s.stands.reduce((n, x) => n + (x.roof ? x.capacity : 0), 0);
  return Math.round((totalCapacity(s) * UPKEEP.place + totalSeats(s) * UPKEEP.seat + roofed * UPKEEP.roof + (s.floodlights ? UPKEEP.floodlights : 0)) * k);
}

/** Start building the next level of food outlets or hospitality. */
export function startCommercialWork(game: GameState, club: Club, kind: Commercial): string | null {
  const opt = commercialUpgrade(game, club, kind);
  if (!opt) return 'Already at the top level.';
  if (opt.blocked) return opt.blocked;
  if (commercialBusy(club)) return 'Already building food or hospitality. One at a time.';
  const problem = cannotBuild(club, opt.cost);
  if (problem) return problem;
  stadiumOf(club).builds.push({ kind, level: opt.level, weeksLeft: opt.weeks, totalWeeks: opt.weeks, cost: opt.cost });
  club.balance -= opt.cost;
  const l = ledgerOf(club);
  l.building = (l.building ?? 0) + opt.cost;
  return null;
}

/**
 * Building costs: non-league builders and second-hand floodlights are much
 * cheaper, so a small club can afford to get its ground up to grade.
 */
function buildScale(game: GameState): number {
  const level = divisionOf(game, game.userClubId).def.level;
  const bottom = Math.max(...game.divisions.map((d) => d.def.level));
  return costScale(game.country) * ([0.45, 0.6, 0.8][bottom - level] ?? 1);
}

/** What can be done to a stand right now. */
export function standOptions(game: GameState, club: Club, i: number): WorkOption[] {
  const s = stadiumOf(club).stands[i];
  const k = buildScale(game);
  const opts: WorkOption[] = [];
  for (const size of EXTEND_SIZES) {
    if (s.capacity + size > MAX_STAND) continue;
    const perPlace = 60 * (1 + s.capacity / 5000);
    opts.push({
      kind: 'extend',
      stand: i,
      size,
      label: `Extend by ${size.toLocaleString('en-GB')} (terracing)`,
      about: `Room for ${size.toLocaleString('en-GB')} more standing fans: bigger crowds and gates, and counts towards the ground rules.`,
      cost: Math.round(size * perPlace * k),
      weeks: Math.min(20, 3 + Math.round(size / 400)),
      upkeep: Math.round(size * UPKEEP.place * k),
    });
  }
  const terrace = s.capacity - s.seats;
  if (terrace > 0) {
    opts.push({
      kind: 'seats',
      stand: i,
      label: `Seat the whole stand (+${terrace.toLocaleString('en-GB')} seats)`,
      about: 'Seats sell for a quarter more than terracing, and higher leagues require a number of seats.',
      cost: Math.round(terrace * 90 * (1 + s.capacity / 10000) * k),
      weeks: Math.min(12, 2 + Math.round(terrace / 800)),
      upkeep: Math.round(terrace * UPKEEP.seat * k),
    });
  }
  if (!s.roof) {
    opts.push({
      kind: 'roof',
      stand: i,
      label: 'Add a roof',
      about: 'Keeps the fans dry: crowds hold up better in bad weather.',
      cost: Math.round(Math.max(5000, s.capacity * 40) * k),
      weeks: Math.min(10, 3 + Math.round(s.capacity / 2000)),
      upkeep: Math.round(s.capacity * UPKEEP.roof * k),
    });
  }
  return opts;
}

export function floodlightOption(game: GameState): WorkOption {
  return {
    kind: 'floodlights',
    label: 'Install floodlights',
    about: 'Needed to play at the level above, and for evening kick-offs.',
    cost: Math.round(40_000 * buildScale(game)),
    weeks: 4,
    upkeep: Math.round(UPKEEP.floodlights * costScale(game.country)),
  };
}

export function stadiumBusy(club: Club): boolean {
  return stadiumOf(club).builds.some(isGroundWork);
}

export function cannotBuild(club: Club, cost: number): string | null {
  if (cost > Math.max(0, club.balance)) return "The club can't afford it. Take out a loan or wait for more money to come in.";
  return null;
}

export function startStadiumWork(club: Club, opt: WorkOption): string | null {
  if (stadiumBusy(club)) return 'Builders are already working on the ground. One project at a time.';
  const problem = cannotBuild(club, opt.cost);
  if (problem) return problem;
  const build: Build = { kind: opt.kind, stand: opt.stand, size: opt.size, weeksLeft: opt.weeks, totalWeeks: opt.weeks, cost: opt.cost };
  stadiumOf(club).builds.push(build);
  club.balance -= opt.cost;
  const l = ledgerOf(club);
  l.building = (l.building ?? 0) + opt.cost;
  syncCapacity(club);
  return null;
}

/** Apply a finished stadium job. Returns a line for the inbox. */
export function completeStadiumWork(club: Club, b: Build): string {
  const s = stadiumOf(club);
  const stand = b.stand !== undefined ? s.stands[b.stand] : null;
  switch (b.kind) {
    case 'extend':
      stand!.capacity += b.size!;
      return `The ${stand!.name} extension is finished: room for ${b.size!.toLocaleString('en-GB')} more fans.`;
    case 'seats':
      stand!.seats = stand!.capacity;
      return `The ${stand!.name} is now all-seater.`;
    case 'roof':
      stand!.roof = true;
      return `The ${stand!.name} has its new roof.`;
    case 'floodlights':
      s.floodlights = true;
      return 'The floodlights are switched on for the first time.';
    case 'food':
      s.food = b.level;
      return `New food and drink outlets are open: ${FOOD_LEVELS[b.level!].name.toLowerCase()}.`;
    case 'vip':
      s.vip = b.level;
      return `The ${VIP_LEVELS[b.level!].name.toLowerCase()} is open for business.`;
    default:
      return '';
  }
}
