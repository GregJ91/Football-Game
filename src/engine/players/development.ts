import type { Rng } from '../rng';
import type { GameState, Player } from '../types';
import { facilitiesOf, trainingBonus, youthIntake } from '../club/facilities';
import { addInbox } from '../transfers/market';
import { divisionOf, domesticClubs, newId } from '../world';
import { SQUAD_TEMPLATE, generatePlayer, makeWonderkid } from './generate';
import { POSITION_WEIGHTS, computeOverall, playerValue } from './ratings';


/** Yearly change towards potential while young, decline from ~28. */
export function developPlayer(rng: Rng, p: Player, trainingBonus = 0) {
  const gap = Math.max(0, p.potential - p.overall);
  let delta: number;
  if (p.age <= 21) delta = gap * 0.35 + rng.normal() * 1.5;
  else if (p.age <= 24) delta = gap * 0.25 + rng.normal() * 1.2;
  else if (p.age <= 27) delta = gap * 0.15 + rng.normal();
  else if (p.age <= 30) delta = -1 + rng.normal();
  else if (p.age <= 32) delta = -2.5 + rng.normal();
  else delta = -4 + rng.normal();
  if (p.age <= 27 && gap > 0) delta += trainingBonus;

  // Attributes are 1–20; a change of 1 overall point is 0.2 of an attribute
  // point, so round stochastically to keep the average change right.
  const keys = POSITION_WEIGHTS[p.position];
  const step = delta / 5;
  for (const key in p.attributes) {
    const k = key as keyof Player['attributes'];
    const isKey = keys[k] !== undefined;
    const target = p.attributes[k] + (isKey ? step + rng.normal() * 0.15 : step * 0.6);
    p.attributes[k] = Math.max(1, Math.min(20, Math.floor(target + rng.next())));
  }
  p.age++;
  p.overall = computeOverall(p);
  p.potential = Math.max(p.potential, p.overall);
  p.value = playerValue(p.overall, p.age, p.potential);
}

function shouldRetire(rng: Rng, p: Player): boolean {
  if (p.age >= 38) return true;
  if (p.age >= 33) return rng.chance((p.age - 32) * 0.2);
  return false;
}

function removePlayer(game: GameState, p: Player) {
  const club = p.clubId ? game.clubs[p.clubId] : null;
  if (club) club.playerIds = club.playerIds.filter((id) => id !== p.id);
  delete game.players[p.id];
}

function sign(game: GameState, rng: Rng, clubId: string, position: Player['position'], quality: number, age?: number) {
  const p = generatePlayer(rng, { id: newId(game, 'p'), position, quality, clubId, season: game.season + 1, age });
  game.players[p.id] = p;
  game.clubs[clubId].playerIds.push(p.id);
  return p;
}

/**
 * Season rollover for every club: development, retirements, youth intake.
 * AI clubs that moved division rebuild part of the squad to suit their new
 * level (a stand-in for the transfer market, which arrives in a later phase).
 */
export function rolloverPlayers(game: GameState, rng: Rng, movedClubIds: Set<string>) {
  for (const club of domesticClubs(game)) {
    const clubId = club.id;
    club.seasonGames = 0;
    const quality = divisionOf(game, clubId).def.quality;
    const squad = club.playerIds.map((id) => game.players[id]);

    const bonus = trainingBonus(club);
    for (const p of squad) {
      developPlayer(rng, p, bonus);
      p.seasonStats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
      p.fitness = 100;
      p.injuryWeeks = 0;
      p.suspendedMatches = 0;
      p.morale = Math.round((p.morale + 70) / 2);
      if (shouldRetire(rng, p)) removePlayer(game, p);
    }

    // Youth intake fills any gaps in the squad shape.
    const current = club.playerIds.map((id) => game.players[id]);
    const need = [...SQUAD_TEMPLATE];
    for (const p of current) {
      const i = need.indexOf(p.position);
      if (i >= 0) need.splice(i, 1);
    }
    // Only while the squad is short (or has no keeper at all).
    for (const position of need) {
      const hasKeeper = club.playerIds.some((id) => game.players[id].position === 'GK');
      if (club.playerIds.length >= 22 && (position !== 'GK' || hasKeeper)) continue;
      sign(game, rng, clubId, position, quality - 13 + rng.normal() * 3, rng.int(16, 19));
    }

    // The user's academy produces its own intake every summer.
    if (club.isUser) {
      const intake = youthIntake(club);
      const names: string[] = [];
      for (let i = 0; i < intake.count; i++) {
        const p = sign(game, rng, clubId, rng.pick(SQUAD_TEMPLATE), quality - 13 + intake.qualityBonus + rng.normal() * 3, rng.int(16, 18));
        p.potential = Math.min(99, p.potential + intake.potentialBonus);
        // A top academy now and then produces a real gem.
        if (i === 0 && rng.chance((facilitiesOf(club).youth - 1) * 0.04)) makeWonderkid(rng, p);
        p.contractEnd = game.season + 3;
        names.push(`${p.firstName} ${p.lastName} (${p.position})`);
      }
      addInbox(game, 'info', `Youth intake: ${names.join(', ')} join from the academy.`, { category: 'training', subject: 'Youth intake' });
    }

    // Now and then a big club's academy produces a wonderkid.
    if (!club.isUser) {
      const level = divisionOf(game, clubId).def.level;
      if (rng.chance(level === 1 ? 0.04 : level === 2 ? 0.015 : 0.003)) {
        makeWonderkid(rng, sign(game, rng, clubId, rng.pick(SQUAD_TEMPLATE), quality - 6 + rng.normal() * 2, rng.int(16, 18)));
      }
    }

    // AI clubs that changed division reshape their squad; the user uses the transfer market.
    if (movedClubIds.has(clubId) && !club.isUser) rebuildForLevel(game, rng, clubId, quality, 4);
  }

  // Free agents age and decline like everyone else.
  for (const p of Object.values(game.players)) {
    if (p.clubId) continue;
    developPlayer(rng, p);
    p.seasonStats = { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
    if (shouldRetire(rng, p)) delete game.players[p.id];
  }
}

/** Swap the weakest players for ones suited to the new division. */
function rebuildForLevel(game: GameState, rng: Rng, clubId: string, quality: number, count: number) {
  const club = game.clubs[clubId];
  const squad = club.playerIds.map((id) => game.players[id]).sort((a, b) => a.overall - b.overall);
  const target = club.isUser ? quality - 3 : quality;
  for (const p of squad.slice(0, count)) {
    if (p.overall >= target) continue;
    removePlayer(game, p);
    sign(game, rng, clubId, p.position, target + rng.normal() * 2, rng.int(21, 29));
  }
}
