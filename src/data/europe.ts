import type { CountryId } from '../engine/types';

export interface EuroCompDef {
  id: string;
  name: string;
  /** Short label for fixture lists. */
  short: string;
  /** Day of the week matches are played (3 = Wednesday, 4 = Thursday). */
  day: number;
  /** Games each club plays in the league phase. */
  leagueGames: 6 | 8;
  /** Rough strength of the foreign clubs met in the play-off round (same scale as `Nation.top`). */
  playoffBand: [number, number];
  /** Where losers of the play-off round drop to. */
  dropTo?: string;
  finalCapacity: number;
  /** Prize money (£): entry to the league phase, per league-phase result, and for reaching each knockout round. */
  prize: { entry: number; win: number; draw: number; r16: number; qf: number; sf: number; final: number; winner: number };
}

/** The three UEFA club competitions, all in the 36-club league-phase format. */
export const EURO_COMPS: EuroCompDef[] = [
  {
    id: 'ucl',
    name: 'Champions League',
    short: 'UCL',
    day: 3,
    leagueGames: 8,
    playoffBand: [72, 77],
    dropTo: 'uel',
    finalCapacity: 75000,
    prize: { entry: 16_000_000, win: 1_900_000, draw: 630_000, r16: 9_500_000, qf: 10_600_000, sf: 12_500_000, final: 15_000_000, winner: 5_000_000 },
  },
  {
    id: 'uel',
    name: 'Europa League',
    short: 'UEL',
    day: 4,
    leagueGames: 8,
    playoffBand: [67, 72],
    dropTo: 'uecl',
    finalCapacity: 50000,
    prize: { entry: 3_700_000, win: 380_000, draw: 125_000, r16: 1_500_000, qf: 2_200_000, sf: 3_500_000, final: 5_000_000, winner: 3_500_000 },
  },
  {
    id: 'uecl',
    name: 'Conference League',
    short: 'UECL',
    day: 4,
    leagueGames: 6,
    playoffBand: [62, 68],
    finalCapacity: 32000,
    prize: { entry: 2_700_000, win: 340_000, draw: 113_000, r16: 700_000, qf: 1_100_000, sf: 1_700_000, final: 3_000_000, winner: 2_000_000 },
  },
];

export function euroDef(id: string): EuroCompDef {
  const def = EURO_COMPS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown European competition ${id}`);
  return def;
}

export function isEuroId(id: string): boolean {
  return EURO_COMPS.some((c) => c.id === id);
}

// ---------------------------------------------------------------- qualification

export interface EuroSlot {
  compId: string;
  /** Top-flight finishing position. */
  league?: number;
  /** Winner of this domestic cup (if already qualified, the place passes down the league). */
  cup?: string;
  /** Enters in the play-off round rather than straight into the league phase. */
  playoff?: boolean;
}

/** European places, in the order they are handed out. */
export const EURO_SLOTS: Record<CountryId, EuroSlot[]> = {
  eng: [
    { compId: 'ucl', league: 1 },
    { compId: 'ucl', league: 2 },
    { compId: 'ucl', league: 3 },
    { compId: 'ucl', league: 4 },
    { compId: 'uel', league: 5 },
    { compId: 'uel', cup: 'fa-cup' },
    { compId: 'uecl', cup: 'league-cup', playoff: true },
  ],
  sco: [
    { compId: 'ucl', league: 1 },
    { compId: 'ucl', league: 2, playoff: true },
    { compId: 'uel', cup: 'scottish-cup', playoff: true },
    { compId: 'uel', league: 3, playoff: true },
    { compId: 'uecl', league: 4, playoff: true },
    { compId: 'uecl', league: 5, playoff: true },
  ],
};

// ---------------------------------------------------------------- foreign clubs (fictional)

export type NameStyle = 'iberian' | 'portuguese' | 'german' | 'dutch' | 'italian' | 'french' | 'slavic' | 'nordic' | 'turkish' | 'greek' | 'british';

export interface Nation {
  code: string;
  name: string;
  style: NameStyle;
  /** Clubs in the pool. */
  clubs: number;
  /** Strength (best-XI average) of the nation's top club, on a scale where an average Premier League side is 76. */
  top: number;
  /** Gap in strength between one club and the next. */
  step: number;
  /** A British nation that is the user's own country is left out. */
  country?: CountryId;
}

export const NATIONS: Nation[] = [
  { code: 'ESP', name: 'Spain', style: 'iberian', clubs: 8, top: 83, step: 1.5 },
  { code: 'GER', name: 'Germany', style: 'german', clubs: 8, top: 82, step: 1.5 },
  { code: 'ITA', name: 'Italy', style: 'italian', clubs: 8, top: 81.5, step: 1.5 },
  { code: 'FRA', name: 'France', style: 'french', clubs: 7, top: 79.5, step: 1.6 },
  { code: 'ENG', name: 'England', style: 'british', clubs: 7, top: 81, step: 1.5, country: 'eng' },
  { code: 'POR', name: 'Portugal', style: 'portuguese', clubs: 6, top: 78, step: 2 },
  { code: 'NED', name: 'Netherlands', style: 'dutch', clubs: 6, top: 77, step: 2 },
  { code: 'BEL', name: 'Belgium', style: 'dutch', clubs: 4, top: 74, step: 2 },
  { code: 'TUR', name: 'Turkey', style: 'turkish', clubs: 4, top: 74, step: 2 },
  { code: 'SCO', name: 'Scotland', style: 'british', clubs: 4, top: 70, step: 2, country: 'sco' },
  { code: 'AUT', name: 'Austria', style: 'german', clubs: 3, top: 72, step: 2 },
  { code: 'GRE', name: 'Greece', style: 'greek', clubs: 4, top: 72, step: 2 },
  { code: 'CZE', name: 'Czechia', style: 'slavic', clubs: 3, top: 71, step: 2 },
  { code: 'SUI', name: 'Switzerland', style: 'german', clubs: 3, top: 71, step: 2 },
  { code: 'DEN', name: 'Denmark', style: 'nordic', clubs: 3, top: 71, step: 2 },
  { code: 'UKR', name: 'Ukraine', style: 'slavic', clubs: 3, top: 71, step: 2 },
  { code: 'NOR', name: 'Norway', style: 'nordic', clubs: 3, top: 70, step: 2 },
  { code: 'CRO', name: 'Croatia', style: 'slavic', clubs: 3, top: 71, step: 2 },
  { code: 'SRB', name: 'Serbia', style: 'slavic', clubs: 3, top: 70, step: 2 },
  { code: 'POL', name: 'Poland', style: 'slavic', clubs: 4, top: 69, step: 2 },
  { code: 'SWE', name: 'Sweden', style: 'nordic', clubs: 3, top: 68, step: 2 },
  { code: 'ISR', name: 'Israel', style: 'greek', clubs: 2, top: 68, step: 2 },
  { code: 'HUN', name: 'Hungary', style: 'slavic', clubs: 2, top: 68, step: 2 },
  { code: 'CYP', name: 'Cyprus', style: 'greek', clubs: 3, top: 68, step: 2 },
  { code: 'ROU', name: 'Romania', style: 'slavic', clubs: 3, top: 67, step: 2 },
  { code: 'BUL', name: 'Bulgaria', style: 'slavic', clubs: 2, top: 66, step: 2 },
  { code: 'SVK', name: 'Slovakia', style: 'slavic', clubs: 2, top: 66, step: 2 },
  { code: 'SVN', name: 'Slovenia', style: 'slavic', clubs: 2, top: 65, step: 2 },
  { code: 'AZE', name: 'Azerbaijan', style: 'turkish', clubs: 2, top: 65, step: 2 },
  { code: 'KAZ', name: 'Kazakhstan', style: 'slavic', clubs: 2, top: 64, step: 2 },
  { code: 'IRL', name: 'Ireland', style: 'british', clubs: 2, top: 63, step: 2 },
  { code: 'FIN', name: 'Finland', style: 'nordic', clubs: 2, top: 63, step: 2 },
  { code: 'ISL', name: 'Iceland', style: 'nordic', clubs: 1, top: 62, step: 2 },
  { code: 'WAL', name: 'Wales', style: 'british', clubs: 1, top: 60, step: 2 },
  { code: 'NIR', name: 'Northern Ireland', style: 'british', clubs: 1, top: 60, step: 2 },
];

/** Fictional club names: a prefix or suffix plus a made-up town. */
export const CLUB_NAMES: Record<Exclude<NameStyle, 'british'>, { prefixes?: string[]; suffixes?: string[]; towns: string[] }> = {
  iberian: {
    prefixes: ['Real', 'Atlético', 'Deportivo', 'Racing', 'Sporting', 'Unión', 'CD'],
    towns: ['Valdemora', 'Castelar', 'Mirasierra', 'Alcantera', 'San Albar', 'Torrevela', 'Montejo', 'Puerto Viejo', 'Villarreta', 'Almedina'],
  },
  portuguese: {
    prefixes: ['Sporting', 'Vitória', 'Académica', 'Desportivo', 'FC', 'União'],
    towns: ['Vilamar', 'Porto Alto', 'Braganha', 'Setúval', 'Castelo Novo', 'Ribamar', 'Alvorada', 'Tavira Nova'],
  },
  german: {
    prefixes: ['FC', 'SV', 'VfB', 'Borussia', 'Eintracht', 'Fortuna', 'TSV', 'SC'],
    towns: ['Ostenfeld', 'Rheinau', 'Waldstadt', 'Kressbach', 'Lindenau', 'Hohenbrück', 'Neustein', 'Elbhafen', 'Grünwalde', 'Felsberg'],
  },
  dutch: {
    prefixes: ['FC', 'SC', 'Sparta', 'Vitesse', 'Go Ahead', 'Club', 'Royal', 'KV'],
    towns: ['Westerdam', 'Zuidhaven', 'Hoogeveld', 'Bergenlo', 'Oostburg', 'Dijkstad', 'Brugelen', 'Mechelstad', 'Oudenhove', 'Lierdonk'],
  },
  italian: {
    prefixes: ['AC', 'US', 'SS', 'Sporting', 'Atletico', 'Polisportiva'],
    towns: ['Verano', 'Castelfiore', 'Montebello', 'Sanvito', 'Torrenova', 'Lavagna', 'Borgoreale', 'Pietralta', 'Valfonda'],
  },
  french: {
    prefixes: ['Olympique', 'AS', 'FC', 'Stade', 'Racing', 'En Avant', 'SC'],
    towns: ['Valmont', 'Saint-Arnaud', 'Montclair', 'Bellerive', 'Rochefort', 'Lavardin', 'Clairvaux', 'Port-Lusan'],
  },
  slavic: {
    prefixes: ['FK', 'Dinamo', 'Slavia', 'Lokomotiv', 'NK', 'Sloga', 'Zorya', 'Banik', 'Ruch'],
    towns: ['Novigrad', 'Krasnodol', 'Belopolje', 'Zlatograd', 'Vysoké', 'Gorna', 'Prievoz', 'Rudnik', 'Tarnovo', 'Dravsk', 'Lipovac', 'Sokolov', 'Brestova', 'Mirnograd'],
  },
  nordic: {
    suffixes: ['IF', 'FK', 'BK', 'IK', 'SK'],
    towns: ['Fjordby', 'Vesterhavn', 'Nordvik', 'Sandaker', 'Lyngå', 'Kalvik', 'Bjørkdal', 'Eskilby', 'Havsund', 'Tornholm'],
  },
  turkish: {
    suffixes: ['spor', ' SK', ' FK'],
    towns: ['Karadeniz', 'Anadolu', 'Bozkurt', 'Yildiz', 'Kartal', 'Toros', 'Akdeniz', 'Gökova'],
  },
  greek: {
    prefixes: ['Apollon', 'Ethnikos', 'Doxa', 'Asteras', 'Aris', 'Atromitos', 'Hapoel', 'Maccabi'],
    towns: ['Kalamari', 'Thessalia', 'Pyrgos', 'Lefkada', 'Korinthos', 'Arkadia', 'Kymi', 'Elia'],
  },
};

/** Player name pools for foreign squads. */
export const PLAYER_NAMES: Record<Exclude<NameStyle, 'british'>, { first: string[]; last: string[] }> = {
  iberian: {
    first: ['Javier', 'Sergio', 'Pablo', 'Diego', 'Álvaro', 'Raúl', 'Iker', 'Marco', 'Adrián', 'Hugo', 'Dani', 'Rodrigo'],
    last: ['García', 'Moreno', 'Herrera', 'Navarro', 'Castillo', 'Ortega', 'Ramos', 'Vidal', 'Serrano', 'Molina', 'Rubio', 'Iglesias'],
  },
  portuguese: {
    first: ['Rui', 'João', 'Tiago', 'Miguel', 'Diogo', 'Gonçalo', 'André', 'Nuno', 'Bruno', 'Pedro', 'Vítor', 'Rafael'],
    last: ['Silva', 'Pereira', 'Costa', 'Duarte', 'Ferreira', 'Carvalho', 'Almeida', 'Sousa', 'Teixeira', 'Lopes', 'Mendes', 'Cardoso'],
  },
  german: {
    first: ['Lukas', 'Jonas', 'Felix', 'Niklas', 'Leon', 'Moritz', 'Tim', 'Florian', 'Maximilian', 'Kevin', 'Julian', 'Fabian'],
    last: ['Becker', 'Hoffmann', 'Krüger', 'Wagner', 'Schäfer', 'Vogel', 'Brandt', 'Hartmann', 'Keller', 'Neumann', 'Lehmann', 'Zimmer'],
  },
  dutch: {
    first: ['Daan', 'Bram', 'Sem', 'Jan', 'Ruben', 'Thijs', 'Joris', 'Wout', 'Lars', 'Stijn', 'Arne', 'Milan'],
    last: ['de Vries', 'Bakker', 'Jansen', 'Visser', 'Smit', 'de Jong', 'van Dijkstra', 'Peeters', 'Maes', 'Claes', 'Mertens', 'Willems'],
  },
  italian: {
    first: ['Marco', 'Luca', 'Andrea', 'Matteo', 'Lorenzo', 'Davide', 'Simone', 'Federico', 'Alessio', 'Riccardo', 'Nicolò', 'Gianluca'],
    last: ['Rossi', 'Bianchi', 'Ferrara', 'Esposito', 'Romano', 'Galli', 'Conti', 'Marino', 'Greco', 'Ricci', 'Lombardi', 'Moretti'],
  },
  french: {
    first: ['Antoine', 'Hugo', 'Théo', 'Lucas', 'Mathis', 'Yanis', 'Maxime', 'Julien', 'Bastien', 'Moussa', 'Enzo', 'Clément'],
    last: ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Girard', 'Fontaine', 'Rousseau', 'Mercier', 'Diallo', 'Traoré', 'Camara'],
  },
  slavic: {
    first: ['Luka', 'Marko', 'Ivan', 'Nikola', 'Petr', 'Tomáš', 'Jakub', 'Filip', 'Dejan', 'Mateusz', 'Andriy', 'Bogdan'],
    last: ['Novak', 'Horvat', 'Kovač', 'Petrović', 'Nowak', 'Dvořák', 'Jovanović', 'Kowalski', 'Popescu', 'Shevchuk', 'Marić', 'Babić'],
  },
  nordic: {
    first: ['Erik', 'Magnus', 'Lars', 'Anders', 'Oskar', 'Emil', 'Mikkel', 'Henrik', 'Viktor', 'Jesper', 'Sindre', 'Aron'],
    last: ['Johansson', 'Nilsen', 'Larsen', 'Hansen', 'Lindqvist', 'Berg', 'Eriksen', 'Dahl', 'Holm', 'Sørensen', 'Lund', 'Sigurdsson'],
  },
  turkish: {
    first: ['Emre', 'Burak', 'Kerem', 'Arda', 'Yusuf', 'Ali', 'Mert', 'Cenk', 'Orhan', 'Rashad', 'Elvin', 'Tural'],
    last: ['Yılmaz', 'Demir', 'Aydın', 'Çelik', 'Şahin', 'Kaya', 'Öztürk', 'Arslan', 'Doğan', 'Aliyev', 'Mammadov', 'Kurt'],
  },
  greek: {
    first: ['Giorgos', 'Nikos', 'Dimitris', 'Kostas', 'Yannis', 'Christos', 'Andreas', 'Eran', 'Omer', 'Stelios', 'Panos', 'Michalis'],
    last: ['Papadopoulos', 'Georgiou', 'Nikolaidis', 'Karagiannis', 'Vlachos', 'Christou', 'Antoniou', 'Levi', 'Mizrahi', 'Pappas', 'Ioannou', 'Stavrou'],
  },
};
