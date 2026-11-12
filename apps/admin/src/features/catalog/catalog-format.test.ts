import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  isCheckboxEnter,
  isNewerVersion,
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

  it("detects a version saved after the one being edited", () => {
    const base = { updatedAt: new Date("2026-11-01T12:00:00.000Z") };
    expect(isNewerVersion(base, { updatedAt: new Date("2026-11-01T12:00:00.001Z") })).toBe(true);
    expect(isNewerVersion(base, { updatedAt: new Date("2026-11-01T12:00:00.000Z") })).toBe(false);
    expect(isNewerVersion(base, { updatedAt: new Date("2026-11-01T11:59:59.999Z") })).toBe(false);
  });

  it("saves on Enter only from the checkbox (text fields use onSubmitEditing)", () => {
    const checkbox = { type: "checkbox" } as unknown as EventTarget;
    const select = { type: "select-one" } as unknown as EventTarget;
    expect(isCheckboxEnter("Enter", checkbox, false)).toBe(true);
    expect(isCheckboxEnter("Enter", checkbox, true)).toBe(false);
    expect(isCheckboxEnter(" ", checkbox, false)).toBe(false);
    expect(isCheckboxEnter("Enter", select, false)).toBe(false);
    expect(isCheckboxEnter("Enter", null, false)).toBe(false);
  });

  it("names the product in the success message", () => {
    expect(productSavedMessage("Mantenol", "created")).toBe("Producto «Mantenol» creado.");
    expect(productSavedMessage("Mantenol", "updated")).toBe("Cambios de «Mantenol» guardados.");
  });
});
