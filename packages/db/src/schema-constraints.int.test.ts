import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "./generated/prisma/client";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase, type TestDatabase } from "./testing/test-database";

const residentId = "resident-1";

describe.skipIf(!TEST_DATABASE_URL)("schema constraints on PostgreSQL", () => {
  let testDb: TestDatabase | undefined;
  let db: PrismaClient;
  let productId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    db = testDb.db;
    await db.user.create({
      data: { id: residentId, name: "Residente Uno", email: "residente1@demo.farmacia.cl" },
    });
    ({ id: productId } = await db.product.create({
      data: {
        sku: "IT-001",
        commercialName: "Producto Prueba",
        activeIngredient: "Principio",
        presentation: "Comprimidos x 10",
        category: "otros",
        priceClp: 1990,
        searchText: "producto prueba principio comprimidos x 10",
        inventory: { create: { onHand: 2 } },
      },
      select: { id: true },
    }));
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  it("new users default to the resident role", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: residentId } });
    expect(user.role).toBe("resident");
  });

  it("stock can never go negative (CHECK on_hand >= 0)", async () => {
    await expect(
      db.inventoryItem.update({ where: { productId }, data: { onHand: { decrement: 3 } } }),
    ).rejects.toThrow(/inventory_items_on_hand_check/);
    const discounted = await db.$executeRaw`
      UPDATE inventory_items SET on_hand = on_hand - 3, version = version + 1
      WHERE product_id = ${productId} AND on_hand >= 3`;
    expect(discounted).toBe(0);
    const item = await db.inventoryItem.findUniqueOrThrow({ where: { productId } });
    expect(item.onHand).toBe(2);
  });

  it("products reject unknown categories and non-positive prices", async () => {
    const base = { commercialName: "X", activeIngredient: "Y", presentation: "Z", searchText: "x" };
    await expect(
      db.product.create({
        data: { ...base, sku: "IT-BAD-1", category: "cosmeticos", priceClp: 1000 },
      }),
    ).rejects.toThrow(/products_category_check/);
    await expect(
      db.product.create({ data: { ...base, sku: "IT-BAD-2", category: "otros", priceClp: 0 } }),
    ).rejects.toThrow(/products_price_clp_check/);
  });

  it("orders get sequential human codes and one draft per resident", async () => {
    const draft = await db.order.create({ data: { residentId } });
    expect(draft.code).toMatch(/^P-\d{6,}$/);
    expect(draft.status).toBe("draft");
    await expect(db.order.create({ data: { residentId } })).rejects.toThrow(
      /orders_one_draft_per_resident|Unique/i,
    );
    const confirmed = await db.order.create({
      data: { residentId, status: "pending_payment", fulfillment: "pickup" },
    });
    expect(Number(confirmed.code.slice(2))).toBeGreaterThan(Number(draft.code.slice(2)));
  });

  it("orders enforce valid status and delivery data", async () => {
    await expect(
      db.order.create({ data: { residentId, status: "shipped", fulfillment: "pickup" } }),
    ).rejects.toThrow(/orders_status_check/);
    await expect(
      db.order.create({ data: { residentId, status: "pending_payment" } }),
    ).rejects.toThrow(/orders_fulfillment_required_check/);
    await expect(
      db.order.create({
        data: {
          residentId,
          status: "pending_payment",
          fulfillment: "delivery",
          deliverySector: "Sector 1",
        },
      }),
    ).rejects.toThrow(/orders_delivery_details_check/);
  });

  it("order lines keep 1..99 units, consistent totals and one row per product", async () => {
    const order = await db.order.create({
      data: { residentId, status: "pending_payment", fulfillment: "pickup" },
    });
    const line = { orderId: order.id, productId, unitPriceClp: 1990 };
    await expect(
      db.orderLine.create({ data: { ...line, quantity: 100, lineTotalClp: 199_000 } }),
    ).rejects.toThrow(/order_lines_quantity_check/);
    await expect(
      db.orderLine.create({ data: { ...line, quantity: 2, lineTotalClp: 1 } }),
    ).rejects.toThrow(/order_lines_line_total_clp_check/);
    await db.orderLine.create({ data: { ...line, quantity: 2, lineTotalClp: 3980 } });
    await expect(
      db.orderLine.create({ data: { ...line, quantity: 1, lineTotalClp: 1990 } }),
    ).rejects.toThrow(/Unique|order_lines_order_id_product_id/i);
  });

  it("payments are unique per idempotency key", async () => {
    const order = await db.order.create({
      data: { residentId, status: "pending_payment", fulfillment: "pickup" },
    });
    const idempotencyKey = randomUUID();
    const payment = { orderId: order.id, idempotencyKey, amountClp: 1990, status: "approved" };
    await db.payment.create({ data: payment });
    await expect(db.payment.create({ data: payment })).rejects.toThrow(/Unique|idempotency_key/i);
    // Several rejected attempts are fine, but never a second approved payment for the order.
    await db.payment.create({
      data: { ...payment, idempotencyKey: randomUUID(), status: "rejected" },
    });
    await expect(
      db.payment.create({ data: { ...payment, idempotencyKey: randomUUID() } }),
    ).rejects.toThrow(/Unique|payments_one_approved_per_order/i);
  });

  it("stock movements validate reason, arithmetic and order", async () => {
    await expect(
      db.stockMovement.create({
        data: { productId, delta: 5, reason: "receipt", quantityBefore: 2, quantityAfter: 9 },
      }),
    ).rejects.toThrow(/stock_movements_quantities_check/);
    await expect(
      db.stockMovement.create({
        data: { productId, delta: -1, reason: "sale", quantityBefore: 2, quantityAfter: 1 },
      }),
    ).rejects.toThrow(/stock_movements_order_check/);
    await expect(
      db.stockMovement.create({
        data: { productId, delta: 1, reason: "theft", quantityBefore: 2, quantityAfter: 3 },
      }),
    ).rejects.toThrow(/stock_movements_(direction|reason)_check/);
  });

  it("audit rows accept only known roles and actions", async () => {
    const row = { entityType: "order", entityId: "1" };
    await expect(
      db.auditLog.create({ data: { ...row, actorRole: "robot", action: "order.transition" } }),
    ).rejects.toThrow(/audit_logs_actor_role_check/);
    await expect(
      db.auditLog.create({ data: { ...row, actorRole: "admin", action: "order.delete" } }),
    ).rejects.toThrow(/audit_logs_action_check/);
    const created = await db.auditLog.create({
      data: {
        actorRole: "system",
        action: "stock.sale",
        entityType: "product",
        entityId: productId,
      },
    });
    expect(created.actorId).toBeNull();
  });

  it("status events accept notes up to 200 characters", async () => {
    const order = await db.order.create({
      data: { residentId, status: "pending_payment", fulfillment: "pickup" },
    });
    const event = { orderId: order.id, fromStatus: "draft", toStatus: "pending_payment" };
    await db.orderStatusEvent.create({
      data: { ...event, actorRole: "resident", actorId: residentId, note: "a".repeat(200) },
    });
    await expect(
      db.orderStatusEvent.create({
        data: { ...event, actorRole: "operator", note: "a".repeat(201) },
      }),
    ).rejects.toThrow(/order_status_events_note_check/);
    await expect(
      db.orderStatusEvent.create({ data: { ...event, toStatus: "lost", actorRole: "system" } }),
    ).rejects.toThrow(/order_status_events_to_status_check/);
  });
});
