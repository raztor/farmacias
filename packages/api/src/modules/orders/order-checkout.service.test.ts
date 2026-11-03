import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { createOrdersService, type OrdersService } from "./orders.service";

const RESIDENT = "resident-1";

let mem: InMemoryOrdering;
let service: OrdersService;

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-a", commercialName: "Escitalopram 10 mg", priceClp: 2000, onHand: 4 });
  mem.addProduct({ id: "p-b", commercialName: "Pregabalina 75 mg", priceClp: 5000, onHand: 10 });
  service = createOrdersService({ repo: mem.ordersRepository() });
});

/** A draft with two lines (snapshot prices 2000 and 5000) and pickup. */
const readyDraft = async () => {
  await service.addItem({ residentId: RESIDENT, productId: "p-a", quantity: 2 });
  await service.addItem({ residentId: RESIDENT, productId: "p-b", quantity: 1 });
  return service.setFulfillment({ residentId: RESIDENT, type: "pickup" });
};

describe("orders service — confirm (HU-04)", () => {
  it("moves the draft to pending_payment with prices refreshed and the total recomputed", async () => {
    const draft = await readyDraft();
    mem.product("p-b").priceClp = 5500; // price changed after it was added

    const summary = await service.confirm({ residentId: RESIDENT, expectedVersion: draft.version });

    expect(summary).toMatchObject({
      id: draft.id,
      status: "pending_payment",
      statusLabel: "Pendiente de pago",
      fulfillment: "pickup",
      totalClp: 2 * 2000 + 5500,
      version: draft.version + 1,
    });
    expect(mem.linesOf(draft.id).find((line) => line.productId === "p-b")).toMatchObject({
      unitPriceClp: 5500,
      lineTotalClp: 5500,
    });
    expect(mem.state.events.at(-1)).toEqual({
      orderId: draft.id,
      from: "draft",
      to: "pending_payment",
      actorId: RESIDENT,
      actorRole: "resident",
      note: null,
    });
    expect(mem.state.audit).toEqual([
      expect.objectContaining({
        action: "order.transition",
        entityId: draft.id,
        before: { status: "draft", version: draft.version },
        after: { status: "pending_payment", version: draft.version + 1 },
      }),
    ]);
    // Confirming neither reserves nor discounts stock (D-02).
    expect([mem.product("p-a").onHand, mem.product("p-b").onHand]).toEqual([4, 10]);
    expect(mem.state.movements).toEqual([]);
  });

  it("answers NOT_FOUND without a draft", async () => {
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a stale version (the person reviewed an older cart)", async () => {
    const draft = await readyDraft();
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: draft.version - 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "STALE_VERSION" } });
    expect(mem.statusOf(draft.id)).toBe("draft");
  });

  it("rejects an empty draft", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-a", quantity: 1 });
    const draft = await service.removeItem({ residentId: RESIDENT, productId: "p-a" });
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: draft.version }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "EMPTY_ORDER" } });
  });

  it("rejects a draft without fulfillment, naming the pending field", async () => {
    const draft = await service.addItem({ residentId: RESIDENT, productId: "p-a", quantity: 1 });
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: draft.version }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      details: { reason: "INCOMPLETE_FULFILLMENT", fields: ["fulfillment"] },
    });
    expect(mem.statusOf(draft.id)).toBe("draft");
  });

  it("re-validates availability: stock consumed since adding blocks the confirmation", async () => {
    const draft = await readyDraft();
    mem.product("p-a").onHand = 1;
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: draft.version }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: {
        reason: "INSUFFICIENT_STOCK",
        lines: [
          { productId: "p-a", commercialName: "Escitalopram 10 mg", requested: 2, available: 1 },
        ],
      },
    });
    expect(mem.statusOf(draft.id)).toBe("draft");
    expect(mem.state.audit).toEqual([]);
  });

  it("rejects products deactivated since they were added", async () => {
    const draft = await readyDraft();
    mem.product("p-b").active = false;
    await expect(
      service.confirm({ residentId: RESIDENT, expectedVersion: draft.version }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "PRODUCT_UNAVAILABLE", products: [{ productId: "p-b" }] },
    });
  });
});

describe("orders service — cancel", () => {
  it("cancels a pending order of the owner with an event and no stock change", async () => {
    mem.addOrder({
      id: "o1",
      residentId: RESIDENT,
      status: "pending_payment",
      fulfillment: "pickup",
      version: 2,
    });
    const summary = await service.cancel({
      residentId: RESIDENT,
      id: "o1",
      expectedVersion: 2,
      note: "Ya no lo necesito",
    });
    expect(summary).toMatchObject({ status: "cancelled", statusLabel: "Cancelado", version: 3 });
    expect(mem.state.events).toEqual([
      expect.objectContaining({
        from: "pending_payment",
        to: "cancelled",
        note: "Ya no lo necesito",
      }),
    ]);
    expect(mem.state.movements).toEqual([]);
  });

  it("restores the sold units when cancelling a paid order", async () => {
    mem.addOrder({
      id: "o1",
      residentId: RESIDENT,
      status: "payment_validated",
      fulfillment: "pickup",
      version: 3,
    });
    mem.product("p-a").onHand = 2;
    mem.state.movements.push({
      productId: "p-a",
      delta: -2,
      reason: "sale",
      orderId: "o1",
      paymentId: "pay-1",
      actorId: null,
      quantityBefore: 4,
      quantityAfter: 2,
      note: null,
    });

    await service.cancel({ residentId: RESIDENT, id: "o1", expectedVersion: 3 });

    expect(mem.product("p-a").onHand).toBe(4);
    expect(mem.state.movements.at(-1)).toMatchObject({
      reason: "cancellation_restore",
      delta: 2,
      quantityBefore: 2,
      quantityAfter: 4,
      actorId: RESIDENT,
    });
    expect(mem.state.audit.map((entry) => entry.action)).toEqual([
      "order.transition",
      "stock.restore",
    ]);
  });

  it("answers NOT_FOUND for another account's order, without changing it", async () => {
    mem.addOrder({
      id: "o1",
      residentId: "resident-2",
      status: "pending_payment",
      fulfillment: "pickup",
    });
    await expect(
      service.cancel({ residentId: RESIDENT, id: "o1", expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "No encontramos ese pedido." });
    expect(mem.statusOf("o1")).toBe("pending_payment");
  });

  it("rejects cancelling once the order is in preparation and keeps its status", async () => {
    mem.addOrder({
      id: "o1",
      residentId: RESIDENT,
      status: "in_preparation",
      fulfillment: "pickup",
    });
    await expect(
      service.cancel({ residentId: RESIDENT, id: "o1", expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { reason: "INVALID_TRANSITION" } });
    expect(mem.statusOf("o1")).toBe("in_preparation");
    expect(mem.state.events).toEqual([]);
  });
});
