import { describe, expect, it } from "vitest";

import { PRODUCT_PRICE_MAX_CLP, productFieldsSchema, productSkuSchema } from "./product.schema";

const valid = {
  sku: " car-los50-b1 ",
  commercialName: "  Tensivar ",
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos recubiertos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 6990,
  active: true,
};

const firstMessage = (input: unknown) => {
  const result = productFieldsSchema.safeParse(input);
  return result.success ? null : (result.error.issues[0]?.message ?? null);
};

describe("productFieldsSchema (HU-11, D-28)", () => {
  it("trims the texts and upper-cases the SKU", () => {
    expect(productFieldsSchema.parse(valid)).toEqual({
      ...valid,
      sku: "CAR-LOS50-B1",
      commercialName: "Tensivar",
    });
  });

  it("rejects a price that is zero, negative, fractional or too high", () => {
    expect(firstMessage({ ...valid, priceClp: 0 })).toBe("El precio debe ser mayor que 0");
    expect(firstMessage({ ...valid, priceClp: -10 })).toBe("El precio debe ser mayor que 0");
    expect(firstMessage({ ...valid, priceClp: 10.5 })).toBe("El precio va en pesos, sin decimales");
    expect(firstMessage({ ...valid, priceClp: PRODUCT_PRICE_MAX_CLP + 1 })).toMatch(/superar/);
    expect(firstMessage({ ...valid, priceClp: "6990" })).toBe("Ingresa el precio en pesos");
  });

  it("rejects blank names and categories outside the closed list", () => {
    expect(firstMessage({ ...valid, commercialName: "   " })).toBe("Ingresa el nombre comercial");
    expect(firstMessage({ ...valid, activeIngredient: "" })).toBe("Ingresa el principio activo");
    expect(firstMessage({ ...valid, presentation: "x".repeat(201) })).toBe("Máximo 200 caracteres");
    expect(firstMessage({ ...valid, category: "cosmeticos" })).toBe("Elige una categoría");
  });

  it("requires the active flag as a boolean", () => {
    expect(firstMessage({ ...valid, active: "true" })).toBe("Indica si el producto está activo");
  });
});

describe("productSkuSchema", () => {
  it.each(["AB", "CAR LOS", "CAR--LOS", "-CAR", "CAR_1", "Ñ-1", "X".repeat(33)])(
    "rejects %j",
    (sku) => {
      expect(productSkuSchema.safeParse(sku).success).toBe(false);
    },
  );

  it.each(["CAR-LOS50-B1", "e2e-123", "ABC"])("accepts %j", (sku) => {
    expect(productSkuSchema.safeParse(sku).success).toBe(true);
  });
});
