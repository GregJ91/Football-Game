import { crowdFill, guideTicketPrice, ticketPrice } from '../economy/finance';
import type { Club, GameState } from '../types';
import { divisionOf } from '../world';
import { facilitiesOf } from './facilities';
import { foodLevel } from './matchday';
import { stadiumOf, totalCapacity } from './stadium';
import { PART_ORDER, TRAINING_PARTS, partLevel } from './trainingGround';

/**
 * What the fans think of the ground, and the players of the training
 * ground. Each verdict is a score (0–100), stars (1–5) and a few quotes;
 * the fans' verdict nudges crowds and the players' verdict nudges morale.
 */

export interface Quote {
  text: string;
  good: boolean;
}

export interface Verdict {
  score: number;
  stars: number;
  quotes: Quote[];
}

/** How much is expected at this level (0 at the bottom, 1 in the top flight). */
export function expectation(game: GameState, club: Club): number {
  const q = divisionOf(game, club.id).def.quality ;
  return Math.max(0, Math.min(1, (q - 47) / 27));
}

function verdict(points: { delta: number; text: string }[]): Verdict {
  const score = Math.round(Math.max(0, Math.min(100, 50 + points.reduce((n, p) => n + p.delta, 0))));
  // Loudest opinions first, at most four.
  const quotes = [...points]
    .filter((p) => p.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
    .map((p) => ({ text: p.text, good: p.delta > 0 }));
  return { score, stars: Math.max(1, Math.min(5, 1 + Math.round(score / 25))), quotes };
}

export function fanVerdict(game: GameState, club: Club): Verdict {
  const s = stadiumOf(club);
  const cap = totalCapacity(s);
  const exp = expectation(game, club);
  const pts: { delta: number; text: string }[] = [];
  if (cap > 0) {
    const roofed = s.stands.reduce((n, x) => n + (x.roof ? x.capacity : 0), 0) / cap;
    if (s.fullRoof) pts.push({ delta: 12, text: 'A full roof! The noise stays in and the rain stays out.' });
    else if (roofed >= 0.8) pts.push({ delta: 6, text: 'Nearly everywhere is covered. No more soakings.' });
    else if (roofed < 0.4 && exp < 0.1) pts.push({ delta: -3, text: "Bring a brolly: there's no cover anywhere." });
    else if (roofed < 0.4) pts.push({ delta: -10, text: 'Half the ground stands in the rain. Put a roof on it!' });

    const seated = s.stands.reduce((n, x) => n + x.seats, 0) / cap;
    if (seated >= 0.9) pts.push({ delta: 4 + 6 * exp, text: 'A seat for everyone. Proper ground, this.' });
    else if (seated < 0.5 && exp > 0.3) pts.push({ delta: -10 * exp, text: 'Still standing on crumbling terraces at this level?' });
    else if (seated < 0.5 && s.stands.every((x) => x.open || x.capacity === 0)) pts.push({ delta: 3, text: 'Leaning on the rail with a cup of tea. Proper grassroots football.' });
    else if (seated < 0.5) pts.push({ delta: 3, text: 'Love a terrace. Old-school football.' });

    const corners = s.stands.filter((x) => x.corner && x.capacity > 0).length;
    if (corners >= 4) pts.push({ delta: 8, text: 'All four corners filled in. It feels like a bowl now.' });
    else if (corners > 0) pts.push({ delta: 3, text: 'The new corner has made it much louder.' });

    const fill = crowdFill(game, club, false);
    if (fill >= 0.97) pts.push({ delta: -6, text: "Can't get a ticket for love nor money. Build it bigger!" });
    else if (fill >= 0.85) pts.push({ delta: 6, text: 'Packed every week. What an atmosphere.' });
    else if (fill < 0.3) pts.push({ delta: -6, text: 'Rows and rows of empty seats. Dead atmosphere.' });
  }

  const ratio = guideTicketPrice(game, club) / ticketPrice(game, club);
  if (ratio >= 1.15) pts.push({ delta: 10, text: 'Tickets are a bargain. Fair play to the chairman.' });
  else if (ratio <= 0.8) pts.push({ delta: -14, text: 'Daylight robbery at these ticket prices.' });
  else if (ratio <= 0.92) pts.push({ delta: -5, text: 'Tickets are getting a bit steep.' });

  const food = foodLevel(club);
  if (food === 0) pts.push({ delta: -6, text: 'Twenty minutes in the queue at the tea hut, missed the goal.' });
  else if (food >= 3) pts.push({ delta: 6, text: 'The food here is actually decent now.' });
  else if (food >= 2) pts.push({ delta: 2, text: 'Decent pie and a pint at half time.' });

  if (s.heating) pts.push({ delta: 4, text: 'Undersoil heating: no more frozen-pitch postponements.' });
  else if (exp > 0.4) pts.push({ delta: -5, text: 'Another game called off for a frozen pitch. Sort it out.' });

  if (!s.floodlights && exp > 0) pts.push({ delta: -4, text: 'No floodlights, so no proper night games.' });
  return verdict(pts);
}

/** Crowds: a happy fanbase turns up a bit more often (±5%). */
export function fanCrowdFactor(game: GameState, club: Club): number {
  return 0.95 + fanVerdict(game, club).score / 1000;
}

export function playerVerdict(game: GameState, club: Club): Verdict {
  const exp = expectation(game, club);
  const pts: { delta: number; text: string }[] = [];
  const training = facilitiesOf(club).training;
  // A level-3 complex is decent at the bottom; the top flight expects level 5.
  const wantTraining = 1 + Math.round(exp * 4);
  if (training > wantTraining) pts.push({ delta: 10, text: 'The pitches here are better than at most clubs at this level.' });
  else if (training === 1 && wantTraining === 1) pts.push({ delta: 1, text: "It's a council pitch two nights a week, but we're just happy to play." });
  else if (training < wantTraining) pts.push({ delta: -8 * (wantTraining - training), text: 'The training pitches are bumpy. Not what you expect at this level.' });

  const lines: Record<string, [string, string]> = {
    gym: ['The gym is top class. I feel stronger than ever.', 'No proper gym? I have to pay for my own membership.'],
    science: ['The sports scientists have my legs feeling fresh every week.', "Nobody tracks our fitness. I'm knackered by Saturday."],
    recovery: ['The rehab set-up got me back from injury in no time.', 'A bucket of ice is not a recovery plan.'],
    dome: ['Training never stops now, whatever the weather.', 'Training was rained off again.'],
    analysis: ['The video sessions mean we know every opponent inside out.', 'We go into games blind. No analysis at all.'],
  };
  for (const part of PART_ORDER) {
    const level = partLevel(club, part);
    const top = TRAINING_PARTS[part].levels.length - 1;
    const want = Math.round(exp * top);
    if (level > want) pts.push({ delta: 4 + 3 * (level - want), text: lines[part][0] });
    else if (level < want) pts.push({ delta: -4 * (want - level), text: lines[part][1] });
    else if (level > 0) pts.push({ delta: 2, text: lines[part][0] });
  }
  return verdict(pts);
}

/** Monthly morale nudge from the players' verdict: −1, 0 or +1. */
export function playerMoraleNudge(game: GameState, club: Club): number {
  const stars = playerVerdict(game, club).stars;
  return stars >= 4 ? 1 : stars <= 2 ? -1 : 0;
}
