import { describe, expect, it } from "vitest";

import { lineTotalClp, orderItemCount, orderTotalClp } from "./order-totals";

describe("order totals (integer CLP)", () => {
  it("computes the line total as quantity × unit price", () => {
    expect(lineTotalClp({ quantity: 3, unitPriceClp: 2490 })).toBe(7470);
  });

  it("sums the line totals and the units", () => {
    const lines = [
      { quantity: 2, unitPriceClp: 1990 },
      { quantity: 1, unitPriceClp: 12_500 },
    ];
    expect(orderTotalClp(lines)).toBe(16_480);
    expect(orderItemCount(lines)).toBe(3);
  });

  it("returns zero for an empty order", () => {
    expect(orderTotalClp([])).toBe(0);
    expect(orderItemCount([])).toBe(0);
  });

  it.each([
    { quantity: 1.5, unitPriceClp: 1000 },
    { quantity: 1, unitPriceClp: 99.9 },
    { quantity: -1, unitPriceClp: 1000 },
    { quantity: 2, unitPriceClp: Number.MAX_SAFE_INTEGER },
  ])("rejects non-integer, negative or unsafe amounts (%o)", (line) => {
    expect(() => lineTotalClp(line)).toThrow(RangeError);
  });
});
