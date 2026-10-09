import { COUNTRIES } from '../data/pyramids';
import { KIT_COLOURS, STADIUM_SUFFIXES, clubSuffixes, townNameParts } from '../data/names';
import { SQUAD_TEMPLATE, generatePlayer } from './players/generate';
import { Rng } from './rng';
import { createStadium, syncCapacity } from './club/stadium';
import { setupCups } from './season/cups';
import { scheduleSeason, startOfSeasonBusiness } from './season/season';
import { SCOUT_REPORTS_PER_WEEK, addInbox, maintainFreeAgents } from './transfers/market';
export const START_SEASON = 2026;
export function newId(game, prefix) {
    return `${prefix}${game.nextId++}`;
}
export function withRng(game, fn) {
    const rng = new Rng(game.rngState);
    const out = fn(rng);
    game.rngState = rng.state;
    return out;
}
/** Club-level economics by pyramid level (rough; refined in the chairman phase). */
function levelProfile(country, level) {
    const scale = country === 'eng' ? 1 : 0.45;
    const capacity = [0, 42000, 22000, 11000, 7000, 4000, 2500, 1200][level] ?? 800;
    const balance = [0, 40_000_000, 8_000_000, 2_000_000, 700_000, 300_000, 120_000, 60_000][level] ?? 40_000;
    const reputation = Math.max(5, 92 - level * 11);
    return { capacity: Math.round(capacity * scale), balance: Math.round(balance * scale), reputation };
}
class NameFactory {
    rng;
    country;
    used = new Set();
    constructor(rng, country) {
        this.rng = rng;
        this.country = country;
    }
    town() {
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
    reserve(name) {
        this.used.add(name);
    }
}
function makeShortName(name) {
    return name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}
export function createSquad(game, rng, club, quality) {
    const players = [];
    for (const position of SQUAD_TEMPLATE) {
        const p = generatePlayer(rng, {
            id: newId(game, 'p'),
            position,
            quality: quality + rng.normal() * 3,
            clubId: club.id,
            season: game.season,
        });
        players.push(p);
        game.players[p.id] = p;
        club.playerIds.push(p.id);
    }
    return players;
}
function createClub(game, rng, names, country, def) {
    const town = names.town();
    const name = `${town} ${rng.pick(clubSuffixes(country))}`;
    const [primary, secondary] = rng.pick(KIT_COLOURS);
    const profile = levelProfile(country, def.level);
    const club = {
        id: newId(game, 'c'),
        name,
        shortName: makeShortName(town),
        colours: { primary, secondary, pattern: rng.pick(['plain', 'plain', 'stripes', 'hoops', 'halves']) },
        stadiumName: `${town} ${rng.pick(STADIUM_SUFFIXES)}`,
        capacity: Math.round(profile.capacity * (0.6 + rng.next() * 0.8)),
        region: def.region ?? (rng.chance(0.5) ? 'N' : 'S'),
        reputation: Math.round(profile.reputation + rng.normal() * 4),
        balance: Math.round(profile.balance * (0.5 + rng.next())),
        isUser: false,
        playerIds: [],
        tactics: {
            formation: rng.pick(['4-4-2', '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2']),
            mentality: 'balanced',
            pressing: rng.pick(['low', 'medium', 'medium', 'high']),
        },
        history: [],
    };
    game.clubs[club.id] = club;
    return club;
}
export function createGame(config) {
    const rng = new Rng(config.seed);
    const countryDef = COUNTRIES[config.country];
    const game = {
        version: 1,
        seed: config.seed,
        rngState: 0,
        country: config.country,
        season: START_SEASON,
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
    };
    const names = new NameFactory(rng, config.country);
    names.reserve(config.clubName);
    const maxLevel = Math.max(...countryDef.divisions.map((d) => d.level));
    const bottom = countryDef.divisions.filter((d) => d.level === maxLevel);
    const userDivision = bottom.find((d) => d.region === config.region) ?? bottom[0];
    for (const def of countryDef.divisions) {
        const division = { def, clubIds: [] };
        const slots = def.id === userDivision.id ? def.size - 1 : def.size;
        for (let i = 0; i < slots; i++) {
            const club = createClub(game, rng, names, config.country, def);
            // A spread of strength within each division so tables separate.
            const strength = def.quality + rng.normal() * 3.5;
            club.reputation = Math.round(club.reputation + (strength - def.quality));
            createSquad(game, rng, club, strength);
            division.clubIds.push(club.id);
        }
        if (def.id === userDivision.id) {
            const user = {
                id: newId(game, 'c'),
                name: config.clubName,
                shortName: config.shortName || makeShortName(config.clubName),
                colours: config.colours,
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
            // An average side for the level; climbing is down to the manager.
            createSquad(game, rng, user, def.quality);
            division.clubIds.push(user.id);
        }
        game.divisions.push(division);
    }
    maintainFreeAgents(game, rng);
    game.rngState = rng.state;
    game.scoutReportsLeft = SCOUT_REPORTS_PER_WEEK;
    const user = game.clubs[game.userClubId];
    user.stadium = createStadium();
    syncCapacity(user);
    scheduleSeason(game);
    setupCups(game);
    addInbox(game, 'info', `Welcome to ${config.clubName}. You're chairman and manager. Build the ground, build the squad, and climb. Press Continue to move through the days; matches are on Saturdays.`, { subject: 'Welcome' });
    startOfSeasonBusiness(game);
    return game;
}
export function userClub(game) {
    return game.clubs[game.userClubId];
}
export function divisionOf(game, clubId) {
    const d = game.divisions.find((div) => div.clubIds.includes(clubId));
    if (!d)
        throw new Error(`Club ${clubId} is in no division`);
    return d;
}
export function squadOf(game, clubId) {
    return game.clubs[clubId].playerIds.map((id) => game.players[id]);
}
