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
  // Venues: whoever played away last time is at home this time, so the
  // home and away games alternate as in a real fixture list. Ties go to the
  // club with fewer home games so far.
  const last = new Map<string, 'H' | 'A'>();
  const homes = new Map<string, number>();
  for (let day = 0; day < n - 1; day++) {
    const round: [string, string][] = [];
    const ring = [teams[0], ...rot];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      const want = (t: string) => (last.get(t) === 'A' ? 2 : last.get(t) === 'H' ? 0 : 1) - (homes.get(t) ?? 0) * 0.01;
      const [home, away] = want(a) >= want(b) ? [a, b] : [b, a];
      round.push([home, away]);
      last.set(home, 'H');
      last.set(away, 'A');
      homes.set(home, (homes.get(home) ?? 0) + 1);
    }
    cycle.push(round);
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
