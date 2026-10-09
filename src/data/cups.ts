import type { CountryId, CupDef } from '../engine/types';

/**
 * Cup competitions by country. `entries` says which round each pyramid level
 * joins in, so non-league clubs start early and the big clubs come in later.
 */
export const CUPS: Record<CountryId, CupDef[]> = {
  eng: [
    {
      // Non-league clubs come through the qualifying rounds; Leagues One and
      // Two join in the First Round Proper, the top two divisions in the Third.
      id: 'fa-cup',
      name: 'FA Cup',
      short: 'FAC',
      entries: { 7: 0, 6: 1, 5: 3, 4: 4, 3: 4, 2: 6, 1: 6 },
      day: 2,
      window: [0.06, 0.92],
      prize: 2500,
      neutralSemis: true,
      roundNames: [
        'First Qualifying Round',
        'Second Qualifying Round',
        'Third Qualifying Round',
        'Fourth Qualifying Round',
        'First Round Proper',
        'Second Round',
        'Third Round',
        'Fourth Round',
        'Fifth Round',
      ],
      milestones: {
        4: "You're through to the First Round Proper of the FA Cup. The Football League clubs are in the hat now.",
        6: "FA Cup Third Round: the Premier League and Championship clubs join. Anything can happen.",
      },
    },
    {
      id: 'league-cup',
      name: 'League Cup',
      short: 'LC',
      entries: { 4: 0, 3: 0, 2: 0, 1: 1 },
      day: 3,
      window: [0.06, 0.6],
      prize: 6000,
      neutralSemis: false,
    },
    {
      id: 'fa-trophy',
      name: 'FA Trophy',
      short: 'FAT',
      entries: { 6: 0, 5: 1 },
      day: 3,
      window: [0.15, 0.85],
      prize: 1500,
      neutralSemis: false,
    },
    {
      id: 'fa-vase',
      name: 'FA Vase',
      short: 'FAV',
      entries: { 7: 0 },
      day: 3,
      window: [0.15, 0.85],
      prize: 800,
      neutralSemis: false,
    },
  ],
  sco: [
    {
      // Highland and Lowland League clubs start in the First Round; League One
      // and Two join in the Second, the Championship in the Third, and the
      // Premiership in the Fourth.
      id: 'scottish-cup',
      name: 'Scottish Cup',
      short: 'SC',
      entries: { 5: 0, 4: 1, 3: 1, 2: 2, 1: 3 },
      day: 2,
      window: [0.1, 0.92],
      prize: 3000,
      neutralSemis: true,
      roundNames: ['First Round', 'Second Round', 'Third Round', 'Fourth Round', 'Fifth Round'],
      milestones: {
        3: 'Scottish Cup Fourth Round: the Premiership clubs are in the draw.',
      },
    },
    {
      id: 'scottish-league-cup',
      name: 'Scottish League Cup',
      short: 'SLC',
      entries: { 4: 0, 3: 0, 2: 0, 1: 1 },
      day: 3,
      window: [0.06, 0.55],
      prize: 3000,
      neutralSemis: true,
    },
  ],
};

export function cupDef(country: CountryId, id: string): CupDef {
  const def = CUPS[country].find((c) => c.id === id);
  if (!def) throw new Error(`Unknown cup ${id}`);
  return def;
}
