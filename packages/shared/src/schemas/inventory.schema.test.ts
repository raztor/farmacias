import { describe, expect, it } from "vitest";

import {
  lowStockThresholdSchema,
  stockAdjustmentSchema,
  stockDeltaIssue,
  stockReasonSchema,
} from "./inventory.schema";

const VALID = { productId: "p1", kind: "receipt", delta: 12, reason: "Recepción proveedor" };

const firstMessage = (input: unknown): string | undefined => {
  const result = stockAdjustmentSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
};

describe("stockReasonSchema", () => {
  it("trims and accepts 5 to 280 characters", () => {
    expect(stockReasonSchema.parse("  Merma  ")).toBe("Merma");
    expect(stockReasonSchema.safeParse("x".repeat(280)).success).toBe(true);
  });

  it.each([[""], ["    "], ["abcd"], [undefined]])("rejects the missing reason %j", (value) => {
    const result = stockReasonSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Indica el motivo (al menos 5 caracteres).");
  });

  it("rejects more than 280 characters", () => {
    expect(stockReasonSchema.safeParse("x".repeat(281)).error?.issues[0]?.message).toBe(
      "El motivo admite hasta 280 caracteres.",
    );
  });
});

describe("stockDeltaIssue", () => {
  it.each([
    ["receipt", 1, null],
    ["receipt", 0, "La cantidad no puede ser 0."],
    ["receipt", -1, "Una recepción suma unidades: ingresa una cantidad mayor que 0."],
    ["adjustment", -3, null],
    ["adjustment", 3, null],
    ["adjustment", 0, "La cantidad no puede ser 0."],
  ] as const)("%s with delta %i", (kind, delta, issue) => {
    expect(stockDeltaIssue(kind, delta)).toBe(issue);
  });
});

describe("stockAdjustmentSchema", () => {
  it("accepts a receipt and a negative adjustment", () => {
    expect(stockAdjustmentSchema.parse(VALID)).toEqual(VALID);
    expect(stockAdjustmentSchema.parse({ ...VALID, kind: "adjustment", delta: -4 }).delta).toBe(-4);
  });

  it("reports the delta issue on the delta field", () => {
    const result = stockAdjustmentSchema.safeParse({ ...VALID, delta: -2 });
    expect(result.error?.issues[0]?.path).toEqual(["delta"]);
  });

  it.each([
    [{ ...VALID, delta: 1.5 }, "Ingresa una cantidad entera de unidades."],
    [{ ...VALID, delta: 10_001 }, "La cantidad admite hasta 10.000 unidades por movimiento."],
    [{ ...VALID, kind: "sale" }, "Elige si es una recepción o un ajuste."],
    [{ ...VALID, productId: " " }, "Selecciona un producto."],
    [{ ...VALID, reason: "" }, "Indica el motivo (al menos 5 caracteres)."],
  ])("rejects %j", (input, message) => {
    expect(firstMessage(input)).toBe(message);
  });
});

describe("lowStockThresholdSchema", () => {
  it.each([[0], [5], [999]])("accepts %i", (value) => {
    expect(lowStockThresholdSchema.parse(value)).toBe(value);
  });

  it.each([[-1], [1000], [2.5]])("rejects %d", (value) => {
    expect(lowStockThresholdSchema.safeParse(value).error?.issues[0]?.message).toBe(
      "El umbral debe ser un número entero entre 0 y 999.",
    );
  });
});
