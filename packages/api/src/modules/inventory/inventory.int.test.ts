import type { PrismaClient } from "@repo/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createOrder,
  createPayment,
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createAuditWriter } from "../audit";
import { createInventoryStore } from "./inventory.repository";
import { discountForOrder, type StockLine } from "./inventory.service";

/** INV-I02, INV-I03 (docs/specs/inventory.md): the discount is all or nothing. */
describe.skipIf(!INTEGRATION_ENABLED)("inventory discount on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const SYSTEM = { actorId: null, actorRole: "system" } as const;

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const fixture = async (stock: readonly number[], quantities: readonly number[]) => {
    const resident = await createUser(db());
    const products = await Promise.all(stock.map((onHand) => createProduct(db(), { onHand })));
    const lines: StockLine[] = products.map((product, index) => ({
      productId: product.id,
      quantity: quantities[index] ?? 1,
    }));
    const order = await createOrder(db(), resident.id, { status: "pending_payment", lines });
    const payment = await createPayment(db(), order);
    const discount = () =>
      db().$transaction((tx) =>
        discountForOrder(
          { store: createInventoryStore(tx), audit: createAuditWriter(tx) },
          { orderId: order.id, paymentId: payment.id, lines, actor: SYSTEM },
        ),
      );
    return { products, order, discount };
  };

  const stockOf = async (ids: readonly string[]) => {
    const rows = await db().inventoryItem.findMany({ where: { productId: { in: [...ids] } } });
    return ids.map((id) => rows.find((row) => row.productId === id)?.onHand);
  };

  it("discounts every line with coherent before/after quantities and version bumps", async () => {
    const { products, order, discount } = await fixture([5, 8, 2], [2, 8, 1]);

    const result = await discount();

    expect(result.ok).toBe(true);
    const ids = products.map((product) => product.id);
    expect(await stockOf(ids)).toEqual([3, 0, 1]);
    const movements = await db().stockMovement.findMany({ where: { orderId: order.id } });
    expect(movements).toHaveLength(3);
    for (const movement of movements) {
      expect(movement.quantityAfter).toBe(movement.quantityBefore + movement.delta);
    }
    const items = await db().inventoryItem.findMany({ where: { productId: { in: ids } } });
    expect(items.every((item) => item.version === 1)).toBe(true);
    expect(await db().auditLog.count({ where: { action: "stock.sale" } })).toBe(3);
  });

  it("discounts nothing when a single line lacks stock (no partial discount)", async () => {
    const { products, discount } = await fixture([5, 1, 9], [2, 2, 3]);

    const result = await discount();

    expect(result).toEqual({
      ok: false,
      conflicts: [{ productId: products[1]?.id, requested: 2, available: 1 }],
    });
    expect(await stockOf(products.map((product) => product.id))).toEqual([5, 1, 9]);
    expect(await db().stockMovement.count()).toBe(0);
    expect(await db().auditLog.count()).toBe(0);
  });
});
