import { describe, expect, it } from "vitest";

import { canDecrease, canIncrease, clampQuantity } from "./quantity-stepper.logic";

describe("clampQuantity", () => {
  const bounds = { min: 1, max: 5 };

  it("keeps values inside the bounds", () => {
    expect(clampQuantity(3, bounds)).toBe(3);
    expect(clampQuantity(1, bounds)).toBe(1);
    expect(clampQuantity(5, bounds)).toBe(5);
  });

  it("clamps values outside the bounds", () => {
    expect(clampQuantity(0, bounds)).toBe(1);
    expect(clampQuantity(-4, bounds)).toBe(1);
    expect(clampQuantity(9, bounds)).toBe(5);
  });

  it("drops decimals and non-finite values", () => {
    expect(clampQuantity(2.9, bounds)).toBe(2);
    expect(clampQuantity(Number.NaN, bounds)).toBe(1);
    expect(clampQuantity(Number.POSITIVE_INFINITY, bounds)).toBe(1);
  });

  it("returns min when nothing is available (max below min)", () => {
    expect(clampQuantity(3, { min: 1, max: 0 })).toBe(1);
  });
});

describe("canDecrease / canIncrease", () => {
  const bounds = { min: 1, max: 3 };

  it("disables «−» at the minimum and «+» at the maximum", () => {
    expect(canDecrease(1, bounds)).toBe(false);
    expect(canIncrease(1, bounds)).toBe(true);
    expect(canDecrease(3, bounds)).toBe(true);
    expect(canIncrease(3, bounds)).toBe(false);
  });

  it("disables both buttons when there is a single possible value", () => {
    expect(canDecrease(1, { min: 1, max: 1 })).toBe(false);
    expect(canIncrease(1, { min: 1, max: 1 })).toBe(false);
  });
});
