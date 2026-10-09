export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${sign}£${(a / 1_000_000_000).toFixed(1)}bn`;
  if (a >= 1_000_000) return `${sign}£${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}m`;
  if (a >= 1000) return `${sign}£${Math.round(a / 1000)}k`;
  return `${sign}£${a}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}
