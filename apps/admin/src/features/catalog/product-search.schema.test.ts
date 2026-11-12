import { describe, expect, it } from "vitest";

import { productSearchSchema, toProductStatusFilter } from "./product-search.schema";

describe("productSearchSchema", () => {
  it("trims the term and treats a blank one as no filter", () => {
    expect(productSearchSchema.parse("  losartan ")).toBe("losartan");
    expect(productSearchSchema.parse("   ")).toBeUndefined();
  });

  it("rejects more than 100 characters", () => {
    expect(productSearchSchema.safeParse("x".repeat(101)).success).toBe(false);
  });
});

describe("toProductStatusFilter", () => {
  it("keeps known statuses and falls back to all", () => {
    expect(toProductStatusFilter("inactive")).toBe("inactive");
    expect(toProductStatusFilter("active")).toBe("active");
    expect(toProductStatusFilter("deleted")).toBe("all");
  });
});
