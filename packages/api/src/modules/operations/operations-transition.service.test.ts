import type { FulfillmentType, OrderStatus } from "@repo/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { createRecordingLogger } from "../../testing/fakes";
import { createInMemoryOperationsRepository } from "../../testing/in-memory-operations";
import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { transitionInput, type OperatorTarget } from "./operations.schema";
import { createOperationsService, type OperationsActor } from "./operations.service";

const operator: OperationsActor = { id: "operator-1", role: "operator" };
const admin: OperationsActor = { id: "admin-1", role: "admin" };
const resident: OperationsActor = { id: "resident-1", role: "resident" };

const input = (to: OperatorTarget, expectedVersion: number, note?: string) =>
  transitionInput.parse({ id: "o1", to, expectedVersion, note });

/** HU-08, R-OPS-06..11 (docs/specs/operations.md) over the real transition code, in memory. */
describe("operations service: transition", () => {
  let mem: InMemoryOrdering;
  let logged: ReturnType<typeof createRecordingLogger>;

  const service = () => {
    const repo = createInMemoryOperationsRepository(mem);
    return createOperationsService({ repo, runner: mem.transitionRunner(), logger: logged.logger });
  };

  const addOrder = (status: OrderStatus, fulfillment: FulfillmentType | null, version = 2) =>
    mem.addOrder({ id: "o1", residentId: "resident-1", status, fulfillment, version });

  beforeEach(() => {
    mem = new InMemoryOrdering();
    logged = createRecordingLogger();
  });

  it("registers a valid move with actor, note, status event and audit (HU-08 #1)", async () => {
    addOrder("payment_validated", "pickup");

    const detail = await service().transition(operator, input("in_preparation", 2, "Caja 3"));

    expect(detail).toMatchObject({
      status: "in_preparation",
      statusLabel: "En preparación",
      version: 3,
      allowedTransitions: ["ready_for_pickup"],
    });
    expect(mem.state.events).toEqual([
      {
        orderId: "o1",
        from: "payment_validated",
        to: "in_preparation",
        actorId: "operator-1",
        actorRole: "operator",
        note: "Caja 3",
      },
    ]);
    expect(mem.state.audit).toEqual([
      expect.objectContaining({
        action: "order.transition",
        actorId: "operator-1",
        actorRole: "operator",
        entityId: "o1",
        before: { status: "payment_validated", version: 2 },
      }),
    ]);
    expect(logged.entries.at(-1)).toMatchObject({
      level: "info",
      obj: { orderId: "o1", from: "payment_validated", to: "in_preparation" },
    });
  });

  it("walks a delivery order through the full physical path as admin", async () => {
    addOrder("payment_validated", "delivery", 0);
    const steps: OperatorTarget[] = ["in_preparation", "in_transit", "not_delivered", "in_transit"];
    for (const [version, to] of steps.entries()) {
      await service().transition(admin, input(to, version));
    }
    const done = await service().transition(admin, input("delivered", steps.length));
    expect(done).toMatchObject({ status: "delivered", allowedTransitions: [] });
    expect(mem.state.events.map((event) => event.to)).toEqual([...steps, "delivered"]);
  });

  it.each([
    ["payment_validated", "pickup", "delivered"],
    ["in_preparation", "pickup", "in_transit"],
    ["in_preparation", "delivery", "ready_for_pickup"],
    ["ready_for_pickup", "pickup", "not_delivered"],
    ["delivered", "pickup", "cancelled"],
    ["cancelled", "pickup", "in_preparation"],
    ["in_transit", "delivery", "cancelled"],
  ] as const)(
    "rejects %s (%s) → %s with CONFLICT and keeps the previous state (HU-08 #2)",
    async (status, fulfillment, to) => {
      addOrder(status, fulfillment);
      await expect(service().transition(operator, input(to, 2))).rejects.toMatchObject({
        code: "CONFLICT",
        details: { reason: "INVALID_TRANSITION", from: status, to },
      });
      expect(mem.order("o1")).toMatchObject({ status, version: 2 });
      expect(mem.state.events).toHaveLength(0);
      expect(mem.state.audit).toHaveLength(0);
    },
  );

  it("rejects a stale expectedVersion with STALE_VERSION before judging the move", async () => {
    addOrder("in_preparation", "pickup", 5);
    // Another operator already moved it; this (now invalid) request was based on version 4.
    await expect(service().transition(operator, input("in_preparation", 4))).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "STALE_VERSION" },
    });
    expect(mem.order("o1")).toMatchObject({ status: "in_preparation", version: 5 });
    expect(mem.state.events).toHaveLength(0);
  });

  it("answers NOT_FOUND for a missing order or a resident's draft (cart is private)", async () => {
    await expect(service().transition(operator, input("cancelled", 0))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    addOrder("draft", null, 0);
    await expect(service().transition(operator, input("cancelled", 0))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mem.order("o1").status).toBe("draft");
  });

  it("rejects a resident caller with FORBIDDEN without touching the order", async () => {
    addOrder("payment_validated", "pickup");
    await expect(service().transition(resident, input("cancelled", 2))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mem.order("o1")).toMatchObject({ status: "payment_validated", version: 2 });
  });

  describe("cancellation and stock (R-OPS-11, D-02)", () => {
    const sold = () => {
      mem.addProduct({ id: "p1", onHand: 3 });
      mem.addLine({ orderId: "o1", productId: "p1", quantity: 2, unitPriceClp: 1000 });
      mem.state.movements.push({
        productId: "p1",
        delta: -2,
        reason: "sale",
        orderId: "o1",
        paymentId: "pay-1",
        actorId: null,
        quantityBefore: 5,
        quantityAfter: 3,
        note: null,
      });
    };

    it("cancelling from not_delivered does NOT restore stock automatically", async () => {
      addOrder("not_delivered", "delivery");
      sold();
      const detail = await service().transition(operator, input("cancelled", 2, "Sin contacto"));
      expect(detail.status).toBe("cancelled");
      expect(mem.product("p1").onHand).toBe(3);
      expect(mem.state.movements.map((movement) => movement.reason)).toEqual(["sale"]);
    });

    it("cancelling from payment_validated restores the units sold", async () => {
      addOrder("payment_validated", "pickup");
      sold();
      await service().transition(admin, input("cancelled", 2));
      expect(mem.product("p1").onHand).toBe(5);
      expect(mem.state.movements.map((movement) => movement.reason)).toEqual([
        "sale",
        "cancellation_restore",
      ]);
    });
  });
});
