import { describe, expect, it } from "vitest";

import {
  INVALID_DAY_MESSAGE,
  RANGE_ORDER_MESSAGE,
  RANGE_SPAN_MESSAGE,
  addCalendarDays,
  calendarRangeLength,
  isCalendarDay,
  reportRangeProblem,
} from "./report-range";

describe("isCalendarDay", () => {
  it("accepts real days between 2000 and 2100 only", () => {
    expect(isCalendarDay("2026-02-28")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2000-01-01")).toBe(true);
    expect(isCalendarDay("2100-12-31")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-1-01")).toBe(false);
    expect(isCalendarDay("01-11-2026")).toBe(false);
    expect(isCalendarDay("1999-12-31")).toBe(false);
    expect(isCalendarDay("2101-01-01")).toBe(false);
    expect(isCalendarDay("9999-12-31")).toBe(false);
  });
});

describe("calendar arithmetic", () => {
  it("moves across months and years and counts inclusive days", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(calendarRangeLength("2026-11-11", "2026-11-11")).toBe(1);
    expect(calendarRangeLength("2026-01-01", "2026-12-31")).toBe(365);
  });

  it("throws on a day outside the accepted ones (callers validate first)", () => {
    expect(() => addCalendarDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addCalendarDays("9999-12-31", 1)).toThrow(RangeError);
  });
});

describe("reportRangeProblem", () => {
  it("accepts an ordered range of up to 366 days and missing ends", () => {
    expect(reportRangeProblem("2026-11-11", "2026-11-11")).toBeNull();
    expect(reportRangeProblem("2027-01-01", "2028-01-01")).toBeNull();
    expect(reportRangeProblem("", "2026-11-11")).toBeNull();
    expect(reportRangeProblem("", "")).toBeNull();
  });

  it("points an invalid date at its own field only", () => {
    expect(reportRangeProblem("2026-02-30", "2026-03-01")).toEqual({
      fields: ["from"],
      message: INVALID_DAY_MESSAGE,
    });
    expect(reportRangeProblem("", "9999-12-31")).toEqual({
      fields: ["to"],
      message: INVALID_DAY_MESSAGE,
    });
    expect(reportRangeProblem("x", "y")).toEqual({
      fields: ["from", "to"],
      message: INVALID_DAY_MESSAGE,
    });
  });

  it("marks both fields for a reversed range and the start for a too long one", () => {
    expect(reportRangeProblem("2026-11-12", "2026-11-11")).toEqual({
      fields: ["from", "to"],
      message: RANGE_ORDER_MESSAGE,
    });
    expect(reportRangeProblem("2026-01-01", "2027-01-02")).toEqual({
      fields: ["from"],
      message: RANGE_SPAN_MESSAGE,
    });
  });
});
