import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { databaseNameOf, INTEGRATION_DATABASE_PREFIX } from "./database-name";
import {
  createOrder,
  createPayment,
  createProduct,
  createUser,
  disconnectTestDb,
  getIntegrationDatabaseUrl,
  getTestDb,
  INTEGRATION_ENABLED,
  listMigrationNames,
  resetDatabase,
} from "./index";

/** Smoke test of the integration harness itself (T-05). */
describe.skipIf(!INTEGRATION_ENABLED)("integration harness (PostgreSQL)", () => {
  const db = INTEGRATION_ENABLED ? getTestDb() : undefined;
  const testDb = () => {
    if (!db) throw new Error("integration disabled");
    return db;
  };

  beforeEach(async () => {
    await resetDatabase(testDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("connects to the run's own throwaway database, never the admin one", async () => {
    const [row] = await testDb().$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    expect(row?.name).toBe(databaseNameOf(getIntegrationDatabaseUrl()));
    expect(row?.name.startsWith(INTEGRATION_DATABASE_PREFIX)).toBe(true);
  });

  it("applied every versioned migration of @repo/db with prisma migrate deploy", async () => {
    const applied = await testDb().$queryRaw<{ name: string }[]>`
      SELECT migration_name AS name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`;
    const expected = listMigrationNames();
    expect(expected.length).toBeGreaterThan(0);
    expect(applied.map((migration) => migration.name)).toEqual(expected);
  });

  it("rejects a negative stock update (CHECK inventory_items_on_hand_check)", async () => {
    const product = await createProduct(testDb(), { onHand: 2 });
    await expect(
      testDb().inventoryItem.update({
        where: { productId: product.id },
        data: { onHand: { decrement: 3 } },
      }),
    ).rejects.toThrow(/inventory_items_on_hand_check/);
    const item = await testDb().inventoryItem.findUniqueOrThrow({
      where: { productId: product.id },
    });
    expect(item.onHand).toBe(2);
  });

  it("enforces a unique idempotency_key per payment", async () => {
    const resident = await createUser(testDb());
    const product = await createProduct(testDb());
    const order = await createOrder(testDb(), resident.id, {
      status: "pending_payment",
      lines: [{ productId: product.id, quantity: 2 }],
    });
    const idempotencyKey = randomUUID();
    await createPayment(testDb(), order, { idempotencyKey, status: "rejected" });
    await expect(
      createPayment(testDb(), order, { idempotencyKey, status: "rejected" }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await testDb().payment.count({ where: { idempotencyKey } })).toBe(1);
  });

  it("factories build valid rows: totals, delivery data and order codes", async () => {
    const resident = await createUser(testDb(), { role: "resident" });
    const product = await createProduct(testDb(), { priceClp: 2500 });
    const order = await createOrder(testDb(), resident.id, {
      status: "pending_payment",
      fulfillment: "delivery",
      lines: [{ productId: product.id, quantity: 3, unitPriceClp: 2500 }],
    });
    expect(order.totalClp).toBe(7500);
    expect(order.deliverySector).not.toBeNull();
    expect(order.code).toBe("P-000001");
  });

  it("resetDatabase empties every table and restarts the order code sequence", async () => {
    const resident = await createUser(testDb());
    await createOrder(testDb(), resident.id);
    await resetDatabase(testDb());
    expect(await testDb().user.count()).toBe(0);
    expect(await testDb().order.count()).toBe(0);
    const again = await createOrder(testDb(), (await createUser(testDb())).id);
    expect(again.code).toBe("P-000001");
  });
});
