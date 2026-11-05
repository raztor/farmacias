import { describe, expect, it } from "vitest";

import {
  addToOrderState,
  availabilityWarning,
  exceedsAvailability,
  maxAddable,
  maxLineQuantity,
} from "./cart-limits";

describe("maxLineQuantity", () => {
  it("is the stock on hand, capped at 99 units per line", () => {
    expect(maxLineQuantity(5)).toBe(5);
    expect(maxLineQuantity(250)).toBe(99);
    expect(maxLineQuantity(0)).toBe(0);
    expect(maxLineQuantity(-3)).toBe(0);
  });
});

describe("maxAddable (HU-03 #2: the maximum allowed)", () => {
  it("subtracts the units already in the order", () => {
    expect(maxAddable(5, 0)).toBe(5);
    expect(maxAddable(5, 2)).toBe(3);
    expect(maxAddable(5, 5)).toBe(0);
    expect(maxAddable(120, 90)).toBe(9);
  });

  it("never goes below zero when stock dropped", () => {
    expect(maxAddable(2, 4)).toBe(0);
  });
});

describe("addToOrderState", () => {
  it("asks to sign in before creating an order", () => {
    expect(addToOrderState({ isSignedIn: false, availableQty: 4, inDraft: 0 })).toEqual({
      kind: "sign_in",
    });
  });

  it("says a product without stock cannot be added, signed in or not", () => {
    expect(addToOrderState({ isSignedIn: true, availableQty: 0, inDraft: 0 }).kind).toBe(
      "out_of_stock",
    );
    expect(addToOrderState({ isSignedIn: false, availableQty: 0, inDraft: 0 }).kind).toBe(
      "out_of_stock",
    );
  });

  it("lets a signed-in resident add up to the remaining units (HU-03 #1)", () => {
    expect(addToOrderState({ isSignedIn: true, availableQty: 4, inDraft: 1 })).toEqual({
      kind: "can_add",
      max: 3,
      inDraft: 1,
    });
  });

  it("reports when every available unit is already in the order", () => {
    expect(addToOrderState({ isSignedIn: true, availableQty: 4, inDraft: 4 })).toEqual({
      kind: "limit_reached",
      inDraft: 4,
    });
  });
});

describe("exceedsAvailability", () => {
  it("flags lines above the current stock", () => {
    expect(exceedsAvailability({ quantity: 3, availableQty: 2 })).toBe(true);
    expect(exceedsAvailability({ quantity: 2, availableQty: 2 })).toBe(false);
    expect(exceedsAvailability({ quantity: 99, availableQty: 500 })).toBe(false);
  });
});

describe("availabilityWarning (RNF-09)", () => {
  it("asks to remove a sold-out product instead of lowering a quantity that cannot reach 0", () => {
    expect(availabilityWarning(0)).toBe(
      "Este producto se agotó. Quítalo de tu pedido para continuar.",
    );
    expect(availabilityWarning(-2)).toBe(
      "Este producto se agotó. Quítalo de tu pedido para continuar.",
    );
  });

  it("uses the singular when one unit is left", () => {
    expect(availabilityWarning(1)).toBe(
      "Ahora solo queda 1 unidad disponible. Baja la cantidad a 1 o quita el producto.",
    );
  });

  it("states the plural maximum, capped at 99 per line", () => {
    expect(availabilityWarning(3)).toBe(
      "Ahora solo hay 3 unidades disponibles. Baja la cantidad o quita el producto.",
    );
    expect(availabilityWarning(250)).toContain("solo hay 99 unidades disponibles");
  });
});
