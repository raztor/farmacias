import { describe, expect, it } from "vitest";

import { addItemInput, cancelInput, confirmInput, setFulfillmentInput } from "./orders.schema";

const delivery = {
  type: "delivery",
  sector: "Villa Sintética",
  addressReference: "Pasaje Ficticio 123",
  contactAlias: "Vecina Demo",
} as const;

const firstIssue = (input: unknown) => {
  const result = setFulfillmentInput.safeParse(input);
  if (result.success) throw new Error("expected a validation error");
  return result.error.issues[0];
};

describe("orders schemas", () => {
  describe("setFulfillmentInput (HU-04)", () => {
    it("accepts pickup without any address (criterion 1)", () => {
      expect(setFulfillmentInput.parse({ type: "pickup" })).toEqual({ type: "pickup" });
    });

    it("strips address fields sent with pickup", () => {
      expect(setFulfillmentInput.parse({ type: "pickup", sector: "X" })).toEqual({
        type: "pickup",
      });
    });

    it("accepts a complete synthetic delivery and normalizes blank instructions", () => {
      expect(setFulfillmentInput.parse({ ...delivery, instructions: "  " })).toEqual({
        ...delivery,
        instructions: null,
      });
      expect(setFulfillmentInput.parse(delivery)).toMatchObject({ instructions: null });
    });

    it.each([
      ["sector", "Indica el sector"],
      ["addressReference", "Indica una referencia de dirección"],
      ["contactAlias", "Indica un alias de contacto"],
    ] as const)("identifies the missing delivery field %s (criterion 2)", (field, message) => {
      const { [field]: _omitted, ...incomplete } = delivery;
      expect(firstIssue(incomplete)).toMatchObject({ path: [field], message });
      expect(firstIssue({ ...delivery, [field]: "   " })).toMatchObject({
        path: [field],
        message,
      });
    });

    it("rejects an unknown fulfillment type with a plain message", () => {
      expect(firstIssue({ type: "drone" })).toMatchObject({
        message: "Elige retiro en farmacia o despacho simulado",
      });
    });

    it("limits the length of every synthetic field", () => {
      expect(firstIssue({ ...delivery, sector: "s".repeat(61) })).toMatchObject({
        path: ["sector"],
      });
      expect(firstIssue({ ...delivery, instructions: "i".repeat(201) })).toMatchObject({
        path: ["instructions"],
      });
    });
  });

  describe("addItemInput (HU-03)", () => {
    it("accepts integer quantities between 1 and 99", () => {
      expect(addItemInput.parse({ productId: " p1 ", quantity: 99 })).toEqual({
        productId: "p1",
        quantity: 99,
      });
    });

    it.each([0, 100, 1.5, -2])("rejects quantity %s", (quantity) => {
      expect(addItemInput.safeParse({ productId: "p1", quantity }).success).toBe(false);
    });

    it("never accepts a price from the client", () => {
      expect(addItemInput.parse({ productId: "p1", quantity: 1, unitPriceClp: 1 })).toEqual({
        productId: "p1",
        quantity: 1,
      });
    });
  });

  it("requires the reviewed version to confirm and caps the cancel note", () => {
    expect(confirmInput.safeParse({}).success).toBe(false);
    expect(confirmInput.parse({ expectedVersion: 3 })).toEqual({ expectedVersion: 3 });
    expect(
      cancelInput.safeParse({ id: "o1", expectedVersion: 0, note: "n".repeat(201) }).success,
    ).toBe(false);
  });
});
