import type { RepeatChange } from "@repo/api";
import { describe, expect, it } from "vitest";

import { formatRepeatChange, repeatNoticeView } from "./repeat-notice";

const change = (overrides: Partial<RepeatChange>): RepeatChange => ({
  productId: "p1",
  commercialName: "Paracetamol 500 mg",
  requested: 5,
  added: 2,
  reason: "reduced",
  ...overrides,
});

describe("formatRepeatChange (HU-14)", () => {
  it("says how many units were added out of the requested ones", () => {
    expect(formatRepeatChange(change({}))).toBe(
      "Paracetamol 500 mg: se agregaron 2 de 5 por disponibilidad",
    );
  });

  it("uses the singular for one unit", () => {
    expect(formatRepeatChange(change({ added: 1, requested: 3 }))).toBe(
      "Paracetamol 500 mg: se agregó 1 de 3 por disponibilidad",
    );
  });

  it("explains a reduction to zero because the cart already has every unit", () => {
    expect(formatRepeatChange(change({ added: 0 }))).toBe(
      "Paracetamol 500 mg: ya tienes en tu pedido todas las unidades disponibles, no se agregó",
    );
  });

  it("reports out-of-stock and inactive products as not added", () => {
    expect(
      formatRepeatChange(change({ commercialName: "Ibuprofeno", added: 0, reason: "unavailable" })),
    ).toBe("Ibuprofeno: agotado, no se agregó");
    expect(
      formatRepeatChange(change({ commercialName: "Aspirina", added: 0, reason: "inactive" })),
    ).toBe("Aspirina: ya no está en el catálogo, no se agregó");
  });
});

describe("repeatNoticeView (HU-14)", () => {
  it("confirms a full repetition with a success notice and no items", () => {
    expect(repeatNoticeView({ orderCode: "P-000123", lineCount: 2, changes: [] })).toEqual({
      tone: "success",
      title: "Agregamos los productos del pedido P-000123",
      items: [],
    });
  });

  it("lists every change when only part of the order was added", () => {
    const view = repeatNoticeView({
      orderCode: "P-000123",
      lineCount: 2,
      changes: [change({ commercialName: "Ibuprofeno", added: 0, reason: "unavailable" })],
    });

    expect(view).toEqual({
      tone: "warning",
      title: "Agregamos el pedido P-000123 con cambios",
      items: ["Ibuprofeno: agotado, no se agregó"],
    });
  });

  it("says nothing could be added when every line was skipped", () => {
    const view = repeatNoticeView({
      orderCode: "P-000123",
      lineCount: 1,
      changes: [change({ added: 0, reason: "inactive" })],
    });

    expect(view.tone).toBe("warning");
    expect(view.title).toBe("No pudimos agregar productos del pedido P-000123");
  });

  it("does not call it a failure when a reduced line still added units", () => {
    const view = repeatNoticeView({ orderCode: "P-1", lineCount: 1, changes: [change({})] });

    expect(view.title).toBe("Agregamos el pedido P-1 con cambios");
  });
});
