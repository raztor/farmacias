import { describe, expect, it } from "vitest";

import { validateForm } from "../../lib/form-errors";
import {
  EMPTY_STOCK_ADJUSTMENT,
  deltaHint,
  isStockChangeKind,
  previewStock,
  stockAdjustmentFormSchema,
  toAdjustInput,
} from "./stock-adjustment-form";

const errorsOf = (values: typeof EMPTY_STOCK_ADJUSTMENT) => {
  const result = validateForm(stockAdjustmentFormSchema, values);
  return result.success ? {} : result.errors;
};

describe("stockAdjustmentFormSchema (HU-10, D-25)", () => {
  it("parses a receipt and a signed adjustment into the API input", () => {
    const receipt = stockAdjustmentFormSchema.parse({
      kind: "receipt",
      delta: " +12 ",
      reason: " Recepción proveedor ",
    });
    expect(toAdjustInput("p1", receipt)).toEqual({
      productId: "p1",
      kind: "receipt",
      delta: 12,
      reason: "Recepción proveedor",
    });
    expect(
      stockAdjustmentFormSchema.parse({ kind: "adjustment", delta: "-3", reason: "Merma" }).delta,
    ).toBe(-3);
  });

  it("reports a missing quantity and a missing reason on their fields", () => {
    expect(errorsOf(EMPTY_STOCK_ADJUSTMENT)).toEqual({
      delta: "Ingresa la cantidad de unidades.",
      reason: "Indica el motivo (al menos 5 caracteres).",
    });
  });

  it.each([
    ["receipt", "abc", "Ingresa una cantidad entera de unidades (por ejemplo, 12 o -3)."],
    ["receipt", "2.5", "Ingresa una cantidad entera de unidades (por ejemplo, 12 o -3)."],
    ["receipt", "-2", "Una recepción suma unidades: ingresa una cantidad mayor que 0."],
    ["adjustment", "0", "La cantidad no puede ser 0."],
    ["adjustment", "20000", "La cantidad admite hasta 10.000 unidades por movimiento."],
  ])("%s with quantity %j", (kind, delta, message) => {
    expect(errorsOf({ kind, delta, reason: "Conteo físico" }).delta).toBe(message);
  });
});

describe("stock preview", () => {
  it("previews the resulting stock and warns about negative stock", () => {
    expect(previewStock(4, { kind: "receipt", delta: "6", reason: "" })).toBe(10);
    expect(previewStock(4, { kind: "adjustment", delta: "-5", reason: "" })).toBe(-1);
    expect(previewStock(4, { kind: "adjustment", delta: "x", reason: "" })).toBeNull();
    expect(deltaHint(4, { kind: "receipt", delta: "6", reason: "" })).toBe(
      "Unidades recibidas, por ejemplo 12. Stock resultante: 10.",
    );
    expect(deltaHint(4, { kind: "adjustment", delta: "-5", reason: "" })).toBe(
      "Usa un número negativo para restar, por ejemplo -3. Quedaría en -1: no se permite stock negativo.",
    );
    expect(deltaHint(4, { kind: "adjustment", delta: "", reason: "" })).toBe(
      "Usa un número negativo para restar, por ejemplo -3.",
    );
  });

  it("recognizes the two kinds", () => {
    expect(isStockChangeKind("adjustment")).toBe(true);
    expect(isStockChangeKind("sale")).toBe(false);
  });
});
