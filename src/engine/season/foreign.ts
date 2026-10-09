import { CLUB_NAMES, NATIONS, PLAYER_NAMES, type Nation } from '../../data/europe';
import { KIT_COLOURS, clubSuffixes, townNameParts } from '../../data/names';
import { SQUAD_TEMPLATE, generatePlayer } from '../players/generate';
import { Rng } from '../rng';
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

/**
 * A foreign club's squad, made the first time it's needed this season (the
 * same club always gets the same players within a season).
 */
export function foreignSquad(game: GameState, clubId: string): Player[] {
  const eu = game.europe;
  const club = game.clubs[clubId];
  if (!eu || !club.foreign) return [];
  let ids = eu.squads[clubId];
  if (!ids) {
    const rng = new Rng(hash(`${game.seed}:${clubId}:${game.season}`));
    const names = club.foreign.style === 'british' ? null : PLAYER_NAMES[club.foreign.style as keyof typeof PLAYER_NAMES];
    // The best eleven come out about 1.5 above the quality target.
    const quality = club.foreign.strength - 1.5;
    ids = SQUAD_TEMPLATE.map((position, i) => {
      const p = generatePlayer(rng, { id: `${clubId}p${i}`, position, quality: quality + rng.normal() * 3, clubId, season: game.season });
      if (names) {
        p.firstName = rng.pick(names.first);
        p.lastName = rng.pick(names.last);
      }
      eu.players[p.id] = p;
      return p.id;
    });
    eu.squads[clubId] = ids;
  }
  return ids.map((id) => eu.players[id]);
}
