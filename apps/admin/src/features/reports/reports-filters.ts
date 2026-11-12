import { readFirst, type SearchParamsRecord } from "../../lib/search-params";

export const REPORTS_PATH = "/reports";

/** Query parameters of the reports page (same names as the `reports.summary` input). */
export const REPORTS_PARAMS = { from: "from", to: "to" } as const;

/** Value of an `<input type="date">`: "YYYY-MM-DD". */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const INVALID_DATE_MESSAGE = "Ingresa una fecha válida (día, mes y año).";
export const RANGE_ORDER_MESSAGE = "La fecha «Desde» no puede ser posterior a la fecha «Hasta».";

/** Report range from the URL; `null` = not chosen (the API applies the last 30 days). */
export type ReportsFilters = Readonly<{ from: string | null; to: string | null }>;

export type ParsedReportsFilters = Readonly<{
  filters: ReportsFilters;
  /** What the person typed, to refill the form even when it is invalid. */
  input: Readonly<{ from: string; to: string }>;
  error: string | null;
}>;

/** `true` for an existing "YYYY-MM-DD" day (rejects 2026-02-30). Pure. */
export function isCalendarDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().startsWith(value);
}

const problemOf = (from: string, to: string): string | null => {
  if ((from !== "" && !isCalendarDay(from)) || (to !== "" && !isCalendarDay(to))) {
    return INVALID_DATE_MESSAGE;
  }
  // "YYYY-MM-DD" strings sort like the days they name.
  if (from !== "" && to !== "" && from > to) return RANGE_ORDER_MESSAGE;
  return null;
};

/**
 * Report range from the page URL. An invalid date or a reversed range is reported and the
 * report falls back to the default range; the one-year limit is checked by the API. Pure.
 */
export function parseReportsFilters(params: SearchParamsRecord): ParsedReportsFilters {
  const from = readFirst(params, REPORTS_PARAMS.from) ?? "";
  const to = readFirst(params, REPORTS_PARAMS.to) ?? "";
  const error = problemOf(from, to);
  const filters: ReportsFilters =
    error === null
      ? { from: from === "" ? null : from, to: to === "" ? null : to }
      : { from: null, to: null };
  return { filters, input: { from, to }, error };
}

/** Input of `reports.summary` with only the chosen ends (stable query key). Pure. */
export function toReportsInput(filters: ReportsFilters): { from?: string; to?: string } {
  return {
    ...(filters.from === null ? {} : { from: filters.from }),
    ...(filters.to === null ? {} : { to: filters.to }),
  };
}

export function hasActiveReportsFilters(parsed: ParsedReportsFilters): boolean {
  return parsed.input.from !== "" || parsed.input.to !== "";
}
