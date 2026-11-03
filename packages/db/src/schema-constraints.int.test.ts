import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase } from "./testing/test-database";

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL no definida";

const residentId = "resident-1";

await test("schema constraints on PostgreSQL", { skip }, async (t) => {
  if (!TEST_DATABASE_URL) return;
  const testDb = await createTestDatabase(TEST_DATABASE_URL);
  const { db } = testDb;
  try {
    await db.user.create({
      data: { id: residentId, name: "Residente Uno", email: "residente1@demo.farmacia.cl" },
    });
    const { id: productId } = await db.product.create({
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
    });

    await t.test("new users default to the resident role", async () => {
      const user = await db.user.findUniqueOrThrow({ where: { id: residentId } });
      assert.equal(user.role, "resident");
    });

    await t.test("stock can never go negative (CHECK on_hand >= 0)", async () => {
      await assert.rejects(
        db.inventoryItem.update({ where: { productId }, data: { onHand: { decrement: 3 } } }),
        /inventory_items_on_hand_check/,
      );
      const discounted = await db.$executeRaw`
        UPDATE inventory_items SET on_hand = on_hand - 3, version = version + 1
        WHERE product_id = ${productId} AND on_hand >= 3`;
      assert.equal(discounted, 0);
      const item = await db.inventoryItem.findUniqueOrThrow({ where: { productId } });
      assert.equal(item.onHand, 2);
    });

    await t.test("products reject unknown categories and non-positive prices", async () => {
      const base = {
        commercialName: "X",
        activeIngredient: "Y",
        presentation: "Z",
        searchText: "x y z",
      };
      await assert.rejects(
        db.product.create({
          data: { ...base, sku: "IT-BAD-1", category: "cosmeticos", priceClp: 1000 },
        }),
        /products_category_check/,
      );
      await assert.rejects(
        db.product.create({ data: { ...base, sku: "IT-BAD-2", category: "otros", priceClp: 0 } }),
        /products_price_clp_check/,
      );
    });

    await t.test("orders get sequential human codes and one draft per resident", async () => {
      const draft = await db.order.create({ data: { residentId } });
      assert.match(draft.code, /^P-\d{6,}$/);
      assert.equal(draft.status, "draft");
      await assert.rejects(
        db.order.create({ data: { residentId } }),
        (error: unknown) =>
          error instanceof Error && /orders_one_draft_per_resident|Unique/i.test(error.message),
      );
      const confirmed = await db.order.create({
        data: { residentId, status: "pending_payment", fulfillment: "pickup" },
      });
      assert.ok(Number(confirmed.code.slice(2)) > Number(draft.code.slice(2)));
    });

    await t.test("orders enforce valid status and delivery data", async () => {
      await assert.rejects(
        db.order.create({ data: { residentId, status: "shipped", fulfillment: "pickup" } }),
        /orders_status_check/,
      );
      await assert.rejects(
        db.order.create({ data: { residentId, status: "pending_payment" } }),
        /orders_fulfillment_required_check/,
      );
      await assert.rejects(
        db.order.create({
          data: {
            residentId,
            status: "pending_payment",
            fulfillment: "delivery",
            deliverySector: "Sector 1",
          },
        }),
        /orders_delivery_details_check/,
      );
    });

    await t.test(
      "order lines keep 1..99 units, consistent totals and one row per product",
      async () => {
        const order = await db.order.create({
          data: { residentId, status: "pending_payment", fulfillment: "pickup" },
        });
        const line = { orderId: order.id, productId, unitPriceClp: 1990 };
        await assert.rejects(
          db.orderLine.create({ data: { ...line, quantity: 100, lineTotalClp: 199_000 } }),
          /order_lines_quantity_check/,
        );
        await assert.rejects(
          db.orderLine.create({ data: { ...line, quantity: 2, lineTotalClp: 1 } }),
          /order_lines_line_total_clp_check/,
        );
        await db.orderLine.create({ data: { ...line, quantity: 2, lineTotalClp: 3980 } });
        await assert.rejects(
          db.orderLine.create({ data: { ...line, quantity: 1, lineTotalClp: 1990 } }),
          (error: unknown) =>
            error instanceof Error && /Unique|order_lines_order_id_product_id/i.test(error.message),
        );
      },
    );

    await t.test("payments are unique per idempotency key", async () => {
      const order = await db.order.create({
        data: { residentId, status: "pending_payment", fulfillment: "pickup" },
      });
      const idempotencyKey = randomUUID();
      const payment = { orderId: order.id, idempotencyKey, amountClp: 1990, status: "approved" };
      await db.payment.create({ data: payment });
      await assert.rejects(
        db.payment.create({ data: payment }),
        (error: unknown) => error instanceof Error && /Unique|idempotency_key/i.test(error.message),
      );
      // Several rejected attempts are fine, but never a second approved payment for the order.
      await db.payment.create({
        data: { ...payment, idempotencyKey: randomUUID(), status: "rejected" },
      });
      await assert.rejects(
        db.payment.create({ data: { ...payment, idempotencyKey: randomUUID() } }),
        (error: unknown) =>
          error instanceof Error && /Unique|payments_one_approved_per_order/i.test(error.message),
      );
    });

    await t.test("stock movements validate reason, arithmetic and order", async () => {
      await assert.rejects(
        db.stockMovement.create({
          data: { productId, delta: 5, reason: "receipt", quantityBefore: 2, quantityAfter: 9 },
        }),
        /stock_movements_quantities_check/,
      );
      await assert.rejects(
        db.stockMovement.create({
          data: { productId, delta: -1, reason: "sale", quantityBefore: 2, quantityAfter: 1 },
        }),
        /stock_movements_order_check/,
      );
      await assert.rejects(
        db.stockMovement.create({
          data: { productId, delta: 1, reason: "theft", quantityBefore: 2, quantityAfter: 3 },
        }),
        /stock_movements_(direction|reason)_check/,
      );
    });

    await t.test("audit rows accept only known roles and actions", async () => {
      const row = { entityType: "order", entityId: "1" };
      await assert.rejects(
        db.auditLog.create({ data: { ...row, actorRole: "robot", action: "order.transition" } }),
        /audit_logs_actor_role_check/,
      );
      await assert.rejects(
        db.auditLog.create({ data: { ...row, actorRole: "admin", action: "order.delete" } }),
        /audit_logs_action_check/,
      );
      const created = await db.auditLog.create({
        data: {
          actorRole: "system",
          action: "stock.sale",
          entityType: "product",
          entityId: productId,
        },
      });
      assert.equal(created.actorId, null);
    });

    await t.test("status events accept notes up to 200 characters", async () => {
      const order = await db.order.create({
        data: { residentId, status: "pending_payment", fulfillment: "pickup" },
      });
      const event = { orderId: order.id, fromStatus: "draft", toStatus: "pending_payment" };
      await db.orderStatusEvent.create({
        data: { ...event, actorRole: "resident", actorId: residentId, note: "a".repeat(200) },
      });
      await assert.rejects(
        db.orderStatusEvent.create({
          data: { ...event, actorRole: "operator", note: "a".repeat(201) },
        }),
        /order_status_events_note_check/,
      );
      await assert.rejects(
        db.orderStatusEvent.create({ data: { ...event, toStatus: "lost", actorRole: "system" } }),
        /order_status_events_to_status_check/,
      );
    });
  } finally {
    await testDb.drop();
  }
});
