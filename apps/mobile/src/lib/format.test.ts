import { describe, expect, it } from "vitest";

import { formatClp, formatDate, formatDateTime, formatUnits } from "./format";

/** Intl may use non-breaking spaces; compare with plain ones. */
const plain = (text: string) => text.replace(/\s/gu, " ");

describe("formatClp", () => {
  it("formats integer pesos with dot thousands separators and no decimals", () => {
    expect(formatClp(12_990)).toBe("$12.990");
    expect(formatClp(990)).toBe("$990");
    expect(formatClp(1_234_567)).toBe("$1.234.567");
    expect(formatClp(0)).toBe("$0");
  });
});

describe("formatDateTime / formatDate", () => {
  it("shows the time in Chile (UTC-3 in November)", () => {
    const date = new Date("2026-11-03T13:42:00Z");

    expect(plain(formatDateTime(date))).toBe("3 nov 2026, 10:42");
    expect(plain(formatDate(date))).toBe("3 nov 2026");
  });

  it("uses the Chilean winter offset (UTC-4 in July)", () => {
    expect(plain(formatDateTime(new Date("2026-07-15T14:05:00Z")))).toBe("15 jul 2026, 10:05");
  });

  it("changes the day when UTC is already past midnight", () => {
    expect(plain(formatDate(new Date("2026-11-04T02:00:00Z")))).toBe("3 nov 2026");
  });
});

describe("formatUnits", () => {
  it("uses singular and plural", () => {
    expect(formatUnits(1)).toBe("1 unidad");
    expect(formatUnits(0)).toBe("0 unidades");
    expect(formatUnits(12)).toBe("12 unidades");
  });
});
