import { createGame } from '../src/engine/world';
export function testGame(country = 'eng', seed = 1234, overrides = {}) {
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
