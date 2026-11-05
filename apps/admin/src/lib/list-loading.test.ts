import { describe, expect, it } from "vitest";

import { isLoadingCurrentResults } from "./list-loading";

describe("isLoadingCurrentResults", () => {
  it("is loading on the first load", () => {
    expect(isLoadingCurrentResults({ isPending: true, isPlaceholderData: false })).toBe(true);
  });

  it("is loading while the previous filters' rows are kept as placeholder", () => {
    // keepPreviousData: isPending is false and data still holds the old filters' rows.
    expect(isLoadingCurrentResults({ isPending: false, isPlaceholderData: true })).toBe(true);
  });

  it("is loaded once the current filters' rows arrive", () => {
    expect(isLoadingCurrentResults({ isPending: false, isPlaceholderData: false })).toBe(false);
  });
});
