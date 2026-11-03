import { describe, expect, it } from "vitest";

import { createHealthService } from "./health.service";

describe("health.service", () => {
  it("reports ok with the current server time", () => {
    const service = createHealthService({ now: () => new Date("2026-01-02T03:04:05.000Z") });

    expect(service.ping()).toEqual({ status: "ok", time: "2026-01-02T03:04:05.000Z" });
  });

  it("uses the system clock by default", () => {
    const { time } = createHealthService().ping();

    expect(Number.isNaN(Date.parse(time))).toBe(false);
  });
});
