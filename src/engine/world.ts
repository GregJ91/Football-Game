import { COUNTRIES } from '../data/pyramids';
import { KIT_COLOURS, STADIUM_SUFFIXES, clubSuffixes, townNameParts } from '../data/names';
import { SQUAD_TEMPLATE, generatePlayer, makeWonderkid } from './players/generate';
import { Rng } from './rng';
import { MAX_FACILITY } from './club/facilities';
import { STAND_NAMES, createStadium, syncCapacity } from './club/stadium';
import { setupCups } from './season/cups';
import { setupEurope } from './season/europe';
import { assignRoles } from './players/squad';
import { foreignSquad } from './season/foreign';
import { scheduleSeason, startOfSeasonBusiness } from './season/season';
import { addInbox, maintainFreeAgents } from './transfers/market';
import { hireInitialStaff, scoutReportsPerWeek } from './club/staff';
import type {
  ChallengeId, Club, ClubColours, CountryId, CrestDesign, Difficulty, Division, DivisionDef, GameState, Player, Region,
} from './types';

export const START_SEASON = 2026;

export function newId(game: Pick<GameState, 'nextId'>, prefix: string): string {
  return `${prefix}${game.nextId++}`;
}

export function withRng<T>(game: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(game.rngState);
  const out = fn(rng);
  game.rngState = rng.state;
  return out;
}

export interface NewGameConfig {
  seed: number;
  country: CountryId;
  /** Which bottom-tier division to start in (for split bottom tiers). */
  region: Region;
  clubName: string;
  shortName: string;
  stadiumName: string;
  colours: ClubColours;
  /** Testing aid: start as one of the biggest clubs in the top flight, in the Champions League. */
  topFlight?: boolean;
  /** Starting money and the board's patience; on hard the board can sack you. */
  difficulty?: Difficulty;
  /** Challenge mode (Relegation Battlers is set up separately). */
  challenge?: ChallengeId;
  awayKit?: ClubColours;
  crest?: CrestDesign;
}

/** Club-level economics by pyramid level (rough; refined in the chairman phase). */
function levelProfile(country: CountryId, level: number) {
  const scale = country === 'eng' ? 1 : 0.45;
  const capacity = [0, 42000, 22000, 11000, 7000, 4000, 2500, 1200][level] ?? 800;
  const balance = [0, 40_000_000, 8_000_000, 2_000_000, 700_000, 300_000, 120_000, 60_000][level] ?? 40_000;
  const reputation = Math.max(5, 92 - level * 11);
  return { capacity: Math.round(capacity * scale), balance: Math.round(balance * scale), reputation };
}

class NameFactory {
  private used = new Set<string>();
  constructor(private rng: Rng, private country: CountryId) {}

  town(): string {
    const { starts, ends } = townNameParts(this.country);
    for (let i = 0; i < 500; i++) {
      const t = this.rng.pick(starts) + this.rng.pick(ends);
      if (!this.used.has(t)) {
        this.used.add(t);
        return t;
      }
    }
    // Pools exhausted: fall back to numbered towns rather than loop forever.
    const t = `${this.rng.pick(starts)}${this.rng.pick(ends)} ${this.used.size}`;
    this.used.add(t);
    return t;
  }

  reserve(name: string) {
    this.used.add(name);
  }
}

function makeShortName(name: string): string {
  return name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

/** Squad ages, 17 to 34 (as generatePlayer picks them). */
export function randomAge(rng: Rng): number {
  return Math.max(16, Math.min(37, Math.round(rng.int(17, 34) + rng.normal() * 2)));
}

/**
 * Young players haven't reached their level yet: they start below the squad's
 * quality and grow into it, so the pyramid doesn't fill up with stars.
 */
export function stillToGrow(age: number): number {
  return age <= 19 ? 9 : age <= 22 ? 5 : age <= 26 ? 2 : 0;
}

/**
 * A 22-man squad around `quality`. `stars` players are a class above the
 * rest, in their prime: the ones the club is built around.
 */
export function createSquad(
  game: GameState,
  rng: Rng,
  club: Club,
  quality: number,
  stars = 0,
  maxAge = 99,
  worldClass = 0,
  wonderkids = 0,
): Player[] {
  const players: Player[] = [];
  // Which squad places go to the world-class players, the stars and the wonderkids.
  const order = rng.shuffle(SQUAD_TEMPLATE.map((_, i) => i));
  const kind = new Map<number, 'world' | 'star' | 'kid'>();
  order.slice(0, worldClass).forEach((i) => kind.set(i, 'world'));
  order.slice(worldClass, worldClass + stars).forEach((i) => kind.set(i, 'star'));
  order.slice(worldClass + stars, worldClass + stars + wonderkids).forEach((i) => kind.set(i, 'kid'));
  SQUAD_TEMPLATE.forEach((position, i) => {
    const k = kind.get(i);
    const age = maxAge < 99 ? rng.int(17, maxAge) : k === 'world' ? rng.int(24, 29) : k === 'star' ? rng.int(23, 29) : k === 'kid' ? rng.int(17, 19) : randomAge(rng);
    const target =
      k === 'world' ? Math.min(94, quality + 14 + rng.next() * 5)
        : k === 'star' ? quality + 6 + rng.next() * 7
          : k === 'kid' ? quality - 5 + rng.normal() * 2
            : quality - stillToGrow(age) + rng.normal() * 3;
    const p = generatePlayer(rng, { id: newId(game, 'p'), position, quality: target, age, clubId: club.id, season: game.season });
    if (k === 'kid') makeWonderkid(rng, p);
    players.push(p);
    game.players[p.id] = p;
    club.playerIds.push(p.id);
  });
  return players;
}

function createClub(
  game: GameState,
  rng: Rng,
  names: NameFactory,
  country: CountryId,
  def: DivisionDef,
): Club {
  const town = names.town();
  const name = `${town} ${rng.pick(clubSuffixes(country))}`;
  const [primary, secondary] = rng.pick(KIT_COLOURS);
  const profile = levelProfile(country, def.level);
  const club: Club = {
    id: newId(game, 'c'),
    name,
    shortName: makeShortName(town),
    colours: { primary, secondary, pattern: rng.pick(['plain', 'plain', 'stripes', 'hoops', 'halves'] as const) },
    stadiumName: `${town} ${rng.pick(STADIUM_SUFFIXES)}`,
    capacity: Math.round(profile.capacity * (0.6 + rng.next() * 0.8)),
    region: def.region ?? (rng.chance(0.5) ? 'N' : 'S'),
    reputation: Math.round(profile.reputation + rng.normal() * 4),
    balance: Math.round(profile.balance * (0.5 + rng.next())),
    isUser: false,
    playerIds: [],
    tactics: {
      formation: rng.pick(['4-4-2', '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'] as const),
      mentality: 'balanced',
      pressing: rng.pick(['low', 'medium', 'medium', 'high'] as const),
    },
    history: [],
  };
  game.clubs[club.id] = club;
  return club;
}

/**
 * Testing aid: the user's club as a top-flight giant, with a title-winning
 * squad, a big all-seater ground, top facilities and the most reputation in
 * the league (so it takes a Champions League place).
 */
function makeGiant(game: GameState, rng: Rng, user: Club, def: DivisionDef) {
  const eng = game.country === 'eng';
  createSquad(game, rng, user, def.quality + 6, 3, 99, 2, 1);
  const stands = eng ? [16000, 12000, 12000, 12000] : [14000, 10000, 10000, 10000];
  user.stadium = {
    stands: STAND_NAMES.map((name, i) => ({ name, capacity: stands[i], seats: stands[i], roof: true })),
    floodlights: true,
    builds: [],
  };
  user.facilities = { training: MAX_FACILITY, youth: MAX_FACILITY, medical: MAX_FACILITY };
  user.balance = eng ? 60_000_000 : 20_000_000;
  user.reputation = 95;
}

export function createGame(config: NewGameConfig): GameState {
  const rng = new Rng(config.seed);
  const countryDef = COUNTRIES[config.country];
  const game: GameState = {
    version: 1,
    seed: config.seed,
    rngState: 0,
    country: config.country,
    season: START_SEASON,
    startSeason: START_SEASON,
    week: 0,
    totalWeeks: 0,
    userClubId: '',
    clubs: {},
    players: {},
    divisions: [],
    fixtures: [],
    lastSummary: null,
    phase: 'season',
    nextId: 1,
    day: 1,
    half: 'am',
    // Avoid the Sack is hard mode, always.
    settings: { assistantTactics: false, difficulty: config.challenge === 'sack' ? 'hard' : config.difficulty ?? 'normal' },
    challenge: config.challenge ? { id: config.challenge, status: 'active', startSeason: START_SEASON } : undefined,
  };
  const names = new NameFactory(rng, config.country);
  names.reserve(config.clubName);

  const maxLevel = Math.max(...countryDef.divisions.map((d) => d.level));
  const bottom = countryDef.divisions.filter((d) => d.level === maxLevel);
  const userDivision = config.topFlight
    ? countryDef.divisions.find((d) => d.level === 1)!
    : bottom.find((d) => d.region === config.region) ?? bottom[0];

  for (const def of countryDef.divisions) {
    const division: Division = { def, clubIds: [] };
    const slots = def.id === userDivision.id ? def.size - 1 : def.size;
    for (let i = 0; i < slots; i++) {
      const club = createClub(game, rng, names, config.country, def);
      // A spread of strength within each division so tables separate.
      const strength = def.quality + rng.normal() * 3.5;
      club.reputation = Math.round(club.reputation + (strength - def.quality));
      // Top-flight clubs have stars, more at the bigger clubs; elsewhere the odd standout.
      const edge = strength - def.quality;
      const stars = def.level === 1 ? (edge > 3 ? 3 : edge > 0 ? 2 : 1) : rng.chance(0.4) ? 1 : 0;
      // The biggest clubs have a world-class player; wonderkids are mostly at the top.
      const worldClass = def.level === 1 && edge > 3 ? 1 : 0;
      const kids = rng.chance(def.level === 1 ? 0.35 : def.level === 2 ? 0.15 : 0.03) ? 1 : 0;
      createSquad(game, rng, club, strength, stars, 99, worldClass, kids);
      division.clubIds.push(club.id);
    }
    if (def.id === userDivision.id) {
      const user: Club = {
        id: newId(game, 'c'),
        name: config.clubName,
        shortName: config.shortName || makeShortName(config.clubName),
        colours: config.colours,
        awayKit: config.awayKit,
        crest: config.crest,
        stadiumName: config.stadiumName,
        capacity: 500,
        region: userDivision.region ?? config.region,
        reputation: levelProfile(config.country, def.level).reputation - 4,
        balance: 50_000,
        isUser: true,
        playerIds: [],
        tactics: { formation: '4-4-2', mentality: 'balanced', pressing: 'medium' },
        history: [],
      };
      game.clubs[user.id] = user;
      game.userClubId = user.id;
      if (config.topFlight) makeGiant(game, rng, user, def);
      // Kids: a squad of under-22s, a little stronger than their age suggests.
      else if (config.challenge === 'kids') createSquad(game, rng, user, def.quality + 4, 0, 21);
      // An average side for the level; climbing is down to the manager.
      else createSquad(game, rng, user, def.quality);
      division.clubIds.push(user.id);
    }
    game.divisions.push(division);
  }

  maintainFreeAgents(game, rng);
  game.rngState = rng.state;
  hireInitialStaff(game, game.clubs[game.userClubId]);
  game.scoutReportsLeft = scoutReportsPerWeek(game.clubs[game.userClubId]);
  const user = game.clubs[game.userClubId];
  // Difficulty: more or less money to start with, and a more or less patient board.
  const difficulty = game.settings!.difficulty!;
  user.balance = Math.round(user.balance * { easy: 2.5, normal: 1, hard: 0.5 }[difficulty]);
  user.board = { confidence: { easy: 70, normal: 60, hard: 50 }[difficulty], fans: 60 };
  user.stadium ??= createStadium();
  syncCapacity(user);
  scheduleSeason(game);
  setupEurope(game);
  setupCups(game);
  addInbox(game, 'info', `Welcome to ${config.clubName}. You're chairman and manager. Build the ground, build the squad, and climb. Press Continue to move through the days; matches are on Saturdays.`, { subject: 'Welcome' });
  assignRoles(game, user);
  startOfSeasonBusiness(game);
  return game;
}

export function userClub(game: GameState): Club {
  return game.clubs[game.userClubId];
}

export function divisionOf(game: GameState, clubId: string): Division {
  const d = game.divisions.find((div) => div.clubIds.includes(clubId));
  if (!d) throw new Error(`Club ${clubId} is in no division`);
  return d;
}

/** Where a club plays: its division, or its country for a club abroad. */
export function leagueNameOf(game: GameState, clubId: string): string {
  const club = game.clubs[clubId];
  return club.foreign ? club.foreign.nationName : divisionOf(game, clubId).def.name;
}

export function squadOf(game: GameState, clubId: string): Player[] {
  const club = game.clubs[clubId];
  if (club.foreign) return foreignSquad(game, clubId);
  return club.playerIds.map((id) => game.players[id]);
}

/** Clubs in the pyramid (foreign clubs met in Europe are left out). */
export function domesticClubs(game: GameState): Club[] {
  return Object.values(game.clubs).filter((c) => !c.foreign);
}

/** Any player, including those in foreign squads. */
export function playerById(game: GameState, id: string): Player | undefined {
  return game.players[id] ?? game.europe?.players[id];
}
