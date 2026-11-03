import { describe, expect, it } from "vitest";

import { addToOrderState, exceedsAvailability, maxAddable, maxLineQuantity } from "./cart-limits";

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
