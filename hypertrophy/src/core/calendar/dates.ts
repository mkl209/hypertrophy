/** Calendar dates are plain local 'YYYY-MM-DD' strings. All arithmetic is done on UTC day numbers, so DST never matters. */
export type ISODate = string;

const MS_DAY = 86_400_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(s: string): boolean {
  const m = RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function toDayNumber(s: ISODate): number {
  if (!isValidISODate(s)) throw new Error(`Invalid date: ${s}`);
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * MS_DAY).toISOString().slice(0, 10);
}

export const addDays = (s: ISODate, n: number): ISODate => fromDayNumber(toDayNumber(s) + n);
export const diffDays = (a: ISODate, b: ISODate): number => toDayNumber(a) - toDayNumber(b);

/** Weekday with Monday = 0 … Sunday = 6. */
export function weekdayMon0(s: ISODate): number {
  return (new Date(toDayNumber(s) * MS_DAY).getUTCDay() + 6) % 7;
}

export const startOfWeekMonday = (s: ISODate): ISODate => addDays(s, -weekdayMon0(s));

/** Today in the device's local timezone (not UTC). */
export function todayISO(now: Date = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Zero-based week index of `date` within a block that starts on `start` (negative = before the block). */
export function weekIndex(start: ISODate, date: ISODate): number {
  return Math.floor(diffDays(date, startOfWeekMonday(start)) / 7);
}
