import { LAST_NAMES } from '../../data/names';
import { hireInitialStaff, staffWages } from './staff';
import { guideTicketPrice, ledgerOf, topUpUnlimited, weeklyIncomeEstimate, weeklyTv } from '../economy/finance';
import { roundMoney } from '../players/ratings';
import type { Rng } from '../rng';
import type { Board, Club, Difficulty, GameState, SeasonSummary } from '../types';
import { divisionTable } from '../season/table';
import { sack } from './career';
import { addInbox } from '../transfers/market';
import { divisionOf, domesticClubs, squadOf } from '../world';
import { FACILITY_INFO, facilitiesOf, totalUpkeep } from './facilities';
import { completeStadiumWork, nextLevelGrading, stadiumOf, syncCapacity } from './stadium';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function boardOf(club: Club): Board {
  club.board ??= { confidence: 60, fans: 60 };
  return club.board;
}

// ---------------------------------------------------------------- difficulty and the sack

export function difficultyOf(game: GameState): Difficulty {
  return game.settings?.difficulty ?? 'normal';
}

/** How hard bad news and good news move the board, by difficulty. */
const PATIENCE: Record<Difficulty, { down: number; up: number }> = {
  easy: { down: 0.5, up: 1.25 },
  normal: { down: 1, up: 1 },
  hard: { down: 1.35, up: 0.85 },
};

/** Change the board's confidence in the user, scaled by difficulty. */
export function shiftConfidence(game: GameState, delta: number) {
  const b = boardOf(game.clubs[game.userClubId]);
  const p = PATIENCE[difficultyOf(game)];
  b.confidence = clamp(b.confidence + delta * (delta < 0 ? p.down : p.up));
}

/**
 * Monthly board check: league position against the target, and debt. Then
 * the board's verdict (see judge). Returns true if the user was sacked.
 */
export function boardCheck(game: GameState): boolean {
  if (game.unemployed) return false;
  const club = game.clubs[game.userClubId];
  const b = boardOf(club);
  const div = divisionOf(game, club.id);
  const table = divisionTable(game, div.def.id);
  const row = table.find((r) => r.clubId === club.id);
  if (b.target && row && row.played >= 6) {
    const behind = table.indexOf(row) + 1 - b.target.position;
    const slack = Math.max(2, Math.round(div.clubIds.length / 8));
    // A poor month costs a little; a whole season well off the pace adds up to about 30.
    if (behind > slack) shiftConfidence(game, -Math.min(3, 1 + (behind - slack) / 3));
    else if (behind <= 0) shiftConfidence(game, 1);
  }
  if (club.balance < 0 && !game.settings?.unlimitedMoney) shiftConfidence(game, -3);
  return judge(game, false);
}

/**
 * The board's patience. Below 30 they say they're concerned; below 20 it's a
 * final warning. On hard, a final warning not turned round within a month
 * (or by the end of the season) is the sack, and so is falling to 8.
 */
export function judge(game: GameState, seasonEnd: boolean): boolean {
  // Relegation Battlers is decided by the final table alone.
  if (game.unemployed || game.challenge?.status === 'active' && game.challenge.id === 'relegation') return false;
  const difficulty = difficultyOf(game);
  const b = boardOf(game.clubs[game.userClubId]);
  const c = b.confidence;
  if (difficulty === 'easy') {
    b.warning = undefined;
    return false;
  }
  if (c >= 40) {
    if (b.warning) addInbox(game, 'info', "The board's confidence in you has returned. Keep it up.", { category: 'club', subject: 'Board back onside' });
    b.warning = undefined;
    return false;
  }
  if (c < 20) {
    // A new manager gets his first season: warnings, but no sack until its final day.
    const firstSeason = game.season === game.startSeason;
    if (difficulty === 'hard' && (!firstSeason || seasonEnd)) {
      const monthPassed = b.warning === 'final' && (game.season > (b.warnedSeason ?? game.season) || game.week - (b.warnedWeek ?? game.week) >= 4);
      if (c <= 8 || monthPassed || (seasonEnd && (b.warning === 'final' || c < 15))) {
        sack(game, c <= 8 ? 'The board lost all confidence in you.' : "Results didn't improve after the board's final warning.");
        return true;
      }
    }
    if (b.warning !== 'final') {
      b.warning = 'final';
      b.warnedSeason = game.season;
      b.warnedWeek = game.week;
      const text = difficulty === 'hard'
        ? "Final warning from the board: things have to improve within a month, or you'll be dismissed."
        : "The board are furious with how things are going. They're standing by you, but they want it turned round.";
      addInbox(game, 'contract', text, { category: 'club', subject: 'Final warning' });
    }
    return false;
  }
  if (c < 30 && !b.warning) {
    b.warning = 'concerned';
    addInbox(game, 'info', "The board are concerned about how the season is going. They expect better.", { category: 'club', subject: 'Board concerned' });
  }
  return false;
}


// ---------------------------------------------------------------- season target

function strength(game: GameState, clubId: string) {
  const best = squadOf(game, clubId).map((p) => p.overall).sort((a, b) => b - a).slice(0, 11);
  return best.reduce((n, x) => n + x, 0) / Math.max(1, best.length);
}

/** The board's expectation for the season, from how the squad compares. */
export function setSeasonTarget(game: GameState) {
  const club = game.clubs[game.userClubId];
  const div = divisionOf(game, club.id);
  const n = div.clubIds.length;
  const ranked = [...div.clubIds].sort((a, b) => strength(game, b) - strength(game, a));
  const r = ranked.indexOf(club.id) + 1;
  const promo = div.def.promotion;
  let target;
  if (!promo) {
    target = r <= 2 ? { label: 'Win the league', position: 1 } : r <= 6 ? { label: 'Finish in the top six', position: 6 } : null;
  } else {
    const auto = promo.auto;
    const playoffEnd = promo.playoff?.[1] ?? auto;
    if (r <= auto) target = { label: 'Win promotion', position: auto };
    else if (r <= playoffEnd + 2) target = { label: promo.playoff ? 'Reach the play-offs' : 'Challenge for promotion', position: playoffEnd + (promo.playoff ? 0 : 2) };
  }
  target ??= r <= n / 2 ? { label: 'Finish in the top half', position: Math.floor(n / 2) } : div.def.relegation
    ? { label: 'Avoid relegation', position: n - div.def.relegation }
    : { label: 'Finish clear of the bottom three', position: n - 3 };
  boardOf(club).target = target;
  boardOf(club).gradingWarned = false;
  addInbox(game, 'info', `The board's target for the season: ${target.label.toLowerCase()} (finish ${ordinal(target.position)} or better).`, { subject: 'Season target' });
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** After each of the user's matches. */
export function moodAfterMatch(game: GameState, scored: number, conceded: number, home: boolean) {
  const club = game.clubs[game.userClubId];
  const b = boardOf(club);
  const res = scored > conceded ? 1 : scored < conceded ? -1 : 0;
  b.fans = clamp(b.fans + res * 2);
  shiftConfidence(game, res);
  if (home) {
    const ratio = (club.ticketPrice ?? guideTicketPrice(game, club)) / guideTicketPrice(game, club);
    b.fans = clamp(b.fans - Math.max(-1, Math.min(3, (ratio - 1) * 4)));
  }
}

/** End-of-season verdict from the board and fans. Returns the summary line. */
export function seasonReview(game: GameState, summary: SeasonSummary) {
  const club = game.clubs[game.userClubId];
  const b = boardOf(club);
  const div = divisionOf(game, club.id);
  const pos = summary.finalTables[div.def.id].findIndex((r) => r.clubId === club.id) + 1;
  const promoted = summary.promoted[div.def.id].includes(club.id);
  const relegated = summary.relegated[div.def.id].includes(club.id);
  const target = b.target;
  const diff = target ? target.position - pos : 0;
  shiftConfidence(game, Math.max(-20, Math.min(20, diff * 3)) + (promoted ? 15 : 0) - (relegated ? 15 : 0));
  b.fans = clamp(b.fans + (promoted ? 15 : relegated ? -12 : Math.max(-8, Math.min(8, diff * 1.5))));
  const verdict = !target
    ? 'The board thanks you for the season.'
    : diff >= 0
      ? `The board is pleased: the target was to ${target.label.toLowerCase()} and you finished ${ordinal(pos)}.`
      : `The board is disappointed: the target was to ${target.label.toLowerCase()} but you finished ${ordinal(pos)}.`;
  addInbox(game, 'info', verdict, { subject: 'Board verdict' });
}

// ---------------------------------------------------------------- sponsors

const SPONSOR_KINDS = ['Motors', 'Builders', 'Brewery', 'Bakery', 'Logistics', 'Insurance', 'Carpets', 'Plumbing', 'Electrical', 'Coaches'];

export function makeSponsorOffers(game: GameState, rng: Rng) {
  const club = game.clubs[game.userClubId];
  if (club.sponsor && club.sponsor.endsSeason >= game.season) return;
  const base = Math.max(100, roundMoney(weeklyTv(game, club) * 0.5));
  const name = () => `${rng.pick(LAST_NAMES)} ${rng.pick(SPONSOR_KINDS)}`;
  const weeks = game.totalWeeks;
  club.sponsorOffers = [
    { name: name(), style: 'steady', weekly: base, upfront: 0, promotionBonus: 0, endsSeason: game.season + 1 },
    { name: name(), style: 'upfront', weekly: 0, upfront: roundMoney(base * weeks * 0.85), promotionBonus: 0, endsSeason: game.season },
    { name: name(), style: 'bonus', weekly: roundMoney(base * 0.6), upfront: 0, promotionBonus: roundMoney(base * weeks * 1.2), endsSeason: game.season },
  ];
  addInbox(game, 'info', 'Three companies want to be your shirt sponsor. Choose one on the Club screen before the window shuts.', { subject: 'Sponsorship offers' });
}

export function chooseSponsor(game: GameState, index: number) {
  const club = game.clubs[game.userClubId];
  const offer = club.sponsorOffers?.[index];
  if (!offer) return;
  club.sponsor = offer;
  club.sponsorOffers = undefined;
  if (offer.upfront) {
    club.balance += offer.upfront;
    const l = ledgerOf(club);
    l.sponsor = (l.sponsor ?? 0) + offer.upfront;
  }
  addInbox(game, 'info', `${offer.name} are your new shirt sponsor.`, { subject: 'New sponsor' });
}

// ---------------------------------------------------------------- loans

export function loanOptions(game: GameState, club: Club) {
  const income = weeklyIncomeEstimate(game, club);
  return [10, 25, 50].map((mult) => {
    const amount = roundMoney(income * mult);
    return { amount, weekly: Math.ceil((amount * 1.08) / (game.totalWeeks * 2)), total: Math.round(amount * 1.08) };
  });
}

export function takeLoan(game: GameState, amount: number): string | null {
  const club = game.clubs[game.userClubId];
  if (club.loan) return 'Pay off the current loan before taking another.';
  const opt = loanOptions(game, club).find((o) => o.amount === amount);
  if (!opt) return 'That loan is not on offer.';
  club.loan = { remaining: opt.total, weekly: opt.weekly };
  club.balance += amount;
  const l = ledgerOf(club);
  l.loan = (l.loan ?? 0) + amount;
  if (amount > weeklyIncomeEstimate(game, club) * 20) shiftConfidence(game, -4);
  return null;
}

export function repayLoan(game: GameState): string | null {
  const club = game.clubs[game.userClubId];
  if (!club.loan) return null;
  if (club.balance < club.loan.remaining) return 'Not enough in the bank to clear the loan.';
  club.balance -= club.loan.remaining;
  const l = ledgerOf(club);
  l.loan = (l.loan ?? 0) - club.loan.remaining;
  club.loan = undefined;
  return null;
}

// ---------------------------------------------------------------- weekly and seasonal money

/** Weekly chairman business: sponsor, upkeep, loan, building progress. */
export function chairmanWeek(game: GameState, rng: Rng) {
  topUpUnlimited(game);
  for (const club of domesticClubs(game)) {
    if (club.parachute && club.parachute.season === game.season) {
      club.balance += club.parachute.weekly;
      const l = ledgerOf(club);
      l.tv += club.parachute.weekly;
    }
  }
  const club = game.clubs[game.userClubId];
  const l = ledgerOf(club);
  if (club.sponsor && club.sponsor.endsSeason >= game.season && club.sponsor.weekly) {
    club.balance += club.sponsor.weekly;
    l.sponsor = (l.sponsor ?? 0) + club.sponsor.weekly;
  }
  const upkeep = totalUpkeep(club);
  club.balance -= upkeep;
  l.upkeep = (l.upkeep ?? 0) + upkeep;
  // Older saves: a backroom team appropriate to the level.
  if (!club.staff) hireInitialStaff(game, club);
  const staff = staffWages(club);
  club.balance -= staff;
  l.staff = (l.staff ?? 0) + staff;
  // Unlimited money (testing) stays topped up after the week's bills.
  topUpUnlimited(game);
  if (club.loan) {
    const pay = Math.min(club.loan.weekly, club.loan.remaining);
    club.balance -= pay;
    l.loan = (l.loan ?? 0) - pay;
    club.loan.remaining -= pay;
    if (club.loan.remaining <= 0) {
      club.loan = undefined;
      addInbox(game, 'info', 'The bank loan is paid off.', { subject: 'Loan repaid' });
    }
  }
  // Sponsor not chosen by the end of the summer window: the board picks the steady deal.
  if (club.sponsorOffers && game.week >= 5) chooseSponsor(game, 0);

  const s = stadiumOf(club);
  for (const b of [...s.builds]) {
    b.weeksLeft--;
    if (b.weeksLeft > 0) continue;
    s.builds = s.builds.filter((x) => x !== b);
    if (b.kind === 'facility') {
      const f = facilitiesOf(club);
      f[b.facility!]++;
      addInbox(game, 'info', `The ${FACILITY_INFO[b.facility!].name.toLowerCase()} upgrade is complete (level ${f[b.facility!]}).`, { subject: 'Facility upgraded' });
    } else {
      addInbox(game, 'info', completeStadiumWork(club, b), { subject: 'Building work finished' });
      boardOf(club).fans = clamp(boardOf(club).fans + 3);
    }
    syncCapacity(club);
  }
  void rng;
}

/** Warn once a season if the user is chasing promotion with a ground that isn't good enough. */
export function gradingWarning(game: GameState, position: number) {
  const club = game.clubs[game.userClubId];
  const b = boardOf(club);
  const div = divisionOf(game, club.id).def;
  if (b.gradingWarned || !div.promotion) return;
  const zone = div.promotion.playoff?.[1] ?? div.promotion.auto;
  if (position > zone + 2) return;
  const check = nextLevelGrading(game);
  if (!check || check.ok) return;
  b.gradingWarned = true;
  const missing = check.items.filter((i) => !i.ok).map((i) => `${i.label.toLowerCase()} (${i.have} of ${i.need})`);
  addInbox(game, 'contract', `Ground warning: you're in the promotion race, but the ground doesn't meet the rules for the next level. Missing: ${missing.join(', ')}. Without it you can't go up.`, { subject: 'Ground warning' });
}

/** Prize money for every club, parachutes for the relegated, sponsor bonuses. */
export function seasonPayouts(game: GameState, summary: SeasonSummary) {
  for (const div of game.divisions) {
    const table = summary.finalTables[div.def.id];
    const n = table.length;
    table.forEach((row, i) => {
      const club = game.clubs[row.clubId];
      const prize = roundMoney((weeklyTv(game, club) * 4 * (n - i)) / n);
      club.balance += prize;
      const l = ledgerOf(club);
      l.prize = (l.prize ?? 0) + prize;
    });
    for (const id of summary.relegated[div.def.id]) {
      const club = game.clubs[id];
      const tvNow = weeklyTv(game, club);
      const lower = game.divisions.find((d) => d.def.level === div.def.level + 1);
      const tvBelow = lower ? weeklyTv(game, game.clubs[lower.clubIds[0]]) : tvNow;
      club.parachute = { weekly: roundMoney(Math.max(0, tvNow - tvBelow) * 0.5), season: game.season + 1 };
    }
  }
  const user = game.clubs[game.userClubId];
  const userDiv = divisionOf(game, user.id).def.id;
  if (user.sponsor?.promotionBonus && summary.promoted[userDiv].includes(user.id)) {
    user.balance += user.sponsor.promotionBonus;
    const l = ledgerOf(user);
    l.sponsor = (l.sponsor ?? 0) + user.sponsor.promotionBonus;
    addInbox(game, 'info', `${user.sponsor.name} pay their promotion bonus.`, { subject: 'Sponsor bonus' });
  }
}
