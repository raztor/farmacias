import { describe, expect, it } from "vitest";

import { toFieldErrors } from "../../lib/zod-form-errors";
import {
  EMPTY_DELIVERY_FORM,
  deliveryFormSchema,
  initialDeliveryValues,
  toFulfillmentInput,
  type DeliveryFormValues,
} from "./checkout.schema";

const VALID: DeliveryFormValues = {
  sector: "Villa Los Presidentes",
  addressReference: "Pasaje Ficticio 123",
  contactAlias: "Vecina Ana",
  instructions: "",
};

function errorsOf(values: DeliveryFormValues) {
  const result = deliveryFormSchema.safeParse(values);
  return result.success ? {} : toFieldErrors<DeliveryFormValues>(result.error.issues);
}

describe("deliveryFormSchema (HU-04 #2)", () => {
  it("accepts complete synthetic delivery data", () => {
    expect(errorsOf(VALID)).toEqual({});
  });

  it.each([
    ["sector", "Indica el sector"],
    ["addressReference", "Indica una referencia de dirección"],
    ["contactAlias", "Indica un alias de contacto"],
  ] as const)("identifies the missing field %s", (field, message) => {
    expect(errorsOf({ ...VALID, [field]: "   " })).toEqual({ [field]: message });
  });

  it("reports every missing field at once", () => {
    expect(Object.keys(errorsOf(EMPTY_DELIVERY_FORM)).sort()).toEqual([
      "addressReference",
      "contactAlias",
      "sector",
    ]);
  });

  it("limits the length of each field", () => {
    expect(errorsOf({ ...VALID, sector: "a".repeat(61) })).toEqual({
      sector: "El sector admite hasta 60 caracteres",
    });
    expect(errorsOf({ ...VALID, instructions: "a".repeat(201) })).toEqual({
      instructions: "Las indicaciones admiten hasta 200 caracteres",
    });
  });

  it("trims spaces", () => {
    const parsed = deliveryFormSchema.parse({ ...VALID, sector: "  Lo Hermida  " });

    expect(parsed.sector).toBe("Lo Hermida");
  });
});

describe("toFulfillmentInput", () => {
  it("sends no address for pickup (HU-04 #1)", () => {
    expect(toFulfillmentInput("pickup", deliveryFormSchema.parse(VALID))).toEqual({
      type: "pickup",
    });
    expect(toFulfillmentInput("pickup", null)).toEqual({ type: "pickup" });
  });

  it("sends the delivery data and omits empty instructions", () => {
    expect(toFulfillmentInput("delivery", deliveryFormSchema.parse(VALID))).toEqual({
      type: "delivery",
      sector: "Villa Los Presidentes",
      addressReference: "Pasaje Ficticio 123",
      contactAlias: "Vecina Ana",
    });
    const withNote = deliveryFormSchema.parse({ ...VALID, instructions: "Tocar el timbre" });
    expect(toFulfillmentInput("delivery", withNote)).toMatchObject({
      instructions: "Tocar el timbre",
    });
  });

  it("returns null for delivery without valid data", () => {
    expect(toFulfillmentInput("delivery", null)).toBeNull();
  });
});

describe("initialDeliveryValues", () => {
  it("starts empty without saved data", () => {
    expect(initialDeliveryValues(null)).toEqual(EMPTY_DELIVERY_FORM);
  });

  it("prefills the saved delivery data", () => {
    expect(
      initialDeliveryValues({
        sector: "Lo Hermida",
        addressReference: "Calle Inventada 45",
        contactAlias: "Don Pedro",
        instructions: null,
      }),
    ).toEqual({
      sector: "Lo Hermida",
      addressReference: "Calle Inventada 45",
      contactAlias: "Don Pedro",
      instructions: "",
    });
  });
});
