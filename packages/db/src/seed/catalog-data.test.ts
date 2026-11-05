import { PRODUCT_CATEGORIES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { CATALOG_CATEGORIES, buildCatalogProducts } from "./catalog-data";

const products = buildCatalogProducts();

const countBy = (category: string): number =>
  products.filter((product) => product.category === category).length;

describe("synthetic demo catalog", () => {
  it("generates at least 200 synthetic products", () => {
    expect(products.length).toBeGreaterThanOrEqual(200);
  });

  it("follows the report's demand split per category (±1 point)", () => {
    const expected = {
      cardiovascular: 0.26,
      "salud-mental": 0.22,
      analgesicos: 0.14,
      suplementos: 0.09,
      digestivo: 0.08,
      otros: 0.21,
    } as const;
    for (const category of PRODUCT_CATEGORIES) {
      const share = countBy(category) / products.length;
      expect(Math.abs(share - expected[category]), category).toBeLessThanOrEqual(0.01);
    }
  });

  it("covers every category of @repo/shared, in order, with its exact target", () => {
    for (const catalog of CATALOG_CATEGORIES) {
      expect(countBy(catalog.category), catalog.category).toBe(catalog.target);
    }
    expect(CATALOG_CATEGORIES.map((catalog) => catalog.category)).toEqual([...PRODUCT_CATEGORIES]);
  });

  it("has unique SKUs and unique product identities", () => {
    expect(new Set(products.map((product) => product.sku)).size).toBe(products.length);
    const identities = products.map(
      (product) => `${product.commercialName}|${product.activeIngredient}|${product.presentation}`,
    );
    expect(new Set(identities).size).toBe(products.length);
  });

  it("has realistic CLP prices: integers between 990 and 60.000 ending in 90", () => {
    for (const product of products) {
      expect(Number.isInteger(product.priceClp), product.sku).toBe(true);
      expect(product.priceClp, product.sku).toBeGreaterThanOrEqual(990);
      expect(product.priceClp, product.sku).toBeLessThanOrEqual(60_000);
      expect(product.priceClp % 100, product.sku).toBe(90);
    }
  });

  it("has non-empty descriptive fields", () => {
    for (const product of products) {
      for (const field of [
        product.commercialName,
        product.activeIngredient,
        product.presentation,
      ]) {
        expect(field.trim().length, product.sku).toBeGreaterThan(0);
      }
    }
  });

  it("has some products out of stock, some low (1..5) and most in normal stock", () => {
    const out = products.filter((product) => product.onHand === 0).length;
    const low = products.filter((product) => product.onHand >= 1 && product.onHand <= 5).length;
    const normal = products.length - out - low;
    expect(out).toBeGreaterThanOrEqual(5);
    expect(low).toBeGreaterThanOrEqual(5);
    expect(normal / products.length).toBeGreaterThanOrEqual(0.7);
    for (const product of products) {
      expect(Number.isInteger(product.onHand) && product.onHand >= 0, product.sku).toBe(true);
      expect(product.lowStockThreshold).toBe(5);
    }
  });

  it("includes the report's most demanded active ingredients", () => {
    const has = (ingredient: string, presentation: string): boolean =>
      products.some(
        (product) =>
          product.activeIngredient.startsWith(ingredient) &&
          product.presentation.includes(presentation),
      );
    expect(has("Pregabalina", "75 mg")).toBe(true);
    expect(has("Pregabalina", "150 mg")).toBe(true);
    expect(has("Melatonina", "3 mg")).toBe(true);
    expect(has("Multivitamínico", "x 30")).toBe(true);
    expect(has("Celecoxib", "200 mg")).toBe(true);
    expect(has("Losartán", "50 mg")).toBe(true);
    expect(has("Escitalopram", "10 mg")).toBe(true);
    expect(has("Escitalopram", "20 mg")).toBe(true);
  });

  it("is deterministic (same catalog on every call)", () => {
    expect(buildCatalogProducts()).toEqual(products);
  });
});
