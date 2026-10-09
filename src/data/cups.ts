import type { CountryId, CupDef } from '../engine/types';

/**
 * Cup competitions by country. `entries` says which round each pyramid level
 * joins in, so non-league clubs start early and the big clubs come in later.
 */
export const CUPS: Record<CountryId, CupDef[]> = {
  eng: [
    {
      id: 'fa-cup',
      name: 'FA Cup',
      short: 'FAC',
      entries: { 7: 0, 6: 0, 5: 1, 4: 2, 3: 2, 2: 3, 1: 3 },
      day: 2,
      window: [0.12, 0.9],
      prize: 4000,
      neutralSemis: true,
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
      id: 'scottish-cup',
      name: 'Scottish Cup',
      short: 'SC',
      entries: { 5: 0, 4: 1, 3: 1, 2: 2, 1: 2 },
      day: 2,
      window: [0.15, 0.9],
      prize: 3000,
      neutralSemis: true,
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
