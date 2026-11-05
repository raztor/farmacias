import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import {
  availabilityLevel,
  discountForOrder,
  normalizeStockLines,
  restoreForOrder,
} from "./inventory.service";

const SYSTEM = { actorId: null, actorRole: "system" } as const;

let mem: InMemoryOrdering;
const deps = () => ({ store: mem.inventoryStore(), audit: mem.auditWriter() });

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-c", onHand: 5 });
  mem.addProduct({ id: "p-a", onHand: 2 });
  mem.addProduct({ id: "p-b", onHand: 1 });
});

describe("availabilityLevel", () => {
  it.each([
    [0, 5, "out"],
    [-1, 5, "out"],
    [1, 5, "low"],
    [5, 5, "low"],
    [6, 5, "available"],
    [1, 0, "available"],
  ] as const)("onHand %i with threshold %i is %s", (onHand, threshold, level) => {
    expect(availabilityLevel(onHand, threshold)).toBe(level);
  });
});

describe("discountForOrder", () => {
  it("merges duplicated products and sorts the lines by product id", () => {
    expect(
      normalizeStockLines([
        { productId: "p-c", quantity: 1 },
        { productId: "p-a", quantity: 1 },
        { productId: "p-c", quantity: 2 },
      ]),
    ).toEqual([
      { productId: "p-a", quantity: 1 },
      { productId: "p-c", quantity: 3 },
    ]);
  });

  it("locks in product order and discounts every line with movements and audit (HU-06 #1)", async () => {
    const result = await discountForOrder(deps(), {
      orderId: "o1",
      paymentId: "pay-1",
      lines: [
        { productId: "p-c", quantity: 4 },
        { productId: "p-a", quantity: 2 },
      ],
      actor: SYSTEM,
    });

    expect(result.ok).toBe(true);
    expect(mem.state.locks).toEqual([["p-a", "p-c"]]);
    expect([mem.product("p-a").onHand, mem.product("p-c").onHand]).toEqual([0, 1]);
    expect(mem.state.movements).toEqual([
      expect.objectContaining({
        productId: "p-a",
        delta: -2,
        reason: "sale",
        quantityBefore: 2,
        quantityAfter: 0,
        paymentId: "pay-1",
      }),
      expect.objectContaining({
        productId: "p-c",
        delta: -4,
        reason: "sale",
        quantityBefore: 5,
        quantityAfter: 1,
      }),
    ]);
    expect(mem.state.audit).toEqual([
      expect.objectContaining({
        action: "stock.sale",
        entityType: "product",
        entityId: "p-a",
        before: { onHand: 2 },
        after: { onHand: 0, orderId: "o1" },
      }),
      expect.objectContaining({
        action: "stock.sale",
        entityId: "p-c",
        before: { onHand: 5 },
        after: { onHand: 1, orderId: "o1" },
      }),
    ]);
  });

  it("returns every conflict and changes nothing when one line lacks stock (HU-06 #2)", async () => {
    const result = await discountForOrder(deps(), {
      orderId: "o1",
      paymentId: "pay-1",
      lines: [
        { productId: "p-a", quantity: 1 },
        { productId: "p-b", quantity: 2 },
        { productId: "p-missing", quantity: 1 },
      ],
      actor: SYSTEM,
    });

    expect(result).toEqual({
      ok: false,
      conflicts: [
        { productId: "p-b", requested: 2, available: 1 },
        { productId: "p-missing", requested: 1, available: 0 },
      ],
    });
    expect(mem.product("p-a").onHand).toBe(2);
    expect(mem.state.movements).toEqual([]);
    expect(mem.state.audit).toEqual([]);
  });

  it("fails loudly if the stock changed under the lock (the transaction rolls back)", async () => {
    const store = { ...mem.inventoryStore(), decrement: () => Promise.resolve(null) };
    await expect(
      discountForOrder(
        { store, audit: mem.auditWriter() },
        {
          orderId: "o1",
          paymentId: "pay-1",
          lines: [{ productId: "p-a", quantity: 1 }],
          actor: SYSTEM,
        },
      ),
    ).rejects.toThrow(/under lock/);
  });
});

describe("restoreForOrder", () => {
  const sell = async () =>
    discountForOrder(deps(), {
      orderId: "o1",
      paymentId: "pay-1",
      lines: [
        { productId: "p-a", quantity: 2 },
        { productId: "p-c", quantity: 1 },
      ],
      actor: SYSTEM,
    });

  it("restores exactly what was sold, with movements and audit", async () => {
    await sell();
    const actor = { actorId: "operator-1", actorRole: "operator" } as const;
    const result = await restoreForOrder(deps(), { orderId: "o1", actor, note: "Cancelado" });

    expect(result.alreadyRestored).toBe(false);
    expect([mem.product("p-a").onHand, mem.product("p-c").onHand]).toEqual([2, 5]);
    expect(result.movements).toEqual([
      expect.objectContaining({
        productId: "p-a",
        delta: 2,
        reason: "cancellation_restore",
        quantityBefore: 0,
        quantityAfter: 2,
        actorId: "operator-1",
        note: "Cancelado",
      }),
      expect.objectContaining({ productId: "p-c", delta: 1, quantityBefore: 4, quantityAfter: 5 }),
    ]);
    expect(mem.state.audit.filter((entry) => entry.action === "stock.restore")).toHaveLength(2);
  });

  it("is idempotent", async () => {
    await sell();
    await restoreForOrder(deps(), { orderId: "o1", actor: SYSTEM });
    const again = await restoreForOrder(deps(), { orderId: "o1", actor: SYSTEM });
    expect(again).toEqual({ movements: [], alreadyRestored: true });
    expect(mem.product("p-a").onHand).toBe(2);
  });

  it("does nothing for an order that never discounted stock", async () => {
    await expect(restoreForOrder(deps(), { orderId: "o9", actor: SYSTEM })).resolves.toEqual({
      movements: [],
      alreadyRestored: false,
    });
    expect(mem.state.locks).toEqual([]);
  });

  it("fails loudly when an inventory row disappeared", async () => {
    await sell();
    const store = { ...mem.inventoryStore(), increment: () => Promise.resolve(null) };
    await expect(
      restoreForOrder({ store, audit: mem.auditWriter() }, { orderId: "o1", actor: SYSTEM }),
    ).rejects.toThrow(/missing/);
  });
});
