import type { CountryDef, CountryId } from '../engine/types';

/**
 * Simplified real pyramids. At each boundary the number of clubs relegated
 * from level L equals the number promoted from level L+1 (checked in tests).
 */
export const COUNTRIES: Record<CountryId, CountryDef> = {
  eng: {
    id: 'eng',
    name: 'England',
    divisions: [
      { id: 'eng-1', name: 'Premier League', level: 1, size: 20, rounds: 2, promotion: null, relegation: 3, quality: 74 },
      { id: 'eng-2', name: 'Championship', level: 2, size: 24, rounds: 2, promotion: { auto: 2, playoff: [3, 6] }, relegation: 3, quality: 66 },
      { id: 'eng-3', name: 'League One', level: 3, size: 24, rounds: 2, promotion: { auto: 2, playoff: [3, 6] }, relegation: 4, quality: 61 },
      { id: 'eng-4', name: 'League Two', level: 4, size: 24, rounds: 2, promotion: { auto: 3, playoff: [4, 7] }, relegation: 2, quality: 57 },
      { id: 'eng-5', name: 'National League', level: 5, size: 24, rounds: 2, promotion: { auto: 1, playoff: [2, 5] }, relegation: 4, quality: 53 },
      { id: 'eng-6n', name: 'National League North', level: 6, size: 24, rounds: 2, promotion: { auto: 1, playoff: [2, 5] }, relegation: 2, region: 'N', quality: 49 },
      { id: 'eng-6s', name: 'National League South', level: 6, size: 24, rounds: 2, promotion: { auto: 1, playoff: [2, 5] }, relegation: 2, region: 'S', quality: 49 },
      { id: 'eng-7n', name: 'Northern Regional League', level: 7, size: 20, rounds: 2, promotion: { auto: 1, playoff: [2, 5] }, relegation: 0, region: 'N', quality: 45 },
      { id: 'eng-7s', name: 'Southern Regional League', level: 7, size: 20, rounds: 2, promotion: { auto: 1, playoff: [2, 5] }, relegation: 0, region: 'S', quality: 45 },
    ],
  },
  sco: {
    id: 'sco',
    name: 'Scotland',
    divisions: [
      { id: 'sco-1', name: 'Premiership', level: 1, size: 12, rounds: 3, promotion: null, relegation: 1, quality: 64 },
      { id: 'sco-2', name: 'Championship', level: 2, size: 10, rounds: 4, promotion: { auto: 1, playoff: null }, relegation: 1, quality: 56 },
      { id: 'sco-3', name: 'League One', level: 3, size: 10, rounds: 4, promotion: { auto: 1, playoff: null }, relegation: 1, quality: 51 },
      { id: 'sco-4', name: 'League Two', level: 4, size: 10, rounds: 4, promotion: { auto: 1, playoff: null }, relegation: 2, quality: 47 },
      { id: 'sco-5n', name: 'Highland League', level: 5, size: 16, rounds: 2, promotion: { auto: 1, playoff: null }, relegation: 0, region: 'N', quality: 43 },
      { id: 'sco-5s', name: 'Lowland League', level: 5, size: 16, rounds: 2, promotion: { auto: 1, playoff: null }, relegation: 0, region: 'S', quality: 43 },
    ],
  },
};

export function bottomDivisions(country: CountryId) {
  const divs = COUNTRIES[country].divisions;
  const maxLevel = Math.max(...divs.map((d) => d.level));
  return divs.filter((d) => d.level === maxLevel);
}
