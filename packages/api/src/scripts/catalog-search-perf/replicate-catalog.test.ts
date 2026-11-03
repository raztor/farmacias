import { buildCatalogProducts } from "@repo/db";
import { describe, expect, it } from "vitest";

import { replicateCatalog } from "./replicate-catalog";

const seed = buildCatalogProducts();

describe("replicateCatalog", () => {
  it("keeps the seed untouched with a single replica", () => {
    expect(replicateCatalog(seed, 1)).toEqual(seed);
  });

  it("multiplies the catalog by the number of replicas with unique SKUs", () => {
    const products = replicateCatalog(seed, 10);

    expect(products).toHaveLength(seed.length * 10);
    expect(new Set(products.map((product) => product.sku)).size).toBe(products.length);
  });

  it("builds realistic synthetic variants of each product", () => {
    const [first] = seed;
    const variant = replicateCatalog(seed, 2)[seed.length];

    expect(first).toBeDefined();
    expect(variant).toMatchObject({
      sku: `${first?.sku ?? ""}-V1`,
      commercialName: `${first?.commercialName ?? ""} Austral`,
      activeIngredient: first?.activeIngredient,
      presentation: first?.presentation,
      category: first?.category,
    });
    expect(variant?.priceClp).toBeGreaterThanOrEqual(990);
    expect(String(variant?.priceClp).endsWith("90")).toBe(true);
  });

  it("includes out-of-stock and low-stock variants and valid stock values", () => {
    const variants = replicateCatalog(seed, 10).slice(seed.length);

    expect(variants.some((product) => product.onHand === 0)).toBe(true);
    expect(variants.some((product) => product.onHand > 0 && product.onHand <= 5)).toBe(true);
    expect(variants.every((product) => product.onHand >= 0)).toBe(true);
  });

  it("numbers laboratory names once the list is exhausted", () => {
    const products = replicateCatalog(seed.slice(0, 1), 11);

    expect(products).toHaveLength(11);
    expect(products.at(-1)?.commercialName.endsWith(" Austral 2")).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects %s replicas", (replicas) => {
    expect(() => replicateCatalog(seed, replicas)).toThrow(/positive integer/);
  });
});
