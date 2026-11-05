import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { applyTransition, createOrderTransitionService } from "./order-transition.service";

const OPERATOR = { id: "operator-1", role: "operator" } as const;

let mem: InMemoryOrdering;

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-1", onHand: 3 });
});

const service = () => createOrderTransitionService({ runner: mem.transitionRunner() });

const sale = (orderId: string, quantity: number) => ({
  productId: "p-1",
  delta: -quantity,
  reason: "sale" as const,
  orderId,
  paymentId: "pay-1",
  actorId: null,
  quantityBefore: 3 + quantity,
  quantityAfter: 3,
  note: null,
});

describe("order transitions (CAS + event + audit + stock effect)", () => {
  it("applies a physical transition with event and audit (operator)", async () => {
    mem.addOrder({
      id: "o1",
      residentId: "r1",
      status: "payment_validated",
      fulfillment: "pickup",
      version: 4,
    });

    const { order } = await service().transition({
      orderId: "o1",
      to: "in_preparation",
      actor: OPERATOR,
      expectedVersion: 4,
      note: "Preparando",
    });

    expect(order).toMatchObject({ status: "in_preparation", version: 5 });
    expect(mem.state.events).toEqual([
      {
        orderId: "o1",
        from: "payment_validated",
        to: "in_preparation",
        actorId: "operator-1",
        actorRole: "operator",
        note: "Preparando",
      },
    ]);
    expect(mem.state.audit).toEqual([
      expect.objectContaining({
        actorId: "operator-1",
        action: "order.transition",
        before: { status: "payment_validated", version: 4 },
        after: { status: "in_preparation", version: 5, note: "Preparando" },
      }),
    ]);
  });

  it("rejects an invalid transition and keeps the previous status (no event, no audit)", async () => {
    mem.addOrder({ id: "o1", residentId: "r1", status: "in_preparation", fulfillment: "delivery" });
    await expect(
      service().transition({
        orderId: "o1",
        to: "ready_for_pickup",
        actor: OPERATOR,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "INVALID_TRANSITION" } });
    expect(mem.statusOf("o1")).toBe("in_preparation");
    expect(mem.state.events).toEqual([]);
    expect(mem.state.audit).toEqual([]);
  });

  it("rejects a stale version before writing anything", async () => {
    mem.addOrder({
      id: "o1",
      residentId: "r1",
      status: "payment_validated",
      fulfillment: "pickup",
      version: 2,
    });
    await expect(
      service().transition({
        orderId: "o1",
        to: "in_preparation",
        actor: OPERATOR,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "STALE_VERSION" } });
    expect(mem.state.events).toEqual([]);
  });

  it("treats a lost compare-and-set as STALE_VERSION and rolls back", async () => {
    mem.addOrder({
      id: "o1",
      residentId: "r1",
      status: "payment_validated",
      fulfillment: "pickup",
    });
    const deps = {
      transitions: { ...mem.transitionStore(), compareAndSet: () => Promise.resolve(null) },
      audit: mem.auditWriter(),
      inventory: mem.inventoryStore(),
    };
    await expect(
      applyTransition(deps, {
        order: { ...mem.order("o1") },
        to: "in_preparation",
        actor: OPERATOR,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ details: { reason: "STALE_VERSION" } });
    expect(mem.state.events).toEqual([]);
  });

  it("answers NOT_FOUND for a missing order or a resident who does not own it", async () => {
    mem.addOrder({ id: "o1", residentId: "r1", status: "pending_payment", fulfillment: "pickup" });
    await expect(
      service().transition({
        orderId: "nope",
        to: "cancelled",
        actor: OPERATOR,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service().transition({
        orderId: "o1",
        to: "cancelled",
        actor: { id: "r2", role: "resident" },
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never validates a payment without the stock discount of the same transaction", async () => {
    mem.addOrder({ id: "o1", residentId: "r1", status: "pending_payment", fulfillment: "pickup" });
    await expect(
      applyTransition(
        {
          transitions: mem.transitionStore(),
          audit: mem.auditWriter(),
          inventory: mem.inventoryStore(),
        },
        {
          order: { ...mem.order("o1") },
          to: "payment_validated",
          actor: { id: null, role: "system" },
          expectedVersion: 0,
        },
      ),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    expect(mem.statusOf("o1")).toBe("pending_payment");
  });

  it("restores stock when staff cancels a paid order, only once", async () => {
    mem.addOrder({
      id: "o1",
      residentId: "r1",
      status: "payment_validated",
      fulfillment: "pickup",
    });
    mem.state.movements.push(sale("o1", 2));

    const { restore } = await service().transition({
      orderId: "o1",
      to: "cancelled",
      actor: OPERATOR,
      expectedVersion: 0,
    });

    expect(restore?.movements).toHaveLength(1);
    expect(mem.product("p-1").onHand).toBe(5);
  });

  it("does not restore stock when cancelling a not-delivered order (manual adjustment, D-14)", async () => {
    mem.addOrder({ id: "o1", residentId: "r1", status: "not_delivered", fulfillment: "delivery" });
    mem.state.movements.push(sale("o1", 2));

    const { order, restore } = await service().transition({
      orderId: "o1",
      to: "cancelled",
      actor: OPERATOR,
      expectedVersion: 0,
    });

    expect(order.status).toBe("cancelled");
    expect(restore).toBeNull();
    expect(mem.product("p-1").onHand).toBe(3);
  });
});
