import type { Rng } from '../rng';

/**
 * Round-robin via the circle method. Returns matchdays of [home, away] pairs;
 * each pair meets `rounds` times, alternating venue each cycle.
 */
export function roundRobin(clubIds: string[], rounds: number, rng: Rng): [string, string][][] {
  const teams = rng.shuffle([...clubIds]);
  if (teams.length % 2 === 1) teams.push('BYE');
  const n = teams.length;
  const cycle: [string, string][][] = [];
  const rot = teams.slice(1);
  for (let day = 0; day < n - 1; day++) {
    const round: [string, string][] = [];
    const ring = [teams[0], ...rot];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      // Alternate venues so nobody gets a long run of home or away games.
      const flip = i === 0 ? day % 2 === 1 : (day + i) % 2 === 1;
      round.push(flip ? [b, a] : [a, b]);
    }
    cycle.push(round.filter(([x, y]) => x !== 'BYE' && y !== 'BYE'));
    rot.unshift(rot.pop()!);
  }
  const days: [string, string][][] = [];
  for (let r = 0; r < rounds; r++) {
    for (const round of cycle) {
      days.push(r % 2 === 0 ? round.map(([x, y]) => [x, y]) : round.map(([x, y]) => [y, x]));
    }
  }
  return days;
}

export function matchdayCount(size: number, rounds: number): number {
  return (size % 2 === 0 ? size - 1 : size) * rounds;
}

/** Spread a division's matchdays across the season's weeks. */
export function weekForMatchday(matchday: number, matchdays: number, totalWeeks: number): number {
  return Math.floor((matchday * totalWeeks) / matchdays);
}
