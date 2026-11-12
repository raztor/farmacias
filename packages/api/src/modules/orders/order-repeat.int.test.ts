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
  setStock,
} from "../../testing/integration";
import { createOrdersRepository } from "./orders.repository";
import { createOrdersService } from "./orders.service";

/** ORD-I04 (docs/specs/orders.md, R-ORD-16): repeating a previous order on PostgreSQL. */
describe.skipIf(!INTEGRATION_ENABLED)("orders.repeat on PostgreSQL (HU-14)", () => {
  const db = (): PrismaClient => getTestDb();
  const orders = () => createOrdersService({ repo: createOrdersRepository(db()) });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const deliveredOrder = async (
    residentId: string,
    lines: { productId: string; quantity: number }[],
  ) => createOrder(db(), residentId, { status: "delivered", lines });

  it("reduces by the current stock, skips inactive products and prices from the catalog", async () => {
    const resident = await createUser(db());
    const short = await createProduct(db(), { onHand: 10, priceClp: 1500 });
    const retired = await createProduct(db(), { onHand: 10 });
    const previous = await deliveredOrder(resident.id, [
      { productId: short.id, quantity: 5 },
      { productId: retired.id, quantity: 1 },
    ]);
    await setStock(db(), short.id, 2);
    await db().product.update({ where: { id: retired.id }, data: { active: false } });

    const result = await orders().repeat({ residentId: resident.id, orderId: previous.id });

    expect(result.changes).toEqual([
      expect.objectContaining({
        productId: short.id,
        presentation: short.presentation,
        requested: 5,
        added: 2,
        reason: "reduced",
      }),
      expect.objectContaining({
        productId: retired.id,
        requested: 1,
        added: 0,
        reason: "inactive",
      }),
    ]);
    const draft = await db().order.findFirstOrThrow({
      where: { residentId: resident.id, status: "draft" },
      include: { lines: true, events: true },
    });
    expect(draft.lines).toEqual([
      expect.objectContaining({ productId: short.id, quantity: 2, unitPriceClp: 1500 }),
    ]);
    expect(draft.totalClp).toBe(3000);
    expect(draft.events).toHaveLength(1);
    expect(
      (await db().inventoryItem.findUniqueOrThrow({ where: { productId: short.id } })).onHand,
    ).toBe(2);
  });

  it("keeps the existing draft lines and sums the repeated units into them", async () => {
    const resident = await createUser(db());
    const shared = await createProduct(db(), { onHand: 20 });
    const extra = await createProduct(db(), { onHand: 20 });
    const previous = await deliveredOrder(resident.id, [{ productId: shared.id, quantity: 3 }]);
    await orders().addItem({ residentId: resident.id, productId: extra.id, quantity: 1 });
    await orders().addItem({ residentId: resident.id, productId: shared.id, quantity: 4 });

    const result = await orders().repeat({ residentId: resident.id, orderId: previous.id });

    expect(result.changes).toEqual([]);
    expect(result.draft?.lines.map((line) => [line.productId, line.quantity])).toEqual([
      [extra.id, 1],
      [shared.id, 7],
    ]);
    expect(result.draft?.totalClp).toBe(8 * 1990);
    expect(await db().order.count({ where: { residentId: resident.id, status: "draft" } })).toBe(1);
  });

  it("answers NOT_FOUND for another resident's order and writes nothing (D-10)", async () => {
    const owner = await createUser(db());
    const intruder = await createUser(db());
    const product = await createProduct(db());
    const previous = await deliveredOrder(owner.id, [{ productId: product.id, quantity: 1 }]);

    await expect(
      orders().repeat({ residentId: intruder.id, orderId: previous.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db().order.count({ where: { status: "draft" } })).toBe(0);
  });
});
