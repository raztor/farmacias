import { describe, expect, it } from "vitest";

import { STAT_PLACEHOLDER, formatStatValue } from "./format-stat";

describe("formatStatValue", () => {
  it("shows a placeholder while loading", () => {
    expect(formatStatValue(undefined)).toBe(STAT_PLACEHOLDER);
  });

  it("formats with Chilean thousands separators", () => {
    expect(formatStatValue(0)).toBe("0");
    expect(formatStatValue(999)).toBe("999");
    expect(formatStatValue(1_234_567)).toBe("1.234.567");
  });
});
