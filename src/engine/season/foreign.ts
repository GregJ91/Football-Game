import { CLUB_NAMES, NATIONS, PLAYER_NAMES, type Nation } from '../../data/europe';
import { KIT_COLOURS, clubSuffixes, townNameParts } from '../../data/names';
import { SQUAD_TEMPLATE, generatePlayer } from '../players/generate';
import { Rng } from '../rng';
import { randomAge, stillToGrow } from '../world';
import { developPlayer } from '../players/development';
import type { Club, GameState, Player } from '../types';

/** A made-up club name in the nation's style, plus the town it's named after. */
function foreignName(rng: Rng, nation: Nation): { name: string; town: string } {
  if (nation.style === 'british') {
    const country = nation.country ?? 'eng';
    const { starts, ends } = townNameParts(country);
    const town = rng.pick(starts) + rng.pick(ends);
    return { name: `${town} ${rng.pick(clubSuffixes(country))}`, town };
  }
  const parts = CLUB_NAMES[nation.style];
  const town = rng.pick(parts.towns);
  if (parts.prefixes) return { name: `${rng.pick(parts.prefixes)} ${town}`, town };
  const suffix = rng.pick(parts.suffixes!);
  return { name: suffix.startsWith(' ') ? `${town}${suffix}` : suffix === 'spor' ? `${town}spor` : `${town} ${suffix}`, town };
}

/** The pool of foreign clubs met in Europe; the user's own country is left out. */
export function createForeignClubs(game: GameState, rng: Rng): string[] {
  const used = new Set(Object.values(game.clubs).map((c) => c.name));
  const ids: string[] = [];
  for (const nation of NATIONS) {
    if (nation.country === game.country) continue;
    for (let i = 0; i < nation.clubs; i++) {
      let named = foreignName(rng, nation);
      for (let tries = 0; used.has(named.name) && tries < 50; tries++) named = foreignName(rng, nation);
      used.add(named.name);
      const base = Math.round((nation.top - i * nation.step + rng.normal() * 0.8) * 10) / 10;
      const [primary, secondary] = rng.pick(KIT_COLOURS);
      const club: Club = {
        id: `x${game.nextId++}`,
        name: named.name,
        shortName: named.town.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase(),
        colours: { primary, secondary, pattern: rng.pick(['plain', 'plain', 'stripes', 'hoops', 'halves'] as const) },
        stadiumName: `${named.town} Stadium`,
        capacity: Math.round(Math.max(6000, Math.min(85000, 9000 + (base - 55) * 2600)) / 500) * 500,
        region: 'N',
        reputation: Math.round(base),
        balance: 0,
        isUser: false,
        playerIds: [],
        tactics: {
          formation: rng.pick(['4-4-2', '4-3-3', '4-3-3', '4-2-3-1', '4-2-3-1', '3-5-2'] as const),
          mentality: 'balanced',
          pressing: rng.pick(['low', 'medium', 'medium', 'high'] as const),
        },
        history: [],
        foreign: { nation: nation.code, nationName: nation.name, style: nation.style, strength: base, base },
      };
      game.clubs[club.id] = club;
      ids.push(club.id);
    }
  }
  return ids;
}

/**
 * Set this season's foreign strengths: each club's usual level, moved by
 * `shift` (so Europe keeps pace with the domestic game), plus a swing that
 * changes a little each summer.
 */
export function setForeignStrengths(game: GameState, rng: Rng, shift: number, newSeason: boolean) {
  for (const id of game.europe?.foreignIds ?? []) {
    const f = game.clubs[id].foreign!;
    if (newSeason) f.form = (f.form ?? 0) * 0.6 + rng.normal() * 1.5;
    f.strength = Math.round((f.base + shift + (f.form ?? 0)) * 10) / 10;
    game.clubs[id].reputation = Math.round(f.strength);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One foreign player, named in his club's style. */
function makePlayer(game: GameState, rng: Rng, club: Club, id: string, position: Player['position'], quality: number, age?: number): Player {
  const names = club.foreign!.style === 'british' ? null : PLAYER_NAMES[club.foreign!.style as keyof typeof PLAYER_NAMES];
  const p = generatePlayer(rng, { id, position, quality, clubId: club.id, season: game.season, age });
  if (names) {
    p.firstName = rng.pick(names.first);
    p.lastName = rng.pick(names.last);
  }
  return p;
}

/**
 * A foreign club's squad, made the first time it's needed and kept from then
 * on (it ages and develops each summer like everyone else's).
 */
export function foreignSquad(game: GameState, clubId: string): Player[] {
  const eu = game.europe;
  const club = game.clubs[clubId];
  if (!eu || !club.foreign) return [];
  let ids = eu.squads[clubId];
  if (!ids) {
    const rng = new Rng(hash(`${game.seed}:${clubId}`));
    // Stronger clubs have more stars; the best eleven come out close to the club's strength.
    const strength = club.foreign.strength;
    const stars = strength >= 76 ? 3 : strength >= 70 ? 2 : 1;
    const quality = strength - 1.5 - stars * 0.5;
    const starSlots = new Set(rng.shuffle(SQUAD_TEMPLATE.map((_, i) => i)).slice(0, stars));
    ids = SQUAD_TEMPLATE.map((position, i) => {
      const star = starSlots.has(i);
      const age = star ? rng.int(23, 29) : randomAge(rng);
      const p = makePlayer(game, rng, club, `${clubId}p${i}`, position, star ? quality + 6 + rng.next() * 7 : quality - stillToGrow(age) + rng.normal() * 3, age);
      eu.players[p.id] = p;
      return p.id;
    });
    eu.squads[clubId] = ids;
  }
  return ids.map((id) => eu.players[id]).filter(Boolean);
}

/** Every foreign club has its squad (so their players can be found and bought). */
export function ensureForeignSquads(game: GameState) {
  for (const id of game.europe?.foreignIds ?? []) foreignSquad(game, id);
}

/**
 * Summer for foreign squads: everyone ages and develops, veterans retire and
 * youngsters come through, and contracts roll on.
 */
export function rolloverForeignSquads(game: GameState, rng: Rng) {
  const eu = game.europe;
  if (!eu) return;
  for (const clubId of eu.foreignIds) {
    const club = game.clubs[clubId];
    const ids = eu.squads[clubId];
    if (!ids) continue;
    const keep: string[] = [];
    for (const id of ids) {
      const p = eu.players[id];
      if (!p) continue;
      developPlayer(rng, p);
      p.seasonStats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
      p.fitness = 100;
      p.injuryWeeks = 0;
      if (p.contractEnd <= game.season) p.contractEnd = game.season + rng.int(1, 4);
      if (p.age >= 35 || (p.age >= 33 && rng.chance(0.3))) {
        delete eu.players[id];
        // A youngster from the academy takes his place.
        const young = makePlayer(game, rng, club, `${clubId}y${game.nextId++}`, p.position, club.foreign!.strength - 11 + rng.normal() * 3, rng.int(17, 19));
        eu.players[young.id] = young;
        keep.push(young.id);
      } else keep.push(id);
    }
    // Replace anyone sold to the user, position for position.
    const need = [...SQUAD_TEMPLATE];
    for (const id of keep) {
      const i = need.indexOf(eu.players[id].position);
      if (i >= 0) need.splice(i, 1);
    }
    for (const position of need.slice(0, Math.max(0, SQUAD_TEMPLATE.length - keep.length))) {
      const p = makePlayer(game, rng, club, `${clubId}y${game.nextId++}`, position, club.foreign!.strength - 3 + rng.normal() * 3);
      eu.players[p.id] = p;
      keep.push(p.id);
    }
    eu.squads[clubId] = keep;
  }
}
