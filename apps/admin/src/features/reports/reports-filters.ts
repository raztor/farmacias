import { reportRangeProblem, type ReportRangeField } from "@repo/shared";

import { readFirst, type SearchParamsRecord } from "../../lib/search-params";

export const REPORTS_PATH = "/reports";

/** Query parameters of the reports page (same names as the `reports.summary` input). */
export const REPORTS_PARAMS = { from: "from", to: "to" } as const;

/** Report range from the URL; `null` = not chosen (the API applies the last 30 days). */
export type ReportsFilters = Readonly<{ from: string | null; to: string | null }>;

export type ParsedReportsFilters = Readonly<{
  filters: ReportsFilters;
  /** What the person typed, to refill the form even when it is invalid. */
  input: Readonly<{ from: string; to: string }>;
  error: string | null;
  /** Fields to mark as invalid: only the wrong one(s), both only for a reversed range. */
  invalidFields: readonly ReportRangeField[];
}>;

/**
 * Report range from the page URL, validated with the same shared rules as the API
 * (`reportRangeProblem`). An invalid range is reported and the report falls back to the default
 * range. Pure.
 */
export function parseReportsFilters(params: SearchParamsRecord): ParsedReportsFilters {
  const from = readFirst(params, REPORTS_PARAMS.from) ?? "";
  const to = readFirst(params, REPORTS_PARAMS.to) ?? "";
  const problem = reportRangeProblem(from, to);
  if (problem) {
    return {
      filters: { from: null, to: null },
      input: { from, to },
      error: problem.message,
      invalidFields: problem.fields,
    };
  }
  return {
    filters: { from: from === "" ? null : from, to: to === "" ? null : to },
    input: { from, to },
    error: null,
    invalidFields: [],
  };
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
