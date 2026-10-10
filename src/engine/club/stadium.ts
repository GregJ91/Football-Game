import { ledgerOf } from '../economy/finance';
import { REAL_STADIUMS } from '../../data/realStadiums';
import type { Build, Club, CountryId, GameState, Stadium, StadiumWork, Stand } from '../types';
import { divisionOf } from '../world';
import { CORPORATE_LEVELS, FOOD_LEVELS, VIP_LEVELS, commercialBusy, commercialUpgrade, costScale, type Commercial } from './matchday';

export const STAND_NAMES = ['Main Stand', 'North End', 'East Terrace', 'South End'];
/** Corners, clockwise from the north-west: they join the sides into a bowl. */
export const CORNER_NAMES = ['North-West Corner', 'North-East Corner', 'South-East Corner', 'South-West Corner'];
/** Biggest a side stand and a corner can be: 4 × 30,000 + 4 × 7,500 = 150,000. */
export const MAX_STAND = 30_000;
export const MAX_CORNER = 7_500;
export const MAX_GROUND = 4 * MAX_STAND + 4 * MAX_CORNER;
const SIDE_SIZES = [250, 1000, 5000];
const CORNER_SIZES = [250, 1000, 2500];

const corners = () => CORNER_NAMES.map((name) => ({ name, capacity: 0, seats: 0, roof: false, corner: true }));

/**
 * A new club at the bottom of the pyramid, as in real life: no stadium,
 * just a pitch with a rail round it, hard standing and a clubhouse.
 */
export function createStadium(): Stadium {
  return {
    stands: [
      { name: STAND_NAMES[0], capacity: 200, seats: 0, roof: false, open: true },
      { name: STAND_NAMES[1], capacity: 100, seats: 0, roof: false, open: true },
      { name: STAND_NAMES[2], capacity: 100, seats: 0, roof: false, open: true },
      { name: STAND_NAMES[3], capacity: 100, seats: 0, roof: false, open: true },
      ...corners(),
    ],
    floodlights: false,
    builds: [],
  };
}

/** What a side is called: before stands are built it's the clubhouse side and the east side. */
export function standLabel(stand: { name: string; open?: boolean }): string {
  if (!stand.open) return stand.name;
  return stand.name === STAND_NAMES[0] ? 'Clubhouse side' : stand.name === STAND_NAMES[2] ? 'East Side' : stand.name;
}

/** How built-up grounds are at a level, roughly as in real life. */
export type GroundTier = 'top' | 'league' | 'nonleague' | 'grassroots';

export function groundTier(country: CountryId, level: number): GroundTier {
  if (country === 'eng') return level <= 2 ? 'top' : level <= 4 ? 'league' : level <= 6 ? 'nonleague' : 'grassroots';
  return level <= 2 ? 'league' : level <= 4 ? 'nonleague' : 'grassroots';
}

/**
 * A realistic ground for a club at this level: Premier League and
 * Championship grounds are all-seater bowls; Football League grounds have
 * four seated, covered stands; non-league grounds have a small main stand,
 * covered terraces and an open end; the bottom is a pitch with a rail.
 */
export function groundFor(country: CountryId, level: number, capacity: number, stadiumName?: string): Stadium {
  const rule = groundRule(country, level);
  const cap = Math.max(capacity, rule?.capacity ?? 0, 400);
  const tier = groundTier(country, level);
  const real = stadiumName ? REAL_STADIUMS[stadiumName] : undefined;
  // A real ground keeps its real size, even if it is below the usual rules for its level.
  const s = real ? realGround(real, Math.max(capacity, 400)) : layoutGround(country, level, cap, tier);
  s.floodlights = tier !== 'grassroots' || !!rule?.floodlights;
  s.heating = tier === 'top' || (tier === 'league' && (country === 'sco' ? level === 1 : level === 3));
  s.food = { top: 4, league: 3, nonleague: 1, grassroots: 0 }[tier];
  s.vip = { top: 4, league: 2, nonleague: 1, grassroots: 0 }[tier];
  s.corporate = { top: 3, league: 1, nonleague: 0, grassroots: 0 }[tier];
  return s;
}

/** A real ground from its stand-by-stand data, scaled to its real capacity. */
function realGround(data: string, cap: number): Stadium {
  const s = createStadium();
  const [sidePart, cornerPart] = data.split('#');
  const parse = (x: string) => {
    const [name, size, flags = ''] = x.split(':');
    return { name, size: Number(size), flags };
  };
  const sides = sidePart.split('|').map(parse);
  const sideTotal = sides.reduce((n, x) => n + x.size, 0);
  const corners =
    cornerPart === 'bowl'
      ? CORNER_NAMES.map((name) => ({ name, size: sideTotal * 0.035, flags: '' }))
      : cornerPart
        ? cornerPart.split('|').map(parse)
        : [];
  const total = sideTotal + corners.reduce((n, x) => n + x.size, 0);
  const place = (stand: Stand, d: { name: string; size: number; flags: string }, max: number) => {
    const open = d.flags.includes('o');
    const capacity = Math.min(max, Math.round((d.size / total) * cap));
    Object.assign(stand, {
      name: d.name,
      capacity,
      seats: open || d.flags.includes('t') ? 0 : capacity,
      roof: !open && !d.flags.includes('u'),
      open: open || undefined,
    });
  };
  const sideStands = s.stands.filter((x) => !x.corner);
  sides.forEach((d, i) => place(sideStands[i], d, MAX_STAND));
  const cornerStands = s.stands.filter((x) => x.corner);
  corners.forEach((d, i) => place(cornerStands[i], d, MAX_CORNER));
  return s;
}

/** A ground laid out from its capacity and level, for grounds with no stand data. */
function layoutGround(country: CountryId, level: number, cap: number, tier: GroundTier): Stadium {
  const rule = groundRule(country, level);
  const s = createStadium();
  const st = s.stands;
  const sides = st.filter((x) => !x.corner);
  const cornerShare = tier === 'top' ? 0.14 : 0;
  const cornerCap = Math.min(MAX_CORNER, Math.round((cap * cornerShare) / 4));
  const sideCaps = [0.31, 0.23, 0.23, 0.23].map((f) => Math.min(MAX_STAND, Math.round((cap - cornerCap * 4) * f)));
  sides.forEach((x, i) => {
    x.capacity = sideCaps[i];
    x.open = tier === 'grassroots';
    x.roof = tier !== 'grassroots';
  });
  if (cornerCap) for (const c of st.filter((x) => x.corner)) Object.assign(c, { capacity: cornerCap, seats: cornerCap, roof: true });
  if (tier === 'nonleague') {
    // One end is still open hard standing at the lower non-league levels.
    const lower = (country === 'eng' && level >= 6) || (country === 'sco' && level >= 4);
    if (lower) Object.assign(sides[3], { open: true, roof: false });
  }
  // Seats: all-seater at the top, mostly seated in the league, a seated main stand below.
  const total = st.reduce((n, x) => n + x.capacity, 0);
  let seats = tier === 'top' ? total : tier === 'league' ? Math.max(rule?.seats ?? 0, Math.round(total * 0.75)) : tier === 'nonleague' ? Math.max(rule?.seats ?? 0, Math.round(sides[0].capacity * 0.7)) : 0;
  for (const x of [...sides, ...st.filter((c) => c.corner)]) {
    const n = x.open ? 0 : Math.min(x.capacity, seats);
    x.seats = Math.max(x.seats, n);
    seats -= n;
  }
  return s;
}

export function stadiumOf(club: Club): Stadium {
  club.stadium ??= createStadium();
  // Grounds from before corners: four empty corners to build on.
  if (club.stadium.stands.length === 4) club.stadium.stands.push(...corners());
  return club.stadium;
}

function standUnderWork(stadium: Stadium, i: number) {
  return stadium.builds.some((b) => b.stand === i && b.stand !== undefined);
}

/** Stand and floodlight work (food and VIP have their own builders). */
function isGroundWork(b: Build) {
  return b.kind !== 'facility' && b.kind !== 'food' && b.kind !== 'vip' && b.kind !== 'corporate' && b.kind !== 'tg';
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
const UPKEEP = { place: 0.04, seat: 0.02, roof: 0.02, floodlights: 40, heating: 120 };

/** Weekly cost of keeping the ground itself in order (stewarding, repairs, pitch, power). */
export function groundUpkeep(game: GameState, club: Club): number {
  const s = stadiumOf(club);
  const k = costScale(game.country);
  const roofed = s.stands.reduce((n, x) => n + (x.roof ? x.capacity : 0), 0);
  return Math.round((totalCapacity(s) * UPKEEP.place + totalSeats(s) * UPKEEP.seat + roofed * UPKEEP.roof + (s.floodlights ? UPKEEP.floodlights : 0) + (s.heating ? UPKEEP.heating : 0)) * k);
}

/** Start building the next level of food outlets or hospitality. */
export function startCommercialWork(game: GameState, club: Club, kind: Commercial): string | null {
  const opt = commercialUpgrade(game, club, kind);
  if (!opt) return 'Already at the top level.';
  if (opt.blocked) return opt.blocked;
  if (commercialBusy(club, kind)) return `The ${kind === 'food' ? 'food outlets are' : kind === 'vip' ? 'hospitality is' : 'corporate rooms are'} already being built.`;
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
export function buildScale(game: GameState): number {
  const level = divisionOf(game, game.userClubId).def.level;
  const bottom = Math.max(...game.divisions.map((d) => d.def.level));
  return costScale(game.country) * ([0.45, 0.6, 0.8][bottom - level] ?? 1);
}

/** What can be done to a stand right now. */
export function standOptions(game: GameState, club: Club, i: number): WorkOption[] {
  const s = stadiumOf(club).stands[i];
  const k = buildScale(game);
  const opts: WorkOption[] = [];
  const max = s.corner ? MAX_CORNER : MAX_STAND;
  // New places are always seats.
  for (const size of s.corner ? CORNER_SIZES : SIDE_SIZES) {
    if (s.capacity + size > max) continue;
    const perSeat = 60 * (1 + s.capacity / 5000) + 45 * (1 + s.capacity / 10000);
    const fresh = s.capacity === 0 || !!s.open;
    opts.push({
      kind: 'extend',
      stand: i,
      size,
      label: fresh ? `Build a ${size.toLocaleString('en-GB')}-seat ${s.corner ? 'corner' : 'stand'}` : `Extend by ${size.toLocaleString('en-GB')} seats`,
      about: `${size.toLocaleString('en-GB')} more seated places: bigger crowds and gates (seats sell for more than terracing), and it counts towards the ground rules.${s.corner ? ' Corners join the sides into a bowl.' : ''}`,
      cost: Math.round(size * perSeat * k),
      weeks: Math.min(24, 3 + Math.round(size / 400)),
      upkeep: Math.round(size * (UPKEEP.place + UPKEEP.seat) * k),
    });
  }
  const terrace = s.capacity - s.seats;
  if (terrace > 0 && !s.open) {
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
  if (!s.roof && s.capacity > 0) {
    opts.push({
      kind: 'roof',
      stand: i,
      label: s.open ? 'Put up a covered terrace' : 'Add a roof',
      about: s.open
        ? 'A simple covered standing area behind the rail: the first step from a pitch to a ground. Keeps the fans dry.'
        : 'Keeps the fans dry: crowds hold up better in bad weather.',
      cost: Math.round(Math.max(5000, s.capacity * 40) * k),
      weeks: Math.min(10, 3 + Math.round(s.capacity / 2000)),
      upkeep: Math.round(s.capacity * UPKEEP.roof * k),
    });
  }
  return opts;
}

/** Whole-ground jobs: the full roof and undersoil heating. */
export function groundOptions(game: GameState, club: Club): WorkOption[] {
  const s = stadiumOf(club);
  const k = buildScale(game);
  const opts: WorkOption[] = [];
  const open = s.stands.filter((x) => x.capacity > 0 && !x.roof);
  if (!s.fullRoof) {
    const cost = open.reduce((n, x) => n + Math.max(5000, x.capacity * 40), 0) * 0.85 + 20_000;
    opts.push({
      kind: 'fullRoof',
      label: 'Full roof',
      about: `Cover the whole ground in one go, about 15% cheaper than stand by stand${open.length ? ` (${open.length} stand${open.length === 1 ? '' : 's'} still open)` : ''}. Every stand built later comes with a roof. Fans love it, and crowds hold up in any weather.`,
      cost: Math.round(cost * k),
      weeks: Math.min(20, 6 + open.length * 2),
      upkeep: Math.round(open.reduce((n, x) => n + x.capacity, 0) * UPKEEP.roof * k),
    });
  }
  if (!s.heating) {
    opts.push({
      kind: 'heating',
      label: 'Undersoil heating',
      about: 'A pitch that stays playable all winter: fewer injuries on a frozen, rutted surface, and the fans notice the difference.',
      cost: Math.round(150_000 * k),
      weeks: 6,
      upkeep: Math.round(UPKEEP.heating * costScale(game.country)),
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

/** Builders already on this stand, or on this whole-ground job. Other jobs can run alongside. */
export function standBusy(club: Club, stand?: number, kind?: StadiumWork): boolean {
  return stadiumOf(club).builds.some((b) => isGroundWork(b) && (stand === undefined ? b.kind === (kind ?? 'floodlights') : b.stand === stand));
}

export function cannotBuild(club: Club, cost: number): string | null {
  if (cost > Math.max(0, club.balance)) return "The club can't afford it. Take out a loan or wait for more money to come in.";
  return null;
}

export function startStadiumWork(club: Club, opt: WorkOption): string | null {
  if (standBusy(club, opt.stand, opt.kind)) return opt.stand === undefined ? `Work on the ${opt.label.toLowerCase()} is already under way.` : 'Builders are already working on that stand. Pick another stand, or wait for this job to finish.';
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
    case 'extend': {
      const fresh = stand!.capacity === 0 || !!stand!.open;
      stand!.open = false;
      stand!.capacity += b.size!;
      stand!.seats += b.size!;
      if (s.fullRoof) stand!.roof = true;
      return fresh
        ? `The new ${stand!.name} is open: ${b.size!.toLocaleString('en-GB')} seats.`
        : `The ${stand!.name} extension is finished: ${b.size!.toLocaleString('en-GB')} more seats.`;
    }
    case 'fullRoof':
      s.fullRoof = true;
      for (const x of s.stands) if (x.capacity > 0) x.roof = true;
      return 'The full roof is finished: the whole ground is covered.';
    case 'heating':
      s.heating = true;
      return 'Undersoil heating is in: the pitch will be playable all winter.';
    case 'corporate':
      s.corporate = b.level;
      return `The ${CORPORATE_LEVELS[b.level!].name.toLowerCase()} is open for business.`;
    case 'seats':
      stand!.seats = stand!.capacity;
      return `The ${stand!.name} is now all-seater.`;
    case 'roof': {
      const open = stand!.open;
      stand!.roof = true;
      stand!.open = false;
      return open ? `The ${stand!.name} has a covered terrace at last.` : `The ${stand!.name} has its new roof.`;
    }
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
