import { describe, expect, it } from "vitest";

import {
  INVALID_DATE_MESSAGE,
  RANGE_ORDER_MESSAGE,
  hasActiveReportsFilters,
  isCalendarDay,
  parseReportsFilters,
  toReportsInput,
} from "./reports-filters";

describe("isCalendarDay", () => {
  it("accepts existing YYYY-MM-DD days only", () => {
    expect(isCalendarDay("2026-11-11")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("11-11-2026")).toBe(false);
    expect(isCalendarDay("2026-11-1")).toBe(false);
  });
});

describe("parseReportsFilters", () => {
  it("uses the default range (no ends) without parameters", () => {
    const parsed = parseReportsFilters({});
    expect(parsed).toEqual({
      filters: { from: null, to: null },
      input: { from: "", to: "" },
      error: null,
    });
    expect(hasActiveReportsFilters(parsed)).toBe(false);
  });

  it("reads both ends, trimmed, and accepts a single day", () => {
    expect(parseReportsFilters({ from: " 2026-11-01 ", to: "2026-11-11" }).filters).toEqual({
      from: "2026-11-01",
      to: "2026-11-11",
    });
    expect(parseReportsFilters({ from: "2026-11-11", to: "2026-11-11" }).error).toBeNull();
  });

  it("accepts only one end (the API fills the other)", () => {
    expect(parseReportsFilters({ to: "2026-07-31" }).filters).toEqual({
      from: null,
      to: "2026-07-31",
    });
  });

  it("reports an invalid date and falls back to the default range", () => {
    const parsed = parseReportsFilters({ from: "2026-02-30", to: "2026-03-10" });
    expect(parsed.error).toBe(INVALID_DATE_MESSAGE);
    expect(parsed.filters).toEqual({ from: null, to: null });
    expect(parsed.input).toEqual({ from: "2026-02-30", to: "2026-03-10" });
    expect(hasActiveReportsFilters(parsed)).toBe(true);
  });

  it("reports a reversed range", () => {
    const parsed = parseReportsFilters({ from: "2026-11-12", to: "2026-11-11" });
    expect(parsed.error).toBe(RANGE_ORDER_MESSAGE);
    expect(parsed.filters).toEqual({ from: null, to: null });
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseReportsFilters({ from: ["2026-10-01", "2026-09-01"] }).filters.from).toBe(
      "2026-10-01",
    );
  });
});

describe("toReportsInput", () => {
  it("sends only the chosen ends", () => {
    expect(toReportsInput({ from: null, to: null })).toEqual({});
    expect(toReportsInput({ from: "2026-11-01", to: null })).toEqual({ from: "2026-11-01" });
    expect(toReportsInput({ from: "2026-11-01", to: "2026-11-11" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-11",
    });
  });
});
