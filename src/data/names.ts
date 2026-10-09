import type { CountryId } from '../engine/types';

/** Fictional-but-plausible name pools. Real squads come in via database import later. */

export const FIRST_NAMES = [
  'Jack', 'Harry', 'Charlie', 'George', 'Oliver', 'James', 'Thomas', 'Daniel', 'Josh', 'Liam',
  'Ryan', 'Callum', 'Connor', 'Jordan', 'Kyle', 'Luke', 'Ben', 'Sam', 'Joe', 'Tom',
  'Adam', 'Lewis', 'Jamie', 'Dean', 'Scott', 'Craig', 'Ross', 'Euan', 'Fraser', 'Kieran',
  'Marcus', 'Leon', 'Tyrone', 'Kai', 'Reece', 'Jaden', 'Andre', 'Kofi', 'Tariq', 'Malik',
  'Ethan', 'Mason', 'Alfie', 'Archie', 'Finley', 'Rhys', 'Owen', 'Declan', 'Conor', 'Sean',
  'Tomás', 'Mateo', 'Luca', 'Nico', 'Jonas', 'Emil', 'Viktor', 'Pavel', 'Bruno', 'Rafael',
  'Ibrahim', 'Yusuf', 'Moussa', 'Sékou', 'Amadou', 'Chidi', 'Emeka', 'Kwame', 'Theo', 'Max',
];

export const LAST_NAMES = [
  'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright',
  'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Clarke',
  'Jackson', 'Turner', 'Hill', 'Cooper', 'Ward', 'Morris', 'Moore', 'King', 'Baker', 'Harrison',
  'Pryce', 'Kerr', 'Whitlock', 'Barnes', 'Doyle', 'Reid', 'Whitfield', 'Achebe', 'Mensah', 'Okafor',
  'Campbell', 'Stewart', 'MacLeod', 'Fraser', 'Murray', 'Ross', 'Paterson', 'McKenzie', 'Sinclair', 'Duncan',
  'Gallagher', 'Byrne', 'Kelly', 'Doherty', 'Quinn', 'Nolan', 'Brennan', 'Lynch', 'Healy', 'Dempsey',
  'Varga', 'Novak', 'Silva', 'Costa', 'Moreau', 'Lindqvist', 'Berg', 'Kovac', 'Diallo', 'Traoré',
  'Asante', 'Boateng', 'Owusu', 'Adeyemi', 'Okoye', 'Hassan', 'Ahmed', 'Patel', 'Khan', 'Shah',
  'Fletcher', 'Sutton', 'Booth', 'Pearce', 'Lowe', 'Parry', 'Holt', 'Marsh', 'Platt', 'Dunn',
];

const TOWN_PARTS: Record<CountryId, { starts: string[]; ends: string[] }> = {
  eng: {
    starts: [
      'Ash', 'Brad', 'Brom', 'Bur', 'Chel', 'Craw', 'Dun', 'Eas', 'Farn', 'Gran', 'Hal', 'Hart', 'Hol',
      'Kel', 'Lang', 'Mar', 'Mel', 'Mil', 'Nor', 'Oak', 'Pen', 'Ram', 'Red', 'Roth', 'Sal', 'Shel',
      'Stan', 'Sud', 'Thorn', 'Wal', 'Wes', 'Whit', 'Win', 'Wor', 'Ald', 'Bel', 'Cal', 'Ex', 'Hen',
      'Ken', 'Ley', 'Ned', 'Ot', 'Rush', 'Selby', 'Tad', 'Ux', 'Wick', 'Brim', 'Cran',
    ],
    ends: [
      'ford', 'ley', 'ton', 'bury', 'field', 'ham', 'wick', 'worth', 'well', 'by', 'stead', 'mouth',
      'bridge', 'dale', 'mere', 'port', 'combe', 'minster', 'thorpe', 'wood', 'chester', 'borough',
    ],
  },
  sco: {
    starts: [
      'Aber', 'Ard', 'Bal', 'Ban', 'Brae', 'Cul', 'Dal', 'Dun', 'Fal', 'Glen', 'Inver', 'Kil', 'Kin',
      'Kirk', 'Loch', 'Mon', 'Muir', 'Pit', 'Port', 'Ruth', 'Stra', 'Tor', 'Auch', 'Craig', 'Cum',
      'Drum', 'Bran', 'Lin', 'Mel', 'Strath',
    ],
    ends: [
      'deen', 'more', 'lochy', 'ness', 'burgh', 'keld', 'ton', 'ross', 'kirk', 'muir', 'haven',
      'gowan', 'cairn', 'ford', 'lie', 'side', 'brae', 'field', 'bank', 'mill',
    ],
  },
};

const CLUB_SUFFIXES: Record<CountryId, string[]> = {
  eng: ['Town', 'United', 'City', 'Rovers', 'Athletic', 'Wanderers', 'Albion', 'County', 'Borough', 'FC', 'Rangers', 'Villa'],
  sco: ['FC', 'Athletic', 'Thistle', 'United', 'Rovers', 'Academicals', 'Albion', 'Star', 'Rangers', 'Celtic', 'Juniors'],
};

const STADIUM_SUFFIXES = ['Park', 'Road', 'Lane', 'Ground', 'Stadium', 'Meadow', 'Field', 'Grove'];

export function townNameParts(country: CountryId) {
  return TOWN_PARTS[country];
}
export function clubSuffixes(country: CountryId) {
  return CLUB_SUFFIXES[country];
}
export { STADIUM_SUFFIXES };

/** Pairs of kit colours that read well together. */
export const KIT_COLOURS: [string, string][] = [
  ['#B3202A', '#F5F1E6'], ['#1F4FB8', '#F5F1E6'], ['#6B1832', '#8EC5F0'], ['#1E7A43', '#F5F1E6'],
  ['#111111', '#F5F1E6'], ['#F2B632', '#111111'], ['#F5F1E6', '#111111'], ['#14234D', '#F5F1E6'],
  ['#F07A1F', '#111111'], ['#8EC5F0', '#14234D'], ['#B3202A', '#111111'], ['#1F4FB8', '#E8C04A'],
  ['#5B2A86', '#F5F1E6'], ['#F5F1E6', '#B3202A'], ['#E8C04A', '#14234D'], ['#1E7A43', '#E8C04A'],
];
