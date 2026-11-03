import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@repo/db";
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
import { createPaymentsRepository, type PaymentsRepository } from "./payments.repository";
import { createPaymentsService } from "./payments.service";
import { createSimulatedPaymentGateway } from "./simulated-payment-gateway";

/** PAY-I01, PAY-I02, PAY-I05, PAY-I06, AUD-I02/I03 (docs/specs/payments.md, audit.md). */
describe.skipIf(!INTEGRATION_ENABLED)("payments.pay on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const service = (repo: PaymentsRepository = createPaymentsRepository(db())) =>
    createPaymentsService({ repo, gateway: createSimulatedPaymentGateway() });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const setup = async (stock: { a: number; b: number } = { a: 5, b: 3 }) => {
    const resident = await createUser(db());
    const a = await createProduct(db(), { onHand: stock.a, commercialName: "Losartán 50 mg" });
    const b = await createProduct(db(), { onHand: stock.b, commercialName: "Melatonina 3 mg" });
    const order = await createOrder(db(), resident.id, {
      status: "pending_payment",
      lines: [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 3 },
      ],
    });
    const pay = (scenario: "approve" | "reject", idempotencyKey = randomUUID()) =>
      service().pay({ residentId: resident.id, orderId: order.id, idempotencyKey, scenario });
    return { resident, a, b, order, pay };
  };

  const onHand = async (productId: string) =>
    (await db().inventoryItem.findUniqueOrThrow({ where: { productId } })).onHand;

  it("approved: discounts once and writes payment, movements, event and audit together", async () => {
    const { a, b, order, pay } = await setup();

    const result = await pay("approve");

    expect(result).toMatchObject({ outcome: "approved", replayed: false });
    expect(result.order).toMatchObject({ status: "payment_validated", version: 1 });
    expect([await onHand(a.id), await onHand(b.id)]).toEqual([3, 0]);
    const payment = await db().payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment).toMatchObject({ status: "approved", amountClp: order.totalClp });
    expect(payment.reference).toMatch(/^SIM-/);
    const movements = await db().stockMovement.findMany({ where: { orderId: order.id } });
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.reason === "sale" && m.paymentId === payment.id)).toBe(true);
    expect(movements.find((m) => m.productId === b.id)).toMatchObject({
      delta: -3,
      quantityBefore: 3,
      quantityAfter: 0,
    });
    const events = await db().orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toEqual([
      expect.objectContaining({
        fromStatus: "pending_payment",
        toStatus: "payment_validated",
        actorRole: "system",
        actorId: null,
      }),
    ]);
    const actions = (await db().auditLog.findMany()).map((row) => row.action).sort();
    expect(actions).toEqual(["order.transition", "stock.sale", "stock.sale"]);
  });

  it("rejected: informs the rejection and leaves on_hand and movements untouched (RF-08)", async () => {
    const { a, b, order, pay } = await setup();

    const result = await pay("reject");

    expect(result).toMatchObject({ outcome: "rejected", order: { status: "payment_rejected" } });
    expect([await onHand(a.id), await onHand(b.id)]).toEqual([5, 3]);
    expect(await db().stockMovement.count()).toBe(0);
    expect(await db().payment.findMany({ where: { orderId: order.id } })).toEqual([
      expect.objectContaining({ status: "rejected" }),
    ]);
  });

  it("same key twice: one payment, one discount, the second call is a replay", async () => {
    const { a, pay } = await setup();
    const key = randomUUID();

    const first = await pay("approve", key);
    const second = await pay("approve", key);

    expect(second).toMatchObject({ paymentId: first.paymentId, replayed: true });
    expect(await onHand(a.id)).toBe(3);
    expect(await db().payment.count()).toBe(1);
    expect(await db().stockMovement.count()).toBe(2);
  });

  it("retry after a rejection with a new key validates the order (R-PAY-08)", async () => {
    const { a, order, pay } = await setup();
    await pay("reject");
    const result = await pay("approve");
    expect(result.order.status).toBe("payment_validated");
    expect(await onHand(a.id)).toBe(3);
    const events = await db().orderStatusEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.toStatus)).toEqual([
      "payment_rejected",
      "payment_validated",
    ]);
  });

  it("stock_conflict: order stays pending, nothing discounted, evidence in payment and audit", async () => {
    const { a, b, order, pay } = await setup({ a: 5, b: 2 });

    await expect(pay("approve")).rejects.toMatchObject({
      code: "CONFLICT",
      details: {
        reason: "STOCK_CONFLICT",
        products: [
          { productId: b.id, commercialName: "Melatonina 3 mg", requested: 3, available: 2 },
        ],
      },
    });

    expect([await onHand(a.id), await onHand(b.id)]).toEqual([5, 2]);
    expect(await db().stockMovement.count()).toBe(0);
    const stored = await db().order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored).toMatchObject({ status: "pending_payment", version: 0 });
    const payment = await db().payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment).toMatchObject({ status: "stock_conflict", failureReason: "STOCK_CONFLICT" });
    const audit = await db().auditLog.findMany();
    expect(audit).toEqual([
      expect.objectContaining({
        action: "payment.stock_conflict",
        entityType: "order",
        entityId: order.id,
        actorRole: "system",
        after: {
          paymentId: payment.id,
          products: [
            { productId: b.id, commercialName: "Melatonina 3 mg", requested: 3, available: 2 },
          ],
        },
      }),
    ]);
    expect(await db().orderStatusEvent.count()).toBe(0);
  });

  it("a stock_conflict key replays the same conflict without new rows (R-PAY-10)", async () => {
    const { b, pay } = await setup({ a: 5, b: 2 });
    const key = randomUUID();
    await expect(pay("approve", key)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(pay("approve", key)).rejects.toMatchObject({
      details: { reason: "STOCK_CONFLICT", products: [{ productId: b.id, available: 2 }] },
    });
    expect(await db().payment.count()).toBe(1);
    expect(await db().auditLog.count()).toBe(1);
  });

  it("is all or nothing: a failure after the discount rolls back stock, payment and audit", async () => {
    const { a, b, resident, order } = await setup();
    const real = createPaymentsRepository(db());
    const failing: PaymentsRepository = {
      transaction: (run) =>
        real.transaction((tx) =>
          run({
            ...tx,
            transitions: {
              ...tx.transitions,
              insertEvent: () => Promise.reject(new Error("simulated crash")),
            },
          }),
        ),
    };

    await expect(
      service(failing).pay({
        residentId: resident.id,
        orderId: order.id,
        idempotencyKey: randomUUID(),
        scenario: "approve",
      }),
    ).rejects.toThrow("simulated crash");

    expect([await onHand(a.id), await onHand(b.id)]).toEqual([5, 3]);
    expect(await db().payment.count()).toBe(0);
    expect(await db().stockMovement.count()).toBe(0);
    expect(await db().auditLog.count()).toBe(0);
    expect((await db().order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "pending_payment",
    );
  });

  it("refuses another resident's order and unpaid statuses", async () => {
    const { order } = await setup();
    const stranger = await createUser(db());
    await expect(
      service().pay({
        residentId: stranger.id,
        orderId: order.id,
        idempotencyKey: randomUUID(),
        scenario: "approve",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const draft = await createOrder(db(), stranger.id, { status: "draft" });
    await expect(
      service().pay({
        residentId: stranger.id,
        orderId: draft.id,
        idempotencyKey: randomUUID(),
        scenario: "approve",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "ORDER_NOT_PAYABLE" } });
    expect(await db().payment.count()).toBe(0);
  });
});
