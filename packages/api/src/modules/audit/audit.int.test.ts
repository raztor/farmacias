import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@repo/db";
import { noopLogger } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createOrderTransitionServiceFromDeps, createOrdersServiceFromDeps } from "../orders";
import { createPaymentsServiceFromDeps } from "../payments";
import { createAuditRepository } from "./audit.repository";
import { createAuditService } from "./audit.service";

/**
 * AUD-I01, AUD-I04 (docs/specs/audit.md): a full demo journey through the real services leaves
 * an event for every transition (date, time and actor) and audit rows for every critical change.
 */
describe.skipIf(!INTEGRATION_ENABLED)("audit trail on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const journey = async () => {
    const resident = await createUser(db());
    const operator = await createUser(db(), { role: "operator", name: "Operador Demo" });
    const product = await createProduct(db(), { onHand: 5 });
    const orders = createOrdersServiceFromDeps({ db: db() }, noopLogger);
    const payments = createPaymentsServiceFromDeps({ db: db() }, noopLogger);
    const transitions = createOrderTransitionServiceFromDeps({ db: db() });

    await orders.addItem({ residentId: resident.id, productId: product.id, quantity: 2 });
    const draft = await orders.setFulfillment({ residentId: resident.id, type: "pickup" });
    await orders.confirm({ residentId: resident.id, expectedVersion: draft.version });
    const rejected = await payments.pay({
      residentId: resident.id,
      orderId: draft.id,
      idempotencyKey: randomUUID(),
      scenario: "reject",
    });
    const paid = await payments.pay({
      residentId: resident.id,
      orderId: draft.id,
      idempotencyKey: randomUUID(),
      scenario: "approve",
    });
    const actor = { id: operator.id, role: "operator" } as const;
    let version = paid.order.version;
    for (const to of ["in_preparation", "ready_for_pickup", "delivered"] as const) {
      const { order } = await transitions.transition({
        orderId: draft.id,
        to,
        actor,
        expectedVersion: version,
      });
      version = order.version;
    }
    return { resident, operator, product, orderId: draft.id, rejected };
  };

  it("records every transition with date, time and actor, and stock changes with before/after", async () => {
    const { orderId, operator, product } = await journey();

    const events = await db().orderStatusEvent.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(events.map((event) => event.toStatus)).toEqual([
      "draft",
      "pending_payment",
      "payment_rejected",
      "payment_validated",
      "in_preparation",
      "ready_for_pickup",
      "delivered",
    ]);
    expect(events.every((event) => event.createdAt instanceof Date && event.actorRole !== "")).toBe(
      true,
    );
    expect(events.slice(4).every((event) => event.actorId === operator.id)).toBe(true);

    const transitionsAudited = await db().auditLog.count({
      where: { action: "order.transition", entityId: orderId },
    });
    expect(transitionsAudited).toBe(events.length - 1); // every transition except the creation
    const sale = await db().auditLog.findFirstOrThrow({ where: { action: "stock.sale" } });
    expect(sale).toMatchObject({
      entityType: "product",
      entityId: product.id,
      actorRole: "system",
      before: { onHand: 5 },
      after: { onHand: 3, orderId },
    });
  });

  it("lists the trail newest first for the admin view, with the actor name", async () => {
    const { orderId } = await journey();
    const service = createAuditService({ repo: createAuditRepository(db()) });

    const page = await service.list({ limit: 3, entityType: "order", entityId: orderId });

    expect(page.items).toHaveLength(3);
    expect(page.items[0]).toMatchObject({
      action: "order.transition",
      actorRole: "operator",
      actorName: "Operador Demo",
      after: { status: "delivered" },
    });
    expect(page.nextCursor).toBe(page.items[2]?.id);
    const next = await service.list({
      limit: 3,
      entityType: "order",
      entityId: orderId,
      cursor: page.nextCursor ?? undefined,
    });
    expect(next.items[0]?.id).not.toBe(page.items[2]?.id);
  });
});
