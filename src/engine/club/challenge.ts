import { COUNTRIES } from '../../data/pyramids';
import { playerName } from '../players/generate';
import { playWeek } from '../season/season';
import { divisionTable } from '../season/table';
import type { ChallengeId, CountryId, GameState, Player, SeasonSummary } from '../types';
import { addInbox } from '../transfers/market';
import { createGame, divisionOf, squadOf } from '../world';
import { boardOf } from './chairman';
import { handOver } from './career';

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  /** One line for the list. */
  tagline: string;
  rules: string[];
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'sack',
    name: 'Avoid the Sack',
    tagline: 'Hard mode, all the time. How long can you last?',
    rules: [
      'Hard difficulty: little money and an impatient board.',
      'Get sacked and the challenge is over. There is no second job.',
      'Your score is how many seasons you survive.',
    ],
  },
  {
    id: 'kids',
    name: "You Can't Win Anything With Kids",
    tagline: 'Under-22s only.',
    rules: [
      'You start with a squad of players aged 21 or under.',
      'You can only sign players aged 21 or under (loans too).',
      'Anyone aged 22 or over still at the club when a transfer window closes costs 3 points.',
    ],
  },
  {
    id: 'embargo',
    name: 'Transfer Embargo',
    tagline: 'No fees. Free agents and loans only.',
    rules: [
      "You can't pay a transfer fee: sign free agents or take players on loan.",
      'Every bid for your players is accepted automatically.',
    ],
  },
  {
    id: 'old',
    name: 'Old But Gold',
    tagline: 'Thirty-somethings only.',
    rules: ['You can only sign players aged 30 or over (loans too).'],
  },
  {
    id: 'relegation',
    name: 'Relegation Battlers',
    tagline: 'Second bottom, ten games to go. Stay up.',
    rules: [
      'You take over the side second from bottom with 10 league games left.',
      'Stay up and the challenge is won. Go down and it is game over.',
    ],
  },
];

export function challengeDef(id: ChallengeId): ChallengeDef {
  return CHALLENGES.find((c) => c.id === id)!;
}

/** The challenge whose rules apply right now (none once it's over). */
export function activeChallenge(game: GameState): ChallengeId | null {
  return game.challenge?.status === 'active' ? game.challenge.id : null;
}

/** Can the user sign (or borrow) this player under the challenge's age rules? */
export function challengeSigningRule(game: GameState, p: Player): string | null {
  const c = activeChallenge(game);
  if (c === 'kids' && p.age > 21) return "You can't win anything with kids: only players aged 21 or under.";
  if (c === 'old' && p.age < 30) return 'Old but gold: only players aged 30 or over.';
  return null;
}

/** Transfer embargo: no fees at all. */
export function challengeFeeRule(game: GameState, p: Player): string | null {
  if (activeChallenge(game) === 'embargo' && p.clubId) return 'Transfer embargo: no fees. Sign free agents or take players on loan.';
  return null;
}

export function loseChallenge(game: GameState, result: string) {
  if (!game.challenge || game.challenge.status !== 'active') return;
  game.challenge.status = 'lost';
  game.challenge.result = result;
}

function winChallenge(game: GameState, result: string) {
  if (!game.challenge || game.challenge.status !== 'active') return;
  game.challenge.status = 'won';
  game.challenge.result = result;
}

/** Seasons completed in charge during this challenge. */
export function seasonsSurvived(game: GameState): number {
  const c = game.challenge;
  if (!c) return 0;
  return game.season - c.startSeason + (game.phase === 'seasonEnd' ? 1 : 0);
}

// ---------------------------------------------------------------- kids

function overAge(game: GameState): Player[] {
  return squadOf(game, game.userClubId).filter((p) => p.age > 21);
}

/** A window opens: warn about anyone who has turned 22. */
export function kidsWindowOpened(game: GameState) {
  if (activeChallenge(game) !== 'kids') return;
  const over = overAge(game);
  if (!over.length) return;
  addInbox(game, 'contract', `Too old for the kids: ${over.map((p) => `${playerName(p)} (${p.age})`).join(', ')}. Sell or release them before the window closes, or it's 3 points each.`, {
    category: 'transfers',
    subject: 'Over-age players',
  });
}

/** A window closes: 3 points for every over-age player still here. */
export function kidsWindowClosed(game: GameState) {
  if (activeChallenge(game) !== 'kids') return;
  const over = overAge(game);
  if (!over.length) return;
  const points = 3 * over.length;
  game.deductions ??= {};
  game.deductions[game.userClubId] = (game.deductions[game.userClubId] ?? 0) + points;
  addInbox(game, 'contract', `Points deduction: ${points} point${points === 1 ? '' : 's'} for keeping ${over.map((p) => p.lastName).join(', ')} past the window.`, {
    category: 'club',
    subject: `${points}-point deduction`,
  });
}

// ---------------------------------------------------------------- season end

/** Relegation Battlers is decided on the final table. */
export function challengeSeasonEnd(game: GameState, summary: SeasonSummary) {
  if (activeChallenge(game) !== 'relegation') return;
  const div = divisionOf(game, game.userClubId).def;
  const pos = summary.finalTables[div.id].findIndex((r) => r.clubId === game.userClubId) + 1;
  if (summary.relegated[div.id].includes(game.userClubId)) loseChallenge(game, `Relegated: ${game.clubs[game.userClubId].name} finished ${ordinal(pos)}.`);
  else winChallenge(game, `Stayed up! ${game.clubs[game.userClubId].name} finished ${ordinal(pos)} in the ${div.name}.`);
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------- relegation battlers

/** Leagues the relegation challenge can be played in: the second-bottom club goes down. */
export function relegationLeagues(country: CountryId) {
  return COUNTRIES[country].divisions.filter((d) => d.relegation >= 2);
}

/**
 * Relegation Battlers: play the season until 10 league games are left, then
 * hand the user the club second from bottom.
 */
export function createRelegationBattle(seed: number, country: CountryId, divisionId: string): GameState {
  // Hard but winnable: re-roll a few times for a side within about six points of safety.
  let best: { game: GameState; gap: number } | null = null;
  for (let i = 0; i < 4 && (!best || best.gap > 6); i++) {
    const tried = playToRunIn(seed + i, country, divisionId);
    if (!best || tried.gap < best.gap) best = tried;
  }
  const { game } = best!;
  const div = game.divisions.find((d) => d.def.id === divisionId)!;
  const table = divisionTable(game, divisionId);
  const club = game.clubs[table[table.length - 2].clubId];
  const caretaker = game.clubs[game.userClubId];
  caretaker.isUser = false;
  delete caretaker.lineup;
  delete caretaker.bench;
  game.career = [];
  game.inbox = [];
  handOver(game, club);
  game.challenge = { id: 'relegation', status: 'active', startSeason: game.season };
  // A new manager bounce.
  for (const p of squadOf(game, club.id)) p.morale = Math.max(p.morale, 85);

  const n = table.length;
  const left = game.fixtures.filter((f) => f.divisionId === divisionId && !f.result && (f.homeId === club.id || f.awayId === club.id)).length;
  boardOf(club).target = { label: 'Avoid relegation', position: n - div.def.relegation };
  addInbox(game, 'contract', `${club.name} are second from bottom of the ${div.def.name} with ${left} games to go, ${best!.gap > 0 ? `${best!.gap} point${best!.gap === 1 ? '' : 's'} from safety` : 'level with the side above the drop zone'}. The board want one thing: stay up.`, {
    category: 'club',
    subject: 'Relegation Battlers',
  });
  return game;
}

/** Play a fresh season until 10 league games are left; how far is second-bottom from safety? */
function playToRunIn(seed: number, country: CountryId, divisionId: string): { game: GameState; gap: number } {
  const game = createGame({
    seed,
    country,
    region: 'N',
    // The season is played out by a caretaker club that stays in the pyramid.
    clubName: country === 'eng' ? 'Ashby Albion' : 'Kinross Thistle',
    shortName: country === 'eng' ? 'ASH' : 'KIN',
    stadiumName: 'The Rec',
    colours: { primary: '#14234D', secondary: '#F5F1E6', pattern: 'plain' },
  });
  const div = game.divisions.find((d) => d.def.id === divisionId)!;
  const left = () => game.fixtures.filter((f) => f.divisionId === divisionId && !f.result && (f.homeId === div.clubIds[0] || f.awayId === div.clubIds[0])).length;
  while (game.phase === 'season' && left() > 10) playWeek(game);
  const table = divisionTable(game, divisionId);
  const n = table.length;
  return { game, gap: table[n - div.def.relegation - 1].points - table[n - 2].points };
}
