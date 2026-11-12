import type { RepeatChange } from "@repo/api";
import { describe, expect, it } from "vitest";

import {
  formatRepeatChange,
  noticeForDraft,
  repeatNoticeView,
  type RepeatNotice,
} from "./repeat-notice";

const change = (overrides: Partial<RepeatChange>): RepeatChange => ({
  productId: "p1",
  commercialName: "Paracetamol",
  presentation: "Comprimidos 500 mg x 16",
  requested: 5,
  added: 2,
  reason: "reduced",
  lineCapReached: false,
  ...overrides,
});

describe("formatRepeatChange (HU-14)", () => {
  it("says how many units were added out of the requested ones, naming the presentation", () => {
    expect(formatRepeatChange(change({}))).toBe(
      "Paracetamol (Comprimidos 500 mg x 16): se agregaron 2 de 5 por disponibilidad",
    );
  });

  it("tells apart two presentations of the same commercial name", () => {
    const fifty = formatRepeatChange(change({ commercialName: "Tensivar", presentation: "50 mg" }));
    const hundred = formatRepeatChange(
      change({ commercialName: "Tensivar", presentation: "100 mg" }),
    );

    expect(fifty).not.toBe(hundred);
    expect(fifty).toContain("Tensivar (50 mg)");
  });

  it("omits empty presentations", () => {
    expect(formatRepeatChange(change({ presentation: "", added: 0, reason: "inactive" }))).toBe(
      "Paracetamol: ya no está en el catálogo, no se agregó",
    );
  });

  it("uses the singular for one unit", () => {
    expect(formatRepeatChange(change({ added: 1, requested: 3 }))).toBe(
      "Paracetamol (Comprimidos 500 mg x 16): se agregó 1 de 3 por disponibilidad",
    );
  });

  it("names the 99-units cap instead of the stock when the cap set the limit", () => {
    expect(formatRepeatChange(change({ added: 19, requested: 30, lineCapReached: true }))).toBe(
      "Paracetamol (Comprimidos 500 mg x 16): se agregaron 19 de 30 (máximo 99 por producto)",
    );
    expect(formatRepeatChange(change({ added: 0, lineCapReached: true }))).toBe(
      "Paracetamol (Comprimidos 500 mg x 16): ya tienes en tu pedido 99 unidades, el máximo por producto; no se agregó",
    );
  });

  it("explains a reduction to zero because the cart already has every unit", () => {
    expect(formatRepeatChange(change({ added: 0 }))).toBe(
      "Paracetamol (Comprimidos 500 mg x 16): ya tienes en tu pedido todas las unidades disponibles, no se agregó",
    );
  });

  it("reports out-of-stock and inactive products as not added", () => {
    const out = change({ commercialName: "Ibuprofeno", presentation: "400 mg", added: 0 });
    expect(formatRepeatChange({ ...out, reason: "unavailable" })).toBe(
      "Ibuprofeno (400 mg): agotado, no se agregó",
    );
    expect(formatRepeatChange({ ...out, reason: "inactive" })).toBe(
      "Ibuprofeno (400 mg): ya no está en el catálogo, no se agregó",
    );
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

  it("lists every change, keyed by product id, when only part of the order was added", () => {
    const view = repeatNoticeView({
      orderCode: "P-000123",
      lineCount: 2,
      changes: [
        change({
          productId: "p9",
          commercialName: "Ibuprofeno",
          presentation: "400 mg",
          added: 0,
          reason: "unavailable",
        }),
      ],
    });

    expect(view).toEqual({
      tone: "warning",
      title: "Agregamos el pedido P-000123 con cambios",
      items: [{ productId: "p9", text: "Ibuprofeno (400 mg): agotado, no se agregó" }],
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

describe("noticeForDraft (HU-14)", () => {
  const notice: RepeatNotice = { orderCode: "P-1", draftId: "draft-1", lineCount: 1, changes: [] };

  it("shows the notice only over the cart it was applied to", () => {
    expect(noticeForDraft(notice, "draft-1")).toBe(notice);
    expect(noticeForDraft(notice, "draft-2")).toBeNull();
  });

  it("hides it once that cart was confirmed (no draft anymore)", () => {
    expect(noticeForDraft(notice, null)).toBeNull();
  });

  it("keeps a notice of nothing added while there is still no cart, and hides it after", () => {
    const empty = { ...notice, draftId: null };

    expect(noticeForDraft(empty, null)).toBe(empty);
    expect(noticeForDraft(empty, "draft-3")).toBeNull();
    expect(noticeForDraft(null, null)).toBeNull();
  });
});
