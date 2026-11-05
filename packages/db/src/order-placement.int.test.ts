import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "./generated/prisma/client";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase, type TestDatabase } from "./testing/test-database";

const DAY_MS = 86_400_000;

/**
 * R-DAT-11: `orders.created_at` is when the order is placed, not when its cart was opened
 * (trigger `orders_stamp_placement`), so the FIFO queue (D-18) follows placement order.
 */
describe.skipIf(!TEST_DATABASE_URL)("order placement time on PostgreSQL", () => {
  let testDb: TestDatabase | undefined;
  let db: PrismaClient;

  /** A draft whose cart was opened `daysAgo` days ago. */
  const openCart = async (residentId: string, daysAgo: number) => {
    await db.user.create({
      data: { id: residentId, name: residentId, email: `${residentId}@demo.farmacia.cl` },
    });
    const draft = await db.order.create({ data: { residentId } });
    const openedAt = new Date(Date.now() - daysAgo * DAY_MS);
    await db.$executeRaw`UPDATE orders SET created_at = ${openedAt} WHERE id = ${draft.id}`;
    return { id: draft.id, openedAt };
  };

  /** Same statement shape as the confirm compare-and-set of @repo/api. */
  const transition = (orderId: string, from: string, to: string) => db.$executeRaw`
    UPDATE orders
    SET status = ${to}, fulfillment = 'pickup', version = version + 1, updated_at = now()
    WHERE id = ${orderId} AND status = ${from}`;

  const readOrder = (id: string) =>
    db.order.findUniqueOrThrow({ where: { id }, select: { createdAt: true, updatedAt: true } });

  beforeAll(async () => {
    testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  it("re-stamps created_at when the cart is confirmed, so FIFO follows placement", async () => {
    const early = await openCart("resident-early-cart", 4);
    const late = await openCart("resident-late-cart", 2);
    await transition(late.id, "draft", "pending_payment");
    await transition(early.id, "draft", "pending_payment");

    const confirmed = await readOrder(early.id);
    expect(confirmed.createdAt.getTime()).toBeGreaterThan(early.openedAt.getTime());
    expect(confirmed.createdAt).toEqual(confirmed.updatedAt);
    const queue = await db.order.findMany({
      where: { id: { in: [early.id, late.id] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    expect(queue.map((order) => order.id)).toEqual([late.id, early.id]);
  });

  it("keeps the placement time on later transitions", async () => {
    const cart = await openCart("resident-later-transitions", 1);
    await transition(cart.id, "draft", "pending_payment");
    const placed = await readOrder(cart.id);
    await transition(cart.id, "pending_payment", "payment_validated");
    expect((await readOrder(cart.id)).createdAt).toEqual(placed.createdAt);
  });

  it("does not stamp a cancelled draft, which was never placed", async () => {
    const cart = await openCart("resident-cancelled-cart", 3);
    await db.$executeRaw`UPDATE orders SET status = 'cancelled' WHERE id = ${cart.id}`;
    expect((await readOrder(cart.id)).createdAt).toEqual(cart.openedAt);
  });
});
