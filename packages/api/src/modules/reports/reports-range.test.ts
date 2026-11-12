import { INVALID_DAY_MESSAGE, RANGE_ORDER_MESSAGE, RANGE_SPAN_MESSAGE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  FUTURE_LIMIT_MESSAGE,
  resolveReportRange,
  santiagoDayOf,
  startOfSantiagoDay,
} from "./reports-range";
import { reportsSummaryInput } from "./reports.schema";

describe("Chile's time zone (D-23)", () => {
  it("reads the calendar day in Chile, not in UTC", () => {
    // 02:59 UTC is 23:59 of the previous day in summer time (UTC-3).
    expect(santiagoDayOf(new Date("2026-11-12T02:59:00.000Z"))).toBe("2026-11-11");
    expect(santiagoDayOf(new Date("2026-11-12T03:00:00.000Z"))).toBe("2026-11-12");
    // Winter time (UTC-4).
    expect(santiagoDayOf(new Date("2026-07-01T03:59:00.000Z"))).toBe("2026-06-30");
  });

  it("starts a day at local midnight in summer and in winter", () => {
    expect(startOfSantiagoDay("2026-11-11").toISOString()).toBe("2026-11-11T03:00:00.000Z");
    expect(startOfSantiagoDay("2026-07-01").toISOString()).toBe("2026-07-01T04:00:00.000Z");
  });

  it("starts the day after the September clock change at 01:00 (skipped midnight)", () => {
    // 2026-09-06: clocks jump from 00:00 (UTC-4) to 01:00 (UTC-3).
    const start = startOfSantiagoDay("2026-09-06");
    expect(start.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(santiagoDayOf(new Date(start.getTime() - 1))).toBe("2026-09-05");
  });

  it("starts the day after the April clock change at its only midnight on that day", () => {
    // 2026-04-05: at 00:00 (UTC-3) clocks go back to 23:00 of the 4th (UTC-4).
    const start = startOfSantiagoDay("2026-04-05");
    expect(start.toISOString()).toBe("2026-04-05T04:00:00.000Z");
    expect(santiagoDayOf(new Date(start.getTime() - 1))).toBe("2026-04-04");
  });
});

describe("resolveReportRange", () => {
  // 2026-11-12 01:00 UTC is still 2026-11-11 in Chile.
  const now = new Date("2026-11-12T01:00:00.000Z");

  it("defaults to the last 30 days in Chile, today included", () => {
    const resolution = resolveReportRange({}, now);
    expect(resolution).toEqual({
      ok: true,
      range: {
        from: "2026-10-13",
        to: "2026-11-11",
        start: new Date("2026-10-13T03:00:00.000Z"),
        end: new Date("2026-11-12T03:00:00.000Z"),
      },
    });
  });

  it("fills a missing end from the other one", () => {
    expect(resolveReportRange({ to: "2026-07-31" }, now)).toMatchObject({
      ok: true,
      range: { from: "2026-07-02", to: "2026-07-31" },
    });
    expect(resolveReportRange({ from: "2026-11-01" }, now)).toMatchObject({
      ok: true,
      range: { from: "2026-11-01", to: "2026-11-11" },
    });
  });

  it("rejects an end beyond one year from today, and years outside 2000..2100", () => {
    expect(resolveReportRange({ from: "2027-11-01", to: "2027-11-13" }, now)).toEqual({
      ok: false,
      problem: { fields: ["to"], message: FUTURE_LIMIT_MESSAGE },
    });
    expect(resolveReportRange({ to: "2027-11-12" }, now)).toMatchObject({ ok: true });
    expect(resolveReportRange({ to: "9999-12-31" }, now)).toEqual({
      ok: false,
      problem: { fields: ["to"], message: INVALID_DAY_MESSAGE },
    });
  });

  it("reports a start after today or a too long window opened by one end", () => {
    expect(resolveReportRange({ from: "2026-12-01" }, now)).toEqual({
      ok: false,
      problem: { fields: ["from", "to"], message: RANGE_ORDER_MESSAGE },
    });
    expect(resolveReportRange({ from: "2024-01-01" }, now)).toEqual({
      ok: false,
      problem: { fields: ["from"], message: RANGE_SPAN_MESSAGE },
    });
    expect(resolveReportRange({ to: "2026-02-30" }, now)).toEqual({
      ok: false,
      problem: { fields: ["to"], message: INVALID_DAY_MESSAGE },
    });
  });
});

describe("reportsSummaryInput", () => {
  it("accepts an empty input and trims the days", () => {
    expect(reportsSummaryInput.parse({})).toEqual({});
    expect(reportsSummaryInput.parse({ from: " 2026-11-01 ", to: "2026-11-11" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-11",
    });
  });

  it("points the error at the wrong field", () => {
    const reversed = reportsSummaryInput.safeParse({ from: "2026-11-12", to: "2026-11-11" });
    expect(reversed.error?.issues).toMatchObject([
      { path: ["from"], message: RANGE_ORDER_MESSAGE },
      { path: ["to"], message: RANGE_ORDER_MESSAGE },
    ]);
    const overflow = reportsSummaryInput.safeParse({ to: "9999-12-31" });
    expect(overflow.error?.issues).toMatchObject([{ path: ["to"], message: INVALID_DAY_MESSAGE }]);
    const invalid = reportsSummaryInput.safeParse({ to: "2026-11-31" });
    expect(invalid.error?.issues).toMatchObject([{ path: ["to"], message: INVALID_DAY_MESSAGE }]);
  });
});
