import type { Fixture, TableRow } from '../types';

export function emptyRow(clubId: string): TableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

export function compareRows(a: TableRow, b: TableRow): number {
  return (
    b.points - a.points ||
    b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    b.won - a.won ||
    (a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0)
  );
}

export function buildTable(clubIds: string[], fixtures: Fixture[]): TableRow[] {
  const rows = new Map(clubIds.map((id) => [id, emptyRow(id)]));
  for (const f of fixtures) {
    if (!f.result) continue;
    const h = rows.get(f.homeId);
    const a = rows.get(f.awayId);
    if (!h || !a) continue;
    const { homeGoals: hg, awayGoals: ag } = f.result;
    h.played++;
    a.played++;
    h.goalsFor += hg;
    h.goalsAgainst += ag;
    a.goalsFor += ag;
    a.goalsAgainst += hg;
    if (hg > ag) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (hg < ag) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  return [...rows.values()].sort(compareRows);
}
