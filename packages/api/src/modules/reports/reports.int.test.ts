import type { PrismaClient } from "@repo/db";
import { noopLogger, type OrderStatus, type Role } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps, createTestSession } from "../../testing/fakes";
import {
  createOrder,
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
  setStock,
  type OrderLineInput,
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";
import { createInventoryAdminServiceFromDeps } from "../inventory";
import { createReportsRepository } from "./reports.repository";
import { createReportsService, createReportsServiceFromDeps } from "./reports.service";

/** REP-I01..REP-I05 (docs/specs/reports.md): HU-13 aggregated queries on PostgreSQL. */
describe.skipIf(!INTEGRATION_ENABLED)("reports on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const service = () => createReportsServiceFromDeps({ db: db() }, noopLogger);

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  type PlacedOrder = {
    status: OrderStatus;
    lines: readonly OrderLineInput[];
    /** Placement time (`orders.created_at`). */
    placedAt: string;
    /** Time of the `delivered` status event, for delivered orders. */
    deliveredAt?: string;
    fulfillment?: "pickup" | "delivery";
  };

  /** One resident per order: a resident may only have one draft (the cart). */
  const placeOrder = async ({ status, lines, placedAt, deliveredAt, fulfillment }: PlacedOrder) => {
    const resident = await createUser(db());
    const order = await createOrder(db(), resident.id, {
      status,
      lines,
      ...(fulfillment ? { fulfillment } : {}),
    });
    await db().order.update({ where: { id: order.id }, data: { createdAt: new Date(placedAt) } });
    if (deliveredAt !== undefined) {
      await db().orderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: fulfillment === "delivery" ? "in_transit" : "ready_for_pickup",
          toStatus: "delivered",
          actorRole: "operator",
          createdAt: new Date(deliveredAt),
        },
      });
    }
    return order;
  };

  it("sums units of orders delivered in the range, pickup and delivery alike (HU-13 #1)", async () => {
    const losartan = await createProduct(db(), { commercialName: "Losartán Prueba" });
    const ibuprofen = await createProduct(db(), { commercialName: "Ibuprofeno Prueba" });
    // Delivered inside the range (picked up and dispatched).
    await placeOrder({
      status: "delivered",
      lines: [
        { productId: losartan.id, quantity: 3 },
        { productId: ibuprofen.id, quantity: 1 },
      ],
      placedAt: "2026-10-01T15:00:00.000Z",
      deliveredAt: "2026-10-10T15:00:00.000Z",
    });
    await placeOrder({
      status: "delivered",
      fulfillment: "delivery",
      lines: [{ productId: losartan.id, quantity: 2 }],
      placedAt: "2026-10-12T15:00:00.000Z",
      deliveredAt: "2026-10-13T15:00:00.000Z",
    });
    // Delivered after the range, and an order not yet delivered: not dispensed.
    await placeOrder({
      status: "delivered",
      lines: [{ productId: ibuprofen.id, quantity: 9 }],
      placedAt: "2026-10-30T15:00:00.000Z",
      deliveredAt: "2026-11-02T15:00:00.000Z",
    });
    await placeOrder({
      status: "ready_for_pickup",
      lines: [{ productId: ibuprofen.id, quantity: 7 }],
      placedAt: "2026-10-05T15:00:00.000Z",
    });

    const summary = await service().summary({ from: "2026-10-01", to: "2026-10-31" });

    expect(summary.range).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(summary.dispensed.units).toBe(6);
    expect(summary.dispensed.orders).toBe(2);
    expect(summary.dispensed.topProducts).toEqual([
      expect.objectContaining({ productId: losartan.id, name: "Losartán Prueba", units: 5 }),
      expect.objectContaining({ productId: ibuprofen.id, name: "Ibuprofeno Prueba", units: 1 }),
    ]);
  });

  it("counts orders placed in the range by status, drafts excluded (HU-13 #1)", async () => {
    const product = await createProduct(db());
    const lines = [{ productId: product.id, quantity: 1 }];
    const inRange = "2026-10-15T15:00:00.000Z";
    await placeOrder({ status: "pending_payment", lines, placedAt: inRange });
    await placeOrder({ status: "pending_payment", lines, placedAt: inRange });
    await placeOrder({ status: "cancelled", lines, placedAt: inRange });
    await placeOrder({ status: "draft", lines, placedAt: inRange });
    // Placed before the range: excluded even though it is still open.
    await placeOrder({ status: "in_preparation", lines, placedAt: "2026-09-30T15:00:00.000Z" });

    const { ordersByStatus } = await service().summary({ from: "2026-10-01", to: "2026-10-31" });

    expect(ordersByStatus.total).toBe(3);
    expect(ordersByStatus.items).toContainEqual({ status: "pending_payment", count: 2 });
    expect(ordersByStatus.items).toContainEqual({ status: "cancelled", count: 1 });
    expect(ordersByStatus.items).toContainEqual({ status: "in_preparation", count: 0 });
    expect(ordersByStatus.items.map((item) => item.status)).not.toContain("draft");
  });

  it("uses Chile's midnight as the day boundary, not UTC's (R-REP-05)", async () => {
    const product = await createProduct(db());
    const lines = [{ productId: product.id, quantity: 4 }];
    // 2026-11-11 00:00 in Chile (summer, UTC-3) is 03:00 UTC.
    await placeOrder({
      status: "delivered",
      lines,
      placedAt: "2026-11-10T02:59:59.999Z", // 2026-11-09 23:59:59.999 in Chile
      deliveredAt: "2026-11-11T02:59:59.999Z", // 2026-11-10 23:59:59.999 in Chile
    });
    await placeOrder({
      status: "delivered",
      lines,
      placedAt: "2026-11-11T03:00:00.000Z", // 2026-11-11 00:00 in Chile
      deliveredAt: "2026-11-12T02:59:59.999Z", // 2026-11-11 23:59:59.999 in Chile
    });

    const day = await service().summary({ from: "2026-11-11", to: "2026-11-11" });
    expect(day.dispensed.units).toBe(4);
    expect(day.ordersByStatus.total).toBe(1);

    const dayBefore = await service().summary({ from: "2026-11-10", to: "2026-11-10" });
    expect(dayBefore.dispensed.units).toBe(4);
    expect(dayBefore.ordersByStatus.total).toBe(0);
  });

  it("defaults to the last 30 days in Chile and lists low-stock products (HU-13 #1, D-27)", async () => {
    const out = await createProduct(db(), { commercialName: "Agotado Prueba", onHand: 3 });
    await setStock(db(), out.id, 0);
    await createProduct(db(), { commercialName: "Bajo Prueba", onHand: 5, lowStockThreshold: 5 });
    await createProduct(db(), { commercialName: "Suficiente Prueba", onHand: 20 });
    await createProduct(db(), { commercialName: "Inactivo Prueba", onHand: 0, active: false });
    const lines = [{ productId: out.id, quantity: 2 }];
    // 2026-10-13 00:00 in Chile is the first instant of the default window.
    await placeOrder({ status: "cancelled", lines, placedAt: "2026-10-13T02:59:59.999Z" });
    await placeOrder({ status: "cancelled", lines, placedAt: "2026-10-13T03:00:00.000Z" });
    const now = new Date("2026-11-12T01:00:00.000Z"); // 2026-11-11 22:00 in Chile
    const reports = createReportsService({
      repo: createReportsRepository(db()),
      lowStock: () => createInventoryAdminServiceFromDeps({ db: db() }, noopLogger).alerts(),
      now: () => now,
    });

    const summary = await reports.summary({});

    expect(summary.range).toEqual({ from: "2026-10-13", to: "2026-11-11" });
    expect(summary.ordersByStatus.total).toBe(1);
    expect(summary.lowStock.total).toBe(2);
    expect(summary.lowStock.items.map((item) => item.name)).toEqual([
      "Agotado Prueba",
      "Bajo Prueba",
    ]);
    expect(summary.lowStock.items.map((item) => item.level)).toEqual(["out", "low"]);
  });

  it("answers the admin through the router and forbids operators (R-REP-08)", async () => {
    const callerFor = async (role: Role) => {
      const user = await createUser(db(), { role });
      return createCaller(
        await createTRPCContext({
          deps: {
            ...createTestDeps({ session: createTestSession({ id: user.id, role }) }),
            db: db(),
          },
          headers: new Headers(),
          requestId: "reports-int",
        }),
      );
    };

    const summary = await (await callerFor("admin")).reports.summary({});
    expect(summary.dispensed).toEqual({ units: 0, orders: 0, topProducts: [] });
    expect(summary.ordersByStatus.total).toBe(0);
    await expect((await callerFor("operator")).reports.summary({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
