import { ledgerOf } from '../economy/finance';
import { divisionOf } from '../world';
export const STAND_NAMES = ['Main Stand', 'North End', 'East Terrace', 'South End'];
export const MAX_STAND = 20_000;
export const EXTEND_SIZES = [250, 1000, 5000];
export function createStadium() {
    return {
        stands: [
            { name: STAND_NAMES[0], capacity: 200, seats: 60, roof: true },
            { name: STAND_NAMES[1], capacity: 100, seats: 0, roof: false },
            { name: STAND_NAMES[2], capacity: 100, seats: 0, roof: false },
            { name: STAND_NAMES[3], capacity: 100, seats: 0, roof: false },
        ],
        floodlights: false,
        builds: [],
    };
}
export function stadiumOf(club) {
    club.stadium ??= createStadium();
    return club.stadium;
}
function standUnderWork(stadium, i) {
    return stadium.builds.some((b) => b.stand === i && b.kind !== 'facility');
}
/** Usable capacity: a stand being worked on holds half its fans. */
export function effectiveCapacity(stadium) {
    return stadium.stands.reduce((n, s, i) => n + (standUnderWork(stadium, i) ? Math.round(s.capacity / 2) : s.capacity), 0);
}
export function totalCapacity(stadium) {
    return stadium.stands.reduce((n, s) => n + s.capacity, 0);
}
export function totalSeats(stadium) {
    return stadium.stands.reduce((n, s) => n + s.seats, 0);
}
export function roofedShare(stadium) {
    const cap = totalCapacity(stadium);
    return cap ? stadium.stands.reduce((n, s) => n + (s.roof ? s.capacity : 0), 0) / cap : 0;
}
export function syncCapacity(club) {
    if (club.stadium)
        club.capacity = effectiveCapacity(club.stadium);
}
/** Minimum ground needed to play at each level (simplified real rules). */
const GRADING = {
    eng: {
        1: { capacity: 20_000, seats: 20_000, floodlights: true },
        2: { capacity: 10_000, seats: 10_000, floodlights: true },
        3: { capacity: 7_500, seats: 2_000, floodlights: true },
        4: { capacity: 5_000, seats: 1_000, floodlights: true },
        5: { capacity: 4_000, seats: 500, floodlights: true },
        6: { capacity: 1_300, seats: 250, floodlights: true },
    },
    sco: {
        1: { capacity: 6_000, seats: 2_000, floodlights: true },
        2: { capacity: 3_000, seats: 500, floodlights: true },
        3: { capacity: 2_000, seats: 300, floodlights: true },
        4: { capacity: 1_000, seats: 100, floodlights: true },
    },
};
export function groundRule(country, level) {
    return GRADING[country][level] ?? null;
}
/** Does the user's ground meet the rules for `level`? (Finished stands only.) */
export function checkGrading(game, club, level) {
    const rule = groundRule(game.country, level);
    if (!rule)
        return null;
    const s = stadiumOf(club);
    const cap = totalCapacity(s);
    const seats = totalSeats(s);
    const items = [
        { label: 'Capacity', have: cap.toLocaleString('en-GB'), need: rule.capacity.toLocaleString('en-GB'), ok: cap >= rule.capacity },
        { label: 'Seats', have: seats.toLocaleString('en-GB'), need: rule.seats.toLocaleString('en-GB'), ok: seats >= rule.seats },
        { label: 'Floodlights', have: s.floodlights ? 'Yes' : 'No', need: rule.floodlights ? 'Yes' : 'No', ok: s.floodlights || !rule.floodlights },
    ];
    return { level, ok: items.every((i) => i.ok), items };
}
/** The grading check for the level above the user's current one. */
export function nextLevelGrading(game) {
    const club = game.clubs[game.userClubId];
    const level = divisionOf(game, club.id).def.level;
    return level > 1 ? checkGrading(game, club, level - 1) : null;
}
function costScale(country) {
    return country === 'eng' ? 1 : 0.7;
}
/** What can be done to a stand right now. */
export function standOptions(game, club, i) {
    const s = stadiumOf(club).stands[i];
    const k = costScale(game.country);
    const opts = [];
    for (const size of EXTEND_SIZES) {
        if (s.capacity + size > MAX_STAND)
            continue;
        const perPlace = 60 * (1 + s.capacity / 5000);
        opts.push({
            kind: 'extend',
            stand: i,
            size,
            label: `Extend by ${size.toLocaleString('en-GB')} (terracing)`,
            cost: Math.round(size * perPlace * k),
            weeks: Math.min(20, 3 + Math.round(size / 400)),
        });
    }
    const terrace = s.capacity - s.seats;
    if (terrace > 0) {
        opts.push({
            kind: 'seats',
            stand: i,
            label: `Seat the whole stand (+${terrace.toLocaleString('en-GB')} seats)`,
            cost: Math.round(terrace * 90 * (1 + s.capacity / 10000) * k),
            weeks: Math.min(12, 2 + Math.round(terrace / 800)),
        });
    }
    if (!s.roof) {
        opts.push({ kind: 'roof', stand: i, label: 'Add a roof', cost: Math.round(Math.max(5000, s.capacity * 40) * k), weeks: Math.min(10, 3 + Math.round(s.capacity / 2000)) });
    }
    return opts;
}
export function floodlightOption(game) {
    return { kind: 'floodlights', label: 'Install floodlights', cost: game.country === 'eng' ? 40_000 : 25_000, weeks: 4 };
}
export function stadiumBusy(club) {
    return stadiumOf(club).builds.some((b) => b.kind !== 'facility');
}
export function cannotBuild(club, cost) {
    if (cost > Math.max(0, club.balance))
        return "The club can't afford it. Take out a loan or wait for more money to come in.";
    return null;
}
export function startStadiumWork(club, opt) {
    if (stadiumBusy(club))
        return 'Builders are already working on the ground. One project at a time.';
    const problem = cannotBuild(club, opt.cost);
    if (problem)
        return problem;
    const build = { kind: opt.kind, stand: opt.stand, size: opt.size, weeksLeft: opt.weeks, totalWeeks: opt.weeks, cost: opt.cost };
    stadiumOf(club).builds.push(build);
    club.balance -= opt.cost;
    const l = ledgerOf(club);
    l.building = (l.building ?? 0) + opt.cost;
    syncCapacity(club);
    return null;
}
/** Apply a finished stadium job. Returns a line for the inbox. */
export function completeStadiumWork(club, b) {
    const s = stadiumOf(club);
    const stand = b.stand !== undefined ? s.stands[b.stand] : null;
    switch (b.kind) {
        case 'extend':
            stand.capacity += b.size;
            return `The ${stand.name} extension is finished: room for ${b.size.toLocaleString('en-GB')} more fans.`;
        case 'seats':
            stand.seats = stand.capacity;
            return `The ${stand.name} is now all-seater.`;
        case 'roof':
            stand.roof = true;
            return `The ${stand.name} has its new roof.`;
        case 'floodlights':
            s.floodlights = true;
            return 'The floodlights are switched on for the first time.';
        default:
            return '';
    }
}
