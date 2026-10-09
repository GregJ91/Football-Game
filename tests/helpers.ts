import { createGame, type NewGameConfig } from '../src/engine/world';
import type { CountryId } from '../src/engine/types';

export function testGame(country: CountryId = 'eng', seed = 1234, overrides: Partial<NewGameConfig> = {}) {
  return createGame({
    seed,
    country,
    region: 'N',
    clubName: 'Ashford Rovers',
    shortName: 'ASR',
    stadiumName: 'The Meadow',
    colours: { primary: '#B3202A', secondary: '#F5F1E6', pattern: 'stripes' },
    ...overrides,
  });
}
