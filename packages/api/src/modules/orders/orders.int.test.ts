import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@repo/db";
import { noopLogger } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createOrder,
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createPaymentsServiceFromDeps } from "../payments";
import { createOrdersRepository } from "./orders.repository";
import { createOrderTransitionServiceFromDeps, createOrdersService } from "./orders.service";

/** ORD-I01..I03, INV-I04, OST-I01 (docs/specs/orders.md, inventory.md, order-status.md). */
describe.skipIf(!INTEGRATION_ENABLED)("orders on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const orders = () => createOrdersService({ repo: createOrdersRepository(db()) });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const onHand = async (productId: string) =>
    (await db().inventoryItem.findUniqueOrThrow({ where: { productId } })).onHand;

  it("keeps one draft per resident even with concurrent first additions (R-ORD-01)", async () => {
    const resident = await createUser(db());
    const products = await Promise.all([1, 2, 3, 4].map(() => createProduct(db())));

    await Promise.all(
      products.map((product) =>
        orders().addItem({ residentId: resident.id, productId: product.id, quantity: 1 }),
      ),
    );

    const drafts = await db().order.findMany({
      where: { residentId: resident.id, status: "draft" },
      include: { lines: true },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.lines).toHaveLength(4);
    expect(drafts[0]?.totalClp).toBe(4 * 1990);
  });

  it("serializes concurrent additions of the same product within availability", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 5 });

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        orders().addItem({ residentId: resident.id, productId: product.id, quantity: 2 }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const line = await db().orderLine.findFirstOrThrow({ where: { productId: product.id } });
    expect(line).toMatchObject({ quantity: 4, lineTotalClp: 4 * 1990 });
  });

  it("confirm writes the draft → pending_payment event with the actor and never touches stock", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 4, priceClp: 2500 });
    await orders().addItem({ residentId: resident.id, productId: product.id, quantity: 2 });
    const draft = await orders().setFulfillment({ residentId: resident.id, type: "pickup" });
    await db().product.update({ where: { id: product.id }, data: { priceClp: 2700 } });

    const summary = await orders().confirm({
      residentId: resident.id,
      expectedVersion: draft.version,
    });

    expect(summary).toMatchObject({
      status: "pending_payment",
      totalClp: 5400,
      fulfillment: "pickup",
    });
    const stored = await db().order.findUniqueOrThrow({
      where: { id: draft.id },
      include: { lines: true },
    });
    expect(stored).toMatchObject({ totalClp: 5400, deliverySector: null });
    expect(stored.lines[0]).toMatchObject({ unitPriceClp: 2700, lineTotalClp: 5400 });
    const events = await db().orderStatusEvent.findMany({
      where: { orderId: draft.id },
      orderBy: { createdAt: "asc" },
    });
    expect(
      events.map((event) => [event.fromStatus, event.toStatus, event.actorRole, event.actorId]),
    ).toEqual([
      [null, "draft", "resident", resident.id],
      ["draft", "pending_payment", "resident", resident.id],
    ]);
    expect(await onHand(product.id)).toBe(4);
    expect(await db().stockMovement.count()).toBe(0);
  });

  it("stores synthetic delivery data and clears it when switching to pickup", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db());
    await orders().addItem({ residentId: resident.id, productId: product.id, quantity: 1 });
    const delivery = await orders().setFulfillment({
      residentId: resident.id,
      type: "delivery",
      sector: "Villa Sintética",
      addressReference: "Pasaje Ficticio 123",
      contactAlias: "Vecina Demo",
      instructions: null,
    });
    expect(delivery.delivery).toMatchObject({ sector: "Villa Sintética" });

    await orders().setFulfillment({ residentId: resident.id, type: "pickup" });
    const stored = await db().order.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(stored).toMatchObject({
      fulfillment: "pickup",
      deliverySector: null,
      deliveryAddressReference: null,
      deliveryContactAlias: null,
    });
  });

  it("cancelling a paid order restores stock with cancellation_restore, event and audit", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 6 });
    const order = await createOrder(db(), resident.id, {
      status: "pending_payment",
      lines: [{ productId: product.id, quantity: 4 }],
    });
    const payments = createPaymentsServiceFromDeps({ db: db() }, noopLogger);
    const paid = await payments.pay({
      residentId: resident.id,
      orderId: order.id,
      idempotencyKey: randomUUID(),
      scenario: "approve",
    });
    expect(await onHand(product.id)).toBe(2);

    const summary = await orders().cancel({
      residentId: resident.id,
      id: order.id,
      expectedVersion: paid.order.version,
    });

    expect(summary.status).toBe("cancelled");
    expect(await onHand(product.id)).toBe(6);
    const restore = await db().stockMovement.findFirstOrThrow({
      where: { orderId: order.id, reason: "cancellation_restore" },
    });
    expect(restore).toMatchObject({
      delta: 4,
      quantityBefore: 2,
      quantityAfter: 6,
      actorId: resident.id,
    });
    const actions = await db().auditLog.findMany({ where: { action: "stock.restore" } });
    expect(actions).toEqual([
      expect.objectContaining({
        entityId: product.id,
        before: { onHand: 2 },
        after: { onHand: 6, orderId: order.id },
      }),
    ]);
  });

  it("an invalid transition keeps the state; a stale concurrent one loses (CAS)", async () => {
    const resident = await createUser(db());
    const operator = await createUser(db(), { role: "operator" });
    const product = await createProduct(db());
    const order = await createOrder(db(), resident.id, {
      status: "payment_validated",
      fulfillment: "delivery",
      lines: [{ productId: product.id, quantity: 1 }],
    });
    const transitions = createOrderTransitionServiceFromDeps({ db: db() });
    const actor = { id: operator.id, role: "operator" } as const;

    await expect(
      transitions.transition({ orderId: order.id, to: "delivered", actor, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "INVALID_TRANSITION" } });
    await expect(
      transitions.transition({
        orderId: order.id,
        to: "in_preparation",
        actor,
        expectedVersion: 7,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "STALE_VERSION" } });
    expect(await db().orderStatusEvent.count({ where: { orderId: order.id } })).toBe(0);
    expect(await db().auditLog.count()).toBe(0);

    const results = await Promise.allSettled([
      transitions.transition({
        orderId: order.id,
        to: "in_preparation",
        actor,
        expectedVersion: 0,
      }),
      transitions.transition({ orderId: order.id, to: "cancelled", actor, expectedVersion: 0 }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((result) => result.status === "rejected");
    expect(loser?.reason).toMatchObject({ code: "CONFLICT" });
    expect(await db().orderStatusEvent.count({ where: { orderId: order.id } })).toBe(1);
    expect((await db().order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(1);
  });
});
