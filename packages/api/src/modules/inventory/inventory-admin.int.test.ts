import type { PrismaClient } from "@repo/db";
import { noopLogger } from "@repo/shared";
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
import {
  NEGATIVE_STOCK_MESSAGE,
  applyStockAdjustment,
  createInventoryAdminServiceFromDeps,
} from "./inventory-admin.service";
import { createInventoryStore } from "./inventory.repository";
import { discountForOrder } from "./inventory.service";

/** INV-I07..INV-I12 (docs/specs/inventory.md): HU-10 and HU-12 on PostgreSQL. */
describe.skipIf(!INTEGRATION_ENABLED)("back-office inventory on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const service = () => createInventoryAdminServiceFromDeps({ db: db() }, noopLogger);

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const onHand = async (productId: string) =>
    (await db().inventoryItem.findUniqueOrThrow({ where: { productId } })).onHand;

  const operatorActor = async () => {
    const user = await createUser(db(), { role: "operator", name: "Olga Operaria" });
    return { actorId: user.id, actorRole: "operator" } as const;
  };

  it("registers a receipt with its movement and audit row (HU-10 #1)", async () => {
    const actor = await operatorActor();
    const product = await createProduct(db(), { onHand: 4 });

    const result = await service().adjust(actor, {
      productId: product.id,
      kind: "receipt",
      delta: 12,
      reason: "Recepción proveedor",
    });

    expect(result).toMatchObject({ quantityBefore: 4, quantityAfter: 16, item: { onHand: 16 } });
    expect(await onHand(product.id)).toBe(16);
    const [movement] = await db().stockMovement.findMany({ where: { productId: product.id } });
    expect(movement).toMatchObject({
      reason: "receipt",
      delta: 12,
      quantityBefore: 4,
      quantityAfter: 16,
      orderId: null,
      actorId: actor.actorId,
      note: "Recepción proveedor",
    });
    const [audit] = await db().auditLog.findMany({ where: { entityId: product.id } });
    expect(audit).toMatchObject({
      action: "stock.receipt",
      entityType: "product",
      actorId: actor.actorId,
      actorRole: "operator",
      before: { onHand: 4 },
      after: { onHand: 16 },
    });
    expect(audit?.createdAt).toBeInstanceOf(Date);

    const history = await service().movements({ productId: product.id, limit: 20 });
    expect(history.items).toEqual([
      expect.objectContaining({
        reason: "receipt",
        note: "Recepción proveedor",
        actorRole: "operator",
        actorName: "Olga Operaria",
        orderCode: null,
      }),
    ]);
  });

  it("rejects an adjustment that would leave negative stock and leaves everything untouched (HU-10 #2)", async () => {
    const actor = await operatorActor();
    const product = await createProduct(db(), { onHand: 3 });

    await expect(
      service().adjust(actor, {
        productId: product.id,
        kind: "adjustment",
        delta: -4,
        reason: "Conteo físico",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: NEGATIVE_STOCK_MESSAGE });

    expect(await onHand(product.id)).toBe(3);
    expect(await db().stockMovement.count()).toBe(0);
    expect(await db().auditLog.count()).toBe(0);
    const item = await db().inventoryItem.findUniqueOrThrow({ where: { productId: product.id } });
    expect(item.version).toBe(0);
  });

  it("rolls the stock and the movement back when the audit row cannot be written (D-22)", async () => {
    const actor = await operatorActor();
    const product = await createProduct(db(), { onHand: 8 });
    const failingAudit = { record: () => Promise.reject(new Error("audit unavailable")) };

    await expect(
      db().$transaction((tx) =>
        applyStockAdjustment({ store: createInventoryStore(tx), audit: failingAudit }, actor, {
          productId: product.id,
          kind: "adjustment",
          delta: -2,
          reason: "Merma",
        }),
      ),
    ).rejects.toThrow("audit unavailable");

    expect(await onHand(product.id)).toBe(8);
    expect(await db().stockMovement.count()).toBe(0);
  });

  it("never goes negative when adjustments race with a payment discount (RNF-08)", async () => {
    const actor = await operatorActor();
    const resident = await createUser(db());
    const product = await createProduct(db(), { onHand: 5 });
    const lines = [{ productId: product.id, quantity: 3 }];
    const order = await createOrder(db(), resident.id, { status: "pending_payment", lines });
    const payment = await createPayment(db(), order);
    const sale = () =>
      db().$transaction((tx) =>
        discountForOrder(
          { store: createInventoryStore(tx), audit: createAuditWriter(tx) },
          {
            orderId: order.id,
            paymentId: payment.id,
            lines,
            actor: { actorId: null, actorRole: "system" },
          },
        ),
      );
    const adjust = () =>
      service().adjust(actor, {
        productId: product.id,
        kind: "adjustment",
        delta: -1,
        reason: "Conteo físico",
      });

    const [saleResult, ...adjustments] = await Promise.allSettled([
      sale(),
      ...Array.from({ length: 6 }, adjust),
    ]);

    const sold = saleResult.status === "fulfilled" && saleResult.value.ok ? 3 : 0;
    const adjusted = adjustments.filter((result) => result.status === "fulfilled").length;
    for (const result of adjustments) {
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({
          code: "BAD_REQUEST",
          message: NEGATIVE_STOCK_MESSAGE,
        });
      }
    }
    expect(5 - sold - adjusted).toBeGreaterThanOrEqual(0);
    expect(await onHand(product.id)).toBe(5 - sold - adjusted);
    const movements = await db().stockMovement.findMany({
      where: { productId: product.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(movements).toHaveLength((sold > 0 ? 1 : 0) + adjusted);
    expect(movements.every((movement) => movement.quantityAfter >= 0)).toBe(true);
  });

  it("lists, searches and pages the stock, with the low-stock filter", async () => {
    const a = await createProduct(db(), {
      commercialName: "Aspirina Prueba",
      sku: "IT-ASP",
      onHand: 2,
    });
    await createProduct(db(), { commercialName: "Betametasona Prueba", onHand: 40 });
    await createProduct(db(), { commercialName: "Cetirizina Prueba", onHand: 5 });

    const first = await service().list({ limit: 2 });
    expect(first.items.map((item) => item.name)).toEqual([
      "Aspirina Prueba",
      "Betametasona Prueba",
    ]);
    const second = await service().list({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((item) => item.name)).toEqual(["Cetirizina Prueba"]);
    expect(second.nextCursor).toBeNull();

    const low = await service().list({ limit: 20, onlyLow: true });
    expect(low.items.map((item) => [item.name, item.level])).toEqual([
      ["Aspirina Prueba", "low"],
      ["Cetirizina Prueba", "low"],
    ]);
    expect((await service().list({ limit: 20, search: "betametasóna" })).items).toHaveLength(1);
    expect((await service().list({ limit: 20, search: "it-asp" })).items).toEqual([
      expect.objectContaining({ productId: a.id, sku: "IT-ASP" }),
    ]);
  });
});

/** INV-I11, INV-I12: low-stock thresholds and alerts (HU-12, D-26, D-27). */
describe.skipIf(!INTEGRATION_ENABLED)("low-stock alerts on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const service = () => createInventoryAdminServiceFromDeps({ db: db() }, noopLogger);

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lists active products at or under their threshold, out of stock first (HU-12 #1)", async () => {
    await createProduct(db(), { commercialName: "Zinc Bajo", onHand: 3 });
    await createProduct(db(), { commercialName: "Yodo Borde", onHand: 5 });
    await createProduct(db(), { commercialName: "Xilitol Agotado", onHand: 0 });
    await createProduct(db(), { commercialName: "Vitamina Ok", onHand: 6 });
    await createProduct(db(), { commercialName: "Urea Inactiva", onHand: 0, active: false });
    await createProduct(db(), { commercialName: "Talco Cero", onHand: 1, lowStockThreshold: 0 });

    const alerts = await service().alerts();

    expect(alerts.total).toBe(3);
    expect(alerts.items.map((item) => [item.name, item.onHand, item.level])).toEqual([
      ["Xilitol Agotado", 0, "out"],
      ["Zinc Bajo", 3, "low"],
      ["Yodo Borde", 5, "low"],
    ]);
  });

  it("changes a threshold with its audit row and the product enters the alerts", async () => {
    const user = await createUser(db(), { role: "admin" });
    const actor = { actorId: user.id, actorRole: "admin" } as const;
    const product = await createProduct(db(), { onHand: 12 });
    expect((await service().alerts()).total).toBe(0);

    const item = await service().setThreshold(actor, { productId: product.id, threshold: 20 });
    expect(item).toMatchObject({ lowStockThreshold: 20, level: "low" });
    await service().setThreshold(actor, { productId: product.id, threshold: 20 });

    const audit = await db().auditLog.findMany({ where: { action: "inventory.threshold_change" } });
    expect(audit).toEqual([
      expect.objectContaining({
        entityType: "product",
        entityId: product.id,
        actorId: user.id,
        actorRole: "admin",
        before: { lowStockThreshold: 5 },
        after: { lowStockThreshold: 20 },
      }),
    ]);
    expect((await service().alerts()).items.map((alert) => alert.productId)).toEqual([product.id]);
    await expect(
      service().setThreshold(actor, { productId: "missing", threshold: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
