import { buildCatalogProducts } from "@repo/db";
import { describe, expect, it } from "vitest";

import {
  adminListProductsInput,
  createProductInput,
  updateProductInput,
} from "./catalog-admin.schema";

describe("adminListProductsInput (R-CAT-15)", () => {
  it("defaults to every status and 20 rows", () => {
    expect(adminListProductsInput.parse({})).toEqual({ status: "all", limit: 20 });
  });

  it("trims the term and rejects more than 100 characters or unknown statuses", () => {
    expect(adminListProductsInput.parse({ q: "  losartan " }).q).toBe("losartan");
    expect(adminListProductsInput.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(adminListProductsInput.safeParse({ status: "deleted" }).success).toBe(false);
  });
});

describe("createProductInput / updateProductInput (R-CAT-12, R-CAT-13)", () => {
  it("accepts every product of the synthetic seed (same limits as the real catalog)", () => {
    for (const { onHand: _onHand, ...product } of buildCatalogProducts()) {
      const result = createProductInput.safeParse({ ...product, active: true });
      expect(result.success, product.sku).toBe(true);
    }
  });

  it("requires a product id to update", () => {
    const fields = {
      sku: "E2E-1",
      commercialName: "Producto",
      activeIngredient: "Principio",
      presentation: "Caja x 10",
      category: "otros",
      priceClp: 990,
      active: false,
    };
    expect(updateProductInput.safeParse(fields).success).toBe(false);
    expect(updateProductInput.parse({ ...fields, id: " prod-1 " }).id).toBe("prod-1");
  });
});
