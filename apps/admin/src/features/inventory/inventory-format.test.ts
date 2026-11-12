import { describe, expect, it } from "vitest";

import {
  MOVEMENT_REASON_LABELS,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
  adjustmentSuccessMessage,
  formatDelta,
  stockUnitsLabel,
} from "./inventory-format";

describe("inventory format", () => {
  it("labels every level and movement reason in Spanish", () => {
    expect(STOCK_LEVEL_LABELS).toEqual({
      available: "Disponible",
      low: "Stock bajo",
      out: "Agotado",
    });
    expect(STOCK_LEVEL_TONES.out).toBe("danger");
    expect(MOVEMENT_REASON_LABELS.receipt).toBe("Recepción");
    expect(MOVEMENT_REASON_LABELS.sale).toBe("Venta (pago aprobado)");
  });

  it("formats units and signed deltas", () => {
    expect(stockUnitsLabel(1)).toBe("1 unidad");
    expect(stockUnitsLabel(0)).toBe("0 unidades");
    expect(formatDelta(12)).toBe("+12");
    expect(formatDelta(-3)).toBe("-3");
  });

  it("states the change and the resulting stock after a receipt or adjustment", () => {
    expect(
      adjustmentSuccessMessage({
        kind: "receipt",
        delta: 12,
        quantityAfter: 16,
        item: { name: "Paracetamol" },
      }),
    ).toBe("Recepción registrada para Paracetamol (+12 unidades). Stock actual: 16 unidades.");
    expect(
      adjustmentSuccessMessage({
        kind: "adjustment",
        delta: -1,
        quantityAfter: 1,
        item: { name: "Zinc" },
      }),
    ).toBe("Ajuste registrado para Zinc (-1 unidad). Stock actual: 1 unidad.");
  });
});
