import { AUDIT_ACTIONS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { AUDIT_ACTION_LABELS, describeAuditChange, entityTypeLabel } from "./audit-format";

describe("labels", () => {
  it("labels every audited action in Spanish", () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).not.toBe("");
    expect(AUDIT_ACTION_LABELS["user.role_change"]).toBe("Cambio de rol");
  });

  it("labels entity types", () => {
    expect(entityTypeLabel("order")).toBe("Pedido");
    expect(entityTypeLabel("product")).toBe("Producto");
    expect(entityTypeLabel("legacy")).toBe("legacy");
  });
});

describe("describeAuditChange", () => {
  it("describes order transitions with status labels", () => {
    expect(
      describeAuditChange({
        action: "order.transition",
        before: { status: "payment_validated", version: 2 },
        after: { status: "in_preparation", version: 3, note: "x" },
      }),
    ).toBe("Pago validado → En preparación");
  });

  it("describes stock changes", () => {
    expect(
      describeAuditChange({
        action: "stock.sale",
        before: { onHand: 10 },
        after: { onHand: 8, orderId: "o1" },
      }),
    ).toBe("Stock 10 → 8");
    expect(
      describeAuditChange({ action: "stock.restore", before: null, after: { onHand: 3 } }),
    ).toBe("Stock → 3");
  });

  it("describes role changes", () => {
    expect(
      describeAuditChange({
        action: "user.role_change",
        before: { role: "resident" },
        after: { role: "operator" },
      }),
    ).toBe("Persona inscrita → Operario");
  });

  it("counts the products of a stock conflict", () => {
    expect(
      describeAuditChange({
        action: "payment.stock_conflict",
        before: null,
        after: { paymentId: "p", products: [{ productId: "a" }, { productId: "b" }] },
      }),
    ).toBe("2 productos sin stock suficiente");
    expect(
      describeAuditChange({
        action: "payment.stock_conflict",
        before: null,
        after: { products: [{}] },
      }),
    ).toBe("1 producto sin stock suficiente");
  });

  it("never prints raw JSON for unexpected snapshots", () => {
    expect(describeAuditChange({ action: "order.transition", before: 1, after: "x" })).toBe(
      "Sin detalle",
    );
    expect(describeAuditChange({ action: "payment.stock_conflict", before: null, after: {} })).toBe(
      "Sin detalle",
    );
  });
});

describe("describeAuditChange (Sprint 3 actions)", () => {
  it("describes receipts and adjustments as stock changes", () => {
    expect(
      describeAuditChange({
        action: "stock.receipt",
        before: { onHand: 2 },
        after: { onHand: 12 },
      }),
    ).toBe("Stock 2 → 12");
    expect(
      describeAuditChange({
        action: "stock.adjustment",
        before: { onHand: 5 },
        after: { onHand: 4 },
      }),
    ).toBe("Stock 5 → 4");
  });

  it("describes threshold changes", () => {
    expect(
      describeAuditChange({
        action: "inventory.threshold_change",
        before: { lowStockThreshold: 5 },
        after: { lowStockThreshold: 8 },
      }),
    ).toBe("Umbral 5 → 8");
    expect(
      describeAuditChange({ action: "inventory.threshold_change", before: null, after: {} }),
    ).toBe("Sin detalle");
  });

  it("describes product creation and price changes", () => {
    expect(describeAuditChange({ action: "product.create", before: null, after: {} })).toBe(
      "Producto creado",
    );
    expect(
      describeAuditChange({
        action: "product.update",
        before: { priceClp: 1000 },
        after: { priceClp: 1200 },
      }),
    ).toMatch(/^Precio \$\s?1\.000 → \$\s?1\.200$/u);
    expect(
      describeAuditChange({
        action: "product.update",
        before: { priceClp: 1000, active: true },
        after: { priceClp: 1000, active: false },
      }),
    ).toBe("Datos del producto editados");
  });
});
