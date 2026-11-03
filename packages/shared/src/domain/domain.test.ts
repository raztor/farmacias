import { describe, expect, it } from "vitest";

import { ROLE_VALUES } from "../roles";
import {
  ACTOR_ROLES,
  AUDIT_ACTIONS,
  FULFILLMENT_LABELS,
  FULFILLMENT_TYPES,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  STOCK_MOVEMENT_REASONS,
  isActorRole,
  isAuditAction,
  isFulfillmentType,
  isOrderStatus,
  isPaymentStatus,
  isProductCategory,
  isStockMovementReason,
} from "./index";

const hasUniqueValues = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

describe("domain value lists", () => {
  it("match the values allowed by the database CHECK constraints", () => {
    expect(ORDER_STATUSES).toEqual([
      "draft",
      "pending_payment",
      "payment_validated",
      "payment_rejected",
      "in_preparation",
      "ready_for_pickup",
      "in_transit",
      "delivered",
      "not_delivered",
      "cancelled",
    ]);
    expect(FULFILLMENT_TYPES).toEqual(["pickup", "delivery"]);
    expect(PRODUCT_CATEGORIES).toEqual([
      "cardiovascular",
      "salud-mental",
      "analgesicos",
      "suplementos",
      "digestivo",
      "otros",
    ]);
    expect(STOCK_MOVEMENT_REASONS).toEqual([
      "sale",
      "cancellation_restore",
      "receipt",
      "adjustment",
    ]);
    expect(PAYMENT_STATUSES).toEqual(["approved", "rejected", "stock_conflict"]);
    expect(ACTOR_ROLES).toEqual(["resident", "operator", "admin", "system"]);
    expect(AUDIT_ACTIONS).toEqual([
      "order.transition",
      "stock.sale",
      "stock.restore",
      "payment.stock_conflict",
      "user.role_change",
    ]);
  });

  it("have no duplicates", () => {
    for (const list of [
      ORDER_STATUSES,
      FULFILLMENT_TYPES,
      PRODUCT_CATEGORIES,
      STOCK_MOVEMENT_REASONS,
      PAYMENT_STATUSES,
      ACTOR_ROLES,
      AUDIT_ACTIONS,
    ]) {
      expect(hasUniqueValues(list)).toBe(true);
    }
  });

  it("actor roles are every user role plus system", () => {
    expect(ACTOR_ROLES).toEqual([...ROLE_VALUES, "system"]);
  });

  it("labels cover every value with non-empty Spanish text", () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(Object.keys(PRODUCT_CATEGORY_LABELS).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
    expect(Object.keys(FULFILLMENT_LABELS).sort()).toEqual([...FULFILLMENT_TYPES].sort());
    expect(ORDER_STATUS_LABELS.in_preparation).toBe("En preparación");
    expect(PRODUCT_CATEGORY_LABELS["salud-mental"]).toBe("Salud mental");
  });
});

describe("type guards", () => {
  it.each([
    ["isOrderStatus", isOrderStatus, "in_transit", "shipped"],
    ["isFulfillmentType", isFulfillmentType, "pickup", "courier"],
    ["isProductCategory", isProductCategory, "digestivo", "Digestivo"],
    ["isStockMovementReason", isStockMovementReason, "sale", "theft"],
    ["isPaymentStatus", isPaymentStatus, "stock_conflict", "pending"],
    ["isActorRole", isActorRole, "system", "user"],
    ["isAuditAction", isAuditAction, "stock.sale", "stock.delete"],
  ] as const)("%s accepts known values and rejects others", (_name, guard, valid, invalid) => {
    expect(guard(valid)).toBe(true);
    expect(guard(invalid)).toBe(false);
    expect(guard(undefined)).toBe(false);
    expect(guard(1)).toBe(false);
  });
});
