import { PRODUCT_SKU_TAKEN_MESSAGE, PRODUCT_STALE_MESSAGE } from "@repo/shared";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { isSkuTakenError, isStaleProductError, reportSkuTaken } from "./catalog-errors";

function apiError(message: string, code: string, httpStatus: number) {
  return TRPCClientError.from({ error: { message, code: -32_600, data: { code, httpStatus } } });
}

describe("catalog errors", () => {
  it("recognizes the duplicate SKU CONFLICT", () => {
    const error = apiError(PRODUCT_SKU_TAKEN_MESSAGE, "CONFLICT", 409);
    expect(isSkuTakenError(error)).toBe(true);
    expect(isStaleProductError(error)).toBe(false);
  });

  it("recognizes the stale version CONFLICT", () => {
    const error = apiError(PRODUCT_STALE_MESSAGE, "CONFLICT", 409);
    expect(isStaleProductError(error)).toBe(true);
    expect(isSkuTakenError(error)).toBe(false);
  });

  it("reports only a duplicate SKU on the SKU field", () => {
    const reported: [string, string][] = [];
    const report = (field: "sku", message: string) => {
      reported.push([field, message]);
    };

    reportSkuTaken(apiError(PRODUCT_SKU_TAKEN_MESSAGE, "CONFLICT", 409), report);
    reportSkuTaken(apiError(PRODUCT_STALE_MESSAGE, "CONFLICT", 409), report);

    expect(reported).toEqual([["sku", PRODUCT_SKU_TAKEN_MESSAGE]]);
  });

  it("ignores other errors, even with the same text", () => {
    expect(isSkuTakenError(apiError(PRODUCT_SKU_TAKEN_MESSAGE, "BAD_REQUEST", 400))).toBe(false);
    expect(isStaleProductError(new Error(PRODUCT_STALE_MESSAGE))).toBe(false);
  });
});
