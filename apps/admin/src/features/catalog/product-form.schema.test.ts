import { describe, expect, it } from "vitest";

import { validateForm } from "../../lib/form-errors";
import { EMPTY_PRODUCT_FORM, productFormSchema, productFormValues } from "./product-form.schema";

const filled = {
  ...EMPTY_PRODUCT_FORM,
  sku: "e2e-cat-1",
  commercialName: "Mantenol",
  activeIngredient: "Paracetamol",
  presentation: "Comprimidos 500 mg x 16",
  category: "analgesicos",
  priceClp: "1490",
};

describe("productFormSchema (HU-11)", () => {
  it("parses the text controls into the API input", () => {
    expect(productFormSchema.parse(filled)).toEqual({
      sku: "E2E-CAT-1",
      commercialName: "Mantenol",
      activeIngredient: "Paracetamol",
      presentation: "Comprimidos 500 mg x 16",
      category: "analgesicos",
      priceClp: 1490,
      active: true,
    });
  });

  it.each(["$1.490", "1.490", " 1490 ", "$ 1490"])("reads %j as 1490 pesos", (priceClp) => {
    expect(productFormSchema.parse({ ...filled, priceClp }).priceClp).toBe(1490);
  });

  it("reads proper thousands groups of larger prices", () => {
    expect(productFormSchema.parse({ ...filled, priceClp: "$1.250.000" }).priceClp).toBe(1_250_000);
  });

  it.each(["1990.50", "19.90", "1.5", "1.4900", "1,490", "1 490", "1.490.5", ".990", "990."])(
    "rejects %j instead of guessing the decimals",
    (priceClp) => {
      expect(validateForm(productFormSchema, { ...filled, priceClp })).toEqual({
        success: false,
        errors: { priceClp: "Escribe el precio en pesos, solo con números (sin decimales)" },
      });
    },
  );

  it("reads the unchecked active box as an inactive product", () => {
    expect(productFormSchema.parse({ ...filled, active: "false" }).active).toBe(false);
  });

  it("shows one Spanish message per invalid field", () => {
    const result = validateForm(productFormSchema, EMPTY_PRODUCT_FORM);

    expect(result).toEqual({
      success: false,
      errors: {
        sku: "El SKU tiene al menos 3 caracteres",
        commercialName: "Ingresa el nombre comercial",
        activeIngredient: "Ingresa el principio activo",
        presentation: "Ingresa la presentación",
        category: "Elige una categoría",
        priceClp: "Ingresa el precio en pesos",
      },
    });
  });

  it.each([
    ["0", "El precio debe ser mayor que 0"],
    ["1490,5", "Escribe el precio en pesos, solo con números (sin decimales)"],
    ["-5", "Escribe el precio en pesos, solo con números (sin decimales)"],
    ["10000000", "El precio no puede superar $9.999.999"],
  ])("rejects the price %j", (priceClp, message) => {
    expect(validateForm(productFormSchema, { ...filled, priceClp })).toEqual({
      success: false,
      errors: { priceClp: message },
    });
  });
});

describe("productFormValues", () => {
  it("round-trips a stored product through the form", () => {
    const product = productFormSchema.parse({ ...filled, active: "false" });

    expect(productFormValues(product)).toEqual({ ...filled, sku: "E2E-CAT-1", active: "false" });
    expect(productFormSchema.parse(productFormValues(product))).toEqual(product);
  });
});
