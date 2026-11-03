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
import { createOrderTransitionServiceFromDeps, createOrdersServiceFromDeps } from "../orders";
import { createPaymentsServiceFromDeps } from "../payments";
import { createTrackingServiceFromDeps } from "./tracking.service";

/** TRK-I01, TRK-I02 (docs/specs/tracking.md) plus «Mis pedidos» ordering and pagination. */
describe.skipIf(!INTEGRATION_ENABLED)("tracking on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const tracking = () => createTrackingServiceFromDeps({ db: db() });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /** Real services: draft → confirm → rejected → approved → in_preparation (operator note). */
  const orderWithHistory = async (residentId: string, operatorId: string) => {
    const product = await createProduct(db(), { onHand: 5, commercialName: "Melatonina 3 mg" });
    const orders = createOrdersServiceFromDeps({ db: db() }, noopLogger);
    const payments = createPaymentsServiceFromDeps({ db: db() }, noopLogger);
    const transitions = createOrderTransitionServiceFromDeps({ db: db() });

    await orders.addItem({ residentId, productId: product.id, quantity: 2 });
    const draft = await orders.setFulfillment({ residentId, type: "pickup" });
    await orders.confirm({ residentId, expectedVersion: draft.version });
    for (const scenario of ["reject", "approve"] as const) {
      await payments.pay({ residentId, orderId: draft.id, idempotencyKey: randomUUID(), scenario });
    }
    const current = await db().order.findUniqueOrThrow({ where: { id: draft.id } });
    await transitions.transition({
      orderId: draft.id,
      to: "in_preparation",
      actor: { id: operatorId, role: "operator" },
      expectedVersion: current.version,
      note: "Pedido en armado",
    });
    return draft.id;
  };

  it("TRK-I01: the owner sees the current status and every event in chronological order", async () => {
    const resident = await createUser(db());
    const operator = await createUser(db(), { role: "operator", name: "Operador Demo" });
    const orderId = await orderWithHistory(resident.id, operator.id);

    const detail = await tracking().detail(resident.id, orderId);

    expect(detail).toMatchObject({ status: "in_preparation", statusLabel: "En preparación" });
    expect(detail.timeline.map((entry) => [entry.label, entry.actorRole])).toEqual([
      ["Borrador", "resident"],
      ["Pendiente de pago", "resident"],
      ["Pago rechazado", "system"],
      ["Pago validado", "system"],
      ["En preparación", "operator"],
    ]);
    const times = detail.timeline.map((entry) => entry.at.getTime());
    expect(times).toEqual([...times].sort((left, right) => left - right));
    expect(detail.timeline.at(-1)?.note).toBe("Pedido en armado");
    // R-TRK-06: one event per applied transition plus the creation event.
    expect(detail.timeline).toHaveLength(await db().orderStatusEvent.count({ where: { orderId } }));
    expect(detail.lines).toMatchObject([{ commercialName: "Melatonina 3 mg", quantity: 2 }]);
    // R-TRK-02: no operator personal data anywhere in the payload.
    const payload = JSON.stringify(detail);
    expect(payload).not.toContain(operator.id);
    expect(payload).not.toContain(operator.email);
    expect(payload).not.toContain("Operador Demo");
  });

  it("TRK-I02: another resident gets the same NOT_FOUND as for a missing order", async () => {
    const owner = await createUser(db());
    const other = await createUser(db());
    const operator = await createUser(db(), { role: "operator" });
    const orderId = await orderWithHistory(owner.id, operator.id);

    await expect(tracking().detail(other.id, orderId)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No encontramos ese pedido.",
    });
    await expect(tracking().detail(other.id, randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No encontramos ese pedido.",
    });
  });

  it("lists only the caller's non-draft orders, newest first, across pages", async () => {
    const resident = await createUser(db());
    const other = await createUser(db());
    const statuses = ["delivered", "pending_payment", "cancelled", "in_transit"] as const;
    const created = [];
    for (const [index, status] of statuses.entries()) {
      const order = await createOrder(db(), resident.id, { status });
      await db().order.update({
        where: { id: order.id },
        data: { createdAt: new Date(Date.UTC(2026, 10, 1 + index)) },
      });
      created.push(order);
    }
    await createOrder(db(), resident.id); // the cart: never listed
    await createOrder(db(), other.id, { status: "delivered" });

    const first = await tracking().mine(resident.id, { limit: 3 });
    const second = await tracking().mine(resident.id, {
      limit: 3,
      cursor: first.nextCursor ?? undefined,
    });

    const newestFirst = [...created].reverse().map((order) => order.id);
    expect(first.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 3));
    expect(first.nextCursor).toBe(newestFirst[2]);
    expect(second.items.map((item) => item.id)).toEqual(newestFirst.slice(3));
    expect(second.nextCursor).toBeNull();
    expect(first.items[0]).toMatchObject({ status: "in_transit", statusLabel: "En ruta" });
  });

  it("ignores a cursor that belongs to another account", async () => {
    const resident = await createUser(db());
    const other = await createUser(db());
    await createOrder(db(), resident.id, { status: "delivered" });
    const foreign = await createOrder(db(), other.id, { status: "delivered" });

    const page = await tracking().mine(resident.id, { limit: 20, cursor: foreign.id });

    expect(page).toEqual({ items: [], nextCursor: null });
  });
});
