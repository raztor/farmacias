/**
 * Report date ranges (docs/specs/reports.md R-REP-03..R-REP-05, D-23, D-29). Pure: no I/O.
 *
 * A range is a pair of inclusive calendar days in Chile's time zone ("YYYY-MM-DD"). The database
 * stores UTC instants, so a range is turned into the half-open interval
 * `[start of "from", start of the day after "to")` in `America/Santiago`. Chile changes its clock
 * at local midnight, so a day may start at 01:00 (September) or have two midnights (April): the
 * start of a day is always its first instant.
 */

export const REPORT_TIME_ZONE = "America/Santiago";

/** Days covered by the default range, today included (D-29: "últimos 30 días"). */
export const DEFAULT_RANGE_DAYS = 30;

/** Longest range, both ends included: one year, leap years too (D-29). */
export const MAX_RANGE_DAYS = 366;

export const INVALID_DAY_MESSAGE = "Ingresa una fecha válida (día, mes y año).";
export const RANGE_ORDER_MESSAGE = "La fecha «Desde» no puede ser posterior a la fecha «Hasta».";
export const RANGE_SPAN_MESSAGE = "El rango puede abarcar como máximo un año (366 días).";

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** UTC midnight of a "YYYY-MM-DD" day, or `null` when it is not a real calendar day. */
const parseDay = (day: string): number | null => {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const [, year, month, date] = match.map(Number);
  if (year === undefined || month === undefined || date === undefined) return null;
  const utc = Date.UTC(year, month - 1, date);
  // Date.UTC rolls 2026-02-30 over to March: a real day survives the round trip.
  return new Date(utc).toISOString().startsWith(day) ? utc : null;
};

const formatUtcDay = (utc: number): string => new Date(utc).toISOString().slice(0, 10);

/** `true` for an existing "YYYY-MM-DD" calendar day. */
export const isCalendarDay = (day: string): boolean => parseDay(day) !== null;

const toUtc = (day: string): number => {
  const utc = parseDay(day);
  if (utc === null) throw new RangeError(`Invalid calendar day "${day}"`);
  return utc;
};

/** `day` moved by `days` calendar days (negative goes back). */
export const addDays = (day: string, days: number): string =>
  formatUtcDay(toUtc(day) + days * DAY_MS);

/** Days covered by `[from, to]`, both included (1 when they are the same day). */
export const rangeLength = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock fields of `instant` in Chile, read back as if they were UTC (ms). */
const wallClockAsUtc = (instant: number): number => {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );
  const { year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = parts;
  return Date.UTC(year, month - 1, day, hour, minute, second);
};

/** Calendar day of `instant` in Chile ("YYYY-MM-DD"). */
export const santiagoDayOf = (instant: Date): string =>
  formatUtcDay(wallClockAsUtc(instant.getTime()));

/** UTC offset of Chile at `instant`, in ms (e.g. -3 h in summer, -4 h in winter). */
const offsetAt = (instant: number): number =>
  wallClockAsUtc(instant) - Math.floor(instant / 1000) * 1000;

/**
 * First instant of `day` in Chile. Candidates are local midnight under each offset seen around
 * that day; the earliest one that already belongs to `day` wins (a skipped midnight starts the
 * day at the clock change, a repeated one at the first midnight that is on `day`).
 */
export const startOfSantiagoDay = (day: string): Date => {
  const midnightUtc = toUtc(day);
  const offsets = new Set([-DAY_MS, 0, DAY_MS].map((shift) => offsetAt(midnightUtc + shift)));
  const candidates = [...offsets]
    .map((offset) => midnightUtc - offset)
    .filter((instant) => santiagoDayOf(new Date(instant)) === day)
    .sort((left, right) => left - right);
  const [first] = candidates;
  // Every day has a first instant; this is a guard against a broken time zone database.
  if (first === undefined) throw new RangeError(`No start found for ${day} in Chile`);
  return new Date(first);
};

export type RangeProblem = { field: "from" | "to"; message: string };

/** Why `[from, to]` is not a valid report range, or `null` when it is (both must be real days). */
export const rangeProblem = (from: string, to: string): RangeProblem | null => {
  if (!isCalendarDay(from)) return { field: "from", message: INVALID_DAY_MESSAGE };
  if (!isCalendarDay(to)) return { field: "to", message: INVALID_DAY_MESSAGE };
  if (from > to) return { field: "from", message: RANGE_ORDER_MESSAGE };
  if (rangeLength(from, to) > MAX_RANGE_DAYS) return { field: "from", message: RANGE_SPAN_MESSAGE };
  return null;
};

export type ReportRangeInput = { from?: string | undefined; to?: string | undefined };

export type ResolvedRange = {
  /** Inclusive calendar days in Chile. */
  from: string;
  to: string;
  /** `[start, end)` in UTC: start of `from` and start of the day after `to`, in Chile. */
  start: Date;
  end: Date;
};

export type RangeResolution =
  { ok: true; range: ResolvedRange } | { ok: false; problem: RangeProblem };

/**
 * Fills the missing ends (R-REP-04): `to` defaults to today in Chile and `from` to the 30-day
 * window that ends on `to`; then validates the range and computes its UTC bounds.
 */
export const resolveReportRange = (input: ReportRangeInput, now: Date): RangeResolution => {
  const to = input.to ?? santiagoDayOf(now);
  if (!isCalendarDay(to))
    return { ok: false, problem: { field: "to", message: INVALID_DAY_MESSAGE } };
  const from = input.from ?? addDays(to, 1 - DEFAULT_RANGE_DAYS);
  const problem = rangeProblem(from, to);
  if (problem) return { ok: false, problem };
  return {
    ok: true,
    range: { from, to, start: startOfSantiagoDay(from), end: startOfSantiagoDay(addDays(to, 1)) },
  };
};
