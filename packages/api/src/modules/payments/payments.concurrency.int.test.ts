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
import { createPaymentsRepository } from "./payments.repository";
import type { StockConflictProduct } from "./payments.schema";
import { createPaymentsService } from "./payments.service";
import { createSimulatedPaymentGateway } from "./simulated-payment-gateway";

/** PAY-I03, PAY-I04, INV-I06 (RNF-08): concurrency proofs on a real PostgreSQL. */
describe.skipIf(!INTEGRATION_ENABLED)("payments.pay under concurrency", () => {
  const db = (): PrismaClient => getTestDb();
  const service = () =>
    createPaymentsService({
      repo: createPaymentsRepository(db()),
      gateway: createSimulatedPaymentGateway(),
    });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /**
   * Asserts that every rejected payment is CONFLICT `STOCK_CONFLICT` and that each one reports a
   * product whose requested quantity really exceeded the stock seen under the lock. Returns how
   * many payments were rejected.
   */
  const expectOnlyStockConflicts = (results: readonly PromiseSettledResult<unknown>[]): number => {
    const rejected = results.filter((result) => result.status === "rejected");
    for (const failure of rejected) {
      expect(failure.reason).toMatchObject({
        code: "CONFLICT",
        details: { reason: "STOCK_CONFLICT" },
      });
      const { products } = (failure.reason as { details: { products: StockConflictProduct[] } })
        .details;
      expect(products.some((product) => product.requested > product.available)).toBe(true);
    }
    return rejected.length;
  };

  /** 20 pending orders for A and B, half of them with their lines in reverse order. */
  const createMultiLineOrders = (residentId: string, productA: string, productB: string) => {
    const plans = Array.from({ length: 20 }, (_, index) => ({
      qa: 1 + (index % 2),
      qb: 1 + ((index + 1) % 3 === 0 ? 1 : 0),
      reversed: index % 2 === 0,
    }));
    return Promise.all(
      plans.map(async (plan) => {
        const lines = [
          { productId: productA, quantity: plan.qa },
          { productId: productB, quantity: plan.qb },
        ];
        const order = await createOrder(db(), residentId, {
          status: "pending_payment",
          lines: plan.reversed ? lines.reverse() : lines,
        });
        return { order, plan };
      }),
    );
  };

  const onHand = async (productId: string) =>
    (await db().inventoryItem.findUniqueOrThrow({ where: { productId } })).onHand;

  it("20 parallel payments racing for the last 5 units: exactly 5 validated, stock 0", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 5 });
    const orders = await Promise.all(
      Array.from({ length: 20 }, () =>
        createOrder(db(), resident.id, {
          status: "pending_payment",
          lines: [{ productId: product.id, quantity: 1 }],
        }),
      ),
    );

    const results = await Promise.allSettled(
      orders.map((order) =>
        service().pay({
          residentId: resident.id,
          orderId: order.id,
          idempotencyKey: randomUUID(),
          scenario: "approve",
        }),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(5);
    expect(rejected).toHaveLength(15);
    for (const failure of rejected) {
      expect(failure.reason).toMatchObject({
        code: "CONFLICT",
        details: { reason: "STOCK_CONFLICT" },
      });
    }
    expect(await onHand(product.id)).toBe(0);
    expect(await db().order.count({ where: { status: "payment_validated" } })).toBe(5);
    expect(await db().order.count({ where: { status: "pending_payment" } })).toBe(15);
    expect(await db().payment.count({ where: { status: "approved" } })).toBe(5);
    expect(await db().payment.count({ where: { status: "stock_conflict" } })).toBe(15);
    expect(await db().stockMovement.count()).toBe(5);
    expect(await db().auditLog.count({ where: { action: "payment.stock_conflict" } })).toBe(15);
  });

  it("multi-line orders in random line order: no deadlock, no negative stock, ledger matches", async () => {
    const resident = await createUser(db());
    const a = await createProduct(db(), { onHand: 7 });
    const b = await createProduct(db(), { onHand: 9 });
    const orders = await createMultiLineOrders(resident.id, a.id, b.id);

    const results = await Promise.allSettled(
      orders.map(({ order }) =>
        service().pay({
          residentId: resident.id,
          orderId: order.id,
          idempotencyKey: randomUUID(),
          scenario: "approve",
        }),
      ),
    );

    // A deadlock (40P01/P2034), a timeout (P2028) or any other failure is a bug: the only
    // acceptable rejection is a real stock conflict, reported under the inventory locks.
    const rejected = expectOnlyStockConflicts(results);
    expect(results.length - rejected).toBe(
      await db().order.count({ where: { status: "payment_validated" } }),
    );
    expect(await db().payment.count({ where: { status: "stock_conflict" } })).toBe(rejected);
    expect(await db().payment.count({ where: { status: "approved" } })).toBe(
      results.length - rejected,
    );
    const validated = await db().order.findMany({ where: { status: "payment_validated" } });
    const validatedIds = new Set(validated.map((order) => order.id));
    const sold = orders.filter(({ order }) => validatedIds.has(order.id));
    const soldA = sold.reduce((sum, { plan }) => sum + plan.qa, 0);
    const soldB = sold.reduce((sum, { plan }) => sum + plan.qb, 0);
    expect(validated.length).toBeGreaterThan(0);
    expect(await onHand(a.id)).toBe(7 - soldA);
    expect(await onHand(b.id)).toBe(9 - soldB);
    expect(await onHand(a.id)).toBeGreaterThanOrEqual(0);
    expect(await onHand(b.id)).toBeGreaterThanOrEqual(0);
    // Stopping early would be a bug: every pending order really lacked stock for some line.
    const remaining = { a: 7 - soldA, b: 9 - soldB };
    for (const { order, plan } of orders.filter(({ order }) => !validatedIds.has(order.id))) {
      expect(plan.qa > remaining.a || plan.qb > remaining.b, order.code).toBe(true);
    }
    const movements = await db().stockMovement.findMany();
    expect(movements).toHaveLength(sold.length * 2);
    expect(movements.every((movement) => validatedIds.has(movement.orderId ?? ""))).toBe(true);
  });

  it("10 parallel duplicates of the same attempt: one payment, one discount", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 10 });
    const order = await createOrder(db(), resident.id, {
      status: "pending_payment",
      lines: [{ productId: product.id, quantity: 3 }],
    });
    const key = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service().pay({
          residentId: resident.id,
          orderId: order.id,
          idempotencyKey: key,
          scenario: "approve",
        }),
      ),
    );

    expect(new Set(results.map((result) => result.paymentId)).size).toBe(1);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(await onHand(product.id)).toBe(7);
    expect(await db().payment.count()).toBe(1);
    expect(await db().stockMovement.count()).toBe(1);
    expect(await db().orderStatusEvent.count()).toBe(1);
  });

  it("the same key raced on two orders: one wins, the other gets IDEMPOTENCY_KEY_REUSED", async () => {
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 10 });
    const orders = await Promise.all(
      [1, 2].map(() =>
        createOrder(db(), resident.id, {
          status: "pending_payment",
          lines: [{ productId: product.id, quantity: 1 }],
        }),
      ),
    );
    const key = randomUUID();

    const results = await Promise.allSettled(
      orders.map((order) =>
        service().pay({
          residentId: resident.id,
          orderId: order.id,
          idempotencyKey: key,
          scenario: "approve",
        }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect(failure?.reason).toMatchObject({ details: { reason: "IDEMPOTENCY_KEY_REUSED" } });
    expect(await onHand(product.id)).toBe(9);
  });
});
