/**
 * Report date ranges (HU-13, D-29; docs/specs/reports.md R-REP-03, R-REP-04). Pure and shared by
 * the API (validation of `reports.summary`) and the admin (range filter), so both accept and
 * reject the same values with the same Spanish messages.
 *
 * A range is a pair of inclusive calendar days ("YYYY-MM-DD", the value of `<input type="date">`).
 */

/** Days covered by the default range, today included (D-29: "últimos 30 días"). */
export const REPORT_DEFAULT_RANGE_DAYS = 30;

/** Longest range, both ends included: one year, leap years too (D-29). */
export const REPORT_MAX_RANGE_DAYS = 366;

/** Accepted years: keeps date arithmetic far from the `Date` limits (no 9999-12-31 overflow). */
export const CALENDAR_DAY_MIN_YEAR = 2000;
export const CALENDAR_DAY_MAX_YEAR = 2100;

export const INVALID_DAY_MESSAGE = `Ingresa una fecha válida entre los años ${String(CALENDAR_DAY_MIN_YEAR)} y ${String(CALENDAR_DAY_MAX_YEAR)}.`;
export const RANGE_ORDER_MESSAGE = "La fecha «Desde» no puede ser posterior a la fecha «Hasta».";
export const RANGE_SPAN_MESSAGE = "El rango puede abarcar como máximo un año (366 días).";

export type ReportRangeField = "from" | "to";

/** Why a range is invalid: the message and the field(s) to fix (both only when reversed). */
export type ReportRangeProblem = { fields: readonly ReportRangeField[]; message: string };

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** UTC midnight of an accepted "YYYY-MM-DD" day, or `null`. */
const parseDay = (day: string): number | null => {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const [year = 0, month = 0, date = 0] = match.slice(1).map(Number);
  if (year < CALENDAR_DAY_MIN_YEAR || year > CALENDAR_DAY_MAX_YEAR) return null;
  const utc = Date.UTC(year, month - 1, date);
  // Date.UTC rolls 2026-02-30 over to March: a real day survives the round trip.
  return new Date(utc).toISOString().startsWith(day) ? utc : null;
};

const toUtc = (day: string): number => {
  const utc = parseDay(day);
  if (utc === null) throw new RangeError(`Invalid calendar day "${day}"`);
  return utc;
};

/** `true` for an existing "YYYY-MM-DD" day between the accepted years. */
export const isCalendarDay = (day: string): boolean => parseDay(day) !== null;

/** `day` moved by `days` calendar days (negative goes back). Throws on an invalid day. */
export const addCalendarDays = (day: string, days: number): string =>
  new Date(toUtc(day) + days * DAY_MS).toISOString().slice(0, 10);

/** Days covered by `[from, to]`, both included (1 when they are the same day). */
export const calendarRangeLength = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;

/** Why `[from, to]` is not a valid report range, or `null` when it is. An empty end is "not chosen". */
export const reportRangeProblem = (from: string, to: string): ReportRangeProblem | null => {
  const invalid: ReportRangeField[] = [];
  if (from !== "" && !isCalendarDay(from)) invalid.push("from");
  if (to !== "" && !isCalendarDay(to)) invalid.push("to");
  if (invalid.length > 0) return { fields: invalid, message: INVALID_DAY_MESSAGE };
  if (from === "" || to === "") return null;
  // "YYYY-MM-DD" strings sort like the days they name.
  if (from > to) return { fields: ["from", "to"], message: RANGE_ORDER_MESSAGE };
  if (calendarRangeLength(from, to) > REPORT_MAX_RANGE_DAYS) {
    return { fields: ["from"], message: RANGE_SPAN_MESSAGE };
  }
  return null;
};
