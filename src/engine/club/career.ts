import { setBoardBudgets } from '../economy/finance';
import { hireInitialStaff } from './staff';
import { assignRoles } from '../players/squad';
import type { Rng } from '../rng';
import { startNextSeason, playWeek } from '../season/season';
import { divisionTable } from '../season/table';
import type { CareerSpell, Club, GameState, JobOffer } from '../types';
import { addInbox } from '../transfers/market';
import { divisionOf, withRng } from '../world';
import { boardOf, difficultyOf, makeSponsorOffers, setSeasonTarget } from './chairman';
import { loseChallenge } from './challenge';
import { MAX_FACILITY } from './facilities';
import { MAX_STAND, STAND_NAMES, groundRule, syncCapacity } from './stadium';

/** Offers stay open this many weeks. */
const OFFER_WEEKS = 4;
const MAX_OFFERS = 3;

const absWeek = (game: GameState) => game.season * 100 + game.week;

/** The clubs you've managed (started lazily for older saves). */
export function careerOf(game: GameState): CareerSpell[] {
  game.career ??= [{ clubId: game.userClubId, clubName: game.clubs[game.userClubId].name, from: game.startSeason ?? game.season }];
  return game.career;
}

/** Trophies won while you were in charge of a club. */
export function spellTrophies(game: GameState, spell: CareerSpell) {
  const last = spell.to ?? game.season;
  return (game.clubs[spell.clubId].trophies ?? []).filter((t) => t.season >= spell.from && t.season <= last);
}

/**
 * The board sacks you. The club gets an AI manager, the world plays on, and
 * a couple of clubs get in touch straight away.
 */
export function sack(game: GameState, reason: string) {
  // In challenge mode there's no second job: the challenge is over.
  if (game.challenge?.status === 'active') {
    loseChallenge(game, `Sacked. ${reason}`);
    return;
  }
  const club = game.clubs[game.userClubId];
  const level = divisionOf(game, club.id).def.level;
  const spell = careerOf(game).at(-1)!;
  spell.to = game.season;
  spell.left = 'sacked';
  addInbox(game, 'contract', `You have been relieved of your duties. ${reason}`, { category: 'club', subject: 'Sacked' });
  club.isUser = false;
  delete club.lineup;
  delete club.bench;
  // Offers for the old club's players are no longer yours to answer.
  for (const item of game.inbox ?? []) if (item.kind === 'bid') item.resolved = true;
  game.unemployed = { reason, season: game.season, week: game.week, fromClubId: club.id, level, offers: [] };
  withRng(game, (rng) => {
    addOffer(game, rng);
    addOffer(game, rng);
  });
}

/**
 * A club in need gets in touch: usually one at the level you were at or a
 * step or two down, struggling in its league. A trophy-winning record opens
 * doors a level higher.
 */
function addOffer(game: GameState, rng: Rng) {
  const u = game.unemployed!;
  const taken = new Set([u.fromClubId, ...u.offers.map((o) => o.clubId)]);
  const honours = careerOf(game).reduce((n, s) => n + spellTrophies(game, s).length, 0);
  const maxLevel = Math.max(...game.divisions.map((d) => d.def.level));
  const lo = Math.max(1, u.level - (honours >= 2 ? 1 : 0));
  const hi = Math.min(maxLevel, u.level + 2);
  const options: { id: string; weight: number }[] = [];
  for (const d of game.divisions) {
    const level = d.def.level;
    if (level < lo || level > hi) continue;
    const table = divisionTable(game, d.def.id);
    const started = table.some((r) => r.played > 0);
    // Clubs in the bottom half are the ones looking for a new manager.
    const struggling = started ? table.slice(Math.floor(table.length / 2)).map((r) => r.clubId) : d.clubIds;
    const weight = level === u.level ? 1 : level === u.level + 1 ? 1.5 : level > u.level ? 0.8 : 0.4;
    for (const id of struggling) if (!taken.has(id)) options.push({ id, weight });
  }
  if (!options.length) return;
  const pick = rng.weighted(options, (o) => o.weight);
  u.offers.push({ clubId: pick.id, expires: absWeek(game) + OFFER_WEEKS });
}

/** Out of work: let a week go by. Old offers lapse and new ones may come in. */
export function waitAWeek(game: GameState) {
  const u = game.unemployed;
  if (!u) return;
  if (game.phase === 'seasonEnd') startNextSeason(game);
  else playWeek(game);
  u.offers = u.offers.filter((o) => o.expires > absWeek(game));
  withRng(game, (rng) => {
    if (u.offers.length < MAX_OFFERS && rng.chance(u.offers.length ? 0.3 : 0.5)) addOffer(game, rng);
  });
}

/** Keep waiting until at least one offer is on the table (up to a season). */
export function waitForOffer(game: GameState) {
  for (let i = 0; i < 52 && game.unemployed && !game.unemployed.offers.length; i++) waitAWeek(game);
}

export function offersFor(game: GameState): JobOffer[] {
  return game.unemployed?.offers ?? [];
}

/** Take a job: the club, its squad and its finances are yours, with a new board to impress. */
export function takeJob(game: GameState, clubId: string): string | null {
  const u = game.unemployed;
  if (!u?.offers.some((o) => o.clubId === clubId)) return 'That offer is no longer open.';
  const club = game.clubs[clubId];
  game.unemployed = undefined;
  handOver(game, club);
  addInbox(game, 'info', `Welcome to ${club.name}. The board have handed you the job: the squad, the ground and the finances are yours. Press Continue to get going.`, {
    category: 'club',
    subject: 'New job',
  });
  return null;
}

/** Make an AI club the user's club (a new job, or a challenge's starting club). */
export function handOver(game: GameState, club: Club) {
  const career = careerOf(game);
  game.userClubId = club.id;
  // A new manager gets a full season before the board can sack him.
  game.startSeason = game.season;
  club.isUser = true;
  takeOver(game, club);
  career.push({ clubId: club.id, clubName: club.name, from: game.season });
}

/**
 * An AI club becomes the user's: a ground of the right size and standard for
 * its level, facilities to match, and a fresh board, target, budgets and sponsor.
 */
function takeOver(game: GameState, club: Club) {
  const level = divisionOf(game, club.id).def.level;
  const rule = groundRule(game.country, level);
  const cap = Math.max(club.capacity, rule?.capacity ?? 0);
  const perStand = Math.min(MAX_STAND, Math.ceil(cap / 4));
  const seatShare = level <= 4 ? 1 : level <= 6 ? 0.5 : 0.2;
  club.stadium = {
    stands: STAND_NAMES.map((name) => {
      const seats = Math.max(Math.round(perStand * seatShare), Math.ceil((rule?.seats ?? 0) / 4));
      return { name, capacity: perStand, seats: Math.min(perStand, seats), roof: level <= 5 };
    }),
    floodlights: level <= 6 || !!rule?.floodlights,
    builds: [],
  };
  syncCapacity(club);
  const facilityLevel = Math.max(1, Math.min(MAX_FACILITY, 5 - Math.ceil(level / 2)));
  club.facilities = { training: facilityLevel, youth: facilityLevel, medical: facilityLevel };
  club.board = { confidence: { easy: 70, normal: 60, hard: 50 }[difficultyOf(game)], fans: 55 };
  delete club.ticketPrice;
  delete club.sponsor;
  delete club.sponsorOffers;
  delete club.loan;
  delete club.lineup;
  delete club.bench;
  club.scouted = {};
  for (const id of club.playerIds) game.players[id].listed = false;
  assignRoles(game, club);
  hireInitialStaff(game, club);
  setSeasonTarget(game);
  setBoardBudgets(game, club);
  withRng(game, (rng) => makeSponsorOffers(game, rng));
  boardOf(club);
}
