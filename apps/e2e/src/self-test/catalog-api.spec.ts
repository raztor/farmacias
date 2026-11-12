import { expect, test } from "@playwright/test";

import { isE2eProduct, syntheticProduct } from "../support/catalog-api.ts";
import { hasDiacritics } from "../support/search-terms.ts";

test.describe("productos temporales del catálogo: verificación de los helpers", () => {
  test("generan datos sin tildes, con un sufijo solo de letras y reconocibles", () => {
    const product = syntheticProduct();

    expect(product.tag).toMatch(/^[A-Z]{10}$/);
    expect(product.sku).toBe(`E2E-HU11-${product.tag}`);
    expect(product.commercialName).toBe(`E2E HU11 ${product.tag}`);
    for (const text of [product.commercialName, product.activeIngredient, product.presentation]) {
      expect(hasDiacritics(text), text).toBe(false);
    }
    expect(isE2eProduct(product)).toBe(true);
    expect(isE2eProduct({ commercialName: "Tensivar" })).toBe(false);
    expect(syntheticProduct().tag).not.toBe(product.tag);
  });
});
