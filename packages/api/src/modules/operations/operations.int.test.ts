import { randomUUID } from "node:crypto";

import type { PrismaClient, User } from "@repo/db";
import { noopLogger, type FulfillmentType, type OrderStatus, type Role } from "@repo/shared";
import { TRPCError } from "@trpc/server";
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
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";
import { createPaymentsServiceFromDeps } from "../payments";

const T0 = Date.parse("2026-11-01T09:00:00.000Z");

/** OPS-I01..I04 (docs/specs/operations.md): back office over PostgreSQL, through the router. */
describe.skipIf(!INTEGRATION_ENABLED)("operations on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();

  const callerFor = async (user: Pick<User, "id"> | null, role: Role = "operator") =>
    createCaller(
      await createTRPCContext({
        deps: {
          ...createTestDeps({ session: user ? createTestSession({ id: user.id, role }) : null }),
          db: db(),
        },
        headers: new Headers(),
        requestId: "operations-int",
      }),
    );

  /** An order created `minute` minutes after T0 (deterministic FIFO). */
  const orderAt = async (
    residentId: string,
    minute: number,
    status: OrderStatus,
    fulfillment: FulfillmentType | null = status === "draft" ? null : "pickup",
  ) => {
    const order = await createOrder(db(), residentId, { status, fulfillment });
    return db().order.update({
      where: { id: order.id },
      data: { createdAt: new Date(T0 + minute * 60_000) },
    });
  };

  const rejection = async (promise: Promise<unknown>): Promise<TRPCError> => {
    try {
      await promise;
    } catch (error) {
      if (error instanceof TRPCError) return error;
      throw error;
    }
    throw new Error("expected a rejection");
  };

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("queue (HU-07)", () => {
    it("filters by status, fulfillment and code; drafts excluded; oldest first (#1)", async () => {
      const resident = await createUser(db());
      const other = await createUser(db());
      const operator = await createUser(db(), { role: "operator" });
      const delivered = await orderAt(resident.id, 1, "delivered");
      const prepPickup = await orderAt(resident.id, 2, "in_preparation");
      await orderAt(resident.id, 3, "draft");
      const prepDelivery = await orderAt(other.id, 4, "in_preparation", "delivery");
      const validated = await orderAt(other.id, 0, "payment_validated", "delivery");
      const caller = await callerFor(operator);

      const all = await caller.operations.queue({});
      expect(all.items.map((item) => item.id)).toEqual([
        validated.id,
        delivered.id,
        prepPickup.id,
        prepDelivery.id,
      ]);

      const byStatus = await caller.operations.queue({ status: ["in_preparation"] });
      expect(byStatus.items.map((item) => item.id)).toEqual([prepPickup.id, prepDelivery.id]);

      const combined = await caller.operations.queue({
        status: ["in_preparation", "payment_validated"],
        fulfillment: "delivery",
      });
      expect(combined.items.map((item) => item.id)).toEqual([validated.id, prepDelivery.id]);
      expect(combined.items[0]).toMatchObject({
        status: "payment_validated",
        statusLabel: "Pago validado",
        fulfillment: "delivery",
      });

      const byCode = await caller.operations.queue({ q: prepPickup.code.toLowerCase() });
      expect(byCode.items.map((item) => item.id)).toEqual([prepPickup.id]);
    });

    it("walks every page with the cursor, without repeats, keeping FIFO", async () => {
      const resident = await createUser(db());
      const admin = await createUser(db(), { role: "admin" });
      const created = [];
      for (let minute = 0; minute < 7; minute += 1) {
        created.push(await orderAt(resident.id, 10 - minute, "pending_payment"));
      }
      const caller = await callerFor(admin, "admin");

      const seen: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await caller.operations.queue({ limit: 3, cursor });
        seen.push(...result.items.map((item) => item.id));
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }
      expect(seen).toEqual(created.map((order) => order.id).reverse());
    });

    it("rejects residents with FORBIDDEN and anonymous callers with UNAUTHORIZED (#2)", async () => {
      const resident = await createUser(db());
      const order = await orderAt(resident.id, 0, "payment_validated");
      const asResident = await callerFor(resident, "resident");
      const anonymous = await callerFor(null);

      await expect(asResident.operations.queue({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(asResident.operations.order({ id: order.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        asResident.operations.transition({ id: order.id, to: "cancelled", expectedVersion: 0 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(anonymous.operations.queue({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(await db().order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: "payment_validated",
        version: 0,
      });
    });
  });

  describe("transition (HU-08)", () => {
    it("records the new state with date, time, actor and audit (#1)", async () => {
      const resident = await createUser(db());
      const operator = await createUser(db(), { role: "operator", name: "Operador Demo" });
      const order = await orderAt(resident.id, 0, "payment_validated");
      const caller = await callerFor(operator);
      const before = new Date();

      const detail = await caller.operations.transition({
        id: order.id,
        to: "in_preparation",
        expectedVersion: 0,
        note: "Caja 3",
      });

      const after = new Date();
      expect(detail).toMatchObject({
        status: "in_preparation",
        version: 1,
        allowedTransitions: ["ready_for_pickup"],
      });
      const event = await db().orderStatusEvent.findFirstOrThrow({ where: { orderId: order.id } });
      expect(event).toMatchObject({
        fromStatus: "payment_validated",
        toStatus: "in_preparation",
        actorId: operator.id,
        actorRole: "operator",
        note: "Caja 3",
      });
      expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(event.createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
      expect(detail.history.at(-1)).toMatchObject({
        toStatus: "in_preparation",
        toLabel: "En preparación",
        actorName: "Operador Demo",
        createdAt: event.createdAt,
      });
      const audit = await db().auditLog.findMany({ where: { entityId: order.id } });
      expect(audit).toEqual([
        expect.objectContaining({
          action: "order.transition",
          actorId: operator.id,
          actorRole: "operator",
          before: { status: "payment_validated", version: 0 },
          after: { status: "in_preparation", version: 1, note: "Caja 3" },
        }),
      ]);
    });

    it("rejects an invalid move with CONFLICT and keeps the previous state (#2)", async () => {
      const resident = await createUser(db());
      const operator = await createUser(db(), { role: "operator" });
      const order = await orderAt(resident.id, 0, "payment_validated");
      const caller = await callerFor(operator);

      const error = await rejection(
        caller.operations.transition({ id: order.id, to: "delivered", expectedVersion: 0 }),
      );

      expect(error.code).toBe("CONFLICT");
      expect(error.message).toContain("El pedido conserva su estado actual");
      expect(await db().order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
        status: "payment_validated",
        version: 0,
        updatedAt: order.updatedAt,
      });
      expect(await db().orderStatusEvent.count({ where: { orderId: order.id } })).toBe(0);
      expect(await db().auditLog.count()).toBe(0);
    });

    it("lets exactly one of several concurrent transitions with the same version win", async () => {
      const resident = await createUser(db());
      const operators = await Promise.all(
        [1, 2, 3, 4].map(() => createUser(db(), { role: "operator" })),
      );
      const order = await orderAt(resident.id, 0, "payment_validated");
      const callers = await Promise.all(operators.map((operator) => callerFor(operator)));
      const targets = ["in_preparation", "cancelled", "in_preparation", "cancelled"] as const;

      const results = await Promise.allSettled(
        callers.map((caller, index) =>
          caller.operations.transition({
            id: order.id,
            to: targets[index] ?? "in_preparation",
            expectedVersion: 0,
          }),
        ),
      );

      const won = results.filter((result) => result.status === "fulfilled");
      const lost = results.filter((result) => result.status === "rejected");
      expect(won).toHaveLength(1);
      for (const result of lost) {
        expect(result.reason).toMatchObject({
          code: "CONFLICT",
          message: "Este pedido cambió mientras lo revisabas. Recarga para ver su estado actual.",
        });
      }
      const stored = await db().order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.version).toBe(1);
      expect(await db().orderStatusEvent.count({ where: { orderId: order.id } })).toBe(1);
      expect(await db().auditLog.count({ where: { action: "order.transition" } })).toBe(1);
    });

    it("cancelling from not_delivered never restores stock automatically (D-02)", async () => {
      const resident = await createUser(db());
      const operator = await createUser(db(), { role: "operator" });
      const product = await createProduct(db(), { onHand: 5 });
      const order = await createOrder(db(), resident.id, {
        status: "pending_payment",
        fulfillment: "delivery",
        lines: [{ productId: product.id, quantity: 2 }],
      });
      const paid = await createPaymentsServiceFromDeps({ db: db() }, noopLogger).pay({
        residentId: resident.id,
        orderId: order.id,
        idempotencyKey: randomUUID(),
        scenario: "approve",
      });
      const caller = await callerFor(operator);
      let version = paid.order.version;
      for (const to of ["in_preparation", "in_transit", "not_delivered", "cancelled"] as const) {
        version = (
          await caller.operations.transition({ id: order.id, to, expectedVersion: version })
        ).version;
      }

      const stock = await db().inventoryItem.findUniqueOrThrow({
        where: { productId: product.id },
      });
      expect(stock.onHand).toBe(3);
      const reasons = await db().stockMovement.findMany({ where: { orderId: order.id } });
      expect(reasons.map((movement) => movement.reason)).toEqual(["sale"]);
    });
  });
});
