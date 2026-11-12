import { INVALID_DAY_MESSAGE, RANGE_ORDER_MESSAGE, RANGE_SPAN_MESSAGE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { hasActiveReportsFilters, parseReportsFilters, toReportsInput } from "./reports-filters";

describe("parseReportsFilters", () => {
  it("uses the default range (no ends) without parameters", () => {
    const parsed = parseReportsFilters({});
    expect(parsed).toEqual({
      filters: { from: null, to: null },
      input: { from: "", to: "" },
      error: null,
      invalidFields: [],
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

  it("marks only the invalid date and falls back to the default range", () => {
    const parsed = parseReportsFilters({ from: "2026-02-30", to: "2026-03-10" });
    expect(parsed.error).toBe(INVALID_DAY_MESSAGE);
    expect(parsed.invalidFields).toEqual(["from"]);
    expect(parsed.filters).toEqual({ from: null, to: null });
    expect(parsed.input).toEqual({ from: "2026-02-30", to: "2026-03-10" });
    expect(hasActiveReportsFilters(parsed)).toBe(true);
    expect(parseReportsFilters({ to: "9999-12-31" }).invalidFields).toEqual(["to"]);
  });

  it("marks both fields for a reversed range", () => {
    const parsed = parseReportsFilters({ from: "2026-11-12", to: "2026-11-11" });
    expect(parsed.error).toBe(RANGE_ORDER_MESSAGE);
    expect(parsed.invalidFields).toEqual(["from", "to"]);
    expect(parsed.filters).toEqual({ from: null, to: null });
  });

  it("applies the same one-year limit as the API", () => {
    const parsed = parseReportsFilters({ from: "2025-01-01", to: "2026-11-11" });
    expect(parsed.error).toBe(RANGE_SPAN_MESSAGE);
    expect(parsed.invalidFields).toEqual(["from"]);
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
