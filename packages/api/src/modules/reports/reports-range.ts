/**
 * Report date ranges (docs/specs/reports.md R-REP-03..R-REP-05, D-23, D-29). Pure: no I/O.
 *
 * A range is a pair of inclusive calendar days in Chile's time zone ("YYYY-MM-DD"). The database
 * stores UTC instants, so a range is turned into the half-open interval
 * `[start of "from", start of the day after "to")` in `America/Santiago`. Chile changes its clock
 * at local midnight, so a day may start at 01:00 (September) or have two midnights (April): the
 * start of a day is always its first instant.
 */

import {
  INVALID_DAY_MESSAGE,
  REPORT_DEFAULT_RANGE_DAYS,
  REPORT_MAX_RANGE_DAYS,
  addCalendarDays,
  isCalendarDay,
  reportRangeProblem,
  type ReportRangeProblem,
} from "@repo/shared";

export const REPORT_TIME_ZONE = "America/Santiago";

export const FUTURE_LIMIT_MESSAGE = "La fecha «Hasta» puede ser como máximo un año después de hoy.";

const DAY_MS = 86_400_000;

const formatUtcDay = (utc: number): string => new Date(utc).toISOString().slice(0, 10);

/** UTC midnight of a "YYYY-MM-DD" day that was already validated with `isCalendarDay`. */
const utcMidnightOf = (day: string): number => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
};

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
  const midnightUtc = utcMidnightOf(day);
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
  { ok: true; range: ResolvedRange } | { ok: false; problem: ReportRangeProblem };

const failure = (problem: ReportRangeProblem): RangeResolution => ({ ok: false, problem });

/**
 * Fills the missing ends (R-REP-04): `to` defaults to today in Chile and `from` to the 30-day
 * window that ends on `to`; then validates the range (shared rules, plus `to` at most one year
 * after today) and computes its UTC bounds.
 */
export const resolveReportRange = (input: ReportRangeInput, now: Date): RangeResolution => {
  const today = santiagoDayOf(now);
  const to = input.to ?? today;
  if (!isCalendarDay(to)) return failure({ fields: ["to"], message: INVALID_DAY_MESSAGE });
  if (to > addCalendarDays(today, REPORT_MAX_RANGE_DAYS)) {
    return failure({ fields: ["to"], message: FUTURE_LIMIT_MESSAGE });
  }
  const from = input.from ?? addCalendarDays(to, 1 - REPORT_DEFAULT_RANGE_DAYS);
  const problem = reportRangeProblem(from, to);
  if (problem) return failure(problem);
  const end = startOfSantiagoDay(formatUtcDay(utcMidnightOf(to) + DAY_MS));
  return { ok: true, range: { from, to, start: startOfSantiagoDay(from), end } };
};
