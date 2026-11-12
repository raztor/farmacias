import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  productHref,
  productSavedMessage,
  productStatusLabel,
  stockLabel,
} from "./catalog-format";

describe("catalog-format", () => {
  it("builds the edit path with an encoded id", () => {
    expect(productHref("01a1-b2")).toBe("/catalog/01a1-b2");
    expect(productHref("a/b")).toBe("/catalog/a%2Fb");
  });

  it("labels categories, status and stock in Spanish", () => {
    expect(categoryLabel("salud-mental")).toBe("Salud mental");
    expect(productStatusLabel(true)).toBe("Activo");
    expect(productStatusLabel(false)).toBe("Inactivo");
    expect(stockLabel(0)).toBe("Sin stock");
    expect(stockLabel(1)).toBe("1 unidad");
    expect(stockLabel(12)).toBe("12 unidades");
  });

  it("names the product in the success message", () => {
    expect(productSavedMessage("Mantenol", "created")).toBe("Producto «Mantenol» creado.");
    expect(productSavedMessage("Mantenol", "updated")).toBe("Cambios de «Mantenol» guardados.");
  });
});
